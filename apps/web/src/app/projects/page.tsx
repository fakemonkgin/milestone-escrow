"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConnection } from "wagmi";

import { ConnectWallet } from "@/components/connect-wallet";
import { SiweAuth } from "@/components/siwe-auth";

type ProjectSummary = {
  id: string;
  title: string;
  status: string;
  milestoneCount: number;
  role: "CLIENT" | "FREELANCER";
};

export default function MyProjectsPage() {
  const connection = useConnection();

  const [projects, setProjects] =
    useState<ProjectSummary[]>([]);

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setLoading(true);
      setErrorMessage(null);
      setProjects([]);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        if (!apiUrl) {
          throw new Error("API URL is not configured.");
        }

        if (!connection.address) {
          throw new Error("Connect your wallet first.");
        }

        const sessionResponse = await fetch(
          `${apiUrl}/auth/session`,
          { credentials: "include" }
        );

        if (!sessionResponse.ok) {
          throw new Error("Sign in with Ethereum first.");
        }

        const session: { address?: string } =
          await sessionResponse.json();

        if (
          session.address?.toLowerCase() !==
          connection.address.toLowerCase()
        ) {
          throw new Error(
            "Wallet and SIWE session do not match."
          );
        }

        const response = await fetch(
          `${apiUrl}/my/projects`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Unable to load projects.");
        }

        const data: { projects: ProjectSummary[] } =
          await response.json();

        if (!cancelled) {
          setProjects(data.projects);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load projects."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [connection.address, refreshKey]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/"
          className="text-sm font-medium text-indigo-600"
        >
          ← Back to Home
        </Link>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            My Projects
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            View projects where you are the client or freelancer.
          </p>
        </div>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <ConnectWallet />
          <SiweAuth />
        </section>

        <button
          type="button"
          disabled={loading}
          onClick={() => setRefreshKey((value) => value + 1)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh Projects"}
        </button>

        {errorMessage && (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {errorMessage}
          </p>
        )}

        {!loading && !errorMessage && projects.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-slate-500">
            No projects found for this wallet.
          </p>
        )}

        <div className="space-y-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {project.title}
                </h2>

                <span className="text-xs font-medium text-indigo-700">
                  View Project →
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                <span>
                  {project.role === "CLIENT"
                    ? "Client"
                    : "Freelancer"}
                </span>

                <span>
                  {project.milestoneCount} milestones
                </span>

                <span>
                  {project.status === "AWAITING_FUNDING"
                    ? "Awaiting deposit"
                    : project.status === "ACTIVE"
                      ? "In progress"
                      : project.status === "COMPLETED"
                        ? "Completed"
                        : project.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}