"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useConnection,
  useSignMessage,
} from "wagmi";

import { foundry } from "wagmi/chains";

import {
  createSiweMessage,
} from "viem/siwe";


type SessionResponse = {
  authenticated: boolean;
  address?:
    `0x${string}`;
};


export function SiweAuth() {
  const connection =
    useConnection();

  const signMessage =
    useSignMessage();

  const [
    sessionAddress,
    setSessionAddress,
  ] =
    useState<
      `0x${string}` | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);


  const apiUrl =
    process.env
      .NEXT_PUBLIC_API_URL;

  useEffect(() => {
  if (!apiUrl) {
    return;
  }

  let cancelled = false;

  void (async () => {
    try {
      const response =
        await fetch(
          `${apiUrl}/auth/session`,
          {
            credentials:
              "include",
          }
        );

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setSessionAddress(null);
        return;
      }

      const session:SessionResponse = await response.json()

      if (cancelled) {
        return;
      }

     setSessionAddress(
        session.authenticated
          ? (session.address ?? null)
          : null
      );
    } catch {
      if (!cancelled) {
        setSessionAddress(null);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [apiUrl]);

  const walletAddress = connection.address;

const isAuthenticatedWallet =
  Boolean(
    walletAddress &&
    sessionAddress &&
    walletAddress.toLowerCase() ===
      sessionAddress.toLowerCase()
  );

const isSessionMismatch =
  Boolean(
    sessionAddress &&
    !isAuthenticatedWallet
  );


  async function signIn():
    Promise<void> {
    setErrorMessage(null);

    if (!apiUrl) {
      setErrorMessage(
        "NEXT_PUBLIC_API_URL is not configured."
      );

      return;
    }

   const signingAddress = connection.address;
    const signingConnector = connection.connector;

    if (!signingAddress || !signingConnector) {
      setErrorMessage("Connect your wallet first.");
      return;
    }

    try {
      setLoading(true);
      const walletChainId =
      await signingConnector.getChainId();

    if (walletChainId !== foundry.id) {
      throw new Error(
        `Wrong wallet network: ${walletChainId}. ` +
        `Please switch to Anvil Local (${foundry.id}).`
      );
    }

      const nonceResponse =
        await fetch(
          `${apiUrl}/auth/nonce`,
          {
            credentials:
              "include",
          }
        );

      if (
        !nonceResponse.ok
      ) {
        throw new Error(
          "Failed to request authentication nonce."
        );
      }

      const {
        nonce,
      } =
        await nonceResponse
          .json() as {
            nonce: string;
          };


      const message =
        createSiweMessage({
          address:
            signingAddress,

          chainId:walletChainId,

          domain:
            window.location.host,

          uri:
            window.location.origin,

          version: "1",

          nonce,

          statement:
            "Sign in to Milestone Escrow.",

          issuedAt:
            new Date(),

          expirationTime:
            new Date(
              Date.now() +
                10 *
                  60 *
                  1000
            ),
        });


      const signature =
        await signMessage
          .mutateAsync({
            message,
          });


      const verifyResponse =
        await fetch(
          `${apiUrl}/auth/verify`,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                message,
                signature,
              }),
          }
        );


      if (
        !verifyResponse.ok
      ) {
        const body =
          await verifyResponse
            .json()
            .catch(
              () => null
            );

        throw new Error(
          body?.error ??
            "Sign-in failed."
        );
      }


      const session =
        await verifyResponse
          .json() as {
            address:
              `0x${string}`;
          };

      setSessionAddress(
        session.address
      );
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setErrorMessage(
          error.message
        );
      } else {
        setErrorMessage(
          "Sign-in failed."
        );
      }
    } finally {
      setLoading(false);
    }
  }


  async function logout(): Promise<void> {
  setErrorMessage(null);

  if (!apiUrl) {
    setErrorMessage("API URL is not configured.");
    return;
  }

  try {
    setLoading(true);

    const response = await fetch(
      `${apiUrl}/auth/logout`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to sign out.");
    }

    setSessionAddress(null);
  } catch (error) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Sign-out failed."
    );
  } finally {
    setLoading(false);
  }
}


 return (
  <section className="space-y-4">
    <p className="text-sm text-slate-500">
      Sign a message to verify wallet ownership.
      No gas fee is required.
    </p>

    {isSessionMismatch ? (
      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p
          role="alert"
          className="text-sm font-semibold text-amber-800"
        >
          Wallet and session do not match.
        </p>

        <p className="break-all text-xs text-amber-800">
          Session: {sessionAddress}
        </p>

        <p className="break-all text-xs text-amber-800">
          Wallet: {walletAddress ?? "Not connected"}
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={() => void logout()}
          className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? "Signing out..." : "Sign Out Old Session"}
        </button>
      </div>
    ) : isAuthenticatedWallet ? (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-emerald-700">
          ✓ Authenticated
        </p>

        <p className="break-all font-mono text-xs text-slate-500">
          {sessionAddress}
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={() => void logout()}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    ) : (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {walletAddress
            ? "Wallet connected. Authentication required."
            : "Connect your wallet first."}
        </p>

        <button
          type="button"
          disabled={loading || !walletAddress}
          onClick={() => void signIn()}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading
            ? "Waiting for signature..."
            : "Sign in with Ethereum"}
        </button>
      </div>
    )}

    {errorMessage && (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {errorMessage}
      </p>
    )}
  </section>
);
}