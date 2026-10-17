import type { PoolClient } from "pg";
import type { Address } from "viem";

import { publicClient } from "./client.js";
import { projectReadAbi } from "./abi.js";

type ProjectRow = {
  client_address: string;
  freelancer_address: string;
  token_address: string;
  onchain_created: boolean;
  milestone_index: number;
  amount: string;
};

export async function projectMismatch(
  db: PoolClient,
  escrowAddress: Address,
  projectId: `0x${string}`,
  blockNumber: bigint,
  requireCreated: boolean
): Promise<string | null> {
  const result = await db.query<ProjectRow>(
    `
    SELECT
      p.client_address,
      p.freelancer_address,
      p.token_address,
      p.onchain_created,
      m.milestone_index,
      m.amount::text AS amount
    FROM projects p
    JOIN milestones m
      ON m.project_id = p.id
    WHERE p.id = $1
    ORDER BY m.milestone_index
    `,
    [projectId]
  );

  const first = result.rows[0];

  if (!first) {
    return "DB_PROJECT_NOT_FOUND";
  }

  if (requireCreated && !first.onchain_created) {
    return "PROJECT_CREATION_NOT_VALIDATED";
  }

  const [
    client,
    freelancer,
    token,
    total,
    ,
    ,
    count,
  ] = await publicClient.readContract({
    address: escrowAddress,
    abi: projectReadAbi,
    functionName: "getProject",
    args: [projectId],
    blockNumber,
  });

  if (
    client.toLowerCase() !==
    first.client_address.toLowerCase()
  ) {
    return "CLIENT_MISMATCH";
  }

  if (
    freelancer.toLowerCase() !==
    first.freelancer_address.toLowerCase()
  ) {
    return "FREELANCER_MISMATCH";
  }

  if (
    token.toLowerCase() !==
    first.token_address.toLowerCase()
  ) {
    return "TOKEN_MISMATCH";
  }

  if (count !== BigInt(result.rows.length)) {
    return "MILESTONE_COUNT_MISMATCH";
  }

  const expectedTotal = result.rows.reduce(
    (sum, row) => sum + BigInt(row.amount),
    0n
  );

  if (total !== expectedTotal) {
    return "TOTAL_AMOUNT_MISMATCH";
  }

  for (const [index, row] of result.rows.entries()) {
    if (row.milestone_index !== index) {
      return "MILESTONE_INDEX_MISMATCH";
    }

    const [amount] = await publicClient.readContract({
      address: escrowAddress,
      abi: projectReadAbi,
      functionName: "getMilestone",
      args: [projectId, BigInt(index)],
      blockNumber,
    });

    if (amount !== BigInt(row.amount)) {
      return `MILESTONE_AMOUNT_MISMATCH:${index}`;
    }
  }

  return null;
}