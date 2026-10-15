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

type CreateFlowStatus =
  | "IDLE"
  | "CREATING_OFFCHAIN"
  | "AWAITING_WALLET"
  | "CONFIRMING"
  | "CONFIRMED"
  | "FAILED";


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

  const [
    milestoneTitle,
    setMilestoneTitle,
  ] = useState("");

  const [
    milestoneDescription,
    setMilestoneDescription,
  ] = useState("");

  const [
    milestoneAmount,
    setMilestoneAmount,
  ] = useState("");

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

    if (
      !milestoneTitle.trim()
    ) {
      setErrorMessage(
        "Milestone title is required."
      );

      return;
    }

    if (
      !milestoneDescription.trim()
    ) {
      setErrorMessage(
        "Milestone description is required."
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

    let amount: bigint;

    try {
      amount =
        parseUnits(
          milestoneAmount,
          6
        );
    } catch {
      setErrorMessage(
        "Milestone amount is invalid."
      );

      return;
    }

    if (amount <= 0n) {
      setErrorMessage(
        "Milestone amount must be greater than zero."
      );

      return;
    }

    const apiUrl =
      process.env
        .NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      setErrorMessage(
        "NEXT_PUBLIC_API_URL is not configured."
      );

      return;
    }

    try {
      setFlowStatus(
        "CREATING_OFFCHAIN"
      );

      const response =
        await fetch(
          `${apiUrl}/projects`,
          {
            method: "POST",
            credentials: "include",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                title:
                  title.trim(),

                description:
                  description.trim(),

                client:
                  connection.address,

                freelancer:
                  freelancerAddress,

                token:
                  TOKEN_ADDRESS,

                milestones: [
                  {
                    title:
                      milestoneTitle.trim(),

                    description:
                      milestoneDescription.trim(),

                    amount:
                      amount.toString(),
                  },
                ],
              }),
          }
        );

      if (!response.ok) {
        const body =
          await response
            .json()
            .catch(
              () => null
            );

        throw new Error(
          body?.error ??
            "Failed to create project."
        );
      }

      const project: CreatedProject = await response.json();
       
      setCreatedProject(
        project
      );

      await createProjectOnchain(
        project
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
          "Unknown error."
        );
      }
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

  return (
    <section>
      <h2>
        Create Project
      </h2>

      <form
        onSubmit={
          handleSubmit
        }
      >
        <div>
          <label
            htmlFor="title"
          >
            Project title
          </label>

          <input
            id="title"
            type="text"
            value={title}
            disabled={isBusy}
            onChange={(event) =>
              setTitle(
                event.target.value
              )
            }
          />
        </div>

        <div>
          <label
            htmlFor="description"
          >
            Project description
          </label>

          <textarea
            id="description"
            value={
              description
            }
            disabled={isBusy}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
          />
        </div>

        <div>
          <label
            htmlFor="freelancer"
          >
            Freelancer address
          </label>

          <input
            id="freelancer"
            type="text"
            value={
              freelancer
            }
            disabled={isBusy}
            placeholder="0x..."
            onChange={(event) =>
              setFreelancer(
                event.target.value
              )
            }
          />
        </div>

        <fieldset>
          <legend>
            Milestone
          </legend>

          <div>
            <label
              htmlFor="milestone-title"
            >
              Milestone title
            </label>

            <input
              id="milestone-title"
              type="text"
              value={
                milestoneTitle
              }
              disabled={
                isBusy
              }
              onChange={(
                event
              ) =>
                setMilestoneTitle(
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
            <label
              htmlFor="milestone-description"
            >
              Milestone description
            </label>

            <textarea
              id="milestone-description"
              value={
                milestoneDescription
              }
              disabled={
                isBusy
              }
              onChange={(
                event
              ) =>
                setMilestoneDescription(
                  event.target
                    .value
                )
              }
            />
          </div>

          <div>
            <label
              htmlFor="milestone-amount"
            >
              Amount (USDC)
            </label>

            <input
              id="milestone-amount"
              type="text"
              inputMode="decimal"
              value={
                milestoneAmount
              }
              disabled={
                isBusy
              }
              placeholder="800"
              onChange={(
                event
              ) =>
                setMilestoneAmount(
                  event.target
                    .value
                )
              }
            />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={
            isBusy ||
            !connection.address
          }
        >
          {flowStatus ===
          "CREATING_OFFCHAIN"
            ? "Saving project..."
            : flowStatus ===
                "AWAITING_WALLET"
              ? "Confirm in wallet..."
              : flowStatus ===
                  "CONFIRMING"
                ? "Waiting for confirmation..."
                : "Create Project"}
        </button>
      </form>

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

      {flowStatus ===
        "CONFIRMED" && (
        <p>
          Project created
          on-chain
          successfully.
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
        <p>
          Transaction:
          {" "}
          {transactionHash}
        </p>
      )}

      {createdProject && (
        <div>
          <p>
            Project ID:
            {" "}
            {
              createdProject.id
            }
          </p>

          <p>
            Off-chain status:
            {" "}
            {
              createdProject.status
            }
          </p>
        </div>
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