/**
 * @erc8001/sdk - Type Definitions
 * 
 * TypeScript types matching the ERC-8001 Solidity structs exactly.
 * See https://eips.ethereum.org/EIPS/eip-8001
 */

import type { Address, Hash, Hex } from 'viem';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Coordination lifecycle status.
 * Matches the Solidity enum exactly.
 */
export enum Status {
  None = 0,       // Default zero state (intent not found)
  Proposed = 1,   // Intent proposed, not all acceptances yet
  Ready = 2,      // All participants have accepted, intent executable
  Executed = 3,   // Intent successfully executed
  Cancelled = 4,  // Intent explicitly cancelled
  Expired = 5,    // Intent expired before execution
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The core intent structure signed by the proposer.
 */
export interface AgentIntent {
  /** keccak256(CoordinationPayload) */
  payloadHash: Hash;
  /** Unix seconds; MUST be > block.timestamp at propose */
  expiry: bigint;
  /** Per-agent nonce; MUST be > agentNonces[agentId] */
  nonce: bigint;
  /** Initiator and signer of the intent */
  agentId: Address;
  /** Domain-specific type id, e.g. keccak256("TRADE_V1") */
  coordinationType: Hash;
  /** Informational in Core; modules MAY bind value */
  coordinationValue: bigint;
  /** Unique, ascending; MUST include agentId */
  participants: Address[];
}

/**
 * Application-specific coordination payload.
 */
export interface CoordinationPayload {
  /** Payload format id */
  version: Hash;
  /** MUST equal AgentIntent.coordinationType */
  coordinationType: Hash;
  /** Opaque to Core */
  coordinationData: Hex;
  /** Domain-specific */
  conditionsHash: Hash;
  /** Creation time (informational) */
  timestamp: bigint;
  /** Optional */
  metadata: Hex;
}

/**
 * Acceptance attestation signed by each participant.
 */
export interface AcceptanceAttestation {
  /** getIntentHash(intent) - MUST be struct hash, not digest */
  intentHash: Hash;
  /** Signer */
  participant: Address;
  /** Optional in Core; see spec Nonces section */
  nonce: bigint;
  /** Acceptance validity; MUST be > now at accept and execute */
  expiry: bigint;
  /** Participant constraints */
  conditionsHash: Hash;
  /** ECDSA (65 or 64 bytes) or ERC-1271 */
  signature: Hex;
}

// ═══════════════════════════════════════════════════════════════════════════
// COORDINATION STATUS RESULT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result from getCoordinationStatus()
 */
export interface CoordinationStatus {
  status: Status;
  proposer: Address;
  participants: Address[];
  acceptedBy: Address[];
  expiry: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════
// BOUNDED EXECUTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Policy for bounded agent execution.
 */
export interface Policy {
  /** Merkle root of allowed actions */
  boundsRoot: Hash;
  /** Maximum total spending */
  spendingLimit: bigint;
  /** Amount spent so far */
  spent: bigint;
  /** Earliest execution time */
  windowStart: bigint;
  /** Latest execution time */
  windowEnd: bigint;
  /** Remaining calls allowed */
  callsRemaining: bigint;
  /** Whether policy is active */
  active: boolean;
}

/**
 * Action leaf for Merkle proof (target + selector).
 */
export interface ActionBound {
  target: Address;
  selector: Hex; // bytes4
}

// ═══════════════════════════════════════════════════════════════════════════
// EIP-712 TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EIP-712 domain for ERC-8001.
 * MUST be: {name: "ERC-8001", version: "1", chainId, verifyingContract}
 */
export interface ERC8001Domain {
  name: 'ERC-8001';
  version: '1';
  chainId: bigint;
  verifyingContract: Address;
}

/**
 * EIP-712 typed data for signing.
 */
export interface TypedData<T> {
  domain: ERC8001Domain;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: T;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CoordinationProposedEvent {
  intentHash: Hash;
  proposer: Address;
  coordinationType: Hash;
  participantCount: bigint;
  coordinationValue: bigint;
}

export interface CoordinationAcceptedEvent {
  intentHash: Hash;
  participant: Address;
  acceptanceHash: Hash;
  acceptedCount: bigint;
  requiredCount: bigint;
}

export interface CoordinationExecutedEvent {
  intentHash: Hash;
  executor: Address;
  success: boolean;
  gasUsed: bigint;
  result: Hex;
}

export interface CoordinationCancelledEvent {
  intentHash: Hash;
  canceller: Address;
  reason: string;
  finalStatus: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILDER HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for creating an AgentIntent.
 */
export interface CreateIntentOptions {
  /** The proposing agent's address */
  agentId: Address;
  /** Required participants (will be auto-sorted) */
  participants: Address[];
  /** Domain-specific coordination type */
  coordinationType: Hash | string;
  /** Optional value */
  coordinationValue?: bigint;
  /** Time-to-live in seconds (default: 1 hour) */
  ttlSeconds?: number;
  /** The coordination payload */
  payload: Omit<CoordinationPayload, 'timestamp'>;
}

/**
 * Options for creating an AcceptanceAttestation.
 */
export interface CreateAttestationOptions {
  /** The intent struct hash */
  intentHash: Hash;
  /** The accepting participant */
  participant: Address;
  /** Optional conditions */
  conditionsHash?: Hash;
  /** Time-to-live in seconds (default: 1 hour) */
  ttlSeconds?: number;
}

/**
 * Options for registering a bounded execution policy.
 */
export interface CreatePolicyOptions {
  /** Agent address */
  agent: Address;
  /** Allowed actions */
  actions: ActionBound[];
  /** Maximum total spending (in wei) */
  spendingLimit: bigint;
  /** Maximum number of calls */
  maxCalls: number;
  /** Duration in seconds */
  durationSeconds: number;
}
