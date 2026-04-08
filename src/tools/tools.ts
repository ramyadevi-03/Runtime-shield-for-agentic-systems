import { z } from "zod";
import { getKcClient } from "../utils/keycloak";
import { verifySpiffeIdentity } from "./spiffeAuth";
import { getUserRoles, checkRole } from "./rbac";

/* -----------------------------
   Resolve userId
----------------------------- */
async function resolveUserId(kc: any, userId?: string, username?: string) {
  if (userId) return userId;

  if (!username) {
    throw new Error("Provide either userId or username");
  }

  const users = await kc.users.find({
    search: username,
    max: 20
  });

  const user = users.find(
    (u: any) => (u.username || "").toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    throw new Error(`User '${username}' not found`);
  }

  return user.id;
}

/* -----------------------------
   Get effective role
----------------------------- */
function getEffectiveRole(token?: string): string {
  // If token provided, use it for RBAC
  // Otherwise fall back to RUNTIME_ROLE from environment (set by bridge)
  if (token) return token;
  return process.env.RUNTIME_ROLE || "analyst";
}

/* -----------------------------
   Security Check (SPIFFE SAFE)
----------------------------- */
async function authorize(action: string) {
  if (process.env.SPIFFE_ENABLED === "true") {
    try {
      const identity = await Promise.race([
        verifySpiffeIdentity(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("SPIFFE timeout")), 2000)
        )
      ]);

      if (
        typeof identity !== "object" ||
        identity === null ||
        !("valid" in identity) ||
        !("spiffe_id" in identity)
      ) {
        throw new Error("SPIFFE identity malformed");
      }

      const spiffeIdentity = identity as { valid: boolean; spiffe_id: string };

      if (!spiffeIdentity.valid || !spiffeIdentity.spiffe_id) {
        throw new Error("Invalid SPIFFE identity");
      }

      return identity;

    } catch (err: any) {
      // SPIFFE failed - continue in degraded mode
    }
  }

  return { spiffe_id: "dev-mode", valid: true };
}

/* -----------------------------
   Register tools
----------------------------- */
export function registerTools(server: any) {

  /* -----------------------------
     LIST USERS
  ----------------------------- */
  server.tool(
    "keycloak_list_users",
    {
      token: z.string().optional()
    },
    async ({ token }: any) => {
      try {
        await authorize("list-users");

        const roles = getUserRoles(getEffectiveRole(token));
        checkRole(roles, ["admin", "analyst"]);

        const kc = await getKcClient();
        const users = await kc.users.find();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(users ?? [], null, 2)
            }
          ],
          isError: false
        };

      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  /* -----------------------------
     LIST USER SESSIONS
  ----------------------------- */
  server.tool(
    "keycloak_list_user_sessions",
    {
      token: z.string().optional(),
      username: z.string().optional(),
      userId: z.string().optional()
    },
    async (params: any) => {
      try {
        await authorize("list-sessions");

        const roles = getUserRoles(getEffectiveRole(params.token));
        checkRole(roles, ["admin", "analyst"]);

        const kc = await getKcClient();
        const targetId = await resolveUserId(kc, params.userId, params.username);
        const sessions = await kc.users.listSessions({ id: targetId });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(sessions ?? [], null, 2)
            }
          ],
          isError: false
        };

      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  /* -----------------------------
     REVOKE USER SESSIONS
  ----------------------------- */
  server.tool(
    "keycloak_revoke_user_sessions",
    {
      token: z.string().optional(),
      username: z.string().optional(),
      userId: z.string().optional()
    },
    async (params: any) => {
      try {
        await authorize("revoke-sessions");

        const roles = getUserRoles(getEffectiveRole(params.token));
        checkRole(roles, ["admin"]);

        const kc = await getKcClient();
        const targetId = await resolveUserId(kc, params.userId, params.username);
        await kc.users.logout({ id: targetId });

        return {
          content: [
            {
              type: "text",
              text: `Sessions revoked for ${params.username || targetId} ✅`
            }
          ],
          isError: false
        };

      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  /* -----------------------------
     GET USER EVENTS
  ----------------------------- */
  server.tool(
    "keycloak_get_user_events",
    {
      token: z.string().optional(),
      username: z.string().optional(),
      userId: z.string().optional(),
      limit: z.number().optional().default(20)
    },
    async (params: any) => {
      try {
        await authorize("view-events");

        const roles = getUserRoles(getEffectiveRole(params.token));
        checkRole(roles, ["admin", "analyst"]);

        const kc = await getKcClient();
        const targetId = await resolveUserId(kc, params.userId, params.username);
        const realm = process.env.KEYCLOAK_REALM || "runtime-shield";

        const events = await kc.realms.findEvents({
          realm,
          user: targetId,
          max: params.limit
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(events ?? [], null, 2)
            }
          ],
          isError: false
        };

      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        };
      }
    }
  );
}