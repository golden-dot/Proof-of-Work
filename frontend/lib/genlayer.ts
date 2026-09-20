import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "0x4F0b22649e8503886761E87Aafe86869b4E444c5") as `0x${string}`;

export const STUDIO_DEV_CHAIN_ID = "0xF1CD";
export const STUDIO_DEV_CHAIN_ID_DECIMAL = 61997;
export const STUDIO_DEV_RPC = "https://studio-dev.genlayer.com/api";

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
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export function getWalletProvider(): Eip1193Provider {
  const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) {
    throw new Error("No browser wallet detected. Install MetaMask or another EIP-1193 wallet.");
  }
  return provider;
}

export async function getWalletChainId() {
  return String(
    await getWalletProvider().request({ method: "eth_chainId" }),
  ).toLowerCase();
}

export async function ensureStudioDevNetwork(provider = getWalletProvider()) {
  const current = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (current === STUDIO_DEV_CHAIN_ID.toLowerCase()) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIO_DEV_CHAIN_ID }],
    });
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? Number((error as { code?: unknown }).code)
        : undefined;

    if (code !== 4902) {
      throw new Error(
        "Please switch your wallet to GenLayer Studio Dev (chain 61997) and try again.",
      );
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: STUDIO_DEV_CHAIN_ID,
        chainName: "GenLayer Studio Dev",
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        rpcUrls: [STUDIO_DEV_RPC],
      }],
    });
  }

  const verified = String(
    await provider.request({ method: "eth_chainId" }),
  ).toLowerCase();

  if (verified !== STUDIO_DEV_CHAIN_ID.toLowerCase()) {
    throw new Error("Wallet network did not switch to GenLayer Studio Dev (chain 61997).");
  }
}

export function readClient() {
  return createClient({ chain: studioDevnet });
}

export function walletClient(address: `0x${string}`) {
  return createClient({
    chain: studioDevnet,
    account: address,
    provider: getWalletProvider(),
  });
}

export async function connectWallet() {
  const provider = getWalletProvider();
  await ensureStudioDevNetwork(provider);

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  const address = accounts[0] as `0x${string}` | undefined;
  if (!address) throw new Error("No wallet account returned.");

  const client = walletClient(address);
  await client.connect("studioDevnet");
  return { address, client, provider };
}

/** Restore an already-authorized wallet without opening a new permission prompt. */
export async function restoreWallet() {
  const provider = getWalletProvider();
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];

  const address = accounts[0] as `0x${string}` | undefined;
  if (!address) return null;

  const chainId = String(
    await provider.request({ method: "eth_chainId" }),
  ).toLowerCase();

  if (chainId !== STUDIO_DEV_CHAIN_ID.toLowerCase()) return null;

  const client = walletClient(address);
  await client.connect("studioDevnet");
  return { address, client, provider };
}

export async function getConnectedAccount() {
  const accounts = (await getWalletProvider().request({
    method: "eth_accounts",
  })) as string[];
  return (accounts[0] as `0x${string}` | undefined) ?? null;
}

export async function getWork(workId: string): Promise<ProofWorkResult> {
  const result = await readClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_work",
    args: [workId],
  });
  return result as ProofWorkResult;
}

type WriteFunction = "create_work" | "submit_evidence" | "verify_work";

export async function sendWrite(
  client: ReturnType<typeof walletClient>,
  functionName: WriteFunction,
  args: string[],
) {
  const write = { address: CONTRACT_ADDRESS, functionName, args } as const;
  const estimate = await client.estimateTransactionFeesForWrite(write);

  const txHash = await client.writeContract({
    ...write,
    fees: {
      distribution: estimate.distribution,
      messageAllocations: estimate.messageAllocations,
      feeValue: estimate.feeValue,
    },
  });

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
    fullTransaction: false,
  });

  return { txHash, receipt };
}
