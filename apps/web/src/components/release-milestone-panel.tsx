"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  useConnection,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";

import {
  BaseError,
  UserRejectedRequestError,
  formatUnits,
  getAddress,
} from "viem";

import {
  createReleaseIntent,
  loadReleaseMarker,
  makeReleaseStorageKey,
  markerTransactionHash,
  replaceReleaseMarker,
  type ReleaseMarker,
} from "@/lib/pending-release";

import {
  ESCROW_ADDRESS,
  milestoneEscrowAbi,
} from "@/lib/contracts";

import type {
  CreatedMilestone,
  CreatedProject,
} from "@/lib/project-types";

type ReleaseMilestonePanelProps = {
  project:
    CreatedProject;

  milestone:
    CreatedMilestone;

  onProjectUpdated:
    (
      project:
        CreatedProject
    ) => void;
};

type ReleaseStatus =
  | "IDLE"
  | "CHECKING"
  | "AWAITING_WALLET"
  | "CONFIRMING"
  | "CONFIRMATION_UNKNOWN"
  | "SYNCING"
  | "SYNC_DELAYED"
  | "PAID"
  | "FAILED";

  type InitialRecovery = {
  marker: ReleaseMarker | null;
  error: string | null;
};

function readInitialRecovery(
  key: string
): InitialRecovery {
  try {
    return {
      marker: loadReleaseMarker(key),
      error: null,
    };
  } catch (error) {
    return {
      marker: null,
      error:
        error instanceof Error && error.message
          ? error.message
          : "Unable to restore payment status.",
    };
  }
}

function subscribeClientReady() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function ReleaseMilestonePanel(
  props: ReleaseMilestonePanelProps
) {
  const publicClient = usePublicClient();

  const clientReady = useSyncExternalStore(
    subscribeClientReady,
    getClientSnapshot,
    getServerSnapshot
  );

  if (!clientReady || !publicClient) {
    return (
      <p role="status">
        Restoring payment status...
      </p>
    );
  }

  const pendingReleaseKey = makeReleaseStorageKey(
    publicClient.chain.id,
    ESCROW_ADDRESS,
    props.project.client,
    props.project.id,
    props.milestone.index
  );

  return (
    <ReleaseMilestonePanelContent
      key={pendingReleaseKey}
      {...props}
      pendingReleaseKey={pendingReleaseKey}
    />
  );
}

function ReleaseMilestonePanelContent({
  project,
  milestone,
  onProjectUpdated,
  pendingReleaseKey,
}: ReleaseMilestonePanelProps & {
  pendingReleaseKey: string;
}) {
  const connection =
    useConnection();

  const publicClient =
    usePublicClient();

  const writeContract =
    useWriteContract();

  const onchainMilestoneQuery = useReadContract({
  address: ESCROW_ADDRESS,
  abi: milestoneEscrowAbi,
  functionName: "getMilestone",
  args: [
    project.id,
    BigInt(milestone.index),
  ],
  query: {
    refetchInterval: 5000,
  },
});

const releasedOnChain =
  onchainMilestoneQuery.data?.[1] === true;

const amountMatches =
  onchainMilestoneQuery.data?.[0] ===
  BigInt(milestone.amount);

const [initialRecovery] = useState(() =>
  readInitialRecovery(pendingReleaseKey)
);

const [releaseStatus, setReleaseStatus] =
  useState<ReleaseStatus>(
    initialRecovery.marker !== null ||
    initialRecovery.error !== null
      ? "CONFIRMATION_UNKNOWN"
      : "IDLE"
  );

const [transactionHash, setTransactionHash] =
  useState<`0x${string}` | null>(
    markerTransactionHash(initialRecovery.marker)
  );

const [errorMessage, setErrorMessage] =
  useState<string | null>(
    initialRecovery.error ??
      (
        initialRecovery.marker !== null
          ? "A previous payment attempt was restored. Check its status before submitting again."
          : null
      )
  );

const releaseOperationRef = useRef(false);

const [
  previousRevertedHash,
  setPreviousRevertedHash,
] = useState<`0x${string}` | null>(null);

const pendingReleaseRef =
  useRef<ReleaseMarker | null>(
    initialRecovery.marker
  );

const storageReady =
  initialRecovery.error === null;

function clearStoredRelease(): void {
  const marker = pendingReleaseRef.current;

  if (marker === null) return;

  if (!pendingReleaseKey) {
    throw new Error(
      "Payment recovery key is unavailable."
    );
  }

  replaceReleaseMarker(
    pendingReleaseKey,
    marker,
    null
  );

  pendingReleaseRef.current = null;
}

  async function waitForPaid():
    Promise<CreatedProject> {
    const apiUrl =
      process.env
        .NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error(
        "NEXT_PUBLIC_API_URL is required."
      );
    }

    for (
      let attempt = 0;
      attempt < 20;
      attempt += 1
    ) {
      const response =
        await fetch(
          `${apiUrl}/projects/${project.id}`,
          {
            cache:
              "no-store",
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          "Failed to read project status."
        );
      }

      const latestProject:CreatedProject = await response.json();

      const latestMilestone =
        latestProject
          .milestones
          .find(
            (item) =>
              item.index ===
              milestone.index
          );

      if (
        latestMilestone
          ?.status ===
        "PAID"
      ) {
        return latestProject;
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            1000
          )
      );
    }

    throw new Error(
      "Release succeeded on-chain, but the indexer has not projected PAID yet."
    );
  }

  async function executeRelease(): Promise<void> {
    setErrorMessage(null);

    if (
      !connection.address
    ) {
      setErrorMessage(
        "Connect your wallet first."
      );

      return;
    }

    if (!publicClient) {
      setErrorMessage(
        "Public client is unavailable."
      );

      return;
    }

    if (
      getAddress(
        connection.address
      ) !==
      getAddress(
        project.client
      )
    ) {
      setErrorMessage(
        "Only the client can release this milestone."
      );

      return;
    }

    if (
      milestone.status !==
      "SUBMITTED"
    ) {
      setErrorMessage(
        "Milestone must be submitted before release."
      );

      return;
    }

    const signingConnector = connection.connector;

    if (!signingConnector) {
      setErrorMessage("Wallet connector is unavailable.");
      return;
    }

    let submittedHash: `0x${string}` | null = null;
    let confirmedRevert = false;

    try {
    setReleaseStatus("CHECKING");
    const walletChainId =
      await signingConnector.getChainId();

    if (walletChainId !== publicClient.chain.id) {
      throw new Error(
        `Wrong wallet network: ${walletChainId}. ` +
        `Expected ${publicClient.chain.id}.`
      );
    }
    const [onchainAmount, alreadyReleased] =
      await publicClient.readContract({
        address: ESCROW_ADDRESS,
        abi: milestoneEscrowAbi,
        functionName: "getMilestone",
        args: [
          project.id,
          BigInt(milestone.index),
        ],
      });

  if (onchainAmount !== BigInt(milestone.amount)) {
    throw new Error(
      "Milestone amount does not match the on-chain contract."
    );
  }

  if (alreadyReleased) {
    setReleaseStatus("SYNC_DELAYED");
    return;
  }

  if (!pendingReleaseKey) {
  throw new Error(
    "Payment recovery is not ready."
  );
}

const intent = createReleaseIntent();

replaceReleaseMarker(
  pendingReleaseKey,
  null,
  intent
);

pendingReleaseRef.current = intent;

setReleaseStatus("AWAITING_WALLET");

let hash: `0x${string}`;

try {
  hash = await writeContract.mutateAsync({
    address: ESCROW_ADDRESS,
    abi: milestoneEscrowAbi,
    functionName: "releaseMilestone",
    args: [
      project.id,
      BigInt(milestone.index),
    ],
  });
} catch (error) {
  const cause =
    error instanceof BaseError
      ? error.walk(
          (item) =>
            item instanceof UserRejectedRequestError
        )
      : error;

  if (cause instanceof UserRejectedRequestError) {
    replaceReleaseMarker(
      pendingReleaseKey,
      intent,
      null
    );

    pendingReleaseRef.current = null;
  }

  throw error;
}

submittedHash = hash;

setTransactionHash(hash);

replaceReleaseMarker(
  pendingReleaseKey,
  intent,
  hash
);

pendingReleaseRef.current = hash;

setReleaseStatus("CONFIRMING");

      const receipt =
        await publicClient
          .waitForTransactionReceipt({
            hash,
          });

            if (receipt.status !== "success") {
        confirmedRevert = true;

        throw new Error(
          "releaseMilestone transaction reverted."
        );
      }

      setReleaseStatus("SYNCING");


    try {
      const updatedProject = await waitForPaid();

      clearStoredRelease();

      onProjectUpdated(updatedProject);

      setReleaseStatus("PAID");
    } catch (syncError) {
      console.warn(
        "Release confirmed on-chain, but database sync is pending:",
        syncError
      );

      setReleaseStatus("SYNC_DELAYED");
    }
        } catch (error) {
    if (
  !confirmedRevert &&
  (
    submittedHash !== null ||
    pendingReleaseRef.current !== null
  )
) {
        setReleaseStatus("CONFIRMATION_UNKNOWN");
      } else {
        setReleaseStatus("FAILED");
      }

      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Milestone release failed.");
      }
    }
  }

  async function syncReleasedMilestone(): Promise<void> {
  setReleaseStatus("SYNCING");

  try {
    const updatedProject = await waitForPaid();

    clearStoredRelease();

    onProjectUpdated(updatedProject);

    setReleaseStatus("PAID");
  } catch {
    setReleaseStatus("SYNC_DELAYED");

    setErrorMessage(
      "Payment is confirmed on-chain. Project data is still synchronizing."
    );
  }
}

async function handleRelease(): Promise<void> {
  if (
    !storageReady ||
    pendingReleaseRef.current !== null ||
    releaseOperationRef.current ||
    transactionHash !== null ||
    releasedOnChain ||
    releaseStatus === "CONFIRMATION_UNKNOWN" ||
    releaseStatus === "SYNC_DELAYED" ||
    releaseStatus === "PAID"
  ) {
    return;
  }

  releaseOperationRef.current = true;

  try {
    await executeRelease();
  } finally {
    releaseOperationRef.current = false;
  }
}

async function handleRecheckRelease(): Promise<void> {
  if (
  !storageReady ||
  releaseOperationRef.current
) {
  return;
}
  if (!publicClient) {
    setErrorMessage("Public client is unavailable.");
    return;
  }

  releaseOperationRef.current = true;
  setErrorMessage(null);
  setReleaseStatus("CHECKING");

  try {
    const [amount, released] = await publicClient.readContract({
      address: ESCROW_ADDRESS,
      abi: milestoneEscrowAbi,
      functionName: "getMilestone",
      args: [project.id, BigInt(milestone.index)],
    });

    if (amount !== BigInt(milestone.amount)) {
      throw new Error(
        "On-chain milestone amount does not match."
      );
    }

    if (released) {
      await syncReleasedMilestone();
      return;
    }

    if (!transactionHash) {
      throw new Error(
        "No transaction hash is available to verify the release."
      );
    }

    const receipt = await publicClient.getTransactionReceipt({
      hash: transactionHash,
    });

    if (receipt.status !== "reverted") {
      throw new Error(
        "The receipt does not confirm a failed release. Keep payment locked."
      );
    }

    const [latestAmount, latestReleased] =
      await publicClient.readContract({
        address: ESCROW_ADDRESS,
        abi: milestoneEscrowAbi,
        functionName: "getMilestone",
        args: [project.id, BigInt(milestone.index)],
      });

    if (latestAmount !== BigInt(milestone.amount)) {
      throw new Error(
        "On-chain milestone amount does not match."
      );
    }

    if (latestReleased) {
      await syncReleasedMilestone();
      return;
    }

    clearStoredRelease();

    setPreviousRevertedHash(transactionHash);

    setTransactionHash(null);

    setReleaseStatus("IDLE");

    setErrorMessage(
      "The previous transaction reverted. The milestone is still unpaid. You may submit again."
    );
  } catch (error) {
    setReleaseStatus("CONFIRMATION_UNKNOWN");

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Unable to verify payment status."
    );
  } finally {
    releaseOperationRef.current = false;
  }
}

  const isBusy =
  releaseStatus === "CHECKING" ||
  releaseStatus === "AWAITING_WALLET" ||
    releaseStatus ===
      "CONFIRMING" ||
    releaseStatus ===
      "SYNCING";

  return (
  <section className="space-y-5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">

    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
        Client Review
      </p>

      <h4 className="mt-2 text-lg font-semibold text-slate-900">
        Approve Milestone {milestone.index + 1}
      </h4>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Review the submitted deliverables above.
        Once approved, the milestone payment
        will be released to the freelancer.
      </p>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">
        Payment to freelancer
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {formatUnits(BigInt(milestone.amount), 6)}
        <span className="ml-2 text-base font-medium text-slate-500">
          USDC
        </span>
      </p>
    </div>

    <p className="text-sm leading-6 text-amber-800">
      Please confirm that the deliverables meet
      your requirements before releasing payment.
    </p>

    <button
        type="button"
        disabled={
            isBusy ||
            !storageReady ||
            !onchainMilestoneQuery.isSuccess ||
            !amountMatches ||
            releasedOnChain ||
            releaseStatus === "SYNC_DELAYED" ||
            releaseStatus === "CONFIRMATION_UNKNOWN" ||
            releaseStatus === "PAID" ||
            transactionHash !== null
          }
        onClick={() => {
          void handleRelease();
        }}
        className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >

        {releaseStatus === "CHECKING"
          ? "Checking on-chain state..."
          : releaseStatus === "AWAITING_WALLET"
          ? "Confirm release in wallet..."
          : releaseStatus ===
              "CONFIRMING"
            ? "Waiting for confirmation..."
            : releaseStatus ===
                "SYNCING"
              ? "Waiting for indexer..."
              : releaseStatus ===
                  "PAID"
                ? "Paid"
               : `Approve & Release ${formatUnits(BigInt(milestone.amount), 6)} USDC`}
      </button>

      {releaseStatus === "CONFIRMATION_UNKNOWN" && (
  <div
    role="alert"
    className="rounded-xl border border-amber-200 bg-amber-50 p-4"
  >
    <p className="font-semibold text-amber-900">
      Transaction status not confirmed
    </p>

      <p className="mt-2 text-sm text-amber-800">
      Payment status could not be verified.
      Check the transaction receipt and on-chain milestone
      before attempting another payment.
      </p>
  </div>
)}

      {onchainMilestoneQuery.isError && (
  <p
    role="alert"
    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
  >
    Unable to verify the milestone on-chain.
    Payment is temporarily disabled.
  </p>
)}

{onchainMilestoneQuery.isSuccess && !amountMatches && (
  <p
    role="alert"
    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
  >
    On-chain milestone amount does not match the project record.
    Do not release payment.
  </p>
)}

{releasedOnChain && milestone.status === "SUBMITTED" && (
  <p
    role="status"
    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
  >
    Payment is already confirmed on-chain.
    Waiting for the project database to synchronize.
  </p>
)}

          {releaseStatus === "SYNC_DELAYED" && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <p className="text-sm font-semibold text-amber-900">
                Payment confirmed on-chain
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                The milestone payment has been released.
                Project data is still synchronizing.
                Please do not submit another payment.
              </p>
            </div>
          )}

      {(
          transactionHash !== null ||
          releaseStatus === "SYNC_DELAYED" ||
          releaseStatus === "CONFIRMATION_UNKNOWN"
        ) && releaseStatus !== "PAID" && (
          <button
            type="button"
            disabled={isBusy || !storageReady}
            onClick={() => {
              void handleRecheckRelease();
            }}
            className="w-full rounded-xl border border-indigo-300 bg-white px-5 py-3 text-sm font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check payment status
          </button>
        )}

{previousRevertedHash && (
  <p className="break-all rounded-xl bg-slate-100 p-3 font-mono text-xs text-slate-600">
    Previous reverted transaction: {previousRevertedHash}
  </p>
)}
      {transactionHash && (
        <p className="break-all rounded-xl bg-white p-3 font-mono text-xs text-slate-600">
          Release transaction:
          {" "}
          {transactionHash}
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}
    </section>
  );
}