"use client";

import {
  useState,
  type SubmitEvent,
} from "react";

import {
  useConnection,
  usePublicClient,
  useWriteContract,
} from "wagmi";

import {
  getAddress,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";

import {
  ESCROW_ADDRESS,
  TOKEN_ADDRESS,
  milestoneEscrowAbi,
} from "@/lib/contracts";

import type {
  CreatedProject,
} from "@/lib/project-types";

import {
  FundProjectPanel,
} from "@/components/fund-project-panel";

import {
  ProjectWorkflowPanel,
} from "@/components/project-workflow-panel";

type MilestoneDraft = {
  id: string;
  title: string;
  description: string;
  amount: string;
};

type ReviewDraft = {
  title: string;
  description: string;
  client: Address;
  freelancer: Address;
  milestones: {
    title: string;
    description: string;
    amount: string;
  }[];
  totalAmount: bigint;
};

type CreateFlowStatus =
  | "IDLE"
  | "CREATING_OFFCHAIN"
  | "AWAITING_WALLET"
  | "CONFIRMING"
  | "CONFIRMED"
  | "FAILED";

const labelClassName =
  "block w-full text-left text-sm font-medium text-slate-700";

const controlClassName = `
  block w-full rounded-xl
  border border-slate-300 bg-white
  px-4 py-3 text-sm text-slate-900
  placeholder:text-slate-400
  outline-none transition
  focus:border-indigo-500
  focus:ring-2 focus:ring-indigo-100
  disabled:bg-slate-100
`;

const primaryButtonClassName = `
  w-full rounded-xl bg-indigo-600
  px-5 py-3 text-sm font-semibold
  text-white shadow-sm transition
  hover:bg-indigo-700
  focus-visible:outline-2
  focus-visible:outline-offset-2
  focus-visible:outline-indigo-600
  disabled:cursor-not-allowed
  disabled:opacity-50
`;

  export function CreateProjectForm() {
    const connection =
      useConnection();

    const publicClient =
      usePublicClient();

    const writeContract =
      useWriteContract();

    const [
      title,
      setTitle,
    ] = useState("");

    const [
      description,
      setDescription,
    ] = useState("");

    const [
      freelancer,
      setFreelancer,
    ] = useState("");

      const [milestones, setMilestones] = useState<MilestoneDraft[]>([
      {
        id: "milestone-1",
        title: "",
        description: "",
        amount: "",
      },
    ]);

    const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);

  function updateMilestone(
    id: string,
    field: "title" | "description" | "amount",
    value: string
  ) {
    setMilestones((previous) =>
      previous.map((milestone) =>
        milestone.id === id
          ? { ...milestone, [field]: value }
          : milestone
      )
    );
  }

  const MAX_MILESTONES = 20;
    function addMilestone() {
    setMilestones((previous) => {
      if (previous.length >= MAX_MILESTONES) {
        return previous;
      }

      return [
        ...previous,
        {
          id: crypto.randomUUID(),
          title: "",
          description: "",
          amount: "",
        },
      ];
    });
  }

  function removeMilestone(id: string) {
  setMilestones((previous) => {
    if (previous.length <= 1) {
      return previous;
    }

    return previous.filter(
      (milestone) => milestone.id !== id
    );
  });
}

  const [
    flowStatus,
    setFlowStatus,
  ] =
    useState<CreateFlowStatus>(
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
    createdProject,
    setCreatedProject,
  ] =
    useState<CreatedProject | null>(
      null
    );

  const [
    transactionHash,
    setTransactionHash,
  ] =
    useState<
      `0x${string}` | null
    >(null);

  async function createProjectOnchain(
    project: CreatedProject
  ): Promise<void> {
    if (!publicClient) {
      throw new Error(
        "Public client is unavailable."
      );
    }

    setFlowStatus(
      "AWAITING_WALLET"
    );

    const hash =
      await writeContract.mutateAsync({
        address:
          ESCROW_ADDRESS,

        abi:
          milestoneEscrowAbi,

        functionName:
          "createProject",

        args: [
          project.id,

          project.freelancer,

          project.token,

          project.milestones.map(
            (milestone) =>
              BigInt(
                milestone.amount
              )
          ),
        ],
      });

    setTransactionHash(
      hash
    );

    setFlowStatus(
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
        "createProject transaction reverted."
      );
    }

    setFlowStatus(
      "CONFIRMED"
    );
  }

  async function handleSubmit(
    event:
      SubmitEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setErrorMessage(null);
    setTransactionHash(null);
    setCreatedProject(null);

    if (
      !connection.address
    ) {
      setErrorMessage(
        "Connect your wallet first."
      );

      return;
    }

    if (!title.trim()) {
      setErrorMessage(
        "Project title is required."
      );

      return;
    }

    if (!description.trim()) {
      setErrorMessage(
        "Project description is required."
      );

      return;
    }


    let freelancerAddress:
      Address;

    try {
      freelancerAddress =
        getAddress(
          freelancer
        );
    } catch {
      setErrorMessage(
        "Freelancer address is invalid."
      );

      return;
    }

    const milestonePayload: {
        title: string;
        description: string;
        amount: string;
      }[] = [];

      for (const [index, milestone] of milestones.entries()) {
        if (!milestone.title.trim()) {
          setErrorMessage(
            `Milestone ${index + 1}: title is required.`
          );
          return;
        }

        if (!milestone.description.trim()) {
          setErrorMessage(
            `Milestone ${index + 1}: description is required.`
          );
          return;
        }

        let amount: bigint;

        try {
          amount = parseUnits(milestone.amount, 6);
        } catch {
          setErrorMessage(
            `Milestone ${index + 1}: invalid USDC amount.`
          );
          return;
        }

        if (amount <= 0n) {
          setErrorMessage(
            `Milestone ${index + 1}: amount must be greater than zero.`
          );
          return;
        }

        milestonePayload.push({
          title: milestone.title.trim(),
          description: milestone.description.trim(),
          amount: amount.toString(),
        });
      }

   const draft: ReviewDraft = {
        title: title.trim(),
        description: description.trim(),
        client: getAddress(connection.address),
        freelancer: freelancerAddress,
        milestones: milestonePayload,
        totalAmount: milestonePayload.reduce(
          (sum, milestone) =>
            sum + BigInt(milestone.amount),
          0n
        ),
      };

      setReviewDraft(draft);
  }

  async function handleConfirm(): Promise<void> {
  const draft = reviewDraft;

  if (!draft || isBusy || createdProject) {
    return;
  }

  if (
    !connection.address ||
    getAddress(connection.address) !== draft.client
  ) {
    setErrorMessage(
      "Wallet changed. Please return to edit and review again."
    );
    return;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    setErrorMessage(
      "NEXT_PUBLIC_API_URL is not configured."
    );
    return;
  }

  setErrorMessage(null);
  setTransactionHash(null);
  setCreatedProject(null);

  try {
    setFlowStatus("CREATING_OFFCHAIN");

    const response = await fetch(
      `${apiUrl}/projects`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          client: draft.client,
          freelancer: draft.freelancer,
          token: TOKEN_ADDRESS,
          milestones: draft.milestones,
        }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => null);

      throw new Error(
        body?.error ?? "Failed to create project."
      );
    }

    const project: CreatedProject =
      await response.json();

    setCreatedProject(project);

    await createProjectOnchain(project);
  } catch (error) {
    setFlowStatus("FAILED");

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Unknown error."
    );
  }
}

  async function handleRetry():
    Promise<void> {
    if (!createdProject) {
      return;
    }

    setErrorMessage(null);
    setTransactionHash(null);

    try {
      await createProjectOnchain(
        createdProject
      );
    } catch (error) {
      setFlowStatus(
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
          "Transaction failed."
        );
      }
    }
  }

  const isBusy =
    flowStatus ===
      "CREATING_OFFCHAIN" ||
    flowStatus ===
      "AWAITING_WALLET" ||
    flowStatus ===
      "CONFIRMING";

  const totalBudget = milestones.reduce<bigint | null>(
  (total, milestone) => {
    if (total === null) {
      return null;
    }

    try {
      const amount = parseUnits(
        milestone.amount,
        6
      );

      if (amount <= 0n) {
        return null;
      }

      return total + amount;
    } catch {
      return null;
    }
  },
  0n
);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Create Project
      </h2>
    {reviewDraft === null ? (
      <form
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <label
            htmlFor="title"
            className={labelClassName}
          >
            Project title
          </label>

          <input
            id="title"
            type="text"
            className={controlClassName}
            value={title}
            disabled={isBusy}
            onChange={(event) =>
              setTitle(event.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="description"
            className={labelClassName}
          >
            Project description
          </label>

          <textarea
            id="description"
            className={controlClassName}
            rows={4}
            value={description}
            disabled={isBusy}
            onChange={(event) =>
              setDescription(event.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="freelancer"
            className={labelClassName}
          >
            Freelancer address
          </label>

          <input
            id="freelancer"
            type="text"
            className={controlClassName}
            value={freelancer}
            disabled={isBusy}
            placeholder="0x..."
            onChange={(event) =>
              setFreelancer(event.target.value)
            }
          />
        </div>

        <fieldset className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <legend className="px-2 text-lg font-semibold text-slate-800">
              Milestone
            </legend>

        {milestones.map((milestone, index) => (
            <div
              key={milestone.id}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">
                  Milestone {index + 1}
                </h3>

                <button
                  type="button"
                  disabled={isBusy || milestones.length === 1}
                  onClick={() => removeMilestone(milestone.id)}
                  className="text-sm text-red-600 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`milestone-title-${milestone.id}`}
                  className={labelClassName}
                >
                  Milestone title
                </label>

                <input
                  id={`milestone-title-${milestone.id}`}
                  className={controlClassName}
                  value={milestone.title}
                  disabled={isBusy}
                  onChange={(event) =>
                    updateMilestone(
                      milestone.id,
                      "title",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`milestone-description-${milestone.id}`}
                  className={labelClassName}
                >
                  Milestone description
                </label>

                <textarea
                  id={`milestone-description-${milestone.id}`}
                  className={controlClassName}
                  rows={3}
                  value={milestone.description}
                  disabled={isBusy}
                  onChange={(event) =>
                    updateMilestone(
                      milestone.id,
                      "description",
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`milestone-amount-${milestone.id}`}
                  className={labelClassName}
                >
                  Amount (USDC)
                </label>

                <input
                  id={`milestone-amount-${milestone.id}`}
                  type="text"
                  inputMode="decimal"
                  className={controlClassName}
                  value={milestone.amount}
                  disabled={isBusy}
                  placeholder="800"
                  onChange={(event) =>
                    updateMilestone(
                      milestone.id,
                      "amount",
                      event.target.value
                    )
                  }
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            disabled={isBusy || milestones.length >= MAX_MILESTONES}
            onClick={addMilestone}
            className="w-full rounded-xl border border-dashed border-indigo-300 px-4 py-3 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
          >
            + Add Milestone
          </button>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">

          <p className="text-sm font-medium text-slate-600">
            Total Project Budget
          </p>

          <p
            className="mt-2 text-2xl font-semibold text-slate-900"
            aria-live="polite"
          >
            {totalBudget === null
              ? "—"
              : `${formatUnits(totalBudget, 6)} USDC`}
          </p>

          <p className="mt-2 text-sm text-slate-600">
            {totalBudget === null
              ? "Enter a valid amount for every milestone."
              : `${milestones.length} milestones. The full budget is deposited once, and payments are released after each milestone is approved.`}
          </p>
        </div>
        </fieldset>

        <button
          type="submit"
          className={primaryButtonClassName}
          disabled={
            isBusy ||
            !connection.address
          }
        >
          Review Project
        </button>
                </form>
    ) : flowStatus === "CONFIRMED" && createdProject ? (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="text-lg font-semibold text-emerald-900">
          Project Created Successfully
        </h3>

        <p className="mt-2 text-sm text-emerald-800">
          Your project has been created on-chain.
        </p>

        <p className="mt-2 text-sm text-emerald-800">
          {createdProject.status === "AWAITING_FUNDING"
            ? "Next step: deposit the full project budget into escrow."
            : "You can now manage project milestones below."}
        </p>
      </div>
    ) : (
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
    <div>
      <h3 className="text-xl font-semibold text-slate-900">
        Review Project
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Please verify all details before creating
        this project on-chain.
      </p>
    </div>

    <div className="space-y-2">
      <h4 className="font-semibold text-slate-900">
        {reviewDraft.title}
      </h4>

      <p className="text-sm text-slate-600">
        {reviewDraft.description}
      </p>

      <p className="break-all text-xs text-slate-500">
        Freelancer: {reviewDraft.freelancer}
      </p>
    </div>

    <div className="space-y-3">
      {reviewDraft.milestones.map((milestone, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-medium text-slate-900">
              {index + 1}. {milestone.title}
            </h4>

            <span className="whitespace-nowrap font-semibold text-slate-900">
              {formatUnits(BigInt(milestone.amount), 6)} USDC
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {milestone.description}
          </p>
        </div>
      ))}
    </div>

    <div className="rounded-xl bg-indigo-50 p-4">
      <p className="text-sm text-slate-600">
        Total Project Budget
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-900">
        {formatUnits(reviewDraft.totalAmount, 6)} USDC
      </p>

      <p className="mt-2 text-sm text-slate-600">
        Creating the project does not transfer USDC.
        The full budget must be funded separately
        before milestone payments can begin.
      </p>
    </div>

    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      This version has no complete dispute resolution
      or unilateral refund mechanism. Use local test
      tokens only.
    </div>

    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={isBusy || createdProject !== null}
        onClick={() => {
          setReviewDraft(null);
          setErrorMessage(null);
        }}
        className="rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 disabled:opacity-50"
      >
        Back to Edit
      </button>

      <button
        type="button"
        disabled={isBusy || createdProject !== null}
        onClick={() => void handleConfirm()}
        className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isBusy ? "Creating..." : "Confirm & Create"}
      </button>
    </div>
  </section>
)}

      {flowStatus ===
        "CREATING_OFFCHAIN" && (
        <p>
          Saving project
          to PostgreSQL...
        </p>
      )}

      {flowStatus ===
        "AWAITING_WALLET" && (
        <p>
          Confirm the
          transaction in
          your wallet.
        </p>
      )}

      {flowStatus ===
        "CONFIRMING" && (
        <p>
          Transaction
          submitted. Waiting
          for confirmation...
        </p>
      )}

      {errorMessage && (
        <p>
          Error:
          {" "}
          {errorMessage}
        </p>
      )}

      {transactionHash && (
          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Transaction Details
            </summary>

            <p className="mt-3 break-all font-mono text-xs text-slate-500">
              {transactionHash}
            </p>
          </details>
        )}

      {createdProject && (
  <details className="rounded-xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer text-sm font-medium text-slate-700">
      Technical Project Details
    </summary>

    <div className="mt-3 space-y-3 text-sm text-slate-600">
      <p>
        Project ID:
        <span className="mt-1 block break-all font-mono text-xs">
          {createdProject.id}
        </span>
      </p>

      <p>
        Database status: {createdProject.status}
      </p>
    </div>
  </details>
)}

      {createdProject &&
        flowStatus ===
          "FAILED" && (
          <button
            type="button"
            onClick={() => {
              void handleRetry();
            }}
          >
            Retry On-chain Creation
          </button>
        )}
        {createdProject &&
            flowStatus ===
              "CONFIRMED" &&
            createdProject.status ===
              "AWAITING_FUNDING" && (
              <FundProjectPanel
                project={
                  createdProject
                }
                onProjectUpdated={
                  setCreatedProject
                }
              />
  )}

  {createdProject &&
  (
    createdProject.status ===
      "ACTIVE" ||
    createdProject.status ===
      "COMPLETED"
  ) && (
    <ProjectWorkflowPanel
      project={
        createdProject
      }
      onProjectUpdated={
        setCreatedProject
      }
    />
  )}
    </section>
  );
}