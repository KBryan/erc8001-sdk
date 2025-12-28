/**
 * @erc8001/sdk - Bounded Execution Client
 * 
 * Client for policy-enforced bounded agent execution.
 */

import {
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
} from 'viem';

import type {
  Policy,
  ActionBound,
  CreatePolicyOptions,
} from './types';

import {
  computeActionLeaf,
  computeBoundsRoot,
  generateProof,
} from './utils';

import { BOUNDED_EXECUTION_ABI } from './abis/AgentCoordination';

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bounded Execution Client
 * 
 * @example
 * ```ts
 * import { BoundedClient } from '@erc8001/sdk';
 * 
 * const client = new BoundedClient({
 *   contractAddress: '0x...',
 *   publicClient,
 *   walletClient,
 * });
 * 
 * // Register a policy
 * const { policyId } = await client.registerPolicy({
 *   agent: '0x...',
 *   actions: [
 *     { target: '0x...', selector: '0x12345678' },
 *   ],
 *   spendingLimit: parseEther('10'),
 *   maxCalls: 100,
 *   durationSeconds: 86400, // 1 day
 * });
 * 
 * // Execute within bounds
 * await client.execute(policyId, {
 *   target: '0x...',
 *   selector: '0x12345678',
 *   callData: '0x...',
 *   value: parseEther('1'),
 * });
 * ```
 */
export class BoundedClient {
  private readonly contractAddress: Address;
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;

  // Cache of registered policies for proof generation
  private readonly policyActions: Map<string, ActionBound[]> = new Map();

  constructor(options: {
    contractAddress: Address;
    publicClient: PublicClient;
    walletClient?: WalletClient;
  }) {
    this.contractAddress = options.contractAddress;
    this.publicClient = options.publicClient;
    this.walletClient = options.walletClient;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get policy details.
   */
  async getPolicy(policyId: Hash): Promise<Policy> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: BOUNDED_EXECUTION_ABI,
      functionName: 'getPolicy',
      args: [policyId],
    }) as any;

    return {
      boundsRoot: result.boundsRoot,
      spendingLimit: result.spendingLimit,
      spent: result.spent,
      windowStart: result.windowStart,
      windowEnd: result.windowEnd,
      callsRemaining: result.callsRemaining,
      active: result.active,
    };
  }

  /**
   * Get active bounds root for an agent.
   */
  async getActiveBoundsRoot(agent: Address): Promise<Hash> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: BOUNDED_EXECUTION_ABI,
      functionName: 'getActiveBoundsRoot',
      args: [agent],
    }) as Promise<Hash>;
  }

  /**
   * Verify if an action is within bounds.
   */
  async verifyBounds(
    policyId: Hash,
    target: Address,
    callData: Hex,
    value: bigint,
    proof: Hash[]
  ): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: BOUNDED_EXECUTION_ABI,
      functionName: 'verifyBounds',
      args: [policyId, target, callData, value, proof],
    }) as Promise<boolean>;
  }

  /**
   * Get remaining budget for a policy.
   */
  async getRemainingBudget(policyId: Hash): Promise<bigint> {
    const policy = await this.getPolicy(policyId);
    return policy.spendingLimit - policy.spent;
  }

  /**
   * Check if policy is valid (active and within time window).
   */
  async isPolicyValid(policyId: Hash): Promise<boolean> {
    const policy = await this.getPolicy(policyId);
    const now = BigInt(Math.floor(Date.now() / 1000));
    
    return (
      policy.active &&
      now >= policy.windowStart &&
      now < policy.windowEnd &&
      policy.callsRemaining > 0n
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register a new policy.
   */
  async registerPolicy(options: CreatePolicyOptions): Promise<{
    policyId: Hash;
    txHash: Hash;
    boundsRoot: Hash;
  }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    // Compute bounds root
    const boundsRoot = computeBoundsRoot(options.actions);
    
    // Calculate time window
    const now = BigInt(Math.floor(Date.now() / 1000));
    const windowStart = now;
    const windowEnd = now + BigInt(options.durationSeconds);

    // Submit transaction
    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: BOUNDED_EXECUTION_ABI,
      functionName: 'registerPolicy',
      args: [
        options.agent,
        boundsRoot,
        options.spendingLimit,
        windowStart,
        windowEnd,
        BigInt(options.maxCalls),
      ],
    });

    // Wait for receipt to get policyId from event
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    
    // Parse PolicyRegistered event
    const policyRegisteredLog = receipt.logs.find(log => {
      // Check if this is the PolicyRegistered event
      return log.topics[0] === '0x' + 'PolicyRegistered'.padEnd(64, '0'); // Simplified
    });

    // For now, compute policyId the same way the contract does
    // In production, parse from event
    const policyId = receipt.logs[0]?.topics?.[1] as Hash ?? ('0x' + '0'.repeat(64)) as Hash;

    // Cache actions for proof generation
    this.policyActions.set(policyId, options.actions);

    return { policyId, txHash, boundsRoot };
  }

  /**
   * Execute an action within policy bounds.
   */
  async execute(
    policyId: Hash,
    action: {
      target: Address;
      callData: Hex;
      value?: bigint;
    },
    proof?: Hash[]
  ): Promise<{
    txHash: Hash;
    success: boolean;
  }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const value = action.value ?? 0n;

    // Generate proof if not provided
    let merkleProof = proof;
    if (!merkleProof) {
      const actions = this.policyActions.get(policyId);
      if (actions) {
        const selector = action.callData.slice(0, 10) as Hex;
        const actionIndex = actions.findIndex(
          a => a.target.toLowerCase() === action.target.toLowerCase() && 
               a.selector.toLowerCase() === selector.toLowerCase()
        );
        
        if (actionIndex >= 0) {
          merkleProof = generateProof(actions, actionIndex);
        }
      }
    }

    if (!merkleProof) {
      merkleProof = []; // Empty proof for single-action policies
    }

    // Submit transaction
    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: BOUNDED_EXECUTION_ABI,
      functionName: 'executeBounded',
      args: [policyId, action.target, action.callData, value, merkleProof],
    });

    // Wait for receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    
    // Check if execution succeeded (from event)
    const success = receipt.status === 'success';

    return { txHash, success };
  }

  /**
   * Revoke a policy.
   */
  async revokePolicy(policyId: Hash): Promise<{ txHash: Hash }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: BOUNDED_EXECUTION_ABI,
      functionName: 'revokePolicy',
      args: [policyId],
    });

    // Remove from cache
    this.policyActions.delete(policyId);

    return { txHash };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute bounds root without submitting.
   */
  computeBoundsRoot(actions: ActionBound[]): Hash {
    return computeBoundsRoot(actions);
  }

  /**
   * Compute action leaf.
   */
  computeActionLeaf(action: ActionBound): Hash {
    return computeActionLeaf(action);
  }

  /**
   * Generate proof for an action.
   */
  generateProof(actions: ActionBound[], actionIndex: number): Hash[] {
    return generateProof(actions, actionIndex);
  }

  /**
   * Cache policy actions for proof generation.
   */
  cacheActions(policyId: Hash, actions: ActionBound[]): void {
    this.policyActions.set(policyId, actions);
  }
}
