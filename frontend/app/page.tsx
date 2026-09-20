```tsx
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

type WalletClient =
  Awaited<ReturnType<typeof connectWallet>>["client"];

/* ============================================================
   Helpers
   ============================================================ */

function shortAddress(
  address: string,
): string {
  if (!address) {
    return "";
  }

  return (
    address.slice(0, 6) +
    "…" +
    address.slice(-4)
  );
}

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
      function (_key, nestedValue) {
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

function errorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    const details =
      error as Error & {
        code?: unknown;
        shortMessage?: unknown;
        details?: unknown;
        cause?: unknown;
        data?: unknown;
      };

    const parts: string[] = [];

    if (details.shortMessage) {
      parts.push(
        String(details.shortMessage),
      );
    } else {
      parts.push(details.message);
    }

    if (
      details.code !==
      undefined
    ) {
      parts.push(
        "Code: " +
          String(details.code),
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

    return parts.join("\n");
  }

  return formatErrorValue(error);
}

/* ============================================================
   Page
   ============================================================ */

export default function Home() {
  /* ==========================================================
     Wallet
     ========================================================== */

  const [
    wallet,
    setWallet,
  ] = useState("");

  const [
    client,
    setClient,
  ] =
    useState<WalletClient | null>(
      null,
    );

  const [
    walletDetected,
    setWalletDetected,
  ] = useState(false);

  const [
    networkReady,
    setNetworkReady,
  ] = useState(false);

  /* ==========================================================
     Form
     ========================================================== */

  const [
    workId,
    setWorkId,
  ] = useState("");

  const [
    title,
    setTitle,
  ] = useState("");

  const [
    criteria,
    setCriteria,
  ] = useState("");

  const [
    evidence,
    setEvidence,
  ] = useState("");

  /* ==========================================================
     UI
     ========================================================== */

  const [
    status,
    setStatus,
  ] = useState(
    "Connect your wallet to begin.",
  );

  const [
    result,
    setResult,
  ] =
    useState<ProofWorkResult | null>(
      null,
    );

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    txHash,
    setTxHash,
  ] = useState("");

  /* ==========================================================
     Refresh work
     ========================================================== */

  async function refresh() {
    const id =
      workId.trim();

    if (!id) {
      setResult(null);
      return;
    }

    try {
      const value =
        await getWork(id);

      setResult(value);
    } catch (error) {
      console.error(
        "ProofWork read error:",
        error,
      );

      setResult(null);
    }
  }

  /* ==========================================================
     Connect
     ========================================================== */

  async function connect() {
    try {
      setBusy(true);

      setStatus(
        "Connecting wallet and checking GenLayer Bradbury…",
      );

      const connected =
        await connectWallet();

      setWallet(
        connected.address,
      );

      setClient(
        connected.client,
      );

      setWalletDetected(
        true,
      );

      setNetworkReady(
        true,
      );

      setStatus(
        "Wallet connected to GenLayer Bradbury Testnet.",
      );
    } catch (error) {
      console.error(
        "Wallet connection error:",
        error,
      );

      setClient(null);
      setNetworkReady(
        false,
      );

      setStatus(
        "Wallet connection failed:\n" +
          errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  /* ==========================================================
     Change wallet
     ========================================================== */

  async function changeWallet() {
    try {
      setBusy(true);

      setStatus(
        "Opening wallet account selector…",
      );

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
         * Some wallets do not implement
         * wallet_requestPermissions.
         */
      }

      const accounts =
        (await provider.request({
          method:
            "eth_requestAccounts",
        })) as string[];

      const address =
        accounts?.[0] as
          | `0x${string}`
          | undefined;

      if (!address) {
        throw new Error(
          "No wallet account was selected.",
        );
      }

      const connected =
        await connectWallet();

      setWallet(
        connected.address,
      );

      setClient(
        connected.client,
      );

      setWalletDetected(
        true,
      );

      setNetworkReady(
        true,
      );

      setStatus(
        "Wallet changed to " +
          shortAddress(
            connected.address,
          ) +
          ".",
      );
    } catch (error) {
      console.error(
        "Change wallet error:",
        error,
      );

      setStatus(
        "Could not change wallet:\n" +
          errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  /* ==========================================================
     Disconnect frontend session
     ========================================================== */

  function disconnectWallet() {
    setWallet("");
    setClient(null);
    setNetworkReady(false);
    setResult(null);
    setTxHash("");

    setStatus(
      "ProofWork wallet session disconnected.",
    );
  }

  /* ==========================================================
     Switch network
     ========================================================== */

  async function switchNetwork() {
    try {
      setBusy(true);

      setStatus(
        "Switching wallet to GenLayer Bradbury Testnet…",
      );

      await ensureBradburyNetwork();

      const chainId =
        await getWalletChainId();

      if (
        chainId.toLowerCase() !==
        TESTNET_BRADBURY_CHAIN_ID.toLowerCase()
      ) {
        throw new Error(
          "The wallet did not switch to GenLayer Bradbury Testnet.",
        );
      }

      setNetworkReady(true);
      setClient(null);

      setStatus(
        "GenLayer Bradbury Testnet selected. Connect your wallet to continue.",
      );
    } catch (error) {
      console.error(
        "Network switch error:",
        error,
      );

      setNetworkReady(
        false,
      );

      setStatus(
        "Network switch failed:\n" +
          errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  /* ==========================================================
     Wallet detection and events
     ========================================================== */

  useEffect(() => {
    let mounted = true;

    const provider =
      (() => {
        try {
          return getWalletProvider();
        } catch {
          return null;
        }
      })();

    async function restoreWallet() {
      if (!provider) {
        if (!mounted) {
          return;
        }

        setWalletDetected(
          false,
        );

        setWallet("");
        setClient(null);
        setNetworkReady(
          false,
        );

        setStatus(
          "No browser wallet detected. Connect a wallet to begin.",
        );

        return;
      }

      try {
        setWalletDetected(
          true,
        );

        const accounts =
          (await provider.request({
            method:
              "eth_accounts",
          })) as string[];

        if (!mounted) {
          return;
        }

        const account =
          (accounts?.[0] as
            | `0x${string}`
            | undefined) ??
          null;

        if (!account) {
          setWallet("");
          setClient(null);
          setNetworkReady(
            false,
          );

          setStatus(
            "Wallet detected. Connect your wallet to begin.",
          );

          return;
        }

        setWallet(account);

        const chainId =
          String(
            await provider.request({
              method:
                "eth_chainId",
            }),
          ).toLowerCase();

        if (!mounted) {
          return;
        }

        const onBradbury =
          chainId ===
          TESTNET_BRADBURY_CHAIN_ID.toLowerCase();

        if (!onBradbury) {
          setClient(null);

          setNetworkReady(
            false,
          );

          setStatus(
            "Wallet detected, but it is on the wrong network. Switch to GenLayer Bradbury Testnet.",
          );

          return;
        }

        setNetworkReady(
          true,
        );

        setClient(null);

        setStatus(
          "Wallet detected: " +
            shortAddress(account) +
            ". Ready to connect.",
        );
      } catch (error) {
        console.error(
          "Wallet restore error:",
          error,
        );

        if (!mounted) {
          return;
        }

        setWalletDetected(
          true,
        );

        setClient(null);
        setNetworkReady(
          false,
        );

        setStatus(
          "Wallet detection failed:\n" +
            errorMessage(error),
        );
      }
    }

    const handleAccountsChanged = (
      ...args: unknown[]
    ) => {
      if (!mounted) {
        return;
      }

      const accounts =
        Array.isArray(args[0])
          ? (args[0] as string[])
          : [];

      const address =
        accounts[0] ?? "";

      setWallet(address);
      setClient(null);

      if (!address) {
        setNetworkReady(
          false,
        );

        setStatus(
          "Wallet account disconnected from the browser wallet.",
        );

        return;
      }

      setWalletDetected(
        true,
      );

      setNetworkReady(
        false,
      );

      setStatus(
        "Wallet changed to " +
          shortAddress(address) +
          ". Connect again to continue.",
      );
    };

    const handleChainChanged = (
      ...args: unknown[]
    ) => {
      if (!mounted) {
        return;
      }

      const chainId =
        String(
          args[0] ?? "",
        ).toLowerCase();

      const correctNetwork =
        chainId ===
        TESTNET_BRADBURY_CHAIN_ID.toLowerCase();

      setClient(null);

      setNetworkReady(
        correctNetwork,
      );

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

    void restoreWallet();

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
      mounted = false;

      if (
        provider?.removeListener
      ) {
        provider.removeListener(
          "accountsChanged",
          handleAccountsChanged,
        );

        provider.removeListener(
          "chainChanged",
          handleChainChanged,
        );
      }
    };
  }, []);

  /* ==========================================================
     Create request
     ========================================================== */

  async function create() {
    if (!wallet) {
      setStatus(
        "Connect your wallet first.",
      );
      return;
    }

    if (
      !client ||
      !networkReady
    ) {
      setStatus(
        "Connect your wallet to GenLayer Bradbury Testnet first.",
      );
      return;
    }

    const id
```
