"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useConnection,
  useSignMessage,
} from "wagmi";

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
        session.address ?? null
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


  async function signIn():
    Promise<void> {
    setErrorMessage(null);

    if (!apiUrl) {
      setErrorMessage(
        "NEXT_PUBLIC_API_URL is not configured."
      );

      return;
    }

    if (
      !connection.address ||
      connection.chainId ===
        undefined
    ) {
      setErrorMessage(
        "Connect your wallet first."
      );

      return;
    }

    try {
      setLoading(true);

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
            connection.address,

          chainId:
            connection.chainId,

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


  async function logout():
    Promise<void> {
    if (!apiUrl) {
      return;
    }

    await fetch(
      `${apiUrl}/auth/logout`,
      {
        method:
          "POST",

        credentials:
          "include",
      }
    );

    setSessionAddress(
      null
    );
  }


  return (
    <section>
      <h2>
        Authentication
      </h2>

      {sessionAddress ? (
        <>
          <p>
            Signed in as:
            {" "}
            {sessionAddress}
          </p>

          <button
            type="button"
            onClick={() => {
              void logout();
            }}
          >
            Sign Out
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={
            loading ||
            !connection.address
          }
          onClick={() => {
            void signIn();
          }}
        >
          {loading
            ? "Check wallet..."
            : "Sign in with Ethereum"}
        </button>
      )}

      {errorMessage && (
        <p>
          Error:
          {" "}
          {errorMessage}
        </p>
      )}
    </section>
  );
}