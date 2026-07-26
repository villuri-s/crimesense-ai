import express from "express";
import { buildDatasetContext } from "../services/analytics.js";
import { getActiveDataset, resetDataset } from "../services/db.js";
import { buildDatasetStatus } from "../services/monitoring.js";

const router = express.Router();

router.get("/status", (req, res) => {
  const { rows, source } = getActiveDataset(req.workspaceId);
  const datasetContext = buildDatasetContext(rows);
  const dataset = buildDatasetStatus({
    rows,
    source,
    datasetContext,
  });

  return res.json({
    ...dataset,
    rows,
  });
});

router.post("/reset", async (req, res) => {
  try {
    const source = await resetDataset(req.workspaceId);
    const { rows } = getActiveDataset(req.workspaceId);
    const datasetContext = buildDatasetContext(rows);

    return res.json({
      message: "Reverted to the demo dataset.",
      dataset: buildDatasetStatus({
        rows,
        source,
        datasetContext,
      }),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Failed to reset the dataset.",
    });
  }
});

export default router;
