"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  connectWallet,
  restoreWallet,
  changeWallet,
  getWalletProvider,
  ensureBradburyNetwork,
  getWork,
  sendWrite,
  BRADBURY_CHAIN_ID,
  BRADBURY_CHAIN_ID_DECIMAL,
  BRADBURY_EXPLORER,
  CONTRACT_ADDRESS,
  type ProofWorkResult,
} from "@/lib/genlayer";

function shortAddress(
  address: string,
) {
  if (!address) {
    return "";
  }

  return `${address.slice(
    0,
    6,
  )}…${address.slice(-4)}`;
}

function shortHash(
  hash: string,
) {
  if (!hash) {
    return "";
  }

  return `${hash.slice(
    0,
    10,
  )}…${hash.slice(-8)}`;
}

function errorMessage(
  error: unknown,
) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export default function Home() {
  const [wallet, setWallet] =
    useState("");

  const [client, setClient] =
    useState<
      Awaited<
        ReturnType<
          typeof connectWallet
        >
      >["client"] | null
    >(null);

  const [networkReady, setNetworkReady] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [walletAction, setWalletAction] =
    useState<
      | "connect"
      | "disconnect"
      | "change"
      | "switch"
      | null
    >(null);

  const [workId, setWorkId] =
    useState("demo-001");

  const [title, setTitle] =
    useState(
      "Landing page delivery",
    );

  const [criteria, setCriteria] =
    useState(
      "The evidence must show a responsive page, a clear headline, and working navigation.",
    );

  const [evidence, setEvidence] =
    useState(
      "https://example.com",
    );

  const [status, setStatus] =
    useState(
      "Connect your wallet to begin.",
    );

  const [result, setResult] =
    useState<ProofWorkResult | null>(
      null,
    );

  const [txHash, setTxHash] =
    useState("");

  async function refresh() {
    const id =
      workId.trim();

    if (!id) {
      return;
    }

    try {
      const work =
        await getWork(id);

      setResult(work);
    } catch {
      setResult(null);
    }
  }

  async function connect() {
    try {
      setBusy(true);
      setWalletAction("connect");

      setStatus(
        "Connecting to GenLayer Testnet Bradbury…",
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
      setWalletAction(null);
    }
  }

  async function handleChangeWallet() {
    try {
      setBusy(true);
      setWalletAction("change");

      setStatus(
        "Opening wallet account selector…",
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
      setWalletAction(null);
    }
  }

  function disconnect() {
    setWalletAction(
      "disconnect",
    );

    setStatus(
      "Disconnecting ProofWork wallet session…",
    );

    window.setTimeout(() => {
      setWallet("");
      setClient(null);
      setNetworkReady(false);
      setTxHash("");
      setResult(null);

      setStatus(
        "Wallet disconnected from ProofWork.",
      );

      setWalletAction(null);
    }, 450);
  }

  async function switchNetwork() {
    try {
      setBusy(true);
      setWalletAction("switch");

      setStatus(
        "Switching to GenLayer Testnet Bradbury…",
      );

      await ensureBradburyNetwork();

      setNetworkReady(true);

      setStatus(
        "GenLayer Testnet Bradbury selected.",
      );
    } catch (error) {
      setStatus(
        errorMessage(error),
      );
    } finally {
      setBusy(false);
      setWalletAction(null);
    }
  }

  useEffect(() => {
    let provider:
      | ReturnType<
          typeof getWalletProvider
        >
      | null = null;

    try {
      provider =
        getWalletProvider();
    } catch {
      provider = null;
    }

    async function restore() {
      if (!provider) {
        return;
      }

      try {
        const connected =
          await restoreWallet();

        if (!connected) {
          return;
        }

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
      } catch {
        // Wallet is optional.
      }
    }

    void restore();

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

      const correctNetwork =
        chainId ===
        BRADBURY_CHAIN_ID.toLowerCase();

      setClient(null);

      setNetworkReady(
        correctNetwork,
      );

      if (correctNetwork) {
        setStatus(
          `GenLayer Testnet Bradbury selected · Chain ${BRADBURY_CHAIN_ID_DECIMAL}.`,
        );
      } else {
        setStatus(
          "Wrong network. Switch to GenLayer Testnet Bradbury.",
        );
      }
    };

    if (provider) {
      provider.on?.(
        "accountsChanged",
        handleAccountsChanged,
      );

      provider.on?.(
        "chainChanged",
        handleChainChanged,
      );
    }

    return () => {
      if (!provider) {
        return;
      }

      provider.removeListener?.(
        "accountsChanged",
        handleAccountsChanged,
      );

      provider.removeListener?.(
        "chainChanged",
        handleChainChanged,
      );
    };
  }, []);

  async function create() {
    if (
      !client ||
      !networkReady
    ) {
      setStatus(
        "Connect your wallet to GenLayer Testnet Bradbury first.",
      );

      return;
    }

    const id =
      workId.trim();

    const workTitle =
      title.trim();

    const workCriteria =
      criteria.trim();

    if (
      !id ||
      !workTitle ||
      !workCriteria
    ) {
      setStatus(
        "Work ID, title, and acceptance criteria are required.",
      );

      return;
    }

    setBusy(true);

    setStatus(
      "Creating work request on GenLayer…",
    );

    setTxHash("");

    try {
      const response =
        await sendWrite(
          client,
          "create_work",
          [
            id,
            workTitle,
            workCriteria,
          ],
        );

      setTxHash(
        response.txHash,
      );

      setStatus(
        "Work request finalized.",
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
    if (
      !client ||
      !networkReady
    ) {
      setStatus(
        "Connect your wallet to GenLayer Testnet Bradbury first.",
      );

      return;
    }

    const url =
      evidence.trim();

    if (
      !url.startsWith(
        "https://",
      )
    ) {
      setStatus(
        "Evidence URL must start with https://",
      );

      return;
    }

    setBusy(true);

    setStatus(
      "Submitting evidence…",
    );

    setTxHash("");

    try {
      const response =
        await sendWrite(
          client,
          "submit_evidence",
          [
            workId.trim(),
            url,
          ],
        );

      setTxHash(
        response.txHash,
      );

      setStatus(
        "Evidence submitted successfully.",
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
    if (
      !client ||
      !networkReady
    ) {
      setStatus(
        "Connect your wallet to GenLayer Testnet Bradbury first.",
      );

      return;
    }

    if (!workId.trim()) {
      setStatus(
        "Enter a Work ID before verification.",
      );

      return;
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

  const connected =
    Boolean(
      wallet &&
        client &&
        networkReady,
    );

  const contractDisplay =
    shortAddress(
      CONTRACT_ADDRESS,
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

        <div className="wallet-area">
          <span className="network-badge">
            Bradbury ·{" "}
            {BRADBURY_CHAIN_ID_DECIMAL}
          </span>

          {!connected ? (
            <div className="wallet-controls">
              {wallet &&
                !networkReady && (
                  <span className="wallet-warning">
                    Wrong network
                  </span>
                )}

              <button
                className={`wallet-button ${
                  busy
                    ? "is-loading"
                    : ""
                }`}
                onClick={
                  wallet &&
                  !networkReady
                    ? switchNetwork
                    : connect
                }
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" />

                    {walletAction ===
                    "switch"
                      ? "Switching…"
                      : "Connecting…"}
                  </>
                ) : (
                  <>
                    <span className="wallet-icon">
                      ◈
                    </span>

                    {wallet &&
                    !networkReady
                      ? "Switch network"
                      : "Connect wallet"}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="connected-wallet">
              <span className="connected-pill">
                <span className="pulse-dot" />

                <span>
                  Connected
                </span>

                <span className="wallet-address">
                  {shortAddress(
                    wallet,
                  )}
                </span>
              </span>

              <button
                className="wallet-action"
                onClick={
                  handleChangeWallet
                }
                disabled={busy}
              >
                {walletAction ===
                "change" ? (
                  <>
                    <span className="spinner small-spinner" />
                    Changing…
                  </>
                ) : (
                  "Change wallet"
                )}
              </button>

              <button
                className="disconnect-button"
                onClick={disconnect}
                disabled={busy}
              >
                {walletAction ===
                "disconnect" ? (
                  <>
                    <span className="spinner small-spinner" />
                    Disconnecting…
                  </>
                ) : (
                  "Disconnect"
                )}
              </button>
            </div>
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
            onChange={(event) =>
              setWorkId(
                event.target.value,
              )
            }
            maxLength={80}
            placeholder="demo-001"
          />

          <label>
            Title
          </label>

          <input
            value={title}
            onChange={(event) =>
              setTitle(
                event.target.value,
              )
            }
            maxLength={200}
            placeholder="Describe the work"
          />

          <label>
            Acceptance criteria
          </label>

          <textarea
            value={criteria}
            onChange={(event) =>
              setCriteria(
                event.target.value,
              )
            }
            maxLength={4000}
            placeholder="What must the evidence prove?"
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
            onChange={(event) =>
              setEvidence(
                event.target.value,
              )
            }
            maxLength={1000}
            placeholder="https://..."
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

            <a
              href={`${BRADBURY_EXPLORER}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              <code>
                {shortHash(txHash)}
              </code>
            </a>
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
                Evidence-grounded
                summary
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
          {contractDisplay}
        </code>{" "}
        · GenLayer Testnet Bradbury ·
        Chain{" "}
        {BRADBURY_CHAIN_ID_DECIMAL}
      </footer>
    </main>
  );
}
