import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "") as `0x${string}`;

export const BRADBURY_CHAIN_ID = "0x107D";
export const BRADBURY_CHAIN_ID_DECIMAL = 4221;

export const BRADBURY_RPC =
  "https://rpc-bradbury.genlayer.com";

export type ProofWorkResult = {
  id: string;
  title: string;
  criteria: string;
  evidence_url: string;
  status: "OPEN" | "SUBMITTED" | "VERIFIED" | string;
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

export function getWalletProvider(): Eip1193Provider {
  const provider = (
    window as Window & {
      ethereum?: Eip1193Provider;
    }
  ).ethereum;

  if (!provider) {
    throw new Error(
      "No browser wallet detected. Install Rabby, MetaMask, or another EIP-1193 wallet.",
    );
  }

  return provider;
}

export async function getWalletChainId() {
  return String(
    await getWalletProvider().request({
      method: "eth_chainId",
    }),
  ).toLowerCase();
}

export async function ensureBradburyNetwork(
  provider = getWalletProvider(),
) {
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
      params: [
        {
          chainId: BRADBURY_CHAIN_ID,
        },
      ],
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
        "Please switch your wallet to GenLayer Testnet Bradbury (chain 4221) and try again.",
      );
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BRADBURY_CHAIN_ID,
          chainName: "GenLayer Testnet Bradbury",
          nativeCurrency: {
            name: "GEN",
            symbol: "GEN",
            decimals: 18,
          },
          rpcUrls: [BRADBURY_RPC],
          blockExplorerUrls: [
            "https://explorer-bradbury.genlayer.com",
          ],
        },
      ],
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
      "Wallet network did not switch to GenLayer Testnet Bradbury (chain 4221).",
    );
  }
}

export function readClient() {
  return createClient({
    chain: testnetBradbury,
  });
}

export function walletClient(
  address: `0x${string}`,
) {
  return createClient({
    chain: testnetBradbury,
    account: address,
    provider: getWalletProvider(),
  });
}

export async function connectWallet() {
  const provider = getWalletProvider();

  await ensureBradburyNetwork(provider);

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  const address = accounts[0] as
    | `0x${string}`
    | undefined;

  if (!address) {
    throw new Error("No wallet account returned.");
  }

  const client = walletClient(address);

  await client.connect("testnetBradbury");

  return {
    address,
    client,
    provider,
  };
}

export async function restoreWallet() {
  const provider = getWalletProvider();

  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];

  const address = accounts[0] as
    | `0x${string}`
    | undefined;

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

  const client = walletClient(address);

  await client.connect("testnetBradbury");

  return {
    address,
    client,
    provider,
  };
}

export async function changeWallet() {
  const provider = getWalletProvider();

  await ensureBradburyNetwork(provider);

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  const address = accounts[0] as
    | `0x${string}`
    | undefined;

  if (!address) {
    throw new Error("No wallet account selected.");
  }

  const client = walletClient(address);

  await client.connect("testnetBradbury");

  return {
    address,
    client,
    provider,
  };
}

export async function getConnectedAccount() {
  const accounts = (await getWalletProvider().request({
    method: "eth_accounts",
  })) as string[];

  return (
    (accounts[0] as `0x${string}` | undefined) ??
    null
  );
}

export async function getWork(
  workId: string,
): Promise<ProofWorkResult> {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "ProofWork contract address is not configured.",
    );
  }

  const result = await readClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_work",
    args: [workId],
  });

  return result as ProofWorkResult;
}

type WriteFunction =
  | "create_work"
  | "submit_evidence"
  | "verify_work";

export async function sendWrite(
  client: ReturnType<typeof walletClient>,
  functionName: WriteFunction,
  args: string[],
) {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "ProofWork contract address is not configured.",
    );
  }

  const write = {
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  } as const;

  const estimate =
    await client.estimateTransactionFeesForWrite(write);

  const txHash = await client.writeContract({
    ...write,
    fees: {
      distribution: estimate.distribution,
      messageAllocations:
        estimate.messageAllocations,
      feeValue: estimate.feeValue,
    },
  });

  const receipt =
    await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
      fullTransaction: false,
    });

  return {
    txHash,
    receipt,
  };
}
