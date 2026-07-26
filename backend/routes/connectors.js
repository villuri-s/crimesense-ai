import express from "express";
import { testConnectorConnection, ingestConnectorDataset } from "../services/connectors/index.js";
import { setDatasetFromConnector, getActiveDataset } from "../services/db.js";
import { buildDatasetContext } from "../services/analytics.js";
import { buildDatasetStatus } from "../services/monitoring.js";

const router = express.Router();

router.post("/test", async (req, res) => {
  try {
    console.info("/connectors/test called", { sourceType: req.body?.connectorType, host: req.body?.connection?.host });
    const result = await testConnectorConnection(req.body || {}, { sourceType: req.body?.connectorType });

    return res.json(result);
  } catch (error) {
    console.error("/connectors/test error", error);
    return res.status(400).json({ message: error.message || "Failed to test connector connection." });
  }
});

router.post("/ingest", async (req, res) => {
  try {
    console.info("/connectors/ingest called", { sourceType: req.body?.connectorType, host: req.body?.connection?.host });
    const result = await ingestConnectorDataset(req.body || {}, { sourceType: req.body?.connectorType });

    const persisted = await setDatasetFromConnector(result, { workspaceId: req.workspaceId });

    const { rows } = getActiveDataset(req.workspaceId);
    const datasetContext = buildDatasetContext(rows);
    const datasetStatus = buildDatasetStatus({ rows, source: persisted, datasetContext });

    return res.json({ message: "Ingested connector dataset.", dataset: datasetStatus });
  } catch (error) {
    console.error("/connectors/ingest error", error);
    return res.status(400).json({ message: error.message || "Failed to ingest connector dataset." });
  }
});

export default router;
