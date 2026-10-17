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
    onSubmit={handleSubmit}
    className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
  >
    <div>
      <h4 className="text-base font-semibold text-slate-900">
        Submit Deliverables
      </h4>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Share your completed work with the client for review.
      </p>
    </div>

      <div>
        <label
          htmlFor={
            `submission-note-${milestone.index}`
          }
        >
          Submission note
        </label>

        <textarea
          id={`submission-note-${milestone.index}`}
          value={submissionNote}
          onChange={(event) => setSubmissionNote(event.target.value)}
          disabled={submitting}
          required
          rows={4}
          placeholder="Describe what you delivered and what the client should review..."
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
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
            id={`submission-url-${milestone.index}`}
            type="url"
            value={submissionUrl}
            onChange={(event) => setSubmissionUrl(event.target.value)}
            disabled={submitting}
            required
            placeholder="https://github.com/your-project"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
          />
      </div>

      <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? "Submitting..." : "Submit for Review"}
      </button>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}