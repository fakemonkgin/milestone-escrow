import type { Address, Hex } from "viem";

export type ReleaseMarker = Hex | `signing:${string}`;

export function makeReleaseStorageKey(
  chainId: number,
  escrow: Address,
  client: Address,
  projectId: Hex,
  milestoneIndex: number
): string {
  return [
    "escrow-release-v1",
    chainId,
    escrow.toLowerCase(),
    client.toLowerCase(),
    projectId.toLowerCase(),
    milestoneIndex,
  ].join(":");
}

export function loadReleaseMarker(
  key: string
): ReleaseMarker | null {
  const value = window.localStorage.getItem(key);

  if (value === null) return null;

  if (
    /^0x[0-9a-fA-F]{64}$/.test(value) ||
    /^signing:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    return value as ReleaseMarker;
  }

  throw new Error(
    "Invalid saved payment record. Payment remains locked."
  );
}

export function createReleaseIntent(): ReleaseMarker {
  return `signing:${window.crypto.randomUUID()}`;
}

export function markerTransactionHash(
  marker: ReleaseMarker | null
): Hex | null {
  return marker?.startsWith("0x")
    ? (marker as Hex)
    : null;
}

export function replaceReleaseMarker(
  key: string,
  expected: ReleaseMarker | null,
  next: ReleaseMarker | null
): void {
  if (loadReleaseMarker(key) !== expected) {
    throw new Error(
      "Saved payment record changed. Reload and verify its status."
    );
  }

  if (next === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, next);
  }
}