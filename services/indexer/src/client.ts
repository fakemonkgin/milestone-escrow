import {
  createPublicClient,
  http,
} from "viem";

const rpcUrl = process.env.RPC_URL;

if (!rpcUrl) {
  throw new Error(
    "RPC_URL environment variable is required"
  );
}

export const publicClient =
  createPublicClient({
    transport: http(rpcUrl),
  });