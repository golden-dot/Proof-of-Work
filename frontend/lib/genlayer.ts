import {
  createClient,
} from "genlayer-js";

import {
  testnetBradbury,
} from "genlayer-js/chains";

import {
  TransactionStatus,
} from "genlayer-js/types";

import {
  encodeFunctionData,
  decodeFunctionResult,
} from "viem";

/**
 * ProofWork Intelligent Contract
 *
 * Hard-coded intentionally.
 */
export const CONTRACT_ADDRESS =
  "0x4F0b22649e8503886761E87Aafe86869b4E444c5" as `0x${string}`;

/**
 * GenLayer Testnet Bradbury
 */
export const BRADBURY_CHAIN_ID =
  "0x107D";

export const BRADBURY_CHAIN_ID_DECIMAL =
  4221;

export const BRADBURY_RPC =
  "https://rpc-bradbury.genlayer.com";

export const BRADBURY_EXPLORER =
  "https://explorer-bradbury.genlayer.com";

/**
 * Bradbury Fee Manager.
 *
 * This address comes from the current
 * GenLayerJS Bradbury chain definition.
 */
const FEE_MANAGER_ADDRESS =
  testnetBradbury.feeManagerContract
    ?.address as `0x${string}`;

/**
 * Fee Manager ABI.
 *
 * We intentionally do NOT call quoteGasPrice().
 * That is the Bradbury call currently causing
 * your transaction flow to revert.
 */
const FEE_MANAGER_ABI = [
  {
    type: "function",
    name: "GENPerTimeUnit",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },

  {
    type: "function",
    name: "storageUnitPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },

  {
    type: "function",
    name: "messageFeeParamsBudgetFloor",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },

  {
    type: "function",
    name: "calculateRoundFees",
    stateMutability: "view",
    inputs: [
      {
        name: "_feesDistribution",
        type: "tuple",
        components: [
          {
            name:
              "leaderTimeunitsAllocation",
            type: "uint256",
          },
          {
            name:
              "validatorTimeunitsAllocation",
            type: "uint256",
          },
          {
            name: "appealRounds",
            type: "uint256",
          },
          {
            name:
              "executionBudgetPerRound",
            type: "uint256",
          },
          {
            name:
              "executionConsumed",
            type: "uint256",
          },
          {
            name:
              "totalMessageFees",
            type: "uint256",
          },
          {
            name: "rotations",
            type: "uint256[]",
          },
          {
            name:
              "maxPriceGenPerTimeUnit",
            type: "uint256",
          },
          {
            name:
              "storageFeeMaxGasPrice",
            type: "uint256",
          },
          {
            name:
              "receiptFeeMaxGasPrice",
            type: "uint256",
          },
        ],
      },
      {
        name: "_numOfValidators",
        type: "uint256",
      },
      {
        name: "round",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "totalFeesToPay",
        type: "uint256",
      },
    ],
  },
] as const;

export type ProofWorkResult = {
  id: string;

  title: string;

  criteria: string;

  evidence_url: string;

  status:
    | "OPEN"
    | "SUBMITTED"
    | "VERIFIED"
    | string;

  score: number;

  approved: boolean;

  summary: string;
};

type Eip1193Provider = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;

  on?: (
    event: string,
    listener: (
      ...args: unknown[]
    ) => void,
  ) => void;

  removeListener?: (
    event: string,
    listener: (
      ...args: unknown[]
    ) => void,
  ) => void;
};

/**
 * Get browser wallet.
 */
export function getWalletProvider(): Eip1193Provider {
  const provider = (
    window as Window & {
      ethereum?: Eip1193Provider;
    }
  ).ethereum;

  if (!provider) {
    throw new Error(
      "No browser wallet detected. Install Rabby or another EIP-1193 wallet.",
    );
  }

  return provider;
}

/**
 * Get wallet chain ID.
 */
export async function getWalletChainId() {
  return String(
    await getWalletProvider().request({
      method: "eth_chainId",
    }),
  ).toLowerCase();
}

/**
 * Make sure the wallet is on Bradbury.
 */
export async function ensureBradburyNetwork(
  provider = getWalletProvider(),
) {
  const currentChainId =
    String(
      await provider.request({
        method:
          "eth_chainId",
      }),
    ).toLowerCase();

  if (
    currentChainId ===
    BRADBURY_CHAIN_ID.toLowerCase()
  ) {
    return;
  }

  try {
    await provider.request({
      method:
        "wallet_switchEthereumChain",

      params: [
        {
          chainId:
            BRADBURY_CHAIN_ID,
        },
      ],
    });
  } catch (error: unknown) {
    const code =
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error
        ? Number(
            (
              error as {
                code?: unknown;
              }
            ).code,
          )
        : undefined;

    if (code !== 4902) {
      throw new Error(
        "Please switch your wallet to GenLayer Testnet Bradbury (chain 4221).",
      );
    }

    await provider.request({
      method:
        "wallet_addEthereumChain",

      params: [
        {
          chainId:
            BRADBURY_CHAIN_ID,

          chainName:
            "GenLayer Testnet Bradbury",

          nativeCurrency: {
            name: "GEN",
            symbol: "GEN",
            decimals: 18,
          },

          rpcUrls: [
            BRADBURY_RPC,
          ],

          blockExplorerUrls: [
            BRADBURY_EXPLORER,
          ],
        },
      ],
    });

    await provider.request({
      method:
        "wallet_switchEthereumChain",

      params: [
        {
          chainId:
            BRADBURY_CHAIN_ID,
        },
      ],
    });
  }

  const verifiedChainId =
    String(
      await provider.request({
        method:
          "eth_chainId",
      }),
    ).toLowerCase();

  if (
    verifiedChainId !==
    BRADBURY_CHAIN_ID.toLowerCase()
  ) {
    throw new Error(
      "Wallet is not connected to GenLayer Testnet Bradbury.",
    );
  }
}

/**
 * Read-only GenLayer client.
 */
export function readClient() {
  return createClient({
    chain:
      testnetBradbury,
  });
}

/**
 * Wallet-backed GenLayer client.
 *
 * No MetaMask Snap connection is used.
 */
export function walletClient(
  address: `0x${string}`,
) {
  return createClient({
    chain:
      testnetBradbury,

    account:
      address,

    provider:
      getWalletProvider(),
  });
}

/**
 * Connect wallet.
 */
export async function connectWallet() {
  const provider =
    getWalletProvider();

  const accounts =
    (await provider.request({
      method:
        "eth_requestAccounts",
    })) as string[];

  const address =
    accounts[0] as
      | `0x${string}`
      | undefined;

  if (!address) {
    throw new Error(
      "No wallet account returned.",
    );
  }

  await ensureBradburyNetwork(
    provider,
  );

  const client =
    walletClient(address);

  return {
    address,
    client,
    provider,
  };
}

/**
 * Restore wallet silently.
 */
export async function restoreWallet() {
  const provider =
    getWalletProvider();

  const accounts =
    (await provider.request({
      method:
        "eth_accounts",
    })) as string[];

  const address =
    accounts[0] as
      | `0x${string}`
      | undefined;

  if (!address) {
    return null;
  }

  const chainId =
    String(
      await provider.request({
        method:
          "eth_chainId",
      }),
    ).toLowerCase();

  if (
    chainId !==
    BRADBURY_CHAIN_ID.toLowerCase()
  ) {
    return null;
  }

  const client =
    walletClient(address);

  return {
    address,
    client,
    provider,
  };
}

/**
 * Change account.
 */
export async function changeWallet() {
  const provider =
    getWalletProvider();

  const accounts =
    (await provider.request({
      method:
        "eth_requestAccounts",
    })) as string[];

  const address =
    accounts[0] as
      | `0x${string}`
      | undefined;

  if (!address) {
    throw new Error(
      "No wallet account selected.",
    );
  }

  await ensureBradburyNetwork(
    provider,
  );

  const client =
    walletClient(address);

  return {
    address,
    client,
    provider,
  };
}

/**
 * Current authorized account.
 */
export async function getConnectedAccount() {
  const accounts =
    (await getWalletProvider().request({
      method:
        "eth_accounts",
    })) as string[];

  return (
    (accounts[0] as
      | `0x${string}`
      | undefined) ??
    null
  );
}

/**
 * Read ProofWork state.
 */
export async function getWork(
  workId: string,
): Promise<ProofWorkResult> {
  const result =
    await readClient().readContract({
      address:
        CONTRACT_ADDRESS,

      functionName:
        "get_work",

      args: [workId],
    });

  return result as ProofWorkResult;
}

/**
 * Read a uint256 from the Bradbury
 * Fee Manager using raw eth_call.
 */
async function readFeeManagerUint(
  provider: Eip1193Provider,
  functionName:
    | "GENPerTimeUnit"
    | "storageUnitPrice"
    | "messageFeeParamsBudgetFloor",
  gasPrice: string,
): Promise<bigint> {
  const data =
    encodeFunctionData({
      abi:
        FEE_MANAGER_ABI,

      functionName,

      args: [],
    });

  const raw =
    (await provider.request({
      method:
        "eth_call",

      params: [
        {
          to:
            FEE_MANAGER_ADDRESS,

          data,

          gasPrice,
        },

        "latest",
      ],
    })) as `0x${string}`;

  return decodeFunctionResult({
    abi:
      FEE_MANAGER_ABI,

    functionName,

    data: raw,
  }) as bigint;
}

/**
 * Build a Bradbury-compatible fee
 * distribution without calling the
 * problematic quoteGasPrice().
 */
async function buildBradburyFees(
  provider: Eip1193Provider,
) {
  const gasPrice =
    (await provider.request({
      method:
        "eth_gasPrice",
    })) as string;

  const [
    genPerTimeUnit,
    storageUnitPrice,
  ] = await Promise.all([
    readFeeManagerUint(
      provider,
      "GENPerTimeUnit",
      gasPrice,
    ),

    readFeeManagerUint(
      provider,
      "storageUnitPrice",
      gasPrice,
    ),
  ]);

  let messageBudgetFloor =
    0n;

  try {
    messageBudgetFloor =
      await readFeeManagerUint(
        provider,
        "messageFeeParamsBudgetFloor",
        gasPrice,
      );
  } catch {
    /*
     * The SDK itself treats this field as
     * potentially unreliable and recomputes
     * the floor when necessary.
     */
    messageBudgetFloor =
      0n;
  }

  const networkGasPrice =
    BigInt(gasPrice);

  /*
   * Give the live gas price 20% headroom.
   */
  const receiptFeeMaxGasPrice =
    networkGasPrice === 0n
      ? 1n
      : (
          networkGasPrice *
            12_000n +
          9_999n
        ) /
          10_000n;

  const maxPriceGenPerTimeUnit =
    genPerTimeUnit === 0n
      ? 0n
      : (
          genPerTimeUnit *
            12_000n +
          9_999n
        ) /
          10_000n;

  const storageFeeMaxGasPrice =
    storageUnitPrice === 0n
      ? 0n
      : (
          storageUnitPrice *
            12_000n +
          9_999n
        ) /
          10_000n;

  /*
   * Same baseline used by current
   * GenLayerJS fee estimation.
   */
  const defaultExecutionBudget =
    500_000n;

  const transactionExecutionGas =
    100_000_000n;

  const executionBudgetFromGas =
    receiptFeeMaxGasPrice *
    transactionExecutionGas;

  const executionBudgetPerRound =
    maxBigInt(
      defaultExecutionBudget,
      messageBudgetFloor,
      executionBudgetFromGas,
    );

  const distribution = {
    leaderTimeunitsAllocation:
      100n,

    validatorTimeunitsAllocation:
      200n,

    appealRounds:
      0n,

    executionBudgetPerRound,

    executionConsumed:
      0n,

    totalMessageFees:
      0n,

    rotations: [0n],

    maxPriceGenPerTimeUnit,

    storageFeeMaxGasPrice,

    receiptFeeMaxGasPrice,
  };

  const calculateData =
    encodeFunctionData({
      abi:
        FEE_MANAGER_ABI,

      functionName:
        "calculateRoundFees",

      args: [
        distribution,
        5n,
        0n,
      ],
    });

  const roundFeeRaw =
    (await provider.request({
      method:
        "eth_call",

      params: [
        {
          to:
            FEE_MANAGER_ADDRESS,

          data:
            calculateData,

          gasPrice,
        },

        "latest",
      ],
    })) as `0x${string}`;

  const roundFees =
    decodeFunctionResult({
      abi:
        FEE_MANAGER_ABI,

      functionName:
        "calculateRoundFees",

      data:
        roundFeeRaw,
    }) as bigint;

  return {
    distribution,

    messageAllocations:
      [],

    feeValue:
      roundFees,
  };
}

function maxBigInt(
  ...values: bigint[]
) {
  let result =
    values[0] ?? 0n;

  for (
    const value of values
  ) {
    if (value > result) {
      result = value;
    }
  }

  return result;
}

type WriteFunction =
  | "create_work"
  | "submit_evidence"
  | "verify_work";

/**
 * Send a ProofWork transaction.
 *
 * This bypasses the broken Bradbury
 * quoteGasPrice() estimation path.
 */
export async function sendWrite(
  client: ReturnType<
    typeof walletClient
  >,
  functionName: WriteFunction,
  args: string[],
) {
  const provider =
    getWalletProvider();

  await ensureBradburyNetwork(
    provider,
  );

  const fees =
    await buildBradburyFees(
      provider,
    );

  const write = {
    address:
      CONTRACT_ADDRESS,

    functionName,

    args,
  } as const;

  const txHash =
    await client.writeContract({
      ...write,

      fees: {
        distribution:
          fees.distribution,

        messageAllocations:
          fees.messageAllocations,

        feeValue:
          fees.feeValue,
      },
    });

  const receipt =
    await client.waitForTransactionReceipt(
      {
        hash: txHash,

        status:
          TransactionStatus.FINALIZED,

        fullTransaction: false,
      },
    );

  return {
    txHash,
    receipt,
  };
}
