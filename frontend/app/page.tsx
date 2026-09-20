"use client";

import { useEffect, useState } from "react";
import {
  connectWallet,
  getConnectedAccount,
  getWalletProvider,
  getWalletChainId,
  ensureStudioDevNetwork,
  getWork,
  sendWrite,
  STUDIO_DEV_CHAIN_ID,
  type ProofWorkResult,
} from "@/lib/genlayer";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [client, setClient] = useState<Awaited<ReturnType<typeof connectWallet>>["client"] | null>(null);
  const [networkReady, setNetworkReady] = useState(false);
  const [workId, setWorkId] = useState("demo-001");
  const [title, setTitle] = useState("Landing page delivery");
  const [criteria, setCriteria] = useState(
    "The evidence must show a responsive page, a clear headline, and working navigation.",
  );
  const [evidence, setEvidence] = useState("https://example.com");
  const [status, setStatus] = useState("Connect your wallet to begin.");
  const [result, setResult] = useState<ProofWorkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");

  async function refresh() {
    try {
      const value = await getWork(workId.trim());
      setResult(value);
    } catch {
      setResult(null);
    }
  }

  async function connect() {
    try {
      setBusy(true);
      setStatus("Checking wallet and GenLayer Studio Dev network…");
      const connected = await connectWallet();
      setWallet(connected.address);
      setClient(connected.client);
      setNetworkReady(true);
      setStatus("Wallet connected to GenLayer Studio Dev.");
    } catch (error) {
      setNetworkReady(false);
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let provider: ReturnType<typeof getWalletProvider> | null = null;

    async function restoreWallet() {
      try {
        provider = getWalletProvider();
        const account = await getConnectedAccount();
        const chainId = await getWalletChainId();

        if (account && chainId === STUDIO_DEV_CHAIN_ID.toLowerCase()) {
          const connected = await connectWallet();
          setWallet(connected.address);
          setClient(connected.client);
          setNetworkReady(true);
          setStatus("Wallet connected to GenLayer Studio Dev.");
        } else if (account) {
          setWallet(account);
          setNetworkReady(false);
          setStatus("Wallet detected. Connect to switch to GenLayer Studio Dev.");
        }
      } catch {
        // Wallet is optional until the user clicks Connect.
      }
    }

    restoreWallet();

    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const address = accounts?.[0] ?? "";
      setWallet(address);
      setClient(null);
      setNetworkReady(false);
      setStatus(address ? "Wallet account changed. Reconnect to continue." : "Wallet disconnected.");
    };

    const handleChainChanged = (...args: unknown[]) => {
      const chainId = String(args[0] ?? "").toLowerCase();
      setNetworkReady(chainId === STUDIO_DEV_CHAIN_ID.toLowerCase());
      setClient(null);
      setStatus(
        chainId === STUDIO_DEV_CHAIN_ID.toLowerCase()
          ? "GenLayer Studio Dev selected. Reconnect wallet to continue."
          : "Wrong network. Connect again to switch to GenLayer Studio Dev.",
      );
    };

    if (provider?.on) {
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (provider?.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  async function create() {
    if (!client || !networkReady) return setStatus("Connect your wallet to GenLayer Studio Dev first.");
    if (!workId.trim() || !title.trim() || !criteria.trim()) {
      return setStatus("Work ID, title, and acceptance criteria are required.");
    }

    setBusy(true);
    setStatus("Creating the work request on GenLayer…");
    setTxHash("");

    try {
      const response = await sendWrite(client, "create_work", [workId.trim(), title.trim(), criteria.trim()]);
      setTxHash(response.txHash);
      setStatus("Work request finalized. You can now submit public evidence.");
      await refresh();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!client || !networkReady) return setStatus("Connect your wallet to GenLayer Studio Dev first.");
    if (!evidence.startsWith("https://")) return setStatus("Evidence URL must start with https://");

    setBusy(true);
    setStatus("Submitting evidence to the ProofWork contract…");
    setTxHash("");

    try {
      const response = await sendWrite(client, "submit_evidence", [workId.trim(), evidence.trim()]);
      setTxHash(response.txHash);
      setStatus("Evidence submitted. The work is ready for GenLayer verification.");
      await refresh();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!client || !networkReady) return setStatus("Connect your wallet to GenLayer Studio Dev first.");

    setBusy(true);
    setStatus("GenLayer is evaluating the evidence and reaching validator consensus…");
    setTxHash("");

    try {
      const response = await sendWrite(client, "verify_work", [workId.trim()]);
      setTxHash(response.txHash);
      setStatus("Verification finalized. The consensus-backed verdict is now stored onchain.");
      await refresh();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function switchNetwork() {
    try {
      setBusy(true);
      await ensureStudioDevNetwork();
      setNetworkReady(true);
      setStatus("GenLayer Studio Dev selected. Click Connect wallet to authorize the account.");
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <nav>
        <div>
          <div className="brand">ProofWork</div>
          <div className="small">Evidence-backed work verification</div>
        </div>
        <div className="row">
          <span className="badge">Studio Dev · 61997</span>
          {!networkReady && <button className="secondary" onClick={switchNetwork} disabled={busy}>Switch network</button>}
          <button className="secondary" onClick={connect} disabled={busy}>
            {wallet ? shortAddress(wallet) : "Connect wallet"}
          </button>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">GENLAYER INTELLIGENT CONTRACT</p>
        <h1>Work that can be verified, not merely claimed.</h1>
        <p className="lead">
          ProofWork turns acceptance criteria and public evidence into a consensus-backed verdict.
          The Intelligent Contract retrieves the evidence, evaluates it with nondeterministic execution,
          and asks validators to independently verify the result.
        </p>
      </section>

      <div className="grid">
        <section className="card">
          <div className="step">01</div>
          <h2>Create work request</h2>
          <label>Work ID</label>
          <input value={workId} onChange={(e) => setWorkId(e.target.value)} maxLength={80} />
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <label>Acceptance criteria</label>
          <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} maxLength={4000} />
          <button onClick={create} disabled={busy || !client || !networkReady}>Create request</button>
        </section>

        <section className="card">
          <div className="step">02</div>
          <h2>Submit evidence</h2>
          <label>Public evidence URL</label>
          <input value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={1000} />
          <p className="small">Use public HTTPS evidence such as a deployed website, GitHub page, documentation, or another publicly readable artifact.</p>
          <button onClick={submit} disabled={busy || !client || !networkReady}>Submit evidence</button>
          <button className="secondary" onClick={verify} disabled={busy || !client || !networkReady}>Verify with GenLayer</button>
        </section>
      </div>

      <section className="card verification" style={{ marginTop: 18 }}>
        <div className="row space-between">
          <div><div className="step">03</div><h2>Consensus verdict</h2></div>
          <div className="row">
            {result && <span className="badge">{result.status}</span>}
            <button className="secondary" onClick={refresh} disabled={busy}>Refresh</button>
          </div>
        </div>
        <div className="status">{status}</div>
        {txHash && <div className="tx"><span>Transaction</span><code>{shortAddress(txHash)}</code></div>}
        {result && (
          <div className="result">
            <div><div className="small">Verification score</div><div className="score">{result.score}<span className="small"> / 100</span></div></div>
            <div><div className="small">Decision</div><strong className={result.approved ? "approved" : "rejected"}>{result.approved ? "APPROVED" : "NOT APPROVED"}</strong></div>
            <div className="summary"><div className="small">Evidence-grounded summary</div><p>{result.summary || "No verification summary yet."}</p></div>
          </div>
        )}
      </section>

      <footer>Contract: <code>0x4F0b…444c5</code> · GenLayer Studio Devnet</footer>
    </main>
  );
}
