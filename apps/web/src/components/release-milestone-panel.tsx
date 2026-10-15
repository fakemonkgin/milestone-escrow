"use client";

import {
  useState,
} from "react";

import {
  useConnection,
  usePublicClient,
  useWriteContract,
} from "wagmi";

import {
  formatUnits,
  getAddress,
} from "viem";

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
  | "AWAITING_WALLET"
  | "CONFIRMING"
  | "SYNCING"
  | "PAID"
  | "FAILED";

export function ReleaseMilestonePanel({
  project,
  milestone,
  onProjectUpdated,
}: ReleaseMilestonePanelProps) {
  const connection =
    useConnection();

  const publicClient =
    usePublicClient();

  const writeContract =
    useWriteContract();

  const [
    releaseStatus,
    setReleaseStatus,
  ] =
    useState<ReleaseStatus>(
      "IDLE"
    );

  const [
    transactionHash,
    setTransactionHash,
  ] =
    useState<
      `0x${string}` | null
    >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

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

  async function handleRelease():
    Promise<void> {
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

    try {
      setReleaseStatus(
        "AWAITING_WALLET"
      );

      const hash =
        await writeContract
          .mutateAsync({
            address:
              ESCROW_ADDRESS,

            abi:
              milestoneEscrowAbi,

            functionName:
              "releaseMilestone",

            args: [
              project.id,

              BigInt(
                milestone.index
              ),
            ],
          });

      setTransactionHash(
        hash
      );

      setReleaseStatus(
        "CONFIRMING"
      );

      const receipt =
        await publicClient
          .waitForTransactionReceipt({
            hash,
          });

      if (
        receipt.status !==
        "success"
      ) {
        throw new Error(
          "releaseMilestone transaction reverted."
        );
      }

      setReleaseStatus(
        "SYNCING"
      );

      const updatedProject =
        await waitForPaid();

      onProjectUpdated(
        updatedProject
      );

      setReleaseStatus(
        "PAID"
      );
    } catch (error) {
      setReleaseStatus(
        "FAILED"
      );

      if (
        error instanceof Error
      ) {
        setErrorMessage(
          error.message
        );
      } else {
        setErrorMessage(
          "Milestone release failed."
        );
      }
    }
  }

  const isBusy =
    releaseStatus ===
      "AWAITING_WALLET" ||
    releaseStatus ===
      "CONFIRMING" ||
    releaseStatus ===
      "SYNCING";

  return (
    <div>
      <p>
        Release amount:
        {" "}
        {formatUnits(
          BigInt(
            milestone.amount
          ),
          6
        )}
        {" "}
        USDC
      </p>

      <button
        type="button"
        disabled={
          isBusy
        }
        onClick={() => {
          void handleRelease();
        }}
      >
        {releaseStatus ===
        "AWAITING_WALLET"
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
                : "Release Milestone"}
      </button>

      {transactionHash && (
        <p>
          Release transaction:
          {" "}
          {transactionHash}
        </p>
      )}

      {errorMessage && (
        <p>
          Error:
          {" "}
          {errorMessage}
        </p>
      )}
    </div>
  );
}