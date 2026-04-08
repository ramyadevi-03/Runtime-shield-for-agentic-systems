import KcAdminClient from "@keycloak/keycloak-admin-client";
import dotenv from "dotenv";

dotenv.config();

let kc: KcAdminClient;

export async function getKcClient() {

  if (!kc) {
    kc = new KcAdminClient({
      baseUrl: process.env.KEYCLOAK_URL,
      realmName: process.env.KEYCLOAK_REALM,
    });
  }

  try {
    console.log("🔑 Authenticating with Keycloak...");

    await kc.auth({
      grantType: "client_credentials",
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
    });

    console.log("✅ Keycloak authenticated");

    return kc;

  } catch (err: any) {
    console.error("❌ Keycloak auth failed:", err.message);
    throw new Error("Keycloak auth failed: " + err.message);
  }
}