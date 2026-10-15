"use client";

import {
  useState,
} from "react";

import {
  useConnection,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";

import {
  formatUnits,
  getAddress,
  zeroAddress,
} from "viem";

import {
  ESCROW_ADDRESS,
  TOKEN_ADDRESS,
  erc20Abi,
  milestoneEscrowAbi,
} from "@/lib/contracts";

import type {
  CreatedProject,
} from "@/lib/project-types";

type FundingStatus =
  | "IDLE"
  | "AWAITING_APPROVE"
  | "CONFIRMING_APPROVE"
  | "AWAITING_FUND"
  | "CONFIRMING_FUND"
  | "SYNCING"
  | "ACTIVE"
  | "FAILED";

type FundProjectPanelProps = {
  project:
    CreatedProject;

  onProjectUpdated:
    (
      project:
        CreatedProject
    ) => void;
};

export function FundProjectPanel({
  project,
  onProjectUpdated,
}: FundProjectPanelProps) {
  const connection =
    useConnection();

  const publicClient =
    usePublicClient();

  const writeContract =
    useWriteContract();

  const [
    fundingStatus,
    setFundingStatus,
  ] =
    useState<FundingStatus>(
      "IDLE"
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null
    );

  const [
    approveHash,
    setApproveHash,
  ] =
    useState<
      `0x${string}` | null
    >(null);

  const [
    fundHash,
    setFundHash,
  ] =
    useState<
      `0x${string}` | null
    >(null);

  const owner =
    connection.address ??
    zeroAddress;

  const requiredAmount =
    project.milestones.reduce(
      (
        total,
        milestone
      ) =>
        total +
        BigInt(
          milestone.amount
        ),
      0n
    );

  const allowanceQuery =
    useReadContract({
      address:
        TOKEN_ADDRESS,

      abi:
        erc20Abi,

      functionName:
        "allowance",

      args: [
        owner,
        ESCROW_ADDRESS,
      ],

      query: {
        enabled:
          Boolean(
            connection.address
          ),
      },
    });

  const balanceQuery =
    useReadContract({
      address:
        TOKEN_ADDRESS,

      abi:
        erc20Abi,

      functionName:
        "balanceOf",

      args: [
        owner,
      ],

      query: {
        enabled:
          Boolean(
            connection.address
          ),
      },
    });

  const allowance =
    allowanceQuery.data ??
    0n;

  const balance =
    balanceQuery.data ??
    0n;

  const needsApproval =
    allowance <
    requiredAmount;

  async function waitForActive():
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

      if (!response.ok) {
        throw new Error(
          "Failed to read project status."
        );
      }

      const latestProject:CreatedProject =  await response.json();

      if (
        latestProject.status ===
        "ACTIVE"
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
      "Funding confirmed on-chain, but the indexer has not projected ACTIVE yet."
    );
  }

  async function handleFund():
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

    const connectedAddress =
      getAddress(
        connection.address
      );

    const clientAddress =
      getAddress(
        project.client
      );

    if (
      connectedAddress !==
      clientAddress
    ) {
      setErrorMessage(
        "Only the project client can fund this project."
      );

      return;
    }

    if (
      balance <
      requiredAmount
    ) {
      setErrorMessage(
        "Insufficient USDC balance."
      );

      return;
    }

    try {
      if (needsApproval) {
        setFundingStatus(
          "AWAITING_APPROVE"
        );

        const hash =
          await writeContract
            .mutateAsync({
              address:
                TOKEN_ADDRESS,

              abi:
                erc20Abi,

              functionName:
                "approve",

              args: [
                ESCROW_ADDRESS,
                requiredAmount,
              ],
            });

        setApproveHash(
          hash
        );

        setFundingStatus(
          "CONFIRMING_APPROVE"
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
            "Approve transaction reverted."
          );
        }

        await allowanceQuery
          .refetch();
      }

      setFundingStatus(
        "AWAITING_FUND"
      );

      const hash =
        await writeContract
          .mutateAsync({
            address:
              ESCROW_ADDRESS,

            abi:
              milestoneEscrowAbi,

            functionName:
              "fundProject",

            args: [
              project.id,
            ],
          });

      setFundHash(
        hash
      );

      setFundingStatus(
        "CONFIRMING_FUND"
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
          "fundProject transaction reverted."
        );
      }

      await Promise.all([
        allowanceQuery.refetch(),
        balanceQuery.refetch(),
      ]);

      setFundingStatus(
        "SYNCING"
      );

       const updatedProject = await waitForActive();

        onProjectUpdated(
          updatedProject
        );

        setFundingStatus(
          "ACTIVE"
        );
    } catch (error) {
      setFundingStatus(
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
          "Funding failed."
        );
      }
    }
  }

  const isBusy =
    fundingStatus ===
      "AWAITING_APPROVE" ||
    fundingStatus ===
      "CONFIRMING_APPROVE" ||
    fundingStatus ===
      "AWAITING_FUND" ||
    fundingStatus ===
      "CONFIRMING_FUND" ||
    fundingStatus ===
      "SYNCING";

  return (
    <section>
      <h2>
        Fund Project
      </h2>

      <p>
        Required:
        {" "}
        {formatUnits(
          requiredAmount,
          6
        )}
        {" "}
        USDC
      </p>

      <p>
        Wallet balance:
        {" "}
        {formatUnits(
          balance,
          6
        )}
        {" "}
        USDC
      </p>

      <p>
        Escrow allowance:
        {" "}
        {formatUnits(
          allowance,
          6
        )}
        {" "}
        USDC
      </p>

      <p>
        Approval required:
        {" "}
        {needsApproval
          ? "Yes"
          : "No"}
      </p>

      <button
        type="button"
        disabled={
          isBusy ||
          !connection.address ||
          fundingStatus ===
            "ACTIVE"
        }
        onClick={() => {
          void handleFund();
        }}
      >
        {fundingStatus ===
        "AWAITING_APPROVE"
          ? "Confirm USDC approval in wallet..."
          : fundingStatus ===
              "CONFIRMING_APPROVE"
            ? "Waiting for approval confirmation..."
            : fundingStatus ===
                "AWAITING_FUND"
              ? "Confirm funding in wallet..."
              : fundingStatus ===
                  "CONFIRMING_FUND"
                ? "Waiting for funding confirmation..."
                : fundingStatus ===
                    "SYNCING"
                  ? "Waiting for indexer..."
                  : fundingStatus ===
                      "ACTIVE"
                    ? "Project Funded"
                    : needsApproval
                      ? "Approve & Fund"
                      : "Fund Project"}
      </button>

      {approveHash && (
        <p>
          Approve transaction:
          {" "}
          {approveHash}
        </p>
      )}

      {fundHash && (
        <p>
          Funding transaction:
          {" "}
          {fundHash}
        </p>
      )}

      {fundingStatus ===
        "ACTIVE" && (
        <p>
          Project is ACTIVE.
        </p>
      )}

      {errorMessage && (
        <p>
          Error:
          {" "}
          {errorMessage}
        </p>
      )}
    </section>
  );
}