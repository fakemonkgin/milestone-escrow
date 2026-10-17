"use client";

import { useSyncExternalStore } from "react";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "wagmi";

const subscribe = () => () => {};

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWallet() {
   const hasHydrated = useHasHydrated();
   const connection = useConnection();

  const connectors = useConnectors();
  const connectMutation = useConnect()
  const disconnectMutation = useDisconnect();

    if (!hasHydrated) {
    return (
      <div>
        <p>Checking wallet connection...</p>
      </div>
    );
  }
  if (connection.isConnected) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />

        <span className="text-sm font-medium text-emerald-700">
          Connected
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-500">
          Wallet address
        </p>

        <p
          className="mt-2 font-mono text-sm font-semibold text-slate-800"
          title={connection.address}
        >
          {connection.address
            ? formatAddress(connection.address)
            : "Address unavailable"}
        </p>
      </div>

      <button
        type="button"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
        disabled={disconnectMutation.isPending}
        onClick={() => disconnectMutation.mutate()}
      >
        {disconnectMutation.isPending
          ? "Disconnecting..."
          : "Disconnect Wallet"}
      </button>
    </div>
  );
}

 return (
  <div className="space-y-3">
    <p className="text-sm text-slate-500">
      Connect your wallet to start using escrow.
    </p>

    {connectors.map((connector) => (
      <button
        key={connector.uid}
        type="button"
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={connectMutation.isPending}
        onClick={() =>
          connectMutation.mutate({ connector })
        }
      >
        {connectMutation.isPending
          ? "Connecting..."
          : `Connect ${connector.name}`}
      </button>
    ))}
  </div>
);
}