/**
 * @erc8001/sdk - EIP-712 Signing Utilities
 * 
 * Implements the exact EIP-712 typed data structures from the ERC-8001 spec.
 */

import {
  type Address,
  type Hash,
  type Hex,
  type WalletClient,
  keccak256,
  encodePacked,
  encodeAbiParameters,
  parseAbiParameters,
  hashTypedData,
} from 'viem';

import type {
  AgentIntent,
  AcceptanceAttestation,
  CoordinationPayload,
  ERC8001Domain,
  TypedData,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPEHASHES (spec-compliant)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EIP-712 typehash for AgentIntent.
 * MUST match the Solidity constant exactly.
 */
export const AGENT_INTENT_TYPEHASH = keccak256(
  encodePacked(
    ['string'],
    ['AgentIntent(bytes32 payloadHash,uint64 expiry,uint64 nonce,address agentId,bytes32 coordinationType,uint256 coordinationValue,address[] participants)']
  )
);

/**
 * EIP-712 typehash for AcceptanceAttestation.
 * MUST match the Solidity constant exactly.
 */
export const ACCEPTANCE_TYPEHASH = keccak256(
  encodePacked(
    ['string'],
    ['AcceptanceAttestation(bytes32 intentHash,address participant,uint64 nonce,uint64 expiry,bytes32 conditionsHash)']
  )
);

// ═══════════════════════════════════════════════════════════════════════════
// EIP-712 TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EIP-712 types for AgentIntent signing.
 */
export const AGENT_INTENT_TYPES = {
  AgentIntent: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'expiry', type: 'uint64' },
    { name: 'nonce', type: 'uint64' },
    { name: 'agentId', type: 'address' },
    { name: 'coordinationType', type: 'bytes32' },
    { name: 'coordinationValue', type: 'uint256' },
    { name: 'participants', type: 'address[]' },
  ],
} as const;

/**
 * EIP-712 types for AcceptanceAttestation signing.
 */
export const ACCEPTANCE_TYPES = {
  AcceptanceAttestation: [
    { name: 'intentHash', type: 'bytes32' },
    { name: 'participant', type: 'address' },
    { name: 'nonce', type: 'uint64' },
    { name: 'expiry', type: 'uint64' },
    { name: 'conditionsHash', type: 'bytes32' },
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// HASH COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute keccak256(abi.encodePacked(participants)).
 * Per spec: participants MUST be strictly ascending by uint160(address).
 */
export function computeParticipantsHash(participants: Address[]): Hash {
  return keccak256(encodePacked(['address[]'], [participants]));
}

/**
 * Compute the EIP-712 struct hash for an AgentIntent.
 * Per spec: This is the intentHash (struct hash, not digest).
 */
export function computeIntentStructHash(intent: AgentIntent): Hash {
  const participantsHash = computeParticipantsHash(intent.participants);
  
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, uint64, uint64, address, bytes32, uint256, bytes32'),
      [
        AGENT_INTENT_TYPEHASH,
        intent.payloadHash,
        intent.expiry,
        intent.nonce,
        intent.agentId,
        intent.coordinationType,
        intent.coordinationValue,
        participantsHash,
      ]
    )
  );
}

/**
 * Compute the EIP-712 struct hash for an AcceptanceAttestation.
 * Note: signature is NOT included (it signs this hash).
 */
export function computeAcceptanceStructHash(
  attestation: Omit<AcceptanceAttestation, 'signature'>
): Hash {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, address, uint64, uint64, bytes32'),
      [
        ACCEPTANCE_TYPEHASH,
        attestation.intentHash,
        attestation.participant,
        attestation.nonce,
        attestation.expiry,
        attestation.conditionsHash,
      ]
    )
  );
}

/**
 * Compute the hash of a CoordinationPayload.
 */
export function computePayloadHash(payload: CoordinationPayload): Hash {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, bytes32, bytes32, uint256, bytes32'),
      [
        payload.version,
        payload.coordinationType,
        keccak256(payload.coordinationData),
        payload.conditionsHash,
        payload.timestamp,
        keccak256(payload.metadata),
      ]
    )
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create the ERC-8001 EIP-712 domain.
 * Per spec: {name: "ERC-8001", version: "1", chainId, verifyingContract}
 */
export function createDomain(
  chainId: bigint,
  verifyingContract: Address
): ERC8001Domain {
  return {
    name: 'ERC-8001',
    version: '1',
    chainId,
    verifyingContract,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sign an AgentIntent using EIP-712.
 * Returns the signature to submit with proposeCoordination().
 */
export async function signIntent(
  walletClient: WalletClient,
  domain: ERC8001Domain,
  intent: AgentIntent
): Promise<Hex> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet client has no account');

  return walletClient.signTypedData({
    account,
    domain,
    types: AGENT_INTENT_TYPES,
    primaryType: 'AgentIntent',
    message: {
      payloadHash: intent.payloadHash,
      expiry: intent.expiry,
      nonce: intent.nonce,
      agentId: intent.agentId,
      coordinationType: intent.coordinationType,
      coordinationValue: intent.coordinationValue,
      participants: intent.participants,
    },
  });
}

/**
 * Sign an AcceptanceAttestation using EIP-712.
 * Returns the complete attestation with signature.
 */
export async function signAcceptance(
  walletClient: WalletClient,
  domain: ERC8001Domain,
  attestation: Omit<AcceptanceAttestation, 'signature'>
): Promise<AcceptanceAttestation> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet client has no account');

  const signature = await walletClient.signTypedData({
    account,
    domain,
    types: ACCEPTANCE_TYPES,
    primaryType: 'AcceptanceAttestation',
    message: {
      intentHash: attestation.intentHash,
      participant: attestation.participant,
      nonce: attestation.nonce,
      expiry: attestation.expiry,
      conditionsHash: attestation.conditionsHash,
    },
  });

  return {
    ...attestation,
    signature,
  };
}

/**
 * Compute the full EIP-712 digest for an intent.
 * This is what gets signed by the proposer.
 */
export function computeIntentDigest(
  domain: ERC8001Domain,
  intent: AgentIntent
): Hash {
  return hashTypedData({
    domain,
    types: AGENT_INTENT_TYPES,
    primaryType: 'AgentIntent',
    message: {
      payloadHash: intent.payloadHash,
      expiry: intent.expiry,
      nonce: intent.nonce,
      agentId: intent.agentId,
      coordinationType: intent.coordinationType,
      coordinationValue: intent.coordinationValue,
      participants: intent.participants,
    },
  });
}

/**
 * Compute the full EIP-712 digest for an acceptance.
 * This is what gets signed by participants.
 */
export function computeAcceptanceDigest(
  domain: ERC8001Domain,
  attestation: Omit<AcceptanceAttestation, 'signature'>
): Hash {
  return hashTypedData({
    domain,
    types: ACCEPTANCE_TYPES,
    primaryType: 'AcceptanceAttestation',
    message: {
      intentHash: attestation.intentHash,
      participant: attestation.participant,
      nonce: attestation.nonce,
      expiry: attestation.expiry,
      conditionsHash: attestation.conditionsHash,
    },
  });
}
