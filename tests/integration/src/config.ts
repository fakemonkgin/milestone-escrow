import {
  getAddress,
  type Address,
  type Hex,
} from "viem";


function requireEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required`
    );
  }

  return value;
}


function requireAddress(
  name: string
): Address {
  return getAddress(
    requireEnv(name)
  );
}


function requirePrivateKey(
  name: string
): Hex {
  const value =
    requireEnv(name);

  if (
    !/^0x[0-9a-fA-F]{64}$/.test(
      value
    )
  ) {
    throw new Error(
      `${name} must be a 32-byte private key`
    );
  }

  return value as Hex;
}


export const config = {
  apiUrl:
    requireEnv("API_URL"),

  rpcUrl:
    requireEnv("RPC_URL"),

  chainId:
    Number(
      requireEnv("CHAIN_ID")
    ),

  siweDomain:
    requireEnv(
      "SIWE_DOMAIN"
    ),

  siweUri:
    requireEnv(
      "SIWE_URI"
    ),

  escrowAddress:
    requireAddress(
      "ESCROW_ADDRESS"
    ),

  tokenAddress:
    requireAddress(
      "TOKEN_ADDRESS"
    ),

  alicePrivateKey:
    requirePrivateKey(
      "ALICE_PRIVATE_KEY"
    ),

  bobPrivateKey:
    requirePrivateKey(
      "BOB_PRIVATE_KEY"
    ),
};