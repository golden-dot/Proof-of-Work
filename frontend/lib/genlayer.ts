import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "0x4F0b22649e8503886761E87Aafe86869b4E444c5") as `0x${string}`;

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

export function readClient() {
  return createClient({ chain: studioDevnet });
}

export function walletClient(address: `0x${string}`) {
  const provider = (window as Window & { ethereum?: unknown }).ethereum;
  if (!provider) {
    throw new Error("Install a browser wallet such as MetaMask first.");
  }

  return createClient({
    chain: studioDevnet,
    account: address,
    provider,
  });
}

export async function connectWallet() {
  const provider = (window as Window & {
    ethereum?: {
      request: (args: { method: string }) => Promise<unknown>;
    };
  }).ethereum;

  if (!provider) {
    throw new Error("No EIP-1193 wallet found.");
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts[0]) {
    throw new Error("No wallet account returned.");
  }

  const address = accounts[0] as `0x${string}`;
  const client = walletClient(address);
  await client.connect("studioDevnet");

  return { address, client };
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
  const write = {
    address: CONTRACT_ADDRESS,
    functionName,
    args,
  } as const;

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
