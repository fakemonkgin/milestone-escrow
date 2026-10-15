import type {
  APIRequestContext,
} from "@playwright/test";

import {
  createSiweMessage,
} from "viem/siwe";

import type {
  PrivateKeyAccount,
} from "viem/accounts";

import {
  config,
} from "./config.js";


export async function
signInWithEthereum(
  api:
    APIRequestContext,

  account:
    PrivateKeyAccount
): Promise<void> {

  const nonceResponse =
    await api.get(
      "/auth/nonce"
    );

  if (
    !nonceResponse.ok()
  ) {
    throw new Error(
      "failed to request SIWE nonce"
    );
  }

  const {nonce} = await nonceResponse.json()

  const message =
    createSiweMessage({
      address:
        account.address,

      chainId:
        config.chainId,

      domain:
        config.siweDomain,

      uri:
        config.siweUri,

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
    await account
      .signMessage({
        message,
      });


  const verifyResponse =
    await api.post(
      "/auth/verify",
      {
        data: {
          message,
          signature,
        },
      }
    );


  if (
    !verifyResponse.ok()
  ) {
    const body =
      await verifyResponse.text();

    throw new Error(
      `SIWE verification failed: ${body}`
    );
  }
}