import {
  ConnectWallet,
} from "@/components/connect-wallet";

import {
  CreateProjectForm
} from "@/components/create-project-form";

import {
  SiweAuth,
} from "@/components/siwe-auth";

export default function Home() {
  return (
    <main>
      <h1>
        Milestone Escrow
      </h1>

      <p>
        Trust-minimized milestone payments.
      </p>

      <ConnectWallet />
      <SiweAuth />

      <CreateProjectForm />
    </main>
  );
}