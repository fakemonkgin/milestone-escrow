"use client";

import {
  formatUnits,
} from "viem";

import { useConnection } from "wagmi";

import {
  SubmitMilestoneForm,
} from "@/components/submit-milestone-form";

import {
  ReleaseMilestonePanel,
} from "@/components/release-milestone-panel";

import type {
  CreatedProject,
} from "@/lib/project-types";

type ProjectWorkflowPanelProps = {
  project:
    CreatedProject;

  onProjectUpdated:
    (
      project:
        CreatedProject
    ) => void;
};

export function ProjectWorkflowPanel({
  project,
  onProjectUpdated,
}: ProjectWorkflowPanelProps) {
  const connection = useConnection();

const connectedAddress =
  connection.address?.toLowerCase();

const isClient =
  connectedAddress !== undefined &&
  connectedAddress === project.client.toLowerCase();

const isFreelancer =
  connectedAddress !== undefined &&
  connectedAddress === project.freelancer.toLowerCase();

  function previousMilestonesPaid(
    currentIndex: number
    ): boolean {
      return project.milestones.every(
        (item) =>
          item.index >= currentIndex ||
          item.status === "PAID"
      );
    }

  const paidMilestones = project.milestones.filter(
  (milestone) => milestone.status === "PAID"
    );

    const paidMilestoneCount = paidMilestones.length;

    const totalPaidAmount = paidMilestones.reduce(
      (sum, milestone) => sum + BigInt(milestone.amount),
      0n
    );

  return (
  <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-slate-900">
        Project Milestones
      </h2>

      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        {project.status === "ACTIVE"
          ? "In Progress"
          : project.status}
      </span>
    </div>
      {project.milestones.map(
        (milestone) => (
          <article
              key={milestone.index}
              className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5"
            >
            <h3 className="text-lg font-semibold text-slate-900">
              Milestone
              {" "}
              {milestone.index + 1}
              :
              {" "}
              {milestone.title}
            </h3>

            <p>
              {
                milestone.description
              }
            </p>

            <p>
              Amount:
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

            <p>
              Status:
              {" "}
              {milestone.status}
            </p>

            {milestone
              .submissionNote && (
              <p>
                Submission:
                {" "}
                {
                  milestone
                    .submissionNote
                }
              </p>
            )}

            {milestone
              .submissionUrl && (
              <p>
                URL:
                {" "}
                <a
                  href={
                    milestone
                      .submissionUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {
                    milestone
                      .submissionUrl
                  }
                </a>
              </p>
            )}

          {isFreelancer &&
              project.status === "ACTIVE" &&
              milestone.status === "PENDING" &&
              previousMilestonesPaid(milestone.index) && (
                <SubmitMilestoneForm
                  project={project}
                  milestone={milestone}
                  onProjectUpdated={onProjectUpdated}
                />
              )}

          {project.status === "ACTIVE" &&
            milestone.status === "PENDING" &&
            !previousMilestonesPaid(milestone.index) && (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                This milestone is locked until all previous
                milestones have been paid.
              </p>
            )}

          {isClient &&
            project.status === "ACTIVE" &&
            milestone.status === "SUBMITTED" && (
              <ReleaseMilestonePanel
                key={`${project.id}:${project.client.toLowerCase()}:${milestone.index}`}
                project={project}
                milestone={milestone}
                onProjectUpdated={onProjectUpdated}
              />
            )}

            {milestone.status ===
              "PAID" && (
              <p>
                Milestone paid.
              </p>
            )}
          </article>
        )
      )}

 {project.status === "COMPLETED" && (
  <section
    aria-label="Final settlement"
    className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
  >
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Final Settlement
      </p>

      <h3 className="mt-2 text-2xl font-bold text-slate-900">
        Project Completed
      </h3>

      <p className="mt-2 text-sm text-slate-600">
        All milestones have been paid to the freelancer.
      </p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-white p-4">
        <p className="text-sm text-slate-500">
          Total paid
        </p>

        <p className="mt-1 text-xl font-bold text-slate-900">
          {formatUnits(totalPaidAmount, 6)} USDC
        </p>
      </div>

      <div className="rounded-xl bg-white p-4">
        <p className="text-sm text-slate-500">
          Milestones paid
        </p>

        <p className="mt-1 text-xl font-bold text-slate-900">
          {paidMilestoneCount} / {project.milestones.length}
        </p>
      </div>
    </div>
  </section>
)}
    </section>
  );
}