import {
  ConnectWallet,
} from "@/components/connect-wallet";

import {
  CreateProjectForm
} from "@/components/create-project-form";

import {
  SiweAuth,
} from "@/components/siwe-auth";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-10">

        <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-10 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
            Decentralized Payments
          </p>

          <h1 className="mt-4 text-4xl font-bold">
            Milestone Escrow
          </h1>

          <p className="mt-4 max-w-xl text-slate-200">
            Secure milestone-based payments
            with on-chain settlement.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">
                Wallet
              </h2>

              <ConnectWallet />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">
                Authentication
              </h2>

              <SiweAuth />

            </section>
            <div className="mb-6">
            <Link
              href="/projects"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              My Projects →
            </Link>
          </div>
          </aside>


          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <CreateProjectForm />
          </section>

        </div>
      </div>
    </main>
  );
}