/**
 * @erc8001/sdk - Utility Functions
 *
 * Helpers for participant canonicalization, coordination types, etc.
 */

import {
  type Address,
  type Hash,
  type Hex,
  keccak256,
  encodePacked,
  getAddress,
} from 'viem';

import type {
  AgentIntent,
  CoordinationPayload,
  CreateIntentOptions,
  CreateAttestationOptions,
  AcceptanceAttestation,
  ActionBound,
} from './types';

import { computePayloadHash } from './eip712';

// ═══════════════════════════════════════════════════════════════════════════
// PARTICIPANT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canonicalize participants: sort ascending by uint160(address), deduplicate.
 * Per spec: participants MUST be strictly ascending by uint160(address) and deduplicated.
 */
export function canonicalizeParticipants(participants: Address[]): Address[] {
  // Checksum and deduplicate
  const uniqueSet = new Set(participants.map(p => getAddress(p)));
  const unique = Array.from(uniqueSet);

  // Sort by uint160 (address as bigint)
  return unique.sort((a, b) => {
    const aNum = BigInt(a);
    const bNum = BigInt(b);
    if (aNum < bNum) return -1;
    if (aNum > bNum) return 1;
    return 0;
  });
}

/**
 * Validate that participants are canonical.
 * Returns true if sorted ascending and unique.
 */
export function isCanonical(participants: Address[]): boolean {
  for (let i = 1; i < participants.length; i++) {
    if (BigInt(participants[i]) <= BigInt(participants[i - 1])) {
      return false;
    }
  }
  return true;
}

/**
 * Check if an address is in the participants list.
 */
export function isParticipant(address: Address, participants: Address[]): boolean {
  const checksummed = getAddress(address);
  return participants.some(p => getAddress(p) === checksummed);
}

// ═══════════════════════════════════════════════════════════════════════════
// COORDINATION TYPE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a coordination type hash from a string.
 * e.g., "TRADE_V1" => keccak256("TRADE_V1")
 */
export function coordinationType(name: string): Hash {
  return keccak256(encodePacked(['string'], [name]));
}

/**
 * Common coordination types.
 */
export const CoordinationTypes = {
  TRADE: coordinationType('ERC8001.TRADE_V1'),
  SWAP: coordinationType('ERC8001.SWAP_V1'),
  PAYMENT: coordinationType('ERC8001.PAYMENT_V1'),
  GAME_ACTION: coordinationType('ERC8001.GAME_ACTION_V1'),
  DAO_PROPOSAL: coordinationType('ERC8001.DAO_PROPOSAL_V1'),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// INTENT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an AgentIntent from options.
 * Automatically:
 * - Canonicalizes participants
 * - Ensures agentId is in participants
 * - Computes payload hash
 * - Sets expiry based on TTL
 *
 * @param options Intent creation options
 * @param nonce Current nonce for the agent (fetch with getAgentNonce)
 * @returns The complete AgentIntent ready for signing
 */
export function createIntent(
    options: CreateIntentOptions,
    nonce: bigint
): { intent: AgentIntent; payload: CoordinationPayload } {
  // Ensure agentId is in participants
  let participants = [...options.participants];
  if (!isParticipant(options.agentId, participants)) {
    participants.push(options.agentId);
  }

  // Canonicalize
  participants = canonicalizeParticipants(participants);

  // Build payload
  const payload: CoordinationPayload = {
    ...options.payload,
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
  };

  // Compute payload hash
  const payloadHash = computePayloadHash(payload);

  // Compute expiry
  const ttl = options.ttlSeconds ?? 3600; // Default 1 hour
  const expiry = BigInt(Math.floor(Date.now() / 1000) + ttl);

  // Handle coordinationType as string or hash
  let coordType: Hash;
  if (options.coordinationType.startsWith('0x') && options.coordinationType.length === 66) {
    coordType = options.coordinationType as Hash;
  } else {
    coordType = coordinationType(options.coordinationType);
  }

  const intent: AgentIntent = {
    payloadHash,
    expiry,
    nonce: nonce + 1n, // Next nonce
    agentId: options.agentId,
    coordinationType: coordType,
    coordinationValue: options.coordinationValue ?? 0n,
    participants,
  };

  return { intent, payload };
}

/**
 * Create an AcceptanceAttestation (without signature).
 * Call signAcceptance() to add the signature.
 */
export function createAttestation(
    options: CreateAttestationOptions,
    nonce?: bigint
): Omit<AcceptanceAttestation, 'signature'> {
  const ttl = options.ttlSeconds ?? 3600; // Default 1 hour
  const expiry = BigInt(Math.floor(Date.now() / 1000) + ttl);

  return {
    intentHash: options.intentHash,
    participant: options.participant,
    nonce: nonce ?? 0n,
    expiry,
    conditionsHash: options.conditionsHash ?? ('0x' + '0'.repeat(64)) as Hash,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BOUNDED EXECUTION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the Merkle leaf for an action bound.
 * Leaf = keccak256(abi.encodePacked(target, selector))
 */
export function computeActionLeaf(action: ActionBound): Hash {
  return keccak256(
      encodePacked(['address', 'bytes4'], [action.target, action.selector as Hex])
  );
}

/**
 * Compute the Merkle root for a list of actions.
 * For a single action, the root equals the leaf.
 */
export function computeBoundsRoot(actions: ActionBound[]): Hash {
  if (actions.length === 0) {
    throw new Error('At least one action required');
  }

  // Compute leaves
  let leaves = actions.map(computeActionLeaf);

  // Pad to power of 2
  while (leaves.length > 1 && (leaves.length & (leaves.length - 1)) !== 0) {
    leaves.push(leaves[leaves.length - 1]);
  }

  // Build tree bottom-up
  while (leaves.length > 1) {
    const nextLevel: Hash[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = leaves[i + 1] ?? left;
      nextLevel.push(hashPair(left, right));
    }
    leaves = nextLevel;
  }

  return leaves[0];
}

/**
 * Generate Merkle proof for an action.
 */
export function generateProof(actions: ActionBound[], index: number): Hash[] {
  if (index >= actions.length) {
    throw new Error('Index out of bounds');
  }

  let leaves = actions.map(computeActionLeaf);

  // Pad to power of 2
  while (leaves.length > 1 && (leaves.length & (leaves.length - 1)) !== 0) {
    leaves.push(leaves[leaves.length - 1]);
  }

  const proof: Hash[] = [];
  let idx = index;

  while (leaves.length > 1) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (siblingIdx < leaves.length) {
      proof.push(leaves[siblingIdx]);
    }

    const nextLevel: Hash[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = leaves[i + 1] ?? left;
      nextLevel.push(hashPair(left, right));
    }
    leaves = nextLevel;
    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Hash a pair of nodes in sorted order (for deterministic trees).
 */
function hashPair(a: Hash, b: Hash): Hash {
  const [first, second] = BigInt(a) < BigInt(b) ? [a, b] : [b, a];
  return keccak256(encodePacked(['bytes32', 'bytes32'], [first, second]));
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate an AgentIntent before submission.
 * Throws if invalid.
 */
export function validateIntent(intent: AgentIntent): void {
  // Check expiry is in future
  if (intent.expiry <= BigInt(Math.floor(Date.now() / 1000))) {
    throw new Error('Intent already expired');
  }

  // Check participants are canonical
  if (!isCanonical(intent.participants)) {
    throw new Error('Participants not canonical (must be sorted ascending)');
  }

  // Check agentId is in participants
  if (!isParticipant(intent.agentId, intent.participants)) {
    throw new Error('agentId must be in participants');
  }

  // Check at least one participant
  if (intent.participants.length === 0) {
    throw new Error('At least one participant required');
  }
}

/**
 * Validate an AcceptanceAttestation before submission.
 * Throws if invalid.
 */
export function validateAttestation(
    attestation: AcceptanceAttestation,
    participants: Address[]
): void {
  // Check expiry is in future
  if (attestation.expiry <= BigInt(Math.floor(Date.now() / 1000))) {
    throw new Error('Attestation already expired');
  }

  // Check participant is in list
  if (!isParticipant(attestation.participant, participants)) {
    throw new Error('Participant not in required list');
  }

  // Check signature exists
  if (!attestation.signature || attestation.signature === '0x') {
    throw new Error('Missing signature');
  }
}