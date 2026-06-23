import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.warn(
      "⚠ Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.\n" +
      "  Run `vercel env pull` or `vercel link` to pull from Vercel, or set manually."
    );
  }

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await registerRoutes(app);

  // Health check
  app.get("/api/health", async () => ({ status: "ok" }));

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
