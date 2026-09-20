import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import {
  decodeFunctionResult,
  encodeFunctionData,
} from "viem";

/**
 * ============================================================
 * ProofWork configuration
 * ============================================================
 */

export const CONTRACT_ADDRESS =
  "0x4F0b22649e8503886761E87Aafe86869b4E444c5" as `0x${string}`;

export const BRADBURY_CHAIN_ID =
  "0x107D";

export const TESTNET_BRADBURY_CHAIN_ID =
  BRADBURY_CHAIN_ID;

export const BRADBURY_CHAIN_ID_DECIMAL =
  4221;

export const BRADBURY_RPC =
  "https://rpc-bradbury.genlayer.com";

export const BRADBURY_EXPLORER =
  "https://explorer-bradbury.genlayer.com";

/**
 * Current Bradbury Fee Manager address.
 */
const FEE_MANAGER_ADDRESS =
  "0xF205868bf5db79d2162843742D18D0900A9E462a" as `0x${string}`;

/**
 * ============================================================
 * ProofWork result type
 * ============================================================
 */

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

/**
 * ============================================================
 * Browser wallet provider
 * ============================================================
 */

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
 * ============================================================
 * Fee Manager ABI
 *
 * IMPORTANT:
 * We intentionally do NOT include/use quoteGasPrice().
 *
 * The Bradbury Fee Manager quoteGasPrice() call was reverting
 * through the current GenLayerJS estimation path.
 * ============================================================
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

/**
 * ============================================================
 * Wallet helpers
 * ============================================================
 */

export function getWalletProvider(): Eip1193Provider {
  if (
    typeof window ===
    "undefined"
  ) {
    throw new Error(
      "Wallet access is only available in the browser.",
    );
  }

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
 * ============================================================
 * Wallet chain ID
 * ============================================================
 */

export async function getWalletChainId(): Promise<string> {
  const chainId =
    await getWalletProvider().request({
      method: "eth_chainId",
    });

  return String(chainId).toLowerCase();
}

/**
 * ============================================================
 * Ensure Bradbury network
 * ============================================================
 */

export async function ensureBradburyNetwork(
  provider = getWalletProvider(),
): Promise<void> {
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
            name: "GEN Token",
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
 * ============================================================
 * GenLayer clients
 * ============================================================
 */

/**
 * Read-only client.
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
 * We deliberately pass the EIP-1193 wallet provider directly
 * rather than using the SDK's wallet_getSnaps flow.
 *
 * This keeps the app compatible with Rabby and other
 * normal browser wallets.
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
 * ============================================================
 * Connect wallet
 * ============================================================
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
 * ============================================================
 * Restore existing wallet session
 * ============================================================
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
 * ============================================================
 * Change wallet
 * ============================================================
 */

export async function changeWallet() {
  const provider =
    getWalletProvider();

  let accounts: string[];

  try {
    await provider.request({
      method:
        "wallet_requestPermissions",

      params: [
        {
          eth_accounts: {},
        },
      ],
    });
  } catch {
    /*
     * Some wallets do not implement
     * wallet_requestPermissions.
     */
  }

  accounts =
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
 * ============================================================
 * Get current connected account
 * ============================================================
 */

export async function getConnectedAccount(): Promise<
  `0x${string}` | null
> {
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
 * ============================================================
 * Read ProofWork work record
 * ============================================================
 */

export async function getWork(
  workId: string,
): Promise<ProofWorkResult> {
  if (!workId.trim()) {
    throw new Error(
      "Work ID is required.",
    );
  }

  const result =
    await readClient().readContract({
      address:
        CONTRACT_ADDRESS,

      functionName:
        "get_work",

      args: [
        workId.trim(),
      ],
    });

  return result as ProofWorkResult;
}

/**
 * ============================================================
 * Fee Manager read helper
 * ============================================================
 */

async function readFeeManagerUint(
  provider: Eip1193Provider,

  functionName:
    | "GENPerTimeUnit"
    | "storageUnitPrice"
    | "messageFeeParamsBudgetFloor",
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
        },

        "latest",
      ],
    })) as `0x${string}`;

  return decodeFunctionResult({
    abi:
      FEE_MANAGER_ABI,

    functionName,

    data:
      raw,
  }) as bigint;
}

/**
 * ============================================================
 * BigInt helpers
 * ============================================================
 */

function maxBigInt(
  ...values: bigint[]
): bigint {
  let result =
    values[0] ??
    0n;

  for (const value of values) {
    if (value > result) {
      result = value;
    }
  }

  return result;
}

function addHeadroom(
  value: bigint,
  basisPoints = 12_000n,
): bigint {
  if (value === 0n) {
    return 0n;
  }

  return (
    value *
      basisPoints +
    9_999n
  ) / 10_000n;
}

/**
 * ============================================================
 * Bradbury fee calculation
 *
 * This mirrors the current GenLayerJS fee-distribution logic,
 * except the broken quoteGasPrice() call is replaced by the
 * wallet/network eth_gasPrice value.
 * ============================================================
 */

async function buildBradburyFees(
  provider: Eip1193Provider,
) {
  const gasPriceRaw =
    await provider.request({
      method:
        "eth_gasPrice",
    });

  const gasPrice =
    BigInt(
      String(gasPriceRaw),
    );

  const [
    genPerTimeUnit,
    storageUnitPrice,
  ] = await Promise.all([
    readFeeManagerUint(
      provider,
      "GENPerTimeUnit",
    ),

    readFeeManagerUint(
      provider,
      "storageUnitPrice",
    ),
  ]);

  let executionBudgetFloor =
    0n;

  try {
    executionBudgetFloor =
      await readFeeManagerUint(
        provider,
        "messageFeeParamsBudgetFloor",
      );
  } catch {
    /*
     * Some Bradbury RPC calls can return an unusable
     * value for this view function when executed through
     * eth_call.
     *
     * We calculate a local floor below instead.
     */
    executionBudgetFloor =
      0n;
  }

  /**
   * Current GenLayerJS fee estimation uses:
   *
   * 12,000 bps = 20% headroom
   */
  const receiptGasPrice =
    addHeadroom(
      gasPrice,
      12_000n,
    );

  const maxPriceGenPerTimeUnit =
    addHeadroom(
      genPerTimeUnit,
      12_000n,
    );

  const storageFeeMaxGasPrice =
    addHeadroom(
      storageUnitPrice,
      12_000n,
    );

  /**
   * Local equivalent of the current SDK's
   * receipt-budget floor calculation.
   */
  const minReceiptBytes =
    512n;

  const calldataGasPerByte =
    16n;

  const receiptSlotsChanged =
    7n;

  const gasPerChangedSlot =
    1_000n;

  const fixedProposeReceiptGas =
    210_000n;

  const intrinsicGas =
    21_000n;

  const bootloaderOverhead =
    60_000n;

  const localExecutionBudgetFloor =
    receiptGasPrice *
    (
      fixedProposeReceiptGas +
      intrinsicGas +
      bootloaderOverhead +
      (
        minReceiptBytes *
        calldataGasPerByte
      ) +
      (
        receiptSlotsChanged *
        gasPerChangedSlot
      )
    );

  executionBudgetFloor =
    maxBigInt(
      executionBudgetFloor,
      localExecutionBudgetFloor,
    );

  /**
   * Current GenLayerJS default:
   *
   * 500,000
   * OR fee floor
   * OR receiptGasPrice * 100,000,000
   *
   * Whichever is greater.
   */
  const defaultExecutionBudget =
    maxBigInt(
      500_000n,

      executionBudgetFloor,

      receiptGasPrice *
        100_000_000n,
    );

  /**
   * ProofWork does not currently emit
   * additional funded child messages,
   * so totalMessageFees remains zero.
   */
  const distribution = {
    leaderTimeunitsAllocation:
      100n,

    validatorTimeunitsAllocation:
      200n,

    appealRounds:
      0n,

    executionBudgetPerRound:
      defaultExecutionBudget,

    executionConsumed:
      0n,

    totalMessageFees:
      0n,

    rotations: [
      0n,
    ],

    maxPriceGenPerTimeUnit,

    storageFeeMaxGasPrice,

    receiptFeeMaxGasPrice:
      receiptGasPrice,
  };

  /**
   * Ask the Fee Manager to calculate the
   * actual deposit for this distribution.
   *
   * This is NOT quoteGasPrice().
   */
  const encodedData =
    encodeFunctionData({
      abi:
        FEE_MANAGER_ABI,

      functionName:
        "calculateRoundFees",

      args: [
        distribution,

        BigInt(
          testnetBradbury
            .defaultNumberOfInitialValidators,
        ),

        0n,
      ],
    });

  const raw =
    (await provider.request({
      method:
        "eth_call",

      params: [
        {
          to:
            FEE_MANAGER_ADDRESS,

          data:
            encodedData,
        },

        "latest",
      ],
    })) as `0x${string}`;

  const feeValue =
    decodeFunctionResult({
      abi:
        FEE_MANAGER_ABI,

      functionName:
        "calculateRoundFees",

      data:
        raw,
    }) as bigint;

  return {
    distribution,

    messageAllocations:
      [],

    feeValue,
  };
}

/**
 * ============================================================
 * Write functions
 * ============================================================
 */

export type ProofWorkWriteFunction =
  | "create_work"
  | "submit_evidence"
  | "verify_work";

/**
 * ============================================================
 * Send ProofWork write
 *
 * Explicitly supplies feeValue so GenLayerJS does not enter
 * the problematic quoteGasPrice() estimation path.
 * ============================================================
 */

export async function sendWrite(
  client: ReturnType<
    typeof walletClient
  >,

  functionName:
    ProofWorkWriteFunction,

  args: string[],
) {
  const provider =
    getWalletProvider();

  /**
   * Always verify network immediately before
   * sending a state-changing transaction.
   */
  await ensureBradburyNetwork(
    provider,
  );

  /**
   * Build explicit Bradbury fees.
   *
   * This is the important workaround.
   */
  const fees =
    await buildBradburyFees(
      provider,
    );

  /**
   * Send through GenLayerJS.
   *
   * Because feeValue is already supplied,
   * the SDK's normal quoteGasPrice() path
   * is bypassed.
   */
  const txHash =
    await client.writeContract({
      address:
        CONTRACT_ADDRESS,

      functionName,

      args,

      fees: {
        distribution:
          fees.distribution,

        messageAllocations:
          fees.messageAllocations,

        feeValue:
          fees.feeValue,
      },
    });

  /**
   * Wait until the GenLayer transaction reaches
   * finalized status.
   */
  const receipt =
    await client.waitForTransactionReceipt({
      hash:
        txHash,

      status:
        TransactionStatus.FINALIZED,

      fullTransaction:
        false,
    });

  return {
    txHash,
    receipt,
  };
}
