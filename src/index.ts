import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/tools.js";
import { initSpiffe } from "./tools/spiffeAuth.js";
import { startMetricsServer } from "./utils/metrics.js";
import dotenv from "dotenv";

dotenv.config();

// MCP Server
const server = new McpServer({
  name: "keycloak-mcp-server",
  version: "1.0.0"
});

registerTools(server);

async function main() {
  try {
    // SPIFFE (optional)
    if (process.env.SPIFFE_ENABLED === "true") {
      try {
        await initSpiffe();
      } catch {
        // ignore SPIFFE errors
      }
    }

    // Metrics (runs in background)
    startMetricsServer(9100);
    // MCP stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // 🔥 KEEP PROCESS ALIVE (CRITICAL)
    process.stdin.resume();

    // 🔥 HARD KEEP-ALIVE (prevents exit in all environments)
    await new Promise(() => {});

  } catch (err) {
    // ❌ NEVER log to stdout
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

main();