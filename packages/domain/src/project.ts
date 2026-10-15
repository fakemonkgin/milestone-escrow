export type Address = `0x${string}`;

export type ProjectId = `0x${string}`;

export type ProjectStatus =
  | "AWAITING_FUNDING"
  | "ACTIVE"
  | "COMPLETED";

export type MilestoneStatus =
  | "PENDING"
  | "SUBMITTED"
  | "PAID";

export type Milestone = {
  index: number;
  title: string;
  description: string;
  amount: bigint;
  status: MilestoneStatus;

  submissionNote: string | null;
  submissionUrl: string | null;
  submittedAt: Date | null;
};

export type Project = {
  id: ProjectId;
  title: string;
  description: string;

  client: Address;
  freelancer: Address;
  token: Address;

  status: ProjectStatus;

  onchainCreated: boolean;

  milestones: Milestone[];
};

 