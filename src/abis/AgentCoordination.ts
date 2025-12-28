/**
 * @erc8001/sdk - Contract ABIs
 */

export const AGENT_COORDINATION_ABI = [
  // Events
  {
    type: 'event',
    name: 'CoordinationProposed',
    inputs: [
      { name: 'intentHash', type: 'bytes32', indexed: true },
      { name: 'proposer', type: 'address', indexed: true },
      { name: 'coordinationType', type: 'bytes32', indexed: false },
      { name: 'participantCount', type: 'uint256', indexed: false },
      { name: 'coordinationValue', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CoordinationAccepted',
    inputs: [
      { name: 'intentHash', type: 'bytes32', indexed: true },
      { name: 'participant', type: 'address', indexed: true },
      { name: 'acceptanceHash', type: 'bytes32', indexed: false },
      { name: 'acceptedCount', type: 'uint256', indexed: false },
      { name: 'requiredCount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CoordinationExecuted',
    inputs: [
      { name: 'intentHash', type: 'bytes32', indexed: true },
      { name: 'executor', type: 'address', indexed: true },
      { name: 'success', type: 'bool', indexed: false },
      { name: 'gasUsed', type: 'uint256', indexed: false },
      { name: 'result', type: 'bytes', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CoordinationCancelled',
    inputs: [
      { name: 'intentHash', type: 'bytes32', indexed: true },
      { name: 'canceller', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'finalStatus', type: 'uint8', indexed: false },
    ],
  },

  // Read functions
  {
    type: 'function',
    name: 'getAgentNonce',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'getCoordinationStatus',
    stateMutability: 'view',
    inputs: [{ name: 'intentHash', type: 'bytes32' }],
    outputs: [
      { name: 'status', type: 'uint8' },
      { name: 'proposer', type: 'address' },
      { name: 'participants', type: 'address[]' },
      { name: 'acceptedBy', type: 'address[]' },
      { name: 'expiry', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getRequiredAcceptances',
    stateMutability: 'view',
    inputs: [{ name: 'intentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'hasAccepted',
    stateMutability: 'view',
    inputs: [
      { name: 'intentHash', type: 'bytes32' },
      { name: 'participant', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getIntentHash',
    stateMutability: 'pure',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        components: [
          { name: 'payloadHash', type: 'bytes32' },
          { name: 'expiry', type: 'uint64' },
          { name: 'nonce', type: 'uint64' },
          { name: 'agentId', type: 'address' },
          { name: 'coordinationType', type: 'bytes32' },
          { name: 'coordinationValue', type: 'uint256' },
          { name: 'participants', type: 'address[]' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },

  // Write functions
  {
    type: 'function',
    name: 'proposeCoordination',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        components: [
          { name: 'payloadHash', type: 'bytes32' },
          { name: 'expiry', type: 'uint64' },
          { name: 'nonce', type: 'uint64' },
          { name: 'agentId', type: 'address' },
          { name: 'coordinationType', type: 'bytes32' },
          { name: 'coordinationValue', type: 'uint256' },
          { name: 'participants', type: 'address[]' },
        ],
      },
      { name: 'signature', type: 'bytes' },
      {
        name: 'payload',
        type: 'tuple',
        components: [
          { name: 'version', type: 'bytes32' },
          { name: 'coordinationType', type: 'bytes32' },
          { name: 'coordinationData', type: 'bytes' },
          { name: 'conditionsHash', type: 'bytes32' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'metadata', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'intentHash', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'acceptCoordination',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'intentHash', type: 'bytes32' },
      {
        name: 'attestation',
        type: 'tuple',
        components: [
          { name: 'intentHash', type: 'bytes32' },
          { name: 'participant', type: 'address' },
          { name: 'nonce', type: 'uint64' },
          { name: 'expiry', type: 'uint64' },
          { name: 'conditionsHash', type: 'bytes32' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'allAccepted', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'executeCoordination',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'intentHash', type: 'bytes32' },
      {
        name: 'payload',
        type: 'tuple',
        components: [
          { name: 'version', type: 'bytes32' },
          { name: 'coordinationType', type: 'bytes32' },
          { name: 'coordinationData', type: 'bytes' },
          { name: 'conditionsHash', type: 'bytes32' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'metadata', type: 'bytes' },
        ],
      },
      { name: 'executionData', type: 'bytes' },
    ],
    outputs: [
      { name: 'success', type: 'bool' },
      { name: 'result', type: 'bytes' },
    ],
  },
  {
    type: 'function',
    name: 'cancelCoordination',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'intentHash', type: 'bytes32' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
] as const;

export const BOUNDED_EXECUTION_ABI = [
  // Events
  {
    type: 'event',
    name: 'PolicyRegistered',
    inputs: [
      { name: 'policyId', type: 'bytes32', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'boundsRoot', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SpendingUpdated',
    inputs: [
      { name: 'policyId', type: 'bytes32', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'spent', type: 'uint256', indexed: false },
      { name: 'limit', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BoundedExecutionSuccess',
    inputs: [
      { name: 'policyId', type: 'bytes32', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'target', type: 'address', indexed: false },
      { name: 'selector', type: 'bytes4', indexed: false },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BoundedExecutionFailed',
    inputs: [
      { name: 'policyId', type: 'bytes32', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },

  // Read functions
  {
    type: 'function',
    name: 'getPolicy',
    stateMutability: 'view',
    inputs: [{ name: 'policyId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'boundsRoot', type: 'bytes32' },
          { name: 'spendingLimit', type: 'uint256' },
          { name: 'spent', type: 'uint256' },
          { name: 'windowStart', type: 'uint256' },
          { name: 'windowEnd', type: 'uint256' },
          { name: 'callsRemaining', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getActiveBoundsRoot',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'verifyBounds',
    stateMutability: 'view',
    inputs: [
      { name: 'policyId', type: 'bytes32' },
      { name: 'target', type: 'address' },
      { name: 'callData', type: 'bytes' },
      { name: 'value', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [{ name: 'valid', type: 'bool' }],
  },

  // Write functions
  {
    type: 'function',
    name: 'registerPolicy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'boundsRoot', type: 'bytes32' },
      { name: 'spendingLimit', type: 'uint256' },
      { name: 'windowStart', type: 'uint256' },
      { name: 'windowEnd', type: 'uint256' },
      { name: 'maxCalls', type: 'uint256' },
    ],
    outputs: [{ name: 'policyId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'executeBounded',
    stateMutability: 'payable',
    inputs: [
      { name: 'policyId', type: 'bytes32' },
      { name: 'target', type: 'address' },
      { name: 'callData', type: 'bytes' },
      { name: 'value', type: 'uint256' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [
      { name: 'success', type: 'bool' },
      { name: 'returnData', type: 'bytes' },
    ],
  },
  {
    type: 'function',
    name: 'revokePolicy',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'policyId', type: 'bytes32' }],
    outputs: [],
  },
] as const;
