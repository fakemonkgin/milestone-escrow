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
  | "SYNC_DELAYED"
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

  const onchainProjectQuery = useReadContract({
  address: ESCROW_ADDRESS,
  abi: milestoneEscrowAbi,
  functionName: "getProject",
  args: [project.id],
  query: {
    refetchInterval: 5000,
  },
});

const alreadyFundedOnChain = onchainProjectQuery.data?.[5] === true;

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
      const onchainProject = await publicClient.readContract({
        address: ESCROW_ADDRESS,
        abi: milestoneEscrowAbi,
        functionName: "getProject",
        args: [project.id],
      });

      if (onchainProject[5]) {
        setFundingStatus("SYNC_DELAYED");
        return;
      }

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

      setFundingStatus("SYNCING");

      // 查询余额只用于刷新显示，不能影响已成功的付款结果
      void Promise.allSettled([
        allowanceQuery.refetch(),
        balanceQuery.refetch(),
        onchainProjectQuery.refetch(),
      ]);

      try {
        const updatedProject = await waitForActive();

        onProjectUpdated(updatedProject);

        setFundingStatus("ACTIVE");
      } catch (syncError) {
        console.warn(
          "Funding is confirmed on-chain, but project sync is pending:",
          syncError
        );

        setFundingStatus("SYNC_DELAYED");
      }

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

  async function handleCheckSync(): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    setErrorMessage("API URL is not configured.");
    return;
  }

  setErrorMessage(null);
  setFundingStatus("SYNCING");

  try {
    const response = await fetch(
      `${apiUrl}/projects/${project.id}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Unable to refresh project status.");
    }

    const latestProject: CreatedProject =
      await response.json();

    if (
      latestProject.status === "ACTIVE" ||
      latestProject.status === "COMPLETED"
    ) {
      onProjectUpdated(latestProject);
      setFundingStatus("ACTIVE");
    } else {
      setFundingStatus("SYNC_DELAYED");
    }
  } catch {
    setFundingStatus("SYNC_DELAYED");
    setErrorMessage(
      "Unable to refresh project status. Do not submit another deposit."
    );
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
  <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

    <div>
      <h2 className="text-xl font-semibold text-slate-900">
        Fund Project
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Deposit the full project budget into escrow
        before milestone payments begin.
      </p>
    </div>

    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
      <p className="text-sm font-medium text-slate-600">
        Total escrow deposit
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {formatUnits(requiredAmount, 6)}
        <span className="ml-2 text-base font-medium text-slate-500">
          USDC
        </span>
      </p>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        Covers all {project.milestones.length} milestones.
        Funds are held in escrow and released separately
        after each milestone is approved.
      </p>
    </div>

    {balanceQuery.isSuccess && balance < requiredAmount && (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        Insufficient USDC balance to fund this project.
      </p>
    )}

    <p className="text-sm leading-6 text-slate-500">
      Your wallet may request an approval transaction
      before confirming the deposit.
    </p>

        <button
      type="button"
      className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={
        isBusy ||
        !connection.address ||
        !onchainProjectQuery.isSuccess ||
        alreadyFundedOnChain ||
        fundingStatus === "SYNC_DELAYED" ||
        Boolean(fundHash) ||
        (balanceQuery.isSuccess && balance < requiredAmount) ||
        fundingStatus === "ACTIVE"
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
                    : `Deposit ${formatUnits(requiredAmount, 6)} USDC`}
      </button>

      {(
  fundingStatus === "SYNC_DELAYED" ||
  (
    alreadyFundedOnChain &&
    project.status === "AWAITING_FUNDING"
  )
) && (
  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
    <p className="text-sm font-medium text-amber-900">
      Your deposit has been recorded on-chain.
      Project data is still synchronizing.
    </p>

    <p className="text-sm text-amber-800">
      Do not deposit again.
      You can safely refresh the project status.
    </p>

    <button
      type="button"
      disabled={isBusy}
      onClick={() => void handleCheckSync()}
      className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
    >
      Refresh Project Status
    </button>
  </div>
)}

      {(approveHash || fundHash) && (
  <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <summary className="cursor-pointer text-sm font-medium text-slate-700">
      Transaction Details
    </summary>

    <div className="mt-3 space-y-3">
      {approveHash && (
        <p className="break-all text-xs text-slate-600">
          Approval transaction: {approveHash}
        </p>
      )}

      {fundHash && (
        <p className="break-all text-xs text-slate-600">
          Deposit transaction: {fundHash}
        </p>
      )}
    </div>
  </details>
)}

{fundingStatus === "ACTIVE" && (
  <p
    role="status"
    className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
  >
    Funds successfully deposited into escrow.
  </p>
)}

{errorMessage && (
  <p
    role="alert"
    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
  >
    {errorMessage}
  </p>
)}
    </section>
  );
}