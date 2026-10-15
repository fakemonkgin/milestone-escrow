import type {
  FastifyInstance,
} from "fastify";

import {
  AuthError,
  SESSION_COOKIE_NAME,
  getSessionAddress,
  issueNonce,
  revokeSession,
  sessionCookieSecure,
  sessionTtlSeconds,
  verifySiweAndCreateSession,
} from "./auth.js";


function isRecord(
  value: unknown
): value is
  Record<string, unknown> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


export async function
registerAuthRoutes(
  app: FastifyInstance
): Promise<void> {

  app.get(
    "/auth/nonce",
    async () => {
      const nonce =
        await issueNonce();

      return {
        nonce,
      };
    }
  );


  app.post(
    "/auth/verify",
    async (
      request,
      reply
    ) => {
      if (
        !isRecord(
          request.body
        )
      ) {
        return reply
          .code(400)
          .send({
            error:
              "body must be an object",
          });
      }

      const {
        message,
        signature,
      } = request.body;

      if (
        typeof message !==
          "string" ||
        typeof signature !==
          "string"
      ) {
        return reply
          .code(400)
          .send({
            error:
              "message and signature are required",
          });
      }

      try {
        const session =
          await verifySiweAndCreateSession({
            message,
            signature,
          });

        reply.setCookie(
          SESSION_COOKIE_NAME,
          session.sessionToken,
          {
            path: "/",

            httpOnly: true,

            sameSite:
              "lax",

            secure:
              sessionCookieSecure,

            maxAge:
              sessionTtlSeconds,
          }
        );

        return {
          address:
            session.address,
        };
      } catch (error) {
        if (
          error instanceof
          AuthError
        ) {
          return reply
            .code(401)
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
    "/auth/session",
    async (
      request,
      reply
    ) => {
      const address =
        await getSessionAddress(
          request.cookies[
            SESSION_COOKIE_NAME
          ]
        );

      if (!address) {
        return reply
          .code(401)
          .send({
            authenticated:
              false,
          });
      }

      return {
        authenticated:
          true,

        address,
      };
    }
  );


  app.post(
    "/auth/logout",
    async (
      request,
      reply
    ) => {
      const sessionToken =
        request.cookies[
          SESSION_COOKIE_NAME
        ];

      await revokeSession(
        sessionToken
      );

      reply.clearCookie(
        SESSION_COOKIE_NAME,
        {
          path: "/",
        }
      );

      return {
        ok: true,
      };
    }
  );
}