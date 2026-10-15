"use client";

import {
  useState,
  type SubmitEvent,
} from "react";

import {
  useConnection,
} from "wagmi";

import {
  getAddress,
} from "viem";

import type {
  CreatedMilestone,
  CreatedProject,
} from "@/lib/project-types";

type SubmitMilestoneFormProps = {
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

export function SubmitMilestoneForm({
  project,
  milestone,
  onProjectUpdated,
}: SubmitMilestoneFormProps) {
  const connection =
    useConnection();

  const [
    submissionNote,
    setSubmissionNote,
  ] =
    useState("");

  const [
    submissionUrl,
    setSubmissionUrl,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string | null
    >(null);

  async function handleSubmit(
    event:
      SubmitEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setErrorMessage(null);

    if (
      !connection.address
    ) {
      setErrorMessage(
        "Connect your wallet first."
      );

      return;
    }

    const connectedAddress =
      getAddress(
        connection.address
      );

    const freelancerAddress =
      getAddress(
        project.freelancer
      );

    if (
      connectedAddress !==
      freelancerAddress
    ) {
      setErrorMessage(
        "Only the freelancer can submit this milestone."
      );

      return;
    }

    if (
      project.status !==
      "ACTIVE"
    ) {
      setErrorMessage(
        "Project is not active."
      );

      return;
    }

    if (
      milestone.status !==
      "PENDING"
    ) {
      setErrorMessage(
        "Milestone is not pending."
      );

      return;
    }

    if (
      !submissionNote.trim()
    ) {
      setErrorMessage(
        "Submission note is required."
      );

      return;
    }

    if (
      !submissionUrl.trim()
    ) {
      setErrorMessage(
        "Submission URL is required."
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
      setSubmitting(true);

      const response =
        await fetch(
          `${apiUrl}/projects/${project.id}/milestones/${milestone.index}/submit`,
          {
            method:
              "POST",
            credentials: "include",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                submissionNote:
                  submissionNote.trim(),

                submissionUrl:
                  submissionUrl.trim(),
              }),
          }
        );

      if (
        !response.ok
      ) {
        const body =
          await response
            .json()
            .catch(
              () => null
            );

        throw new Error(
          body?.error ??
            "Failed to submit milestone."
        );
      }

      const updatedProject: CreatedProject = await response.json()
          
      onProjectUpdated(
        updatedProject
      );
    } catch (error) {
      if (
        error instanceof Error
      ) {
        setErrorMessage(
          error.message
        );
      } else {
        setErrorMessage(
          "Milestone submission failed."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
    >
      <h4>
        Submit Milestone
      </h4>

      <div>
        <label
          htmlFor={
            `submission-note-${milestone.index}`
          }
        >
          Submission note
        </label>

        <textarea
          id={
            `submission-note-${milestone.index}`
          }
          value={
            submissionNote
          }
          disabled={
            submitting
          }
          onChange={(
            event
          ) =>
            setSubmissionNote(
              event.target.value
            )
          }
        />
      </div>

      <div>
        <label
          htmlFor={
            `submission-url-${milestone.index}`
          }
        >
          Submission URL
        </label>

        <input
          id={
            `submission-url-${milestone.index}`
          }
          type="url"
          value={
            submissionUrl
          }
          disabled={
            submitting
          }
          placeholder="https://..."
          onChange={(
            event
          ) =>
            setSubmissionUrl(
              event.target.value
            )
          }
        />
      </div>

      <button
        type="submit"
        disabled={
          submitting
        }
      >
        {submitting
          ? "Submitting..."
          : "Submit Milestone"}
      </button>

      {errorMessage && (
        <p>
          Error:
          {" "}
          {errorMessage}
        </p>
      )}
    </form>
  );
}