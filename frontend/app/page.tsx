"use client";

import { useEffect, useState } from "react";

import {
  connectWallet,
  restoreWallet,
  changeWallet,
  getWalletProvider,
  ensureTestnetNetwork,
  getWork,
  sendWrite,
  TESTNET_CHAIN_ID,
  type ProofWorkResult,
} from "@/lib/genlayer";

function shortAddress(address: string) {
  if (!address) return "";

  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export default function Home() {
  const [wallet, setWallet] = useState("");

  const [client, setClient] = useState<
    Awaited<
      ReturnType<typeof connectWallet>
    >["client"] | null
  >(null);

  const [networkReady, setNetworkReady] =
    useState(false);

  const [workId, setWorkId] =
    useState("demo-001");

  const [title, setTitle] =
    useState("Landing page delivery");

  const [criteria, setCriteria] =
    useState(
      "The evidence must show a responsive page, a clear headline, and working navigation.",
    );

  const [evidence, setEvidence] =
    useState("https://example.com");

  const [status, setStatus] =
    useState(
      "Connect your wallet to begin.",
    );

  const [result, setResult] =
    useState<ProofWorkResult | null>(null);

  const [busy, setBusy] =
    useState(false);

  const [txHash, setTxHash] =
    useState("");

  async function refresh() {
    if (!workId.trim()) {
      return;
    }

    try {
      const work = await getWork(
        workId.trim(),
      );

      setResult(work);
    } catch {
      setResult(null);
    }
  }

  /**
   * Connect wallet.
   */
  async function connect() {
    try {
      setBusy(true);

      setStatus(
        "Checking wallet and GenLayer Testnet Asimov network…",
      );

      const connected =
        await connectWallet();

      setWallet(
        connected.address,
      );

      setClient(
        connected.client,
      );

      setNetworkReady(true);

      setStatus(
        `Wallet connected: ${shortAddress(
          connected.address,
        )}`,
      );
    } catch (error) {
      setNetworkReady(false);

      setStatus(
        errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Change wallet account.
   */
  async function handleChangeWallet() {
    try {
      setBusy(true);

      setStatus(
        "Choose a wallet account…",
      );

      const connected =
        await changeWallet();

      setWallet(
        connected.address,
      );

      setClient(
        connected.client,
      );

      setNetworkReady(true);

      setStatus(
        `Wallet changed to ${shortAddress(
          connected.address,
        )}`,
      );
    } catch (error) {
      setStatus(
        errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Disconnect only the ProofWork
   * frontend session.
   *
   * EIP-1193 does not provide a universal
   * dapp-side disconnect method.
   */
  function disconnect() {
    setWallet("");

    setClient(null);

    setNetworkReady(false);

    setTxHash("");

    setStatus(
      "Wallet disconnected from ProofWork.",
    );
  }

  useEffect(() => {
    let provider:
      | ReturnType<
          typeof getWalletProvider
        >
      | null = null;

    async function restore() {
      try {
        provider =
          getWalletProvider();

        const connected =
          await restoreWallet();

        if (connected) {
          setWallet(
            connected.address,
          );

          setClient(
            connected.client,
          );

          setNetworkReady(true);

          setStatus(
            `Wallet connected: ${shortAddress(
              connected.address,
            )}`,
          );
        }
      } catch {
        /*
         * Wallet is optional until
         * manually connected.
         */
      }
    }

    restore();

    const handleAccountsChanged = (
      ...args: unknown[]
    ) => {
      const accounts =
        args[0] as
          | string[]
          | undefined;

      const address =
        accounts?.[0] ?? "";

      if (!address) {
        setWallet("");

        setClient(null);

        setNetworkReady(false);

        setStatus(
          "Wallet disconnected.",
        );

        return;
      }

      setWallet(address);

      setClient(null);

      setNetworkReady(false);

      setStatus(
        `Wallet changed to ${shortAddress(
          address,
        )}. Click Connect wallet to continue.`,
      );
    };

    const handleChainChanged = (
      ...args: unknown[]
    ) => {
      const chainId =
        String(
          args[0] ?? "",
        ).toLowerCase();

      const isTestnet =
        chainId ===
        TESTNET_CHAIN_ID.toLowerCase();

      setClient(null);

      setNetworkReady(
        isTestnet,
      );

      if (isTestnet) {
        setStatus(
          "GenLayer Testnet Asimov selected. Click Connect wallet to continue.",
        );
      } else {
        setStatus(
          "Wrong network. Click Switch network to use GenLayer Testnet Asimov.",
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
    if (!client || !networkReady) {
      return setStatus(
        "Connect your wallet to GenLayer Testnet Asimov first.",
      );
    }

    if (
      !workId.trim() ||
      !title.trim() ||
      !criteria.trim()
    ) {
      return setStatus(
        "Work ID, title, and acceptance criteria are required.",
      );
    }

    setBusy(true);

    setStatus(
      "Creating the work request on GenLayer…",
    );

    setTxHash("");

    try {
      const response =
        await sendWrite(
          client,
          "create_work",
          [
            workId.trim(),
            title.trim(),
            criteria.trim(),
          ],
        );

      setTxHash(
        response.txHash,
      );

      setStatus(
        "Work request finalized. You can now submit public evidence.",
      );

      await refresh();
    } catch (error) {
      setStatus(
        errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!client || !networkReady) {
      return setStatus(
        "Connect your wallet to GenLayer Testnet Asimov first.",
      );
    }

    if (
      !evidence.startsWith(
        "https://",
      )
    ) {
      return setStatus(
        "Evidence URL must start with https://",
      );
    }

    setBusy(true);

    setStatus(
      "Submitting evidence to the ProofWork contract…",
    );

    setTxHash("");

    try {
      const response =
        await sendWrite(
          client,
          "submit_evidence",
          [
            workId.trim(),
            evidence.trim(),
          ],
        );

      setTxHash(
        response.txHash,
      );

      setStatus(
        "Evidence submitted. The work is ready for GenLayer verification.",
      );

      await refresh();
    } catch (error) {
      setStatus(
        errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!client || !networkReady) {
      return setStatus(
        "Connect your wallet to GenLayer Testnet Asimov first.",
      );
    }

    setBusy(true);

    setStatus(
      "GenLayer is evaluating the evidence and reaching validator consensus…",
    );

    setTxHash("");

    try {
      const response =
        await sendWrite(
          client,
          "verify_work",
          [workId.trim()],
        );

      setTxHash(
        response.txHash,
      );

      setStatus(
        "Verification finalized. The consensus-backed verdict is now stored onchain.",
      );

      await refresh();
    } catch (error) {
      setStatus(
        errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function switchNetwork() {
    try {
      setBusy(true);

      await ensureTestnetNetwork();

      setNetworkReady(true);

      setStatus(
        "GenLayer Testnet Asimov selected. Click Connect wallet to authorize the account.",
      );
    } catch (error) {
      setStatus(
        errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  const connected =
    Boolean(
      wallet &&
        client &&
        networkReady,
    );

  return (
    <main>
      <nav>
        <div>
          <div className="brand">
            ProofWork
          </div>

          <div className="small">
            Evidence-backed work
            verification
          </div>
        </div>

        <div className="row">
          <span className="badge">
            Testnet Asimov · 4221
          </span>

          {connected ? (
            <>
              <span className="badge">
                ● Connected ·{" "}
                {shortAddress(wallet)}
              </span>

              <button
                className="secondary"
                onClick={
                  handleChangeWallet
                }
                disabled={busy}
              >
                Change wallet
              </button>

              <button
                className="secondary"
                onClick={
                  disconnect
                }
                disabled={busy}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              {!networkReady && (
                <button
                  className="secondary"
                  onClick={
                    switchNetwork
                  }
                  disabled={busy}
                >
                  Switch network
                </button>
              )}

              <button
                className="secondary"
                onClick={connect}
                disabled={busy}
              >
                Connect wallet
              </button>
            </>
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
          ProofWork turns acceptance
          criteria and public evidence
          into a consensus-backed
          verdict. The Intelligent
          Contract retrieves the
          evidence, evaluates it with
          nondeterministic execution,
          and asks validators to
          independently verify the
          result.
        </p>
      </section>

      <div className="grid">
        <section className="card">
          <div className="step">
            01
          </div>

          <h2>
            Create work request
          </h2>

          <label>
            Work ID
          </label>

          <input
            value={workId}
            onChange={(e) =>
              setWorkId(
                e.target.value,
              )
            }
            maxLength={80}
          />

          <label>
            Title
          </label>

          <input
            value={title}
            onChange={(e) =>
              setTitle(
                e.target.value,
              )
            }
            maxLength={200}
          />

          <label>
            Acceptance criteria
          </label>

          <textarea
            value={criteria}
            onChange={(e) =>
              setCriteria(
                e.target.value,
              )
            }
            maxLength={4000}
          />

          <button
            onClick={create}
            disabled={
              busy ||
              !client ||
              !networkReady
            }
          >
            Create request
          </button>
        </section>

        <section className="card">
          <div className="step">
            02
          </div>

          <h2>
            Submit evidence
          </h2>

          <label>
            Public evidence URL
          </label>

          <input
            value={evidence}
            onChange={(e) =>
              setEvidence(
                e.target.value,
              )
            }
            maxLength={1000}
          />

          <p className="small">
            Use public HTTPS evidence
            such as a deployed website,
            GitHub page, documentation,
            or another publicly readable
            artifact.
          </p>

          <button
            onClick={submit}
            disabled={
              busy ||
              !client ||
              !networkReady
            }
          >
            Submit evidence
          </button>

          <button
            className="secondary"
            onClick={verify}
            disabled={
              busy ||
              !client ||
              !networkReady
            }
          >
            Verify with GenLayer
          </button>
        </section>
      </div>

      <section
        className="card verification"
        style={{
          marginTop: 18,
        }}
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
              {shortAddress(
                txHash,
              )}
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
        Contract:{" "}
        <code>
          {CONTRACT_ADDRESS_DISPLAY}
        </code>{" "}
        · GenLayer Testnet Asimov
      </footer>
    </main>
  );
}
