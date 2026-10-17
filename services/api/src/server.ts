import Fastify from "fastify";
import type { Project } from "@escrow/domain";
import {isAddress, getAddress} from "viem";
import { randomBytes } from "node:crypto";
import { pool } from "./db.js";
import cors from "@fastify/cors";
import cookie from
  "@fastify/cookie";

import {
  registerAuthRoutes,
} from "./auth-routes.js";

import {
  getSessionAddress,
  SESSION_COOKIE_NAME,
} from "./auth.js";

const app = Fastify({
  logger: true,
});

const corsOrigin =
  process.env.CORS_ORIGIN;

if (!corsOrigin) {
  throw new Error(
    "CORS_ORIGIN environment variable is required"
  );
}

await app.register(cors, {
  origin:
    corsOrigin,

  credentials:
    true,
});

await app.register(
  cookie
);

await registerAuthRoutes(
  app
);

const host =
  process.env.HOST ?? "127.0.0.1";

const port = Number(
  process.env.PORT ?? "3001"
);

const UINT256_MAX = (1n << 256n) - 1n;

type MilestoneDto = {
  index: number;
  title: string;
  description: string;
  amount: string;
  status: string;

  submissionNote: string | null;
  submissionUrl: string | null;
  submittedAt: string | null;
};
type ProjectDto = {
  id: string;
  title: string;
  description: string;

  client: string;
  freelancer: string;
  token: string;

  status: string;

  onchainCreated: boolean;

  milestones: MilestoneDto[];
};

class InputError extends Error {}

async function insertProject(
  project: Project
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO projects (
        id,
        title,
        description,
        client_address,
        freelancer_address,
        token_address,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      `,
      [
        project.id,
        project.title,
        project.description,
        project.client,
        project.freelancer,
        project.token,
        project.status,
      ]
    );

    for (const milestone of project.milestones) {
      await client.query(
        `
        INSERT INTO milestones (
          project_id,
          milestone_index,
          title,
          description,
          amount,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        `,
        [
          project.id,
          milestone.index,
          milestone.title,
          milestone.description,
          milestone.amount.toString(),
          milestone.status,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findProjectById(
  id: Project["id"]
): Promise<Project | null> {
  const result = await pool.query(
    `
    SELECT
      p.id AS project_id,
      p.title AS project_title,
      p.description AS project_description,
      p.client_address,
      p.freelancer_address,
      p.token_address,
      p.status AS project_status,
      p.onchain_created,

      m.milestone_index,
      m.title AS milestone_title,
      m.description AS milestone_description,
      m.amount,
      m.status AS milestone_status,
      m.submission_note,
      m.submission_url,
      m.submitted_at
    FROM projects AS p
    LEFT JOIN milestones AS m
      ON m.project_id = p.id
    WHERE p.id = $1
    ORDER BY m.milestone_index
    `,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const firstRow = result.rows[0];

  const milestones = result.rows
    .filter(
      (row) => row.milestone_index !== null
    )
    .map((row) => ({
      index: row.milestone_index,
      title: row.milestone_title,
      description: row.milestone_description,
      amount: BigInt(row.amount),
      status: row.milestone_status,
      submissionNote: row.submission_note,
      submissionUrl:row.submission_url,
      submittedAt:
        row.submitted_at
          ? new Date(
              row.submitted_at
            )
          : null,
    }));

  return {
    id: firstRow.project_id,
    title: firstRow.project_title,
    description: firstRow.project_description,
    client: firstRow.client_address,
    freelancer: firstRow.freelancer_address,
    token: firstRow.token_address,
    status: firstRow.project_status,
    onchainCreated:firstRow.onchain_created,

    milestones,
  };
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requireProjectId(
  value: string
): Project["id"] {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new InputError(
      "project id must be a 32-byte hex string"
    );
  }

  return value as Project["id"];
}

function requireString(
  value: unknown,
  field: string
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new InputError(
      `${field} must be a non-empty string`
    );
  }

  return value.trim();
}

function requireAddress(
  value: unknown,
  field: string
) {
  if (
    typeof value !== "string" ||
    !isAddress(value)
  ) {
    throw new InputError(
      `${field} must be a valid Ethereum address`
    );
  }

  return getAddress(value);
}

function requireAmount(
  value: unknown,
  field: string
): bigint {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw new InputError(
      `${field} must be a positive decimal integer string`
    );
  }

  const amount = BigInt(value);

  if (amount > UINT256_MAX) {
    throw new InputError(
      `${field} exceeds uint256`
    );
  }

  return amount;
}

function parseCreateProject(
  input: unknown
): Project {
  if (!isRecord(input)) {
    throw new InputError(
      "body must be an object"
    );
  }

  const title = requireString(
    input.title,
    "title"
  );

  const description = requireString(
    input.description,
    "description"
  );

  const client = requireAddress(
    input.client,
    "client"
  );

  const freelancer = requireAddress(
    input.freelancer,
    "freelancer"
  );

  const token = requireAddress(
    input.token,
    "token"
  );

  if (
    !Array.isArray(input.milestones) ||
    input.milestones.length === 0
  ) {
    throw new InputError(
      "milestones must be a non-empty array"
    );
  }

  const milestones = input.milestones.map(
    (rawMilestone, index) => {
      if (!isRecord(rawMilestone)) {
        throw new InputError(
          `milestones[${index}] must be an object`
        );
      }

      return {
        index,
        title: requireString(
          rawMilestone.title,
          `milestones[${index}].title`
        ),
        description: requireString(
          rawMilestone.description,
          `milestones[${index}].description`
        ),
        amount: requireAmount(
          rawMilestone.amount,
          `milestones[${index}].amount`
        ),
        status: "PENDING" as const,

        submissionNote: null,
        submissionUrl: null,
        submittedAt: null,
      };
    }
  );

  const totalAmount = milestones.reduce(
    (total, milestone) =>
      total + milestone.amount,
    0n
  );

  if (totalAmount > UINT256_MAX) {
    throw new InputError(
      "total milestone amount exceeds uint256"
    );
  }

    return {
    id: `0x${randomBytes(32).toString("hex")}`,
    title,
    description,
    client,
    freelancer,
    token,

    status: "AWAITING_FUNDING",

    onchainCreated: false,

    milestones,
  };
}

function toProjectDto(
  project: Project
): ProjectDto {
  return {
    id: project.id,
    title: project.title,
    description: project.description,

    client: project.client,
    freelancer: project.freelancer,
    token: project.token,

    status: project.status,

    onchainCreated:
      project.onchainCreated,

    milestones:
      project.milestones.map(
        (milestone) => ({
          index: milestone.index,
          title: milestone.title,
          description:
            milestone.description,
          amount:
            milestone.amount.toString(),
          status: milestone.status,
          submissionNote: milestone.submissionNote,
          submissionUrl:milestone.submissionUrl,

          submittedAt:
            milestone.submittedAt
              ? milestone.submittedAt.toISOString()
              : null,
        })
      ),
  };
}

function requireUrl(
  value: unknown,
  field: string
): string {
  const raw =
    requireString(
      value,
      field
    );

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new InputError(
      `${field} must be a valid URL`
    );
  }

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw new InputError(
      `${field} must use http or https`
    );
  }

  return url.toString();
}

async function submitMilestone({
  projectId,
  milestoneIndex,
  submissionNote,
  submissionUrl,
}: {
  projectId: Project["id"];
  milestoneIndex: number;
  submissionNote: string;
  submissionUrl: string;
}): Promise<void> {
  const result =
    await pool.query(
      `
      UPDATE milestones AS m
      SET
        status = 'SUBMITTED',
        submission_note = $3,
        submission_url = $4,
        submitted_at = NOW(),
        updated_at = NOW()
      FROM projects AS p
      WHERE
        m.project_id = $1
        AND m.milestone_index = $2
        AND m.status = 'PENDING'
        AND p.id = m.project_id
        AND p.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1
          FROM milestones AS previous
          WHERE previous.project_id = m.project_id
            AND previous.milestone_index < m.milestone_index
            AND previous.status <> 'PAID'
        )
      `,
      [
        projectId,
        milestoneIndex,
        submissionNote,
        submissionUrl,
      ]
    );

  if (result.rowCount !== 1) {
    throw new InputError(
      "milestone cannot be submitted"
    );
  }
}

app.get("/health", async () => {
  const result = await pool.query(
    "SELECT 1 AS database_ok"
  );

  return {
    status: "ok",
    database: result.rows[0]?.database_ok,
  };
});

app.get("/my/projects", async (request, reply) => {
  const address = await getSessionAddress(
    request.cookies[SESSION_COOKIE_NAME]
  );

  if (!address) {
    return reply.code(401).send({
      error: "authentication required",
    });
  }

  const result = await pool.query<{
    id: string;
    title: string;
    status: string;
    milestoneCount: number;
    role: "CLIENT" | "FREELANCER";
  }>(
    `
    SELECT
      p.id,
      p.title,
      p.status,

      (
        SELECT COUNT(*)::int
        FROM milestones AS m
        WHERE m.project_id = p.id
      ) AS "milestoneCount",

      CASE
        WHEN lower(p.client_address) = lower($1)
          THEN 'CLIENT'
        ELSE 'FREELANCER'
      END AS "role"

    FROM projects AS p
    WHERE
      lower(p.client_address) = lower($1)
      OR lower(p.freelancer_address) = lower($1)

    ORDER BY p.created_at DESC
    LIMIT 50
    `,
    [address]
  );

  return {
    projects: result.rows,
  };
});

app.post("/projects", async (request, reply) => {
  try {
    const project = parseCreateProject(
      request.body
    );

    const authenticatedAddress =
  await getSessionAddress(
    request.cookies[
      SESSION_COOKIE_NAME
    ]
  );

if (
  !authenticatedAddress
) {
  return reply
    .code(401)
    .send({
      error:
        "authentication required",
    });
}

if (
  authenticatedAddress !==
  project.client
) {
  return reply
    .code(403)
    .send({
      error:
        "authenticated wallet does not match project client",
    });
}

    await insertProject(project);
    return reply
      .code(201)
      .send(toProjectDto(project));
  } catch (error) {
    if (error instanceof InputError) {
      return reply
        .code(400)
        .send({
          error: error.message,
        });
    }

    throw error;
  }
});

app.post(
  "/projects/:projectId/milestones/:index/submit",
  async (
    request,
    reply
  ) => {
    const params =
      request.params as {
        projectId: string;
        index: string;
      };

    let projectId:
      Project["id"];

    try {
      projectId =
        requireProjectId(
          params.projectId
        );

      const authenticatedAddress =
  await getSessionAddress(
    request.cookies[
      SESSION_COOKIE_NAME
    ]
  );

if (
  !authenticatedAddress
) {
  return reply
    .code(401)
    .send({
      error:
        "authentication required",
    });
}

const existingProject =
  await findProjectById(
    projectId
  );

if (!existingProject) {
  return reply
    .code(404)
    .send({
      error:
        "project not found",
    });
}

if (
  authenticatedAddress !==
  existingProject.freelancer
) {
  return reply
    .code(403)
    .send({
      error:
        "only the freelancer can submit this milestone",
    });
}

      if (
        !/^\d+$/.test(
          params.index
        )
      ) {
        throw new InputError(
          "milestone index must be a non-negative integer"
        );
      }

      const milestoneIndex =
        Number(params.index);

      if (
        !Number.isSafeInteger(
          milestoneIndex
        )
      ) {
        throw new InputError(
          "milestone index is too large"
        );
      }

      if (
        !isRecord(
          request.body
        )
      ) {
        throw new InputError(
          "body must be an object"
        );
      }

      const submissionNote =
        requireString(
          request.body
            .submissionNote,
          "submissionNote"
        );

      const submissionUrl =
        requireUrl(
          request.body
            .submissionUrl,
          "submissionUrl"
        );

      await submitMilestone({
        projectId,
        milestoneIndex,
        submissionNote,
        submissionUrl,
      });

      const project =
        await findProjectById(
          projectId
        );

      if (!project) {
        return reply
          .code(404)
          .send({
            error:
              "project not found",
          });
      }

      return reply.send(
        toProjectDto(
          project
        )
      );
    } catch (error) {
      if (
        error instanceof
        InputError
      ) {
        return reply
          .code(400)
          .send({
            error:
              error.message,
          });
      }

      throw error;
    }
  }
);

app.get(
  "/projects/:id",
  async (request, reply) => {
    const params = request.params as {
      id: string;
    };

    let projectId: Project["id"];

    try {
      projectId = requireProjectId(params.id);
    } catch (error) {
      if (error instanceof InputError) {
        return reply
          .code(400)
          .send({
            error: error.message,
          });
      }

      throw error;
    }

    const project = await findProjectById(
      projectId
    );

    if (!project) {
      return reply
        .code(404)
        .send({
          error: "project not found",
        });
    }

    return toProjectDto(project);
  }
);

await app.listen({
  host,
  port,
});