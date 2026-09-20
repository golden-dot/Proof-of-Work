"use client";

import { useEffect, useState } from "react";
import {
  connectWallet,
  getConnectedAccount,
  getWalletProvider,
  getWalletChainId,
  ensureBradburyNetwork,
  getWork,
  sendWrite,
  TESTNET_BRADBURY_CHAIN_ID,
  CONTRACT_ADDRESS,
  type ProofWorkResult,
} from "@/lib/genlayer";

type WalletClient = Awaited<ReturnType<typeof connectWallet>>["client"];

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatErrorValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

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

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const details = error as Error & {
      code?: unknown;
      shortMessage?: unknown;
      details?: unknown;
      cause?: unknown;
      data?: unknown;
    };

    const parts: string[] = [];

    if (details.shortMessage) {
      parts.push(String(details.shortMessage));
    } else {
      parts.push(details.message);
    }

    if (details.code !== undefined) {
      parts.push(`Code: ${String(details.code)}`);
    }

    if (details.details !== undefined) {
      parts.push(
        `Details: ${formatErrorValue(details.details)}`,
      );
    }

    if (details.data !== undefined) {
      parts.push(
        `Data: ${formatErrorValue(details.data)}`,
      );
    }

    if (details.cause !== undefined) {
      parts.push(
        `Cause: ${formatErrorValue(details.cause)}`,
      );
    }

    return parts.join("\n");
  }

  return formatErrorValue(error);
}

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [client, setClient] = useState<WalletClient | null>(null);

  const [walletDetected, setWalletDetected] = useState(false);
  const [networkReady, setNetworkReady] = useState(false);

  const [workId, setWorkId] = useState("");
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [evidence, setEvidence] = useState("");

  const [status, setStatus] = useState(
    "Connect your wallet to begin.",
  );

  const [result, setResult] =
    useState<ProofWorkResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");

  async function refresh() {
    const id = workId.trim();

    if (!id) {
      setResult(null);
      return;
    }

    try {
      const value = await getWork(id);
      setResult(value);
    } catch {
      setResult(null);
    }
  }

  async function connect() {
    try {
      setBusy(true);
      setStatus(
        "Connecting wallet and checking GenLayer Bradbury…",
      );

      const connected = await connectWallet();

      setWallet(connected.address);
      setClient(connected.client);
      setWalletDetected(true);
      setNetworkReady(true);

      setStatus(
        "Wallet connected to GenLayer Bradbury Testnet.",
      );
    } catch (error) {
      console.error("Wallet connection error:", error);

      setNetworkReady(false);

      setStatus(
        `Wallet connection failed:\n${errorMessage(error)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeWallet() {
    try {
      setBusy(true);
      setStatus("Opening wallet account selector…");

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
        // Some wallets do not implement wallet_requestPermissions.
      }

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      const address = accounts?.[0] as
        | `0x${string}`
        | undefined;

      if (!address) {
        throw new Error(
          "No wallet account was returned.",
        );
      }

      const connected = await connectWallet();

      setWallet(connected.address);
      setClient(connected.client);
      setWalletDetected(true);
      setNetworkReady(true);

      setStatus(
        `Wallet changed to ${shortAddress(address)}.`,
      );
    } catch (error) {
      console.error("Change wallet error:", error);

      setStatus(
        `Could not change wallet:\n${errorMessage(error)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function disconnectWallet() {
    /*
     * This disconnects ProofWork's frontend session.
     * It does NOT revoke wallet permissions from the browser wallet.
     */
    setWallet("");
    setClient(null);
    setNetworkReady(false);
    setResult(null);
    setTxHash("");

    setStatus(
      "ProofWork wallet session disconnected. Your browser wallet permission remains unchanged.",
    );
  }

  async function switchNetwork() {
    try {
      setBusy(true);
      setStatus(
        "Switching wallet to GenLayer Bradbury Testnet…",
      );

      await ensureBradburyNetwork();

      const chainId = await getWalletChainId();

      if (
        chainId.toLowerCase() !==
        TESTNET_BRADBURY_CHAIN_ID.toLowerCase()
      ) {
        throw new Error(
          "The wallet did not switch to GenLayer Bradbury Testnet.",
        );
      }

      setNetworkReady(true);

      setStatus(
        "GenLayer Bradbury Testnet selected. Connect your wallet to continue.",
      );
    } catch (error) {
      console.error("Network switch error:", error);

      setStatus(
        `Network switch failed:\n${errorMessage(error)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let provider:
      | ReturnType<typeof getWalletProvider>
      | null = null;

    async function restoreWallet() {
      try {
        provider = getWalletProvider();

        setWalletDetected(true);

        const account = await getConnectedAccount();

        if (!account) {
          setStatus("Wallet detected. Connect your wallet to begin.");
          return;
        }

        setWallet(account);

        const chainId = await getWalletChainId();

        if (
          chainId.toLowerCase() !==
          TESTNET_BRADBURY_CHAIN_ID.toLowerCase()
        ) {
          setNetworkReady(false);

          setStatus(
            "Wallet detected, but it is on the wrong network. Switch to GenLayer Bradbury Testnet.",
          );

          return;
        }

        setNetworkReady(true);

        /*
         * We intentionally don't automatically create a GenLayer client
         * here. The user can explicitly connect when needed.
         */
        setStatus(
          `Wallet detected: ${shortAddress(account)}. Ready to connect.`,
        );
      } catch {
        setWalletDetected(false);
      }
    }

    restoreWallet();

    const handleAccountsChanged = (
      ...args: unknown[]
    ) => {
      const accounts = args[0] as string[] | undefined;
      const address = accounts?.[0] ?? "";

      setWallet(address);
      setClient(null);

      if (!address) {
        setNetworkReady(false);

        setStatus(
          "Wallet account disconnected from the browser wallet.",
        );

        return;
      }

      setWalletDetected(true);
      setNetworkReady(false);

      setStatus(
        `Wallet changed to ${shortAddress(
          address,
        )}. Connect again to continue.`,
      );
    };

    const handleChainChanged = (
      ...args: unknown[]
    ) => {
      const chainId = String(
        args[0] ?? "",
      ).toLowerCase();

      setClient(null);

      const correctNetwork =
        chainId ===
        TESTNET_BRADBURY_CHAIN_ID.toLowerCase();

      setNetworkReady(correctNetwork);

      if (correctNetwork) {
        setStatus(
          "GenLayer Bradbury Testnet selected. Connect your wallet to continue.",
        );
      } else {
        setStatus(
          "Wrong network selected. Switch to GenLayer Bradbury Testnet.",
        );
      }
    };

    if (provider?.on) {
      provider.on(
        "accountsChanged",
        handleAccountsChanged,
      );

      provider.on(
        "chainChanged",
        handleChainChanged,
      );
    }

    return () => {
      provider?.removeListener?.(
        "accountsChanged",
        handleAccountsChanged,
      );

      provider?.removeListener?.(
        "chainChanged",
        handleChainChanged,
      );
    };
  }, []);

  async function create() {
    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }

    if (!client || !networkReady) {
      setStatus(
        "Connect your wallet to GenLayer Bradbury Testnet first.",
      );
      return;
    }

    if (!workId.trim()) {
      setStatus("Enter a work ID.");
      return;
    }

    if (!title.trim()) {
      setStatus("Enter a work title.");
      return;
    }

    if (!criteria.trim()) {
      setStatus("Enter the acceptance criteria.");
      return;
    }

    if (workId.trim().length > 80) {
      setStatus(
        "Work ID must be 80 characters or fewer.",
      );
      return;
    }

    if (title.trim().length > 200) {
      setStatus(
        "Title must be 200 characters or fewer.",
      );
      return;
    }

    if (criteria.trim().length > 4000) {
      setStatus(
        "Acceptance criteria must be 4000 characters or fewer.",
      );
      return;
    }

    setBusy(true);
    setTxHash("");
    setResult(null);

    setStatus(
      "Creating the work request on GenLayer…",
    );

    try {
      const response = await sendWrite(
        client,
        "create_work",
        [
          workId.trim(),
          title.trim(),
          criteria.trim(),
        ],
      );

      setTxHash(response.txHash);

      setStatus(
        "Work request finalized. You can now submit the evidence URL.",
      );

      await refresh();
    } catch (error) {
      console.error(
        "ProofWork create error:",
        error,
      );

      setStatus(
        `Create request failed:\n${errorMessage(error)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }

    if (!client || !networkReady) {
      setStatus(
        "Connect your wallet to GenLayer Bradbury Testnet first.",
      );
      return;
    }

    if (!workId.trim()) {
      setStatus(
        "Enter the work ID you want to update.",
      );
      return;
    }

    if (!evidence.trim()) {
      setStatus("Enter a public evidence URL.");
      return;
    }

    if (!evidence.trim().startsWith("https://")) {
      setStatus(
        "Evidence URL must start with https://",
      );
      return;
    }

    if (evidence.trim().length > 1000) {
      setStatus(
        "Evidence URL must be 1000 characters or fewer.",
      );
      return;
    }

    setBusy(true);
    setTxHash("");

    setStatus(
      "Submitting evidence to the ProofWork contract…",
    );

    try {
      const response = await sendWrite(
        client,
        "submit_evidence",
        [
          workId.trim(),
          evidence.trim(),
        ],
      );

      setTxHash(response.txHash);

      setStatus(
        "Evidence submitted. The work is ready for GenLayer verification.",
      );

      await refresh();
    } catch (error) {
      console.error(
        "ProofWork submit evidence error:",
        error,
      );

      setStatus(
        `Evidence submission failed:\n${errorMessage(
          error,
        )}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }

    if (!client || !networkReady) {
      setStatus(
        "Connect your wallet to GenLayer Bradbury Testnet first.",
      );
      return;
    }

    if (!workId.trim()) {
      setStatus(
        "Enter the work ID you want to verify.",
      );
      return;
    }

    setBusy(true);
    setTxHash("");

    setStatus(
      "GenLayer is evaluating the evidence and reaching validator consensus…",
    );

    try {
      const response = await sendWrite(
        client,
        "verify_work",
        [workId.trim()],
      );

      setTxHash(response.txHash);

      setStatus(
        "Verification finalized. The consensus-backed verdict is now stored onchain.",
      );

      await refresh();
    } catch (error) {
      console.error(
        "ProofWork verification error:",
        error,
      );

      setResult(null);

      setStatus(
        `Verification failed:\n${errorMessage(
          error,
        )}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const connected =
    Boolean(wallet) &&
    Boolean(client) &&
    networkReady;

  return (
    <main>
      <nav>
        <div>
          <div className="brand">
            ProofWork
          </div>

          <div className="small">
            Evidence-backed work verification
          </div>
        </div>

        <div className="row">
          <span className="badge">
            GenLayer Bradbury · 4221
          </span>

          {walletDetected ? (
            <>
              {networkReady ? (
                <span className="connected-pill">
                  <span className="pulse-dot" />
                  {wallet
                    ? shortAddress(wallet)
                    : "Wallet detected"}
                </span>
              ) : (
                <span className="wallet-detected">
                  <span className="pulse-dot" />
                  Wallet detected
                </span>
              )}

              {!networkReady && (
                <button
                  className="secondary wallet-action"
                  onClick={switchNetwork}
                  disabled={busy}
                >
                  Switch network
                </button>
              )}

              {wallet && (
                <button
                  className="secondary wallet-action"
                  onClick={changeWallet}
                  disabled={busy}
                >
                  Change wallet
                </button>
              )}

              {wallet && (
                <button
                  className="disconnect-button"
                  onClick={disconnectWallet}
                  disabled={busy}
                >
                  Disconnect
                </button>
              )}

              {!wallet && (
                <button
                  className="wallet-button"
                  onClick={connect}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="spinner" />
                      Connecting…
                    </>
                  ) : (
                    "Connect wallet"
                  )}
                </button>
              )}
            </>
          ) : (
            <button
              className="wallet-button"
              onClick={connect}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="spinner" />
                  Connecting…
                </>
              ) : (
                "Connect wallet"
              )}
            </button>
          )}
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">
          GENLAYER INTELLIGENT CONTRACT
        </p>

        <h1>
          Work that can be verified,
          not merely claimed.
        </h1>

        <p className="lead">
          ProofWork turns acceptance criteria
          and public evidence into a
          consensus-backed verdict. The
          Intelligent Contract retrieves the
          evidence, evaluates it with
          nondeterministic execution, and asks
          validators to independently verify
          the result.
        </p>
      </section>

      <div className="grid">
        <section className="card">
          <div className="step">01</div>

          <h2>
            Create work request
          </h2>

          <label>
            Work ID
          </label>

          <input
            value={workId}
            onChange={(event) =>
              setWorkId(event.target.value)
            }
            placeholder="e.g. client-website-001"
            maxLength={80}
            disabled={busy}
          />

          <label>
            Title
          </label>

          <input
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="What work needs to be verified?"
            maxLength={200}
            disabled={busy}
          />

          <label>
            Acceptance criteria
          </label>

          <textarea
            value={criteria}
            onChange={(event) =>
              setCriteria(event.target.value)
            }
            placeholder="Describe exactly what the evidence must demonstrate."
            maxLength={4000}
            disabled={busy}
          />

          <button
            onClick={create}
            disabled={
              busy ||
              !connected
            }
          >
            {busy ? (
              <>
                <span className="small-spinner" />
                Processing…
              </>
            ) : (
              "Create request"
            )}
          </button>
        </section>

        <section className="card">
          <div className="step">02</div>

          <h2>
            Submit evidence
          </h2>

          <label>
            Public evidence URL
          </label>

          <input
            value={evidence}
            onChange={(event) =>
              setEvidence(event.target.value)
            }
            placeholder="https://example.com/my-work"
            maxLength={1000}
            disabled={busy}
          />

          <p className="small">
            Use publicly readable HTTPS evidence
            such as a deployed website, GitHub
            page, documentation, or another
            public artifact.
          </p>

          <button
            onClick={submit}
            disabled={
              busy ||
              !connected
            }
          >
            {busy ? (
              <>
                <span className="small-spinner" />
                Processing…
              </>
            ) : (
              "Submit evidence"
            )}
          </button>

          <button
            className="secondary"
            onClick={verify}
            disabled={
              busy ||
              !connected
            }
          >
            {busy ? (
              <>
                <span className="small-spinner" />
                Verifying…
              </>
            ) : (
              "Verify with GenLayer"
            )}
          </button>
        </section>
      </div>

      <section
        className="card verification"
        style={{ marginTop: 18 }}
      >
        <div className="row space-between">
          <div>
            <div className="step">
              03
            </div>

            <h2>
              Consensus verdict
            </h2>
          </div>

          <div className="row">
            {result && (
              <span className="badge">
                {result.status}
              </span>
            )}

            <button
              className="secondary"
              onClick={refresh}
              disabled={busy}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="status">
          {status}
        </div>

        {txHash && (
          <div className="tx">
            <span>
              Transaction
            </span>

            <code>
              {txHash}
            </code>
          </div>
        )}

        {result && (
          <div className="result">
            <div>
              <div className="small">
                Verification score
              </div>

              <div className="score">
                {result.score}
                <span className="small">
                  {" "}
                  / 100
                </span>
              </div>
            </div>

            <div>
              <div className="small">
                Decision
              </div>

              <strong
                className={
                  result.approved
                    ? "approved"
                    : "rejected"
                }
              >
                {result.approved
                  ? "APPROVED"
                  : "NOT APPROVED"}
              </strong>
            </div>

            <div className="summary">
              <div className="small">
                Evidence-grounded summary
              </div>

              <p>
                {result.summary ||
                  "No verification summary yet."}
              </p>
            </div>
          </div>
        )}
      </section>

      <footer>
        <div>
          Contract:
          {" "}
          <code>
            {shortAddress(
              CONTRACT_ADDRESS,
            )}
          </code>
        </div>

        <div>
          GenLayer Bradbury Testnet ·
          Chain ID 4221
        </div>
      </footer>
    </main>
  );
}
