import type { Address } from "viem";

export type CreatedMilestone = {
  index: number;
  title: string;
  description: string;
  amount: string;
  status: string;

  submissionNote: string | null;
  submissionUrl: string | null;
  submittedAt: string | null;
};

export type CreatedProject = {
  id: `0x${string}`;

  title: string;
  description: string;

  client: Address;
  freelancer: Address;
  token: Address;

  status: string;
  onchainCreated: boolean;

  milestones: CreatedMilestone[];
};