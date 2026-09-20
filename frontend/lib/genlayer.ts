import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import {
  decodeFunctionResult,
  encodeFunctionData,
} from "viem";

/**
 * ProofWork Intelligent Contract.
 */
export const CONTRACT_ADDRESS =
  "0x4F0b22649e8503886761E87Aafe86869b4E444c5" as `0x${string}`;

/** GenLayer Testnet Bradbury. */
export const BRADBURY_CHAIN_ID = "0x107D";
export const TESTNET_BRADBURY_CHAIN_ID = BRADBURY_CHAIN_ID;
export const BRADBURY_CHAIN_ID_DECIMAL = 4221;
export const BRADBURY_RPC =
  "https://rpc-bradbury.genlayer.com";
export const BRADBURY_EXPLORER =
  "https://explorer-bradbury.genlayer.com";

/**
 * Bradbury Fee Manager.
 */
const FEE_MANAGER_ADDRESS =
  "0xF205868bf5db79d2162843742D18D0900A9E462a" as `0x${string}`;

/**
 * Fee Manager ABI used by the direct Bradbury RPC fee path.
 *
 * IMPORTANT:
 * quoteGasPrice() is intentionally NOT present.
 */
const FEE_MANAGER_ABI = [
  {
    type: "function",
    name: "GENPerTimeUnit",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "storageUnitPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
            name: "leaderTimeunitsAllocation",
            type: "uint256",
          },
          {
            name: "validatorTimeunitsAllocation",
            type: "uint256",
          },
          {
            name: "appealRounds",
            type: "uint256",
          },
          {
            name: "executionBudgetPerRound",
            type: "uint256",
          },
          {
            name: "executionConsumed",
            type: "uint256",
          },
          {
            name: "totalMessageFees",
            type: "uint256",
          },
          {
            name: "rotations",
            type: "uint256[]",
          },
          {
            name: "maxPriceGenPerTimeUnit",
            type: "uint256",
          },
          {
            name: "storageFeeMaxGasPrice",
            type: "uint256",
          },
          {
            name: "receiptFeeMaxGasPrice",
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
    listener: (...args: unknown[]) => void,
  ) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
};

/**
 * Get the injected browser wallet provider.
 */
export function getWalletProvider(): Eip1193Provider {
  if (typeof window === "undefined") {
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
 * Read the wallet's current chain id.
 */
export async function getWalletChainId(): Promise<string> {
  const chainId = await getWalletProvider().request({
    method: "eth_chainId",
  });

  return String(chainId).toLowerCase();
}

/**
 * Ensure the injected wallet is on GenLayer Bradbury.
 */
export async function ensureBradburyNetwork(
  provider = getWalletProvider(),
): Promise<void> {
  const currentChainId = String(
    await provider.request({
      method: "eth_chainId",
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
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY_CHAIN_ID }],
    });
  } catch (error: unknown) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? Number(
            (error as { code?: unknown }).code,
          )
        : undefined;

    if (code !== 4902) {
      throw new Error(
        "Please switch your wallet to GenLayer Testnet Bradbury (chain 4221).",
      );
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BRADBURY_CHAIN_ID,
          chainName: "GenLayer Testnet Bradbury",
          nativeCurrency: {
            name: "GEN Token",
            symbol: "GEN",
            decimals: 18,
          },
          rpcUrls: [BRADBURY_RPC],
          blockExplorerUrls: [BRADBURY_EXPLORER],
        },
      ],
    });

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY_CHAIN_ID }],
    });
  }

  const verifiedChainId = String(
    await provider.request({
      method: "eth_chainId",
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
 *
 * No browser provider is supplied, so RPC reads go to the
 * chain configured by testnetBradbury.
 */
export function readClient() {
  return createClient({
    chain: testnetBradbury,
  });
}

/**
 * Wallet-backed client for signed writes.
 */
export function walletClient(
  address: `0x${string}`,
) {
  return createClient({
    chain: testnetBradbury,
    account: address,
    provider: getWalletProvider(),
  });
}

/**
 * Connect the current browser wallet to Bradbury.
 */
export async function connectWallet() {
  const provider = getWalletProvider();

  const rawAccounts =
    await provider.request({
      method: "eth_requestAccounts",
    });

  const accounts = Array.isArray(rawAccounts)
    ? rawAccounts
    : [];

  const address =
    typeof accounts[0] === "string"
      ? (accounts[0] as `0x${string}`)
      : undefined;

  if (!address) {
    throw new Error("No wallet account returned.");
  }

  await ensureBradburyNetwork(provider);

  return {
    address,
    client: walletClient(address),
    provider,
  };
}

/**
 * Restore an already-authorized Bradbury account.
 */
export async function restoreWallet() {
  const provider = getWalletProvider();

  const rawAccounts =
    await provider.request({
      method: "eth_accounts",
    });

  const accounts = Array.isArray(rawAccounts)
    ? rawAccounts
    : [];

  const address =
    typeof accounts[0] === "string"
      ? (accounts[0] as `0x${string}`)
      : undefined;

  if (!address) {
    return null;
  }

  const chainId = String(
    await provider.request({
      method: "eth_chainId",
    }),
  ).toLowerCase();

  if (
    chainId !==
    BRADBURY_CHAIN_ID.toLowerCase()
  ) {
    return null;
  }

  return {
    address,
    client: walletClient(address),
    provider,
  };
}

/**
 * Ask the wallet for a different account and reconnect it.
 */
export async function changeWallet() {
  const provider = getWalletProvider();

  try {
    await provider.request({
      method: "wallet_requestPermissions",
      params: [
        {
          eth_accounts: {},
        },
      ],
    });
  } catch {
    /* Not every wallet implements this method. */
  }

  const rawAccounts =
    await provider.request({
      method: "eth_requestAccounts",
    });

  const accounts = Array.isArray(rawAccounts)
    ? rawAccounts
    : [];

  const address =
    typeof accounts[0] === "string"
      ? (accounts[0] as `0x${string}`)
      : undefined;

  if (!address) {
    throw new Error("No wallet account selected.");
  }

  await ensureBradburyNetwork(provider);

  return {
    address,
    client: walletClient(address),
    provider,
  };
}

/**
 * Return the currently authorized wallet account.
 */
export async function getConnectedAccount(): Promise<
  `0x${string}` | null
> {
  const rawAccounts =
    await getWalletProvider().request({
      method: "eth_accounts",
    });

  const accounts = Array.isArray(rawAccounts)
    ? rawAccounts
    : [];

  if (typeof accounts[0] !== "string") {
    return null;
  }

  return accounts[0] as `0x${string}`;
}

/**
 * Read a ProofWork record.
 */
export async function getWork(
  workId: string,
): Promise<ProofWorkResult> {
  const id = workId.trim();

  if (!id) {
    throw new Error("Work ID is required.");
  }

  const result = await readClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_work",
    args: [id],
  });

  return result as ProofWorkResult;
}

/**
 * Direct JSON-RPC request to Bradbury.
 *
 * This is intentionally separate from the injected wallet provider.
 */
async function bradburyRpc(
  method: string,
  params: unknown[],
): Promise<unknown> {
  const response = await fetch(BRADBURY_RPC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(
      "Bradbury RPC HTTP " +
        String(response.status) +
        ": " +
        response.statusText,
    );
  }

  const body = (await response.json()) as {
    result?: unknown;
    error?: {
      code?: number;
      message?: string;
      data?: unknown;
    };
  };

  if (body.error) {
    throw new Error(
      "Bradbury RPC error: " +
        String(
          body.error.message ??
            "Unknown RPC error",
        ) +
        (body.error.data !== undefined
          ? "\nData: " +
            formatErrorValue(
              body.error.data,
            )
          : ""),
    );
  }

  return body.result;
}

/**
 * Format arbitrary RPC errors without producing [object Object].
 */
function formatErrorValue(
  value: unknown,
): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(
      value,
      (_key, nestedValue) =>
        typeof nestedValue === "bigint"
          ? nestedValue.toString()
          : nestedValue,
      2,
    );
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Read a uint256 Fee Manager value directly from Bradbury.
 *
 * quoteGasPrice() is intentionally not used.
 */
async function readBradburyUint(
  functionName:
    | "GENPerTimeUnit"
    | "storageUnitPrice",
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: FEE_MANAGER_ABI,
    functionName,
    args: [],
  });

  const raw = (await bradburyRpc(
    "eth_call",
    [
      {
        to: FEE_MANAGER_ADDRESS,
        data,
      },
      "latest",
    ],
  )) as `0x${string}`;

  return decodeFunctionResult({
    abi: FEE_MANAGER_ABI,
    functionName,
    data: raw,
  }) as bigint;
}

/**
 * Return the larger bigint.
 */
function maxBigInt(
  ...values: bigint[]
): bigint {
  let result = values[0] ?? 0n;

  for (const value of values) {
    if (value > result) {
      result = value;
    }
  }

  return result;
}

/**
 * Add price headroom using basis points.
 *
 * 12,000 BPS = 20% headroom.
 */
function withHeadroom(
  value: bigint,
  headroomBps = 12_000n,
): bigint {
  if (value === 0n) {
    return 0n;
  }

  return (
    value * headroomBps +
    9_999n
  ) / 10_000n;
}

/**
 * Build a transaction fee distribution without using
 * quoteGasPrice().
 *
 * The fee reads are performed against the direct Bradbury RPC.
 */
async function buildBradburyFees() {
  const gasPriceRaw =
    await bradburyRpc(
      "eth_gasPrice",
      [],
    );

  const gasPrice = BigInt(
    String(gasPriceRaw),
  );

  if (gasPrice <= 0n) {
    throw new Error(
      "Bradbury returned a zero gas price; cannot construct a valid fee cap.",
    );
  }

  const [
    genPerTimeUnit,
    storageUnitPrice,
  ] = await Promise.all([
    readBradburyUint(
      "GENPerTimeUnit",
    ),
    readBradburyUint(
      "storageUnitPrice",
    ),
  ]);

  /**
   * The current GenLayerJS fee logic uses 20% price-cap headroom.
   */
  const receiptGasPrice =
    withHeadroom(
      gasPrice,
      12_000n,
    );

  const maxPriceGenPerTimeUnit =
    withHeadroom(
      genPerTimeUnit,
      12_000n,
    );

  const storageFeeMaxGasPrice =
    withHeadroom(
      storageUnitPrice,
      12_000n,
    );

  /**
   * Local equivalent of the current SDK's receipt floor.
   *
   * This deliberately does not call
   * messageFeeParamsBudgetFloor(), because that view can
   * itself depend on quoteGasPrice on-chain.
   */
  const minimumReceiptBytes =
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
      minimumReceiptBytes *
        calldataGasPerByte +
      receiptSlotsChanged *
        gasPerChangedSlot
    );

  /**
   * Current SDK baseline is the maximum of:
   * - 500,000
   * - execution-budget floor
   * - receipt gas price * 100,000,000
   */
  const executionBudgetPerRound =
    maxBigInt(
      500_000n,
      localExecutionBudgetFloor,
      receiptGasPrice *
        100_000_000n,
    );

  const distribution = {
    leaderTimeunitsAllocation: 100n,
    validatorTimeunitsAllocation: 200n,
    appealRounds: 0n,
    executionBudgetPerRound,
    executionConsumed: 0n,
    totalMessageFees: 0n,
    rotations: [0n],
    maxPriceGenPerTimeUnit,
    storageFeeMaxGasPrice,
    receiptFeeMaxGasPrice:
      receiptGasPrice,
  };

  /**
   * Ask the Bradbury Fee Manager for the actual deposit.
   *
   * This is calculateRoundFees(), not quoteGasPrice().
   */
  const encodedData =
    encodeFunctionData({
      abi: FEE_MANAGER_ABI,
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

  let raw: `0x${string}`;

  try {
    raw = (await bradburyRpc(
      "eth_call",
      [
        {
          to: FEE_MANAGER_ADDRESS,
          data: encodedData,
        },
        "latest",
      ],
    )) as `0x${string}`;
  } catch (error) {
    throw new Error(
      "Bradbury Fee Manager calculateRoundFees reverted. " +
        "This is now a direct Bradbury RPC failure, not a wallet RPC failure. " +
        formatErrorValue(error),
    );
  }

  const feeValue =
    decodeFunctionResult({
      abi: FEE_MANAGER_ABI,
      functionName:
        "calculateRoundFees",
      data: raw,
    }) as bigint;

  if (feeValue <= 0n) {
    throw new Error(
      "Bradbury Fee Manager returned a zero transaction fee.",
    );
  }

  return {
    distribution,
    messageAllocations: [],
    feeValue,
  };
}

/**
 * ProofWork write methods.
 */
export type ProofWorkWriteFunction =
  | "create_work"
  | "submit_evidence"
  | "verify_work";

/**
 * Send a ProofWork state-changing transaction.
 *
 * Fee calculation uses direct Bradbury RPC.
 * Rabby is used only for the signed transaction itself.
 */
export async function sendWrite(
  client: ReturnType<typeof walletClient>,
  functionName: ProofWorkWriteFunction,
  args: string[],
) {
  if (!client) {
    throw new Error(
      "Wallet client is not initialized.",
    );
  }

  const provider =
    getWalletProvider();

  await ensureBradburyNetwork(
    provider,
  );

  /**
   * IMPORTANT:
   *
   * Do not replace this with client.estimateTransactionFees().
   * That method currently reaches quoteGasPrice(), which is the
   * Bradbury call that was reverting for this project.
   */
  const fees =
    await buildBradburyFees();

  const txHash =
    await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
      fees: {
        distribution:
          fees.distribution,
        messageAllocations:
          fees.messageAllocations,
        feeValue: fees.feeValue,
      },
    });

  const receipt =
    await client.waitForTransactionReceipt({
      hash: txHash,
      status:
        TransactionStatus.FINALIZED,
      fullTransaction: false,
    });

  return {
    txHash,
    receipt,
  };
}
