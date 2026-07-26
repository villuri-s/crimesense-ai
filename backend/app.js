import express from "express";
import { pathToFileURL } from "url";
import "./services/loadEnv.js";
import mysql from "./services/mysql.js";
import cors from "cors";
import { attachWorkspaceContext } from "./middleware/workspaceContext.js";
import { buildCorsOptions } from "./services/cors.js";
import queryRoute from "./routes/query.js";
import uploadRoute from "./routes/upload.js";
import datasetRoute from "./routes/dataset.js";
import connectorsRoute from "./routes/connectors.js";

function resolvePort(portValue) {
  const parsed = Number.parseInt(String(portValue ?? process.env.PORT ?? "8080"), 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return 8080;
}

export function createApp() {
  const app = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json());
  app.use(attachWorkspaceContext);

  app.get("/test-mysql", async (req, res) => {
    try {
      const [rows] = await mysql.query("SELECT * FROM users");
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: err.message
      });
    }
  });

  app.get("/test-sql", async (req, res) => {
    try {
      const [rows] = await mysql.query("SELECT 1 as ok");
      res.json({
        status: "ok",
        database: "connected",
        result: rows,
      });
    } catch (err) {
      console.error("/test-sql failed:", err);
      res.status(500).json({
        status: "error",
        error: err.message || "Unable to connect to SQL database.",
      });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "insightiq-backend",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/query", queryRoute);
  app.use("/upload", uploadRoute);
  app.use("/dataset", datasetRoute);
  app.use("/connectors", connectorsRoute);

  return app;
}

export function startServer(portValue) {
  const port = resolvePort(portValue);
  const app = createApp();
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. The backend may already be running. Stop the existing process or set a different PORT in .env.`
      );
      process.exit(1);
    }

    console.error("Failed to start server:", error);
    process.exit(1);
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
