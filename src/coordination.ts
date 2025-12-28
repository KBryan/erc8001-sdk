/**
 * @erc8001/sdk - Coordination Client
 *
 * High-level client for ERC-8001 Agent Coordination.
 */

import {
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Account,
} from 'viem';

import type {
  AgentIntent,
  AcceptanceAttestation,
  CoordinationPayload,
  CoordinationStatus,
  Status,
  CreateIntentOptions,
  CreateAttestationOptions,
} from './types';

import {
  createDomain,
  signIntent,
  signAcceptance,
  computeIntentStructHash,
} from './eip712';

import {
  createIntent,
  createAttestation,
  validateIntent,
  validateAttestation,
} from './utils';

import { AGENT_COORDINATION_ABI } from './abis/AgentCoordination';

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ERC-8001 Coordination Client
 *
 * @example
 * ```ts
 * import { CoordinationClient } from '@erc8001/sdk';
 * import { createPublicClient, createWalletClient, http } from 'viem';
 * import { baseSepolia } from 'viem/chains';
 *
 * const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
 * const walletClient = createWalletClient({ chain: baseSepolia, transport: http() });
 *
 * const client = new CoordinationClient({
 *   contractAddress: '0x...',
 *   publicClient,
 *   walletClient,
 * });
 *
 * // Propose a coordination
 * const { intentHash } = await client.propose({
 *   agentId: '0x...',
 *   participants: ['0x...', '0x...'],
 *   coordinationType: 'TRADE_V1',
 *   payload: { ... },
 * });
 *
 * // Accept as participant
 * await client.accept(intentHash);
 *
 * // Execute when ready
 * await client.execute(intentHash, payload);
 * ```
 */
export class CoordinationClient {
  private readonly contractAddress: Address;
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly chainId: bigint;
  private readonly chain: Chain;

  constructor(options: {
    contractAddress: Address;
    publicClient: PublicClient;
    walletClient?: WalletClient;
    chainId?: bigint;
    chain?: Chain;
  }) {
    this.contractAddress = options.contractAddress;
    this.publicClient = options.publicClient;
    this.walletClient = options.walletClient;

    const chain = options.chain ?? options.publicClient.chain;
    if (!chain) {
      throw new Error('Chain must be provided either via publicClient or chain option');
    }
    this.chain = chain;
    this.chainId = options.chainId ?? BigInt(chain.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the current nonce for an agent.
   */
  async getAgentNonce(agentId: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'getAgentNonce',
      args: [agentId],
    }) as Promise<bigint>;
  }

  /**
   * Get the coordination status.
   */
  async getStatus(intentHash: Hash): Promise<CoordinationStatus> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'getCoordinationStatus',
      args: [intentHash],
    }) as [number, Address, Address[], Address[], bigint];

    return {
      status: result[0] as Status,
      proposer: result[1],
      participants: result[2],
      acceptedBy: result[3],
      expiry: result[4],
    };
  }

  /**
   * Get required acceptances count.
   */
  async getRequiredAcceptances(intentHash: Hash): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'getRequiredAcceptances',
      args: [intentHash],
    }) as Promise<bigint>;
  }

  /**
   * Check if a participant has accepted.
   */
  async hasAccepted(intentHash: Hash, participant: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'hasAccepted',
      args: [intentHash, participant],
    }) as Promise<boolean>;
  }

  /**
   * Get the domain separator.
   */
  async getDomainSeparator(): Promise<Hash> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'DOMAIN_SEPARATOR',
    }) as Promise<Hash>;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private getAccount(): Account {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client with account required for write operations');
    }
    return this.walletClient.account;
  }

  /**
   * Propose a new coordination.
   *
   * @returns The intent hash and transaction hash
   */
  async propose(options: CreateIntentOptions): Promise<{
    intentHash: Hash;
    txHash: Hash;
    intent: AgentIntent;
    payload: CoordinationPayload;
  }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = this.getAccount();

    // Get current nonce
    const nonce = await this.getAgentNonce(options.agentId);

    // Build intent and payload
    const { intent, payload } = createIntent(options, nonce);

    // Validate
    validateIntent(intent);

    // Compute intent hash
    const intentHash = computeIntentStructHash(intent);

    // Create domain
    const domain = createDomain(this.chainId, this.contractAddress);

    // Sign intent
    const signature = await signIntent(this.walletClient, domain, intent);

    // Submit transaction
    const txHash = await this.walletClient.writeContract({
      account,
      chain: this.chain,
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'proposeCoordination',
      args: [intent, signature, payload],
    });

    return { intentHash, txHash, intent, payload };
  }

  /**
   * Accept a coordination as a participant.
   *
   * @returns The transaction hash
   */
  async accept(
      intentHash: Hash,
      options?: Partial<CreateAttestationOptions>
  ): Promise<{ txHash: Hash; attestation: AcceptanceAttestation }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = this.getAccount();
    const participant = account.address;

    // Get coordination to validate participant
    const status = await this.getStatus(intentHash);

    // Build attestation
    const attestationOptions: CreateAttestationOptions = {
      intentHash,
      participant,
      conditionsHash: options?.conditionsHash,
      ttlSeconds: options?.ttlSeconds,
    };

    const unsignedAttestation = createAttestation(attestationOptions);

    // Create domain
    const domain = createDomain(this.chainId, this.contractAddress);

    // Sign attestation
    const attestation = await signAcceptance(this.walletClient, domain, unsignedAttestation);

    // Validate
    validateAttestation(attestation, status.participants);

    // Submit transaction
    const txHash = await this.walletClient.writeContract({
      account,
      chain: this.chain,
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'acceptCoordination',
      args: [intentHash, attestation],
    });

    return { txHash, attestation };
  }

  /**
   * Execute a ready coordination.
   *
   * @returns The transaction hash and execution result
   */
  async execute(
      intentHash: Hash,
      payload: CoordinationPayload,
      executionData: Hex = '0x'
  ): Promise<{ txHash: Hash }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = this.getAccount();

    // Verify status is Ready
    const status = await this.getStatus(intentHash);
    if (status.status !== 2) { // Status.Ready
      throw new Error(`Coordination not ready. Current status: ${status.status}`);
    }

    // Submit transaction
    const txHash = await this.walletClient.writeContract({
      account,
      chain: this.chain,
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'executeCoordination',
      args: [intentHash, payload, executionData],
    });

    return { txHash };
  }

  /**
   * Cancel a coordination.
   * Before expiry: only proposer can cancel.
   * After expiry: anyone can cancel.
   */
  async cancel(intentHash: Hash, reason: string = ''): Promise<{ txHash: Hash }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = this.getAccount();

    const txHash = await this.walletClient.writeContract({
      account,
      chain: this.chain,
      address: this.contractAddress,
      abi: AGENT_COORDINATION_ABI,
      functionName: 'cancelCoordination',
      args: [intentHash, reason],
    });

    return { txHash };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build an intent without submitting.
   * Useful for multi-party signature collection.
   */
  async buildIntent(options: CreateIntentOptions): Promise<{
    intent: AgentIntent;
    payload: CoordinationPayload;
    intentHash: Hash;
  }> {
    const nonce = await this.getAgentNonce(options.agentId);
    const { intent, payload } = createIntent(options, nonce);
    const intentHash = computeIntentStructHash(intent);

    return { intent, payload, intentHash };
  }

  /**
   * Sign an intent without submitting.
   */
  async signIntent(intent: AgentIntent): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for signing');
    }

    const domain = createDomain(this.chainId, this.contractAddress);
    return signIntent(this.walletClient, domain, intent);
  }

  /**
   * Create and sign an acceptance without submitting.
   */
  async signAcceptance(
      intentHash: Hash,
      options?: Partial<CreateAttestationOptions>
  ): Promise<AcceptanceAttestation> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client with account required for signing');
    }

    const participant = this.walletClient.account.address;

    const attestationOptions: CreateAttestationOptions = {
      intentHash,
      participant,
      conditionsHash: options?.conditionsHash,
      ttlSeconds: options?.ttlSeconds,
    };

    const unsignedAttestation = createAttestation(attestationOptions);
    const domain = createDomain(this.chainId, this.contractAddress);

    return signAcceptance(this.walletClient, domain, unsignedAttestation);
  }

  /**
   * Wait for a coordination to reach Ready status.
   */
  async waitForReady(
      intentHash: Hash,
      options?: { pollIntervalMs?: number; timeoutMs?: number }
  ): Promise<CoordinationStatus> {
    const pollInterval = options?.pollIntervalMs ?? 2000;
    const timeout = options?.timeoutMs ?? 60000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus(intentHash);

      if (status.status === 2) { // Ready
        return status;
      }

      if (status.status >= 3) { // Executed, Cancelled, or Expired
        throw new Error(`Coordination ended with status: ${status.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Timeout waiting for coordination to be ready');
  }
}