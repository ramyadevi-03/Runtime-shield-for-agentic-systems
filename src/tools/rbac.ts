import jwt from "jsonwebtoken";

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
YOUR_KEYCLOAK_PUBLIC_KEY
-----END PUBLIC KEY-----`;

const VALID_ROLES = ["guest", "analyst", "admin"];

export function getUserRoles(token: string): string[] {
  // If token is a plain role string (set by bridge via RUNTIME_ROLE), use it directly
  if (VALID_ROLES.includes(token.trim().toLowerCase())) {
    return [token.trim().toLowerCase()];
  }

  // Otherwise try to decode as JWT
  try {
    const decoded: any = jwt.verify(token, PUBLIC_KEY, {
      algorithms: ["RS256"]
    });

    if (!decoded || !decoded.realm_access) {
      throw new Error("Invalid token");
    }

    return decoded.realm_access.roles || [];

  } catch (err) {
    // If JWT verification fails, check if it's a plain role passed without verification
    const role = token.trim().toLowerCase();
    if (VALID_ROLES.includes(role)) {
      return [role];
    }
    throw new Error("Invalid or tampered token ❌");
  }
}

export function checkRole(userRoles: string[], allowedRoles: string[]) {
  const allowed = userRoles.some(role =>
    allowedRoles.includes(role)
  );

  if (!allowed) {
    throw new Error("Unauthorized tool access ❌");
  }
}