import type {PoolClient} from "pg";

import {getAddress,type Address} from "viem";

import {publicClient} from "./client.js";

import {pool} from "./db.js";

import {milestoneEscrowAbi} from "./abi.js";

import { projectMismatch } from "./project-validation.js";

const escrowAddressValue =
  process.env.ESCROW_ADDRESS;

if (!escrowAddressValue) {
  throw new Error("ESCROW_ADDRESS environment variable is required");
}

const escrowAddress: Address = getAddress(escrowAddressValue);

const deploymentBlockValue = process.env.ESCROW_DEPLOYMENT_BLOCK;

if (!deploymentBlockValue) {
  throw new Error("ESCROW_DEPLOYMENT_BLOCK environment variable is required");
}

const deploymentBlock = BigInt(deploymentBlockValue);

const BLOCK_BATCH_SIZE = 500n;

const blockTagValue =
  process.env
    .INDEXER_BLOCK_TAG ??
  "finalized";

if (
  blockTagValue !==
    "latest" &&
  blockTagValue !==
    "finalized"
) {
  throw new Error(
    "INDEXER_BLOCK_TAG must be latest or finalized"
  );
}

export const syncBlockTag = blockTagValue;

async function getLastProcessedBlock(
  chainId: number,
  address: Address
): Promise<bigint | null> {
  const result = await pool.query(
    `
    SELECT last_processed_block
    FROM chain_sync_state
    WHERE
      chain_id = $1
      AND contract_address = $2
    `,
    [
      chainId,
      address.toLowerCase(),
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return BigInt(
    result.rows[0].last_processed_block
  );
}

async function applyProjectFunded(
  client: PoolClient,
  projectId: `0x${string}`
): Promise<void> {
  const result = await client.query(
    `
    UPDATE projects
    SET
      status = 'ACTIVE',
      updated_at = NOW()
    WHERE id = $1
    `,
    [projectId]
  );

  if (result.rowCount !== 1) {
    throw new Error(
      `project not found: ${projectId}`
    );
  }
}

async function applyProjectCreated(
  client: PoolClient,
  projectId: `0x${string}`
): Promise<void> {
  const result = await client.query(
    `
    UPDATE projects
    SET
      onchain_created = TRUE,
      updated_at = NOW()
    WHERE id = $1
    `,
    [projectId]
  );

  if (result.rowCount !== 1) {
    throw new Error(
      `project not found: ${projectId}`
    );
  }
}

async function applyMilestoneReleased(
  client: PoolClient,
  projectId: `0x${string}`,
  milestoneIndex: bigint
): Promise<void> {
  if (
    milestoneIndex >
    BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(
      "milestone index is too large"
    );
  }

  const index =
    Number(milestoneIndex);

  const milestoneResult =
    await client.query(
      `
      UPDATE milestones
      SET
        status = 'PAID',
        updated_at = NOW()
      WHERE
        project_id = $1
        AND milestone_index = $2
      `,
      [
        projectId,
        index,
      ]
    );

  if (milestoneResult.rowCount !== 1) {
    throw new Error(
      `milestone not found: ${projectId}/${index}`
    );
  }

  const remainingResult =
    await client.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM milestones
        WHERE
          project_id = $1
          AND status <> 'PAID'
      ) AS has_unpaid
      `,
      [projectId]
    );

  const hasUnpaid =
    remainingResult.rows[0]?.has_unpaid;

  if (hasUnpaid === false) {
    await client.query(
      `
      UPDATE projects
      SET
        status = 'COMPLETED',
        updated_at = NOW()
      WHERE id = $1
      `,
      [projectId]
    );
  }
}

async function getEscrowLogs(
  fromBlock: bigint,
  toBlock: bigint
) {
  return publicClient.getLogs({
    address: escrowAddress,

    events: milestoneEscrowAbi,

    fromBlock,
    toBlock,
  });
}

type EscrowLogs =
  Awaited<
    ReturnType<
      typeof getEscrowLogs
    >
  >;

async function processBlockRange({
  chainId,
  toBlock,
  logs,
}: {
  chainId: number;
  toBlock: bigint;
  logs: EscrowLogs;
}): Promise<void> {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    for (const log of logs) {
      if (
        log.transactionHash === null ||
        log.logIndex === null ||
        log.blockNumber === null
      ) {
        throw new Error(
          "log is missing blockchain identifiers"
        );
      }

      const processedResult =
        await client.query(
          `
          INSERT INTO processed_logs (
            chain_id,
            transaction_hash,
            log_index,
            block_number,
            contract_address,
            event_name
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          ON CONFLICT DO NOTHING
          RETURNING transaction_hash
          `,
          [
            chainId,
            log.transactionHash,
            log.logIndex,
            log.blockNumber.toString(),
            escrowAddress.toLowerCase(),
            log.eventName,
          ]
        );

      const isNewLog =
        processedResult.rows.length === 1;

      if (!isNewLog) {
        continue;
      }

      const { projectId } = log.args;

if (projectId === undefined) {
  throw new Error(
    "Escrow log is missing projectId"
  );
}

const rejectionReason = await projectMismatch(
  client,
  escrowAddress,
  projectId,
  log.blockNumber,
  log.eventName !== "ProjectCreated"
);

if (rejectionReason !== null) {
  await client.query(
    `
    UPDATE processed_logs
    SET rejection_reason = $4
    WHERE
      chain_id = $1
      AND transaction_hash = $2
      AND log_index = $3
    `,
    [
      chainId,
      log.transactionHash,
      log.logIndex,
      rejectionReason,
    ]
  );

  continue;
}

    switch (log.eventName) {
        case "ProjectCreated": {
            const { projectId } = log.args;

            if (projectId === undefined) {
            throw new Error(
                "ProjectCreated log is missing projectId"
            );
            }

            await applyProjectCreated(
            client,
            projectId
            );

            break;
        }

        case "ProjectFunded": {
            const { projectId } = log.args;

            if (projectId === undefined) {
            throw new Error(
                "ProjectFunded log is missing projectId"
            );
            }

            await applyProjectFunded(
            client,
            projectId
            );

            break;
        }

            case "MilestoneReleased": {
                const {
                projectId,
                milestoneIndex,
                } = log.args;

                if (
                projectId === undefined ||
                milestoneIndex === undefined
                ) {
                throw new Error(
                    "MilestoneReleased log is missing required args"
                );
                }

                await applyMilestoneReleased(
                client,
                projectId,
                milestoneIndex
                );

                break;
            }
        }
    }

    await client.query(
      `
      INSERT INTO chain_sync_state (
        chain_id,
        contract_address,
        last_processed_block
      )
      VALUES (
        $1,
        $2,
        $3
      )
      ON CONFLICT (
        chain_id,
        contract_address
      )
      DO UPDATE SET
        last_processed_block =
          EXCLUDED.last_processed_block,
        updated_at = NOW()
      `,
      [
        chainId,
        escrowAddress.toLowerCase(),
        toBlock.toString(),
      ]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

async function syncToFinalized(): Promise<void> {
  const chainId = await publicClient.getChainId();

  const lastProcessedBlock =
    await getLastProcessedBlock(
      chainId,
      escrowAddress
    );

  const latestBlockNumber =
  await publicClient.getBlockNumber();

  if (
    lastProcessedBlock !== null &&
    lastProcessedBlock > latestBlockNumber
  ) {
    throw new Error(
      `Indexer cursor is ahead of chain head: ` +
      `cursor=${lastProcessedBlock}, ` +
      `latest=${latestBlockNumber}. ` +
      `Check whether Anvil has been reset.`
    );
  }

  let fromBlock =
    lastProcessedBlock === null
      ? deploymentBlock
      : lastProcessedBlock + 1n;

  while (true) {
    const finalizedBlock =
      await publicClient.getBlock({
        blockTag: syncBlockTag,
      });

    if (
      fromBlock >
      finalizedBlock.number
    ) {
      return;
    }

    const candidateToBlock =
      fromBlock +
      BLOCK_BATCH_SIZE -
      1n;

    const toBlock =
      candidateToBlock >
      finalizedBlock.number
        ? finalizedBlock.number
        : candidateToBlock;

    const logs =
      await getEscrowLogs(
        fromBlock,
        toBlock
      );

    await processBlockRange({
      chainId,
      toBlock,
      logs,
    });

    fromBlock =
      toBlock + 1n;
  }
}

let syncing = false;

export async function runSync():
  Promise<void> {
  if (syncing) {
    return;
  }

  syncing = true;

  try {
    await syncToFinalized();
  } finally {
    syncing = false;
  }
}