"use client";

import {
  formatUnits,
} from "viem";

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
  return (
    <section>
      <h2>
        Project Workflow
      </h2>

      <p>
        Project status:
        {" "}
        {project.status}
      </p>

      {project.milestones.map(
        (milestone) => (
          <article
            key={
              milestone.index
            }
          >
            <h3>
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

            {project.status ===
              "ACTIVE" &&
              milestone.status ===
                "PENDING" && (
                <SubmitMilestoneForm
                  project={
                    project
                  }
                  milestone={
                    milestone
                  }
                  onProjectUpdated={
                    onProjectUpdated
                  }
                />
              )}

            {project.status ===
              "ACTIVE" &&
              milestone.status ===
                "SUBMITTED" && (
                <ReleaseMilestonePanel
                  project={
                    project
                  }
                  milestone={
                    milestone
                  }
                  onProjectUpdated={
                    onProjectUpdated
                  }
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

      {project.status ===
        "COMPLETED" && (
        <p>
          All milestones have
          been paid. Project
          completed.
        </p>
      )}
    </section>
  );
}