import type {
  APIRequestContext,
} from "@playwright/test";

import type {
  Address,
} from "viem";


export type ProjectDto = {
  id:
    `0x${string}`;

  title:
    string;

  description:
    string;

  client:
    Address;

  freelancer:
    Address;

  token:
    Address;

  status:
    string;

  onchainCreated:
    boolean;

  milestones: Array<{
    index:
      number;

    title:
      string;

    description:
      string;

    amount:
      string;

    status:
      string;

    submissionNote:
      string | null;

    submissionUrl:
      string | null;

    submittedAt:
      string | null;
  }>;
};


export async function waitForProject(
  api: APIRequestContext,

  projectId: `0x${string}`,

  predicate: (
    project: ProjectDto
  ) => boolean
): Promise<ProjectDto> {
  const timeoutMs = 30_000;
  const intervalMs = 500;

  const deadline =
    Date.now() + timeoutMs;

    let lastProject:
    ProjectDto | null = null;

    let lastStatus:
    number | null = null;

    let lastBody =
    "";

  while (
    Date.now() < deadline
  ) {
    const response =
  await api.get(
    `/projects/${projectId}`
  );

lastStatus =
  response.status();

lastBody =
  await response.text();

if (
  response.ok()
) {
  const project:
    ProjectDto =
    JSON.parse(lastBody);

  lastProject =
    project;

  if (
    predicate(project)
  ) {
    return project;
  }
}

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          intervalMs
        )
    );
  }
        throw new Error(
        `project ${projectId} did not reach expected state; ` +
            `last status: ${lastStatus}; ` +
            `last body: ${lastBody}; ` +
            `last observed project: ${JSON.stringify(
            lastProject
            )}`
        );      
}