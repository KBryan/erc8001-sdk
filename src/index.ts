/**
 * @erc8001/sdk
 * 
 * TypeScript SDK for ERC-8001 Agent Coordination Framework
 * 
 * @example
 * ```ts
 * import { 
 *   CoordinationClient, 
 *   BoundedClient,
 *   createIntent,
 *   canonicalizeParticipants,
 * } from '@erc8001/sdk';
 * ```
 * 
 * @see https://eips.ethereum.org/EIPS/eip-8001
 */

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════════════════

export { CoordinationClient } from './coordination';
export { BoundedClient } from './bounded';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Enums
  Status,
  
  // Core structs
  type AgentIntent,
  type CoordinationPayload,
  type AcceptanceAttestation,
  type CoordinationStatus,
  
  // Bounded execution
  type Policy,
  type ActionBound,
  
  // EIP-712
  type ERC8001Domain,
  type TypedData,
  
  // Events
  type CoordinationProposedEvent,
  type CoordinationAcceptedEvent,
  type CoordinationExecutedEvent,
  type CoordinationCancelledEvent,
  
  // Builder options
  type CreateIntentOptions,
  type CreateAttestationOptions,
  type CreatePolicyOptions,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// EIP-712 UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Typehashes
  AGENT_INTENT_TYPEHASH,
  ACCEPTANCE_TYPEHASH,
  
  // Type definitions
  AGENT_INTENT_TYPES,
  ACCEPTANCE_TYPES,
  
  // Hash computation
  computeParticipantsHash,
  computeIntentStructHash,
  computeAcceptanceStructHash,
  computePayloadHash,
  
  // Domain
  createDomain,
  
  // Signing
  signIntent,
  signAcceptance,
  
  // Digests
  computeIntentDigest,
  computeAcceptanceDigest,
} from './eip712';

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Participants
  canonicalizeParticipants,
  isCanonical,
  isParticipant,
  
  // Coordination types
  coordinationType,
  CoordinationTypes,
  
  // Builders
  createIntent,
  createAttestation,
  
  // Bounded execution
  computeActionLeaf,
  computeBoundsRoot,
  generateProof,
  
  // Validation
  validateIntent,
  validateAttestation,
} from './utils';

// ═══════════════════════════════════════════════════════════════════════════
// ABIS
// ═══════════════════════════════════════════════════════════════════════════

export {
  AGENT_COORDINATION_ABI,
  BOUNDED_EXECUTION_ABI,
} from './abis/AgentCoordination';
