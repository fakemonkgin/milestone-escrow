"use client";

import {
  useState,
  type ReactNode,
} from "react";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  WagmiProvider,
} from "wagmi";

import {
  wagmiConfig,
} from "@/lib/wagmi";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({
  children,
}: ProvidersProps) {
  const [queryClient] = useState(
    () => new QueryClient()
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider
        client={queryClient}
      >
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}