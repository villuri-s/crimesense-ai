import fs from "fs";
import { randomUUID } from "crypto";
import { promises as fsp } from "fs";
import path from "path";
import { Readable } from "stream";
import csvParser from "csv-parser";
import XLSX from "xlsx";
import {
  isAzureBlobStorageConfigured,
  uploadFileToAzureBlob,
} from "./blobStorage.js";
import {
  DEFAULT_WORKSPACE_ID,
  normalizeWorkspaceId,
} from "./workspace.js";

const DEFAULT_DATASET_URL = new URL("../data/sales.json", import.meta.url);
const UPLOADS_DIR_URL = new URL("../uploads/", import.meta.url);
const WORKSPACES_DIR_URL = new URL("workspaces/", UPLOADS_DIR_URL);
const LEGACY_ACTIVE_DATASET_URL = new URL("active-dataset.json", UPLOADS_DIR_URL);
const LEGACY_ACTIVE_META_URL = new URL("active-dataset.meta.json", UPLOADS_DIR_URL);

const FIELD_ALIASES = {
  date: [
    "date",
    "day",
    "month",
    "week",
    "timestamp",
    "created_at",
    "opened_at",
    "closed_at",
    "resolved_at",
    "order_date",
  ],
  region: ["region", "country", "market", "location", "territory", "geo", "geography"],
  department: ["department", "business_unit", "division", "function"],
  team: ["team", "assignment_group", "support_team", "squad", "resolver_group"],
  application: ["application", "app", "service", "system", "platform"],
  project: ["project", "initiative", "program", "epic"],
  product: ["product", "product_name", "item", "item_name", "sku", "title"],
  category: ["category", "segment", "type", "issue_type", "incident_type"],
  customer_type: ["customer_type", "customertype", "customer_segment", "segment_name"],
  priority: ["priority", "severity", "impact", "urgency"],
  status: ["status", "state", "resolution_status", "ticket_status"],
  owner: ["owner", "assignee", "assigned_to", "manager", "agent"],
  revenue: ["revenue", "sales", "amount", "total_sales", "gmv", "income", "turnover"],
  profit: ["profit", "margin", "gross_profit", "net_profit", "earnings"],
  units_sold: ["units_sold", "units", "quantity", "qty", "volume"],
  incident_count: ["incident_count", "incidents", "ticket_count", "tickets", "case_count"],
  downtime_hours: ["downtime_hours", "downtime", "outage_hours", "downtime_hrs"],
  alert_count: ["alert_count", "alerts", "security_alerts", "event_count"],
  vulnerability_count: ["vulnerability_count", "vulnerabilities", "findings"],
  workload: ["workload", "story_points", "task_count", "open_tasks", "work_items"],
  budget: ["budget", "planned_budget", "allocated_budget"],
  spend: ["spend", "cost", "actual_cost", "spent", "expense"],
  sla_breach_count: ["sla_breach_count", "sla_breaches", "missed_sla", "breaches"],
  attrition_count: ["attrition_count", "attrition", "leavers"],
  performance_score: ["performance_score", "performance", "score"],
};

const SUPPORTED_EXTENSIONS = new Set([".json", ".csv", ".xlsx", ".xls", ".pdf", ".doc", ".docx"]);

const aliasLookup = new Map();

for (const [canonicalField, aliases] of Object.entries(FIELD_ALIASES)) {
  aliasLookup.set(normalizeToken(canonicalField), canonicalField);

  for (const alias of aliases) {
    aliasLookup.set(normalizeToken(alias), canonicalField);
  }
}

const activeDatasets = new Map();

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeFilename(value) {
  return String(value || "dataset")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .toLowerCase();
}

function buildUploadId() {
  return `upload-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function buildStoredFilename(source, value) {
  return `${normalizeFilename(source?.id) || buildUploadId()}-${normalizeFilename(value) || "dataset"}`;
}

function resolveWorkspacePaths(workspaceId = DEFAULT_WORKSPACE_ID) {
  const workspaceKey = normalizeWorkspaceId(workspaceId);
  const workspaceDirUrl = new URL(`${workspaceKey}/`, WORKSPACES_DIR_URL);

  return {
    workspaceId: workspaceKey,
    workspaceDirUrl,
    activeDatasetUrl: new URL("active-dataset.json", workspaceDirUrl),
    activeMetaUrl: new URL("active-dataset.meta.json", workspaceDirUrl),
  };
}

function resolveStoredFileUrls(storedFile, workspaceDirUrl) {
  if (!storedFile) {
    return [];
  }

  return [new URL(storedFile, workspaceDirUrl), new URL(storedFile, UPLOADS_DIR_URL)];
}

async function writeUploadedFileLocally(file, source, workspacePaths) {
  await fsp.mkdir(workspacePaths.workspaceDirUrl, { recursive: true });

  const safeName = buildStoredFilename(source, file.originalname);
  const rawFilePath = new URL(safeName, workspacePaths.workspaceDirUrl);

  await fsp.writeFile(rawFilePath, file.buffer);

  return {
    provider: "local",
    storedFile: safeName,
  };
}

function looksLikeDate(value) {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  const stringValue = String(value || "").trim();

  if (!stringValue) {
    return false;
  }

  if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}([ t]\d{1,2}:\d{2}(:\d{2})?)?$/i.test(stringValue)) {
    return false;
  }

  return !Number.isNaN(Date.parse(stringValue));
}

function formatDateValue(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return date.toISOString().slice(0, 10);
  }

  return date.toISOString();
}

function coerceScalarValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return formatDateValue(value);
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return null;
  }

  if (/^(true|false)$/i.test(stringValue)) {
    return stringValue.toLowerCase() === "true";
  }

  if (/^(yes|no)$/i.test(stringValue)) {
    return stringValue.toLowerCase() === "yes";
  }

  const compactNumber = stringValue.replace(/,/g, "");

  if (/^-?\d+(\.\d+)?$/.test(compactNumber)) {
    const parsed = Number(compactNumber);
    return Number.isFinite(parsed) ? parsed : stringValue;
  }

  if (looksLikeDate(stringValue)) {
    return formatDateValue(stringValue);
  }

  return stringValue;
}

function canonicalizeFieldName(fieldName) {
  const normalized = normalizeToken(fieldName);

  if (!normalized) {
    return null;
  }

  return aliasLookup.get(normalized) || normalized;
}

function normalizeRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const normalizedRow = {};

  for (const [rawField, rawValue] of Object.entries(row)) {
    const field = canonicalizeFieldName(rawField);

    if (!field) {
      continue;
    }

    normalizedRow[field] = coerceScalarValue(rawValue);
  }

  return Object.keys(normalizedRow).length ? normalizedRow : null;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => normalizeRow(row))
    .filter(Boolean);
}

function extractRowsFromJson(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed?.records)) {
    return parsed.records;
  }

  if (Array.isArray(parsed?.data)) {
    return parsed.data;
  }

  throw new Error("JSON uploads must contain an array of records.");
}

function parseJsonBuffer(buffer) {
  const parsed = JSON.parse(buffer.toString("utf8"));
  return extractRowsFromJson(parsed);
}

function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];

    Readable.from(buffer)
      .pipe(csvParser())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", (error) => reject(error));
  });
}

function parseWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new Error("The workbook does not contain any sheets.");
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    defval: null,
    raw: false,
  });
}

function parseTextLikeBuffer(buffer, extension) {
  const rawText = buffer.toString("latin1");
  const normalized = rawText
    .replace(/\0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const preview = normalized.slice(0, 400) || `Uploaded ${extension.toUpperCase()} document`;

  return [
    {
      filename: "uploaded-file",
      fileType: extension.toUpperCase(),
      content: preview,
      uploadedAt: new Date().toISOString(),
    },
  ];
}

async function parseUploadFile(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Supported file types are PDF, Word, Excel, CSV, and JSON.");
  }

  if (extension === ".json") {
    return parseJsonBuffer(file.buffer);
  }

  if (extension === ".csv") {
    return parseCsvBuffer(file.buffer);
  }

  if (extension === ".xlsx" || extension === ".xls") {
    return parseWorkbookBuffer(file.buffer);
  }

  return parseTextLikeBuffer(file.buffer, extension);
}

function readJsonIfPresent(fileUrl) {
  try {
    if (!fs.existsSync(fileUrl)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(fileUrl, "utf8"));
  } catch {
    return null;
  }
}

async function removeFileIfPresent(fileUrl) {
  try {
    if (fs.existsSync(fileUrl)) {
      await fsp.unlink(fileUrl);
    }
  } catch {
    // Best-effort cleanup; stale files should not block the app.
  }
}

async function cleanupStoredFile(source, workspacePaths) {
  const storedFile = source?.storage?.storedFile || source?.storedFile;

  if (!storedFile) {
    return;
  }

  const fileUrls = resolveStoredFileUrls(storedFile, workspacePaths.workspaceDirUrl);

  for (const fileUrl of fileUrls) {
    await removeFileIfPresent(fileUrl);
  }
}

async function cleanupWorkspaceFiles(workspacePaths, source, options = {}) {
  if (source?.kind === "upload") {
    await cleanupStoredFile(source, workspacePaths);
  }

  if (options.removeSnapshots) {
    await removeFileIfPresent(workspacePaths.activeDatasetUrl);
    await removeFileIfPresent(workspacePaths.activeMetaUrl);
  }

  if (options.removeLegacy && workspacePaths.workspaceId === DEFAULT_WORKSPACE_ID) {
    await removeFileIfPresent(LEGACY_ACTIVE_DATASET_URL);
    await removeFileIfPresent(LEGACY_ACTIVE_META_URL);
  }
}

function setActiveDataset(workspaceId, rows, source) {
  const workspaceKey = normalizeWorkspaceId(workspaceId);
  const dataset = {
    rows,
    source: {
      ...source,
      workspaceId: workspaceKey,
      rowCount: rows.length,
    },
  };

  activeDatasets.set(workspaceKey, dataset);

  return dataset;
}

function loadDefaultDataset(workspaceId = DEFAULT_WORKSPACE_ID) {
  const workspaceKey = normalizeWorkspaceId(workspaceId);
  const rawRows = JSON.parse(fs.readFileSync(DEFAULT_DATASET_URL, "utf8"));
  const rows = normalizeRows(rawRows);

  return setActiveDataset(workspaceKey, rows, {
    id: "demo-sales",
    kind: "demo",
    label: "Sales demo dataset",
    filename: "sales.json",
    contentType: "application/json",
    uploadedAt: null,
    workspaceId: workspaceKey,
  });
}

function loadWorkspaceDatasetFromFiles(workspacePaths) {
  const persistedRows = readJsonIfPresent(workspacePaths.activeDatasetUrl);
  const persistedMeta = readJsonIfPresent(workspacePaths.activeMetaUrl);

  if (!Array.isArray(persistedRows) || !persistedRows.length || !persistedMeta) {
    return null;
  }

  return setActiveDataset(
    workspacePaths.workspaceId,
    normalizeRows(persistedRows),
    persistedMeta
  );
}

function loadLegacySharedDataset() {
  const persistedRows = readJsonIfPresent(LEGACY_ACTIVE_DATASET_URL);
  const persistedMeta = readJsonIfPresent(LEGACY_ACTIVE_META_URL);

  if (!Array.isArray(persistedRows) || !persistedRows.length || !persistedMeta) {
    return null;
  }

  return setActiveDataset(
    DEFAULT_WORKSPACE_ID,
    normalizeRows(persistedRows),
    persistedMeta
  );
}

function loadPersistedDataset(workspaceId = DEFAULT_WORKSPACE_ID) {
  const workspacePaths = resolveWorkspacePaths(workspaceId);
  const persistedDataset = loadWorkspaceDatasetFromFiles(workspacePaths);

  if (persistedDataset) {
    return persistedDataset;
  }

  if (workspacePaths.workspaceId === DEFAULT_WORKSPACE_ID) {
    const legacyDataset = loadLegacySharedDataset();

    if (legacyDataset) {
      return legacyDataset;
    }
  }

  return loadDefaultDataset(workspacePaths.workspaceId);
}

function ensureActiveDataset(workspaceId = DEFAULT_WORKSPACE_ID) {
  const workspaceKey = normalizeWorkspaceId(workspaceId);

  if (!activeDatasets.has(workspaceKey)) {
    loadPersistedDataset(workspaceKey);
  }

  return activeDatasets.get(workspaceKey);
}

async function persistUploadedDataset(file, rows, source, workspacePaths) {
  await fsp.mkdir(workspacePaths.workspaceDirUrl, { recursive: true });

  let storage;

  if (isAzureBlobStorageConfigured()) {
    try {
      storage = await uploadFileToAzureBlob(file, source);
    } catch (error) {
      console.warn(
        "Azure Blob upload failed, falling back to local storage:",
        error.message
      );
      const localStorage = await writeUploadedFileLocally(file, source, workspacePaths);
      storage = {
        ...localStorage,
        fallbackFrom: "azure_blob",
      };
    }
  } else {
    storage = await writeUploadedFileLocally(file, source, workspacePaths);
  }

  await fsp.writeFile(workspacePaths.activeDatasetUrl, JSON.stringify(rows, null, 2));
  const persistedSource = {
    ...source,
    workspaceId: workspacePaths.workspaceId,
    storage,
    ...(storage?.provider === "local" ? { storedFile: storage.storedFile } : {}),
  };

  await fsp.writeFile(workspacePaths.activeMetaUrl, JSON.stringify(persistedSource, null, 2));

  if (workspacePaths.workspaceId === DEFAULT_WORKSPACE_ID) {
    await removeFileIfPresent(LEGACY_ACTIVE_DATASET_URL);
    await removeFileIfPresent(LEGACY_ACTIVE_META_URL);
  }

  return persistedSource;
}

ensureActiveDataset(DEFAULT_WORKSPACE_ID);

export async function setDatasetFromUpload(file, options = {}) {
  if (!file?.buffer?.length) {
    throw new Error("Please upload a file with data.");
  }

  const workspacePaths = resolveWorkspacePaths(options.workspaceId);
  const previousDataset = ensureActiveDataset(workspacePaths.workspaceId);
  const previousSource = previousDataset?.source;
  const parsedRows = await parseUploadFile(file);
  const rows = normalizeRows(parsedRows);

  if (!rows.length) {
    throw new Error("The uploaded file did not contain any usable rows.");
  }

  const source = {
    id: buildUploadId(),
    kind: "upload",
    label: file.originalname,
    filename: file.originalname,
    contentType: file.mimetype || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    workspaceId: workspacePaths.workspaceId,
  };

  const persistedSource = await persistUploadedDataset(file, rows, source, workspacePaths);
  setActiveDataset(workspacePaths.workspaceId, rows, persistedSource);

  if (previousSource?.kind === "upload" && previousSource.id !== persistedSource.id) {
    await cleanupWorkspaceFiles(workspacePaths, previousSource, {
      removeLegacy: workspacePaths.workspaceId === DEFAULT_WORKSPACE_ID,
    });
  }

  return {
    ...persistedSource,
    rowCount: rows.length,
  };
}

export async function setDatasetFromConnector(result, options = {}) {
  const { rows: rawRows, source: sourceMeta } = result || {};

  if (!Array.isArray(rawRows) || !rawRows.length) {
    throw new Error("Connector did not return any rows to ingest.");
  }

  const workspacePaths = resolveWorkspacePaths(options.workspaceId);
  const previousDataset = ensureActiveDataset(workspacePaths.workspaceId);
  const previousSource = previousDataset?.source;

  const rows = normalizeRows(rawRows);

  const source = {
    id: sourceMeta?.id || buildUploadId(),
    kind: "connector",
    label: sourceMeta?.label || sourceMeta?.connectorLabel || "Connector dataset",
    filename: sourceMeta?.filename || null,
    contentType: sourceMeta?.contentType || "application/json",
    uploadedAt: new Date().toISOString(),
    workspaceId: workspacePaths.workspaceId,
    ...sourceMeta,
  };

  await fsp.mkdir(workspacePaths.workspaceDirUrl, { recursive: true });

  await fsp.writeFile(workspacePaths.activeDatasetUrl, JSON.stringify(rows, null, 2));
  const persistedSource = {
    ...source,
    workspaceId: workspacePaths.workspaceId,
  };

  await fsp.writeFile(workspacePaths.activeMetaUrl, JSON.stringify(persistedSource, null, 2));

  setActiveDataset(workspacePaths.workspaceId, rows, persistedSource);

  if (previousSource?.kind === "upload" && previousSource.id !== persistedSource.id) {
    await cleanupWorkspaceFiles(workspacePaths, previousSource, {
      removeLegacy: workspacePaths.workspaceId === DEFAULT_WORKSPACE_ID,
    });
  }

  return {
    ...persistedSource,
    rowCount: rows.length,
  };
}

export async function resetDataset(workspaceId = DEFAULT_WORKSPACE_ID) {
  const workspacePaths = resolveWorkspacePaths(workspaceId);
  const previousSource = ensureActiveDataset(workspacePaths.workspaceId)?.source;
  const dataset = loadDefaultDataset(workspacePaths.workspaceId);

  await cleanupWorkspaceFiles(workspacePaths, previousSource, {
    removeSnapshots: true,
    removeLegacy: workspacePaths.workspaceId === DEFAULT_WORKSPACE_ID,
  });

  return dataset.source;
}

export function getDatasetSource(workspaceId = DEFAULT_WORKSPACE_ID) {
  return ensureActiveDataset(workspaceId).source;
}

export function getActiveDataset(workspaceId = DEFAULT_WORKSPACE_ID) {
  return ensureActiveDataset(workspaceId);
}

export async function runQuery(workspaceId = DEFAULT_WORKSPACE_ID) {
  return ensureActiveDataset(workspaceId).rows;
}
