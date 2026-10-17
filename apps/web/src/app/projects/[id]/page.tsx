"use client";

import { Suspense,useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import type { CreatedProject } from "@/lib/project-types";

import { ConnectWallet } from "@/components/connect-wallet";
import { SiweAuth } from "@/components/siwe-auth";
import { FundProjectPanel } from "@/components/fund-project-panel";
import { ProjectWorkflowPanel } from "@/components/project-workflow-panel";

function ProjectDetailsContent() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] =
    useState<CreatedProject | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        if (!apiUrl) {
          throw new Error("API URL is not configured.");
        }

        if (!/^0x[0-9a-fA-F]{64}$/.test(id)) {
          throw new Error("Invalid project ID.");
        }

        const response = await fetch(
          `${apiUrl}/projects/${id}`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load project: HTTP ${response.status}`
          );
        }

        const data: CreatedProject =
          await response.json();

        if (!cancelled) {
          setProject(data);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load project."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [id, refreshCount]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-5xl space-y-6">

        <Link
          href="/"
          className="text-sm font-medium text-indigo-600"
        >
          ← Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-slate-900">
          Project Details
        </h1>

        <button
          type="button"
          onClick={() => setRefreshCount((value) => value + 1)}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
        >
          Refresh Project Status
        </button>

        {loading && (
          <p className="text-slate-500">
            Loading project...
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="text-red-600">
            {errorMessage}
          </p>
        )}

        {project && project.id.toLowerCase() === id.toLowerCase() && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                {project.title}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                {project.description}
              </p>

              <p className="mt-3 text-sm text-slate-500">
                Status: {project.status}
              </p>

              <p className="text-sm text-slate-500">
                {project.milestones.length} milestones
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <ConnectWallet />
              <SiweAuth />
            </section>

            {project.status === "AWAITING_FUNDING" &&
              !project.onchainCreated && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  Waiting for the indexer to confirm project creation.
                </p>
              )}

            {project.status === "AWAITING_FUNDING" &&
              project.onchainCreated && (
                <FundProjectPanel
                  project={project}
                  onProjectUpdated={setProject}
                />
              )}

            {(project.status === "ACTIVE" ||
              project.status === "COMPLETED") && (
              <ProjectWorkflowPanel
                project={project}
                onProjectUpdated={setProject}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function ProjectDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-10">
          <p className="text-sm text-slate-500">
            Loading project details...
          </p>
        </main>
      }
    >
      <ProjectDetailsContent />
    </Suspense>
  );
}