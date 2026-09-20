import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

/**
 * ProofWork contract
 *
 * No environment variables are used.
 */
export const CONTRACT_ADDRESS =
  "0x4F0b22649e8503886761E87Aafe86869b4E444c5" as `0x${string}`;

/**
 * GenLayer Testnet Bradbury
 */
export const BRADBURY_CHAIN_ID = "0x107D";
export const BRADBURY_CHAIN_ID_DECIMAL = 4221;

export const BRADBURY_RPC =
  "https://rpc-bradbury.genlayer.com";

export const BRADBURY_EXPLORER =
  "https://explorer-bradbury.genlayer.com";

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
 * Get the injected browser wallet.
 */
export function getWalletProvider(): Eip1193Provider {
  const provider = (
    window as Window & {
      ethereum?: Eip1193Provider;
    }
  ).ethereum;

  if (!provider) {
    throw new Error(
      "No browser wallet detected. Please install Rabby, MetaMask, or another EIP-1193 wallet.",
    );
  }

  return provider;
}

/**
 * Get wallet chain ID.
 */
export async function getWalletChainId() {
  const provider =
    getWalletProvider();

  return String(
    await provider.request({
      method: "eth_chainId",
    }),
  ).toLowerCase();
}

/**
 * Make sure the wallet is on Bradbury.
 *
 * We deliberately do not call client.connect()
 * because GenLayerJS's connect helper uses
 * MetaMask Snap APIs that are not appropriate
 * for Rabby.
 */
export async function ensureBradburyNetwork(
  provider = getWalletProvider(),
) {
  const currentChainId =
    String(
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
      typeof error === "object" &&
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
 * Read-only client.
 *
 * This communicates directly with the
 * GenLayer Bradbury RPC.
 */
export function readClient() {
  return createClient({
    chain: testnetBradbury,
  });
}

/**
 * Wallet-backed client.
 *
 * Rabby signs through the EIP-1193 provider.
 */
export function walletClient(
  address: `0x${string}`,
) {
  return createClient({
    chain: testnetBradbury,
    account: address,
    provider:
      getWalletProvider(),
  });
}

/**
 * Connect Rabby/MetaMask without using
 * GenLayerJS's MetaMask Snap connector.
 */
export async function connectWallet() {
  const provider =
    getWalletProvider();

  /*
   * Ask the wallet to expose the selected
   * account.
   */
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

  /*
   * Switch to Bradbury.
   */
  await ensureBradburyNetwork(
    provider,
  );

  /*
   * Create the GenLayerJS wallet client.
   *
   * IMPORTANT:
   * We intentionally do NOT call:
   *
   * client.connect("testnetBradbury")
   *
   * because that invokes the SDK's MetaMask
   * Snap connector.
   */
  const client =
    walletClient(address);

  return {
    address,
    client,
    provider,
  };
}

/**
 * Restore an already-authorized wallet
 * without opening a permission popup.
 */
export async function restoreWallet() {
  const provider =
    getWalletProvider();

  const accounts =
    (await provider.request({
      method: "eth_accounts",
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
        method: "eth_chainId",
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
 * Get currently authorized account.
 */
export async function getConnectedAccount() {
  const provider =
    getWalletProvider();

  const accounts =
    (await provider.request({
      method: "eth_accounts",
    })) as string[];

  return (
    (accounts[0] as
      | `0x${string}`
      | undefined) ?? null
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

type WriteFunction =
  | "create_work"
  | "submit_evidence"
  | "verify_work";

/**
 * Write to ProofWork.
 */
export async function sendWrite(
  client: ReturnType<
    typeof walletClient
  >,
  functionName: WriteFunction,
  args: string[],
) {
  const write = {
    address:
      CONTRACT_ADDRESS,

    functionName,

    args,
  } as const;

  /*
   * GenLayer requires the fee information
   * before submitting the transaction.
   */
  const estimate =
    await client.estimateTransactionFeesForWrite(
      write,
    );

  /*
   * Send the transaction through Rabby's
   * EIP-1193 provider.
   */
  const txHash =
    await client.writeContract({
      ...write,

      fees: {
        distribution:
          estimate.distribution,

        messageAllocations:
          estimate.messageAllocations,

        feeValue:
          estimate.feeValue,
      },
    });

  /*
   * Wait until GenLayer finalizes the
   * consensus transaction.
   */
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
