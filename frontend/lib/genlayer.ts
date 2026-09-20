import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

/**
 * ============================================================
 * ProofWork configuration
 * ============================================================
 */

export const CONTRACT_ADDRESS =
  "0x4F0b22649e8503886761E87Aafe86869b4E444c5" as `0x${string}`;

/**
 * GenLayer Testnet Bradbury
 */
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
 * ============================================================
 * ProofWork result
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

export type Eip1193Provider = {
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
 * Wallet provider
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
  const result =
    await getWalletProvider().request({
      method:
        "eth_chainId",
    });

  return String(
    result,
  ).toLowerCase();
}

/**
 * ============================================================
 * Switch / verify Bradbury
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
            name:
              "GEN Token",

            symbol:
              "GEN",

            decimals:
              18,
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

  const finalChainId =
    String(
      await provider.request({
        method:
          "eth_chainId",
      }),
    ).toLowerCase();

  if (
    finalChainId !==
    BRADBURY_CHAIN_ID.toLowerCase()
  ) {
    throw new Error(
      "Wallet is not connected to GenLayer Testnet Bradbury.",
    );
  }
}

/**
 * ============================================================
 * Read-only GenLayer client
 *
 * IMPORTANT:
 * This client has NO browser wallet provider.
 *
 * Therefore GenLayer RPC operations such as fee estimation
 * use the Bradbury RPC configured in testnetBradbury instead
 * of Rabby's injected RPC endpoint.
 * ============================================================
 */

export function readClient() {
  return createClient({
    chain:
      testnetBradbury,
  });
}

/**
 * ============================================================
 * Wallet-backed GenLayer client
 *
 * This client is only used for signed writes.
 * ============================================================
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

  const rawAccounts =
    await provider.request({
      method:
        "eth_requestAccounts",
    });

  const accounts =
    Array.isArray(
      rawAccounts,
    )
      ? rawAccounts
      : [];

  const address =
    typeof accounts[0] ===
    "string"
      ? (accounts[0] as `0x${string}`)
      : undefined;

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
 * Restore wallet
 * ============================================================
 */

export async function restoreWallet() {
  const provider =
    getWalletProvider();

  const rawAccounts =
    await provider.request({
      method:
        "eth_accounts",
    });

  const accounts =
    Array.isArray(
      rawAccounts,
    )
      ? rawAccounts
      : [];

  const address =
    typeof accounts[0] ===
    "string"
      ? (accounts[0] as `0x${string}`)
      : undefined;

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
     * Not all browser wallets expose
     * wallet_requestPermissions.
     */
  }

  const rawAccounts =
    await provider.request({
      method:
        "eth_requestAccounts",
    });

  const accounts =
    Array.isArray(
      rawAccounts,
    )
      ? rawAccounts
      : [];

  const address =
    typeof accounts[0] ===
    "string"
      ? (accounts[0] as `0x${string}`)
      : undefined;

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
 * Get connected account
 * ============================================================
 */

export async function getConnectedAccount(): Promise<
  `0x${string}` | null
> {
  const rawAccounts =
    await getWalletProvider().request({
      method:
        "eth_accounts",
    });

  const accounts =
    Array.isArray(
      rawAccounts,
    )
      ? rawAccounts
      : [];

  if (
    typeof accounts[0] !==
    "string"
  ) {
    return null;
  }

  return accounts[0] as `0x${string}`;
}

/**
 * ============================================================
 * Read ProofWork contract
 * ============================================================
 */

export async function getWork(
  workId: string,
): Promise<ProofWorkResult> {
  const id =
    workId.trim();

  if (!id) {
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
        id,
      ],
    });

  return result as ProofWorkResult;
}

/**
 * ============================================================
 * Estimate fees
 *
 * IMPORTANT:
 *
 * We now use the GenLayerJS fee estimator on the read-only
 * Bradbury client.
 *
 * This means fee-policy reads and Fee Manager calls go to:
 *
 * https://rpc-bradbury.genlayer.com
 *
 * They do NOT go through Rabby's injected RPC provider.
 *
 * The returned feeValue is then passed to the wallet-backed
 * client for the actual signed transaction.
 * ============================================================
 */

async function estimateWriteFees() {
  const client =
    readClient();

  try {
    const estimate =
      await client.estimateTransactionFees(
        {
          leaderTimeunitsAllocation:
            100n,

          validatorTimeunitsAllocation:
            200n,

          rotations: [
            0n,
          ],

          totalMessageFees:
            0n,
        },
      );

    return {
      distribution:
        estimate.distribution,

      messageAllocations:
        estimate.messageAllocations,

      feeValue:
        estimate.feeValue,
    };
  } catch (error) {
    console.error(
      "Bradbury fee estimation failed:",
      error,
    );

    throw new Error(
      "Bradbury fee estimation failed. " +
        "The fee calculation was rejected by the GenLayer RPC. " +
        formatGenLayerError(error),
    );
  }
}

/**
 * ============================================================
 * Error formatting
 * ============================================================
 */

function formatGenLayerError(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    const details =
      error as Error & {
        code?: unknown;
        shortMessage?: unknown;
        details?: unknown;
        cause?: unknown;
        data?: unknown;
      };

    const parts: string[] =
      [];

    if (
      details.shortMessage
    ) {
      parts.push(
        String(
          details.shortMessage,
        ),
      );
    } else {
      parts.push(
        details.message,
      );
    }

    if (
      details.code !==
      undefined
    ) {
      parts.push(
        "Code: " +
          String(
            details.code,
          ),
      );
    }

    if (
      details.details !==
      undefined
    ) {
      parts.push(
        "Details: " +
          formatErrorValue(
            details.details,
          ),
      );
    }

    if (
      details.data !==
      undefined
    ) {
      parts.push(
        "Data: " +
          formatErrorValue(
            details.data,
          ),
      );
    }

    if (
      details.cause !==
      undefined
    ) {
      parts.push(
        "Cause: " +
          formatErrorValue(
            details.cause,
          ),
      );
    }

    return parts.join(
      " | ",
    );
  }

  return formatErrorValue(
    error,
  );
}

function formatErrorValue(
  value: unknown,
): string {
  if (
    value === null
  ) {
    return "null";
  }

  if (
    value === undefined
  ) {
    return "undefined";
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number" ||
    typeof value ===
      "boolean"
  ) {
    return String(
      value,
    );
  }

  try {
    return JSON.stringify(
      value,
      (_key, nestedValue) => {
        if (
          typeof nestedValue ===
          "bigint"
        ) {
          return nestedValue.toString();
        }

        return nestedValue;
      },
      2,
    );
  } catch {
    return Object.prototype.toString.call(
      value,
    );
  }
}

/**
 * ============================================================
 * Write function names
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
 * Flow:
 *
 * 1. Verify wallet is on Bradbury.
 * 2. Estimate fees using the READ-ONLY Bradbury client.
 * 3. Use the Rabby-backed client only for the signed write.
 * 4. Wait for finalization.
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
   * Fee estimation happens entirely through
   * the configured Bradbury GenLayer client.
   *
   * Rabby is NOT used for the fee-manager read.
   */
  const fees =
    await estimateWriteFees();

  /**
   * Only now do we use the wallet-backed client.
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
   * Wait until GenLayer reports finalization.
   */
  const receipt =
    await client.waitForTransactionReceipt(
      {
        hash:
          txHash,

        status:
          TransactionStatus.FINALIZED,

        fullTransaction:
          false,
      },
    );

  return {
    txHash,

    receipt,
  };
}
