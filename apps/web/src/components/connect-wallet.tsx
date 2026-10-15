"use client";

import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "wagmi";

export function ConnectWallet() {
  const connection = useConnection();

  const connectors = useConnectors();

  const {
    connect,
    isPending,
  } = useConnect();

  const {
    disconnect,
  } = useDisconnect();

  if (connection.isConnected) {
    return (
      <div>
        <p>
          Connected:
          {" "}
          {connection.address}
        </p>

        <button
          type="button"
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          type="button"
          disabled={isPending}
          onClick={() =>
            connect({
              connector,
            })
          }
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}