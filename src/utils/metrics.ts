import * as client from "prom-client";
import http from "http";

// Registry
export const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Metrics
export const spiffeVerificationRequestsTotal = new client.Counter({
  name: "spiffe_verification_requests_total",
  help: "Total number of SPIFFE identity verification requests",
  labelNames: ["status"]
});

export const spiffeVerificationDurationSeconds = new client.Histogram({
  name: "spiffe_verification_duration_seconds",
  help: "Duration of SPIFFE identity verifications in seconds",
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

register.registerMetric(spiffeVerificationRequestsTotal);
register.registerMetric(spiffeVerificationDurationSeconds);

// ✅ MCP SAFE
export function startMetricsServer(port = Number(process.env.METRICS_PORT || 9092)) {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.setHeader("Content-Type", register.contentType);
      res.end(await register.metrics());
    } else {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  server.listen(port, "0.0.0.0", () => {
    // ✅ SAFE → stderr
    console.error(`[Metrics] running on http://127.0.0.1:${port}/metrics`);
  });

  return server;
}