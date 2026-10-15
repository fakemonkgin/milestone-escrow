import {createConfig,http} from "wagmi";
import { foundry } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL;

if (!rpcUrl) {
  throw new Error(
    "NEXT_PUBLIC_RPC_URL is required"
  );
}

export const wagmiConfig = createConfig({
  chains: [foundry],
  connectors: [injected(),],
  ssr: true,
  transports: {
    [foundry.id]: http(rpcUrl),
  },
});