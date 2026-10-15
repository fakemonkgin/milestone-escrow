import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  createPublicClient,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";

import {
  generateSiweNonce,
  parseSiweMessage,
} from "viem/siwe";

import {
  pool,
} from "./db.js";


export class AuthError
  extends Error {}


export const SESSION_COOKIE_NAME =
  "escrow_session";


function requireEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} environment variable is required`
    );
  }

  return value;
}


function requirePositiveIntegerEnv(
  name: string
): number {
  const raw =
    requireEnv(name);

  const value =
    Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${name} must be a positive integer`
    );
  }

  return value;
}


const rpcUrl =
  requireEnv("RPC_URL");

const siweDomain =
  requireEnv("SIWE_DOMAIN");

const siweUri =
  requireEnv("SIWE_URI");

const expectedChainId =
  requirePositiveIntegerEnv(
    "CHAIN_ID"
  );

export const nonceTtlSeconds =
  requirePositiveIntegerEnv(
    "AUTH_NONCE_TTL_SECONDS"
  );

export const sessionTtlSeconds =
  requirePositiveIntegerEnv(
    "SESSION_TTL_SECONDS"
  );


export const sessionCookieSecure =
  siweUri.startsWith(
    "https://"
  );


const authPublicClient =
  createPublicClient({
    transport:
      http(rpcUrl),
  });


function hashSessionToken(
  token: string
): string {
  return createHash(
    "sha256"
  )
    .update(token)
    .digest("hex");
}


export async function issueNonce():
  Promise<string> {
  const nonce =
    generateSiweNonce();

  const expiresAt =
    new Date(
      Date.now() +
        nonceTtlSeconds *
          1000
    );

  await pool.query(
    `
    INSERT INTO auth_nonces (
      nonce,
      expires_at
    )
    VALUES ($1, $2)
    `,
    [
      nonce,
      expiresAt,
    ]
  );

  return nonce;
}


export async function
verifySiweAndCreateSession({
  message,
  signature,
}: {
  message: string;
  signature: string;
}): Promise<{
  address: Address;
  sessionToken: string;
  expiresAt: Date;
}> {
  if (
    !/^0x[0-9a-fA-F]+$/.test(
      signature
    )
  ) {
    throw new AuthError(
      "invalid signature"
    );
  }

  let parsed:
    ReturnType<
      typeof parseSiweMessage
    >;

  try {
    parsed =
      parseSiweMessage(
        message
      );
  } catch {
    throw new AuthError(
      "invalid SIWE message"
    );
  }

  const {
    address,
    nonce,
    domain,
    uri,
    chainId,
  } = parsed;

  if (
    !address ||
    !nonce ||
    !domain ||
    !uri ||
    chainId === undefined
  ) {
    throw new AuthError(
      "SIWE message is missing required fields"
    );
  }

  if (
    domain !== siweDomain
  ) {
    throw new AuthError(
      "invalid SIWE domain"
    );
  }

  if (
    uri !== siweUri
  ) {
    throw new AuthError(
      "invalid SIWE URI"
    );
  }

  if (
    chainId !==
    expectedChainId
  ) {
    throw new AuthError(
      "invalid SIWE chain"
    );
  }

  const nonceResult =
    await pool.query(
      `
      SELECT nonce
      FROM auth_nonces
      WHERE
        nonce = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      `,
      [nonce]
    );

  if (
    nonceResult.rowCount !==
    1
  ) {
    throw new AuthError(
      "nonce is invalid, expired, or already used"
    );
  }

  const checksumAddress =
    getAddress(address);

  const valid =
    await authPublicClient
      .verifySiweMessage({
        address:
          checksumAddress,

        message,

        signature:
          signature as Hex,

        domain:
          siweDomain,

        nonce,

        time:
          new Date(),
      });

  if (!valid) {
    throw new AuthError(
      "SIWE signature verification failed"
    );
  }

  // 原子消费 nonce。
  // 两个请求同时重放，
  // 最多只有一个能够成功。
  const consumeResult =
    await pool.query(
      `
      UPDATE auth_nonces
      SET used_at = NOW()
      WHERE
        nonce = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING nonce
      `,
      [nonce]
    );

  if (
    consumeResult.rowCount !==
    1
  ) {
    throw new AuthError(
      "nonce has already been consumed"
    );
  }

  const sessionToken =
    randomBytes(32)
      .toString(
        "base64url"
      );

  const sessionHash =
    hashSessionToken(
      sessionToken
    );

  const expiresAt =
    new Date(
      Date.now() +
        sessionTtlSeconds *
          1000
    );

  await pool.query(
    `
    INSERT INTO auth_sessions (
      session_hash,
      address,
      expires_at
    )
    VALUES ($1, $2, $3)
    `,
    [
      sessionHash,

      checksumAddress
        .toLowerCase(),

      expiresAt,
    ]
  );

  return {
    address:
      checksumAddress,

    sessionToken,

    expiresAt,
  };
}


export async function
getSessionAddress(
  sessionToken:
    string | undefined
): Promise<Address | null> {
  if (!sessionToken) {
    return null;
  }

  const sessionHash =
    hashSessionToken(
      sessionToken
    );

  const result =
    await pool.query(
      `
      SELECT address
      FROM auth_sessions
      WHERE
        session_hash = $1
        AND expires_at > NOW()
      `,
      [sessionHash]
    );

  if (
    result.rowCount !== 1
  ) {
    return null;
  }

  return getAddress(
    result.rows[0].address
  );
}


export async function
revokeSession(
  sessionToken:
    string | undefined
): Promise<void> {
  if (!sessionToken) {
    return;
  }

  const sessionHash =
    hashSessionToken(
      sessionToken
    );

  await pool.query(
    `
    DELETE FROM auth_sessions
    WHERE session_hash = $1
    `,
    [sessionHash]
  );
}