import express from "express";
import multer from "multer";
import { buildDatasetContext } from "../services/analytics.js";
import { getActiveDataset, setDatasetFromUpload } from "../services/db.js";
import { buildDatasetStatus } from "../services/monitoring.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message: "Please choose a PDF, Word, Excel, CSV, or JSON file to upload.",
    });
  }

  try {
    const source = await setDatasetFromUpload(req.file, {
      workspaceId: req.workspaceId,
    });
    const { rows } = getActiveDataset(req.workspaceId);
    const datasetContext = buildDatasetContext(rows);
    const datasetStatus = buildDatasetStatus({ rows, source, datasetContext });

    return res.json({
      message: `${req.file.originalname} uploaded successfully.`,
      dataset: datasetStatus,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Failed to process the uploaded dataset.",
    });
  }
});

export default router;
