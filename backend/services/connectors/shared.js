import { randomUUID } from "crypto";

export const CONNECTOR_TIMEOUT_MS = 30_000;
export const PREVIEW_ROW_LIMIT = 20;

const CONNECTOR_ALIASES = {
  sql: "sqlserver",
  mssql: "sqlserver",
  sqlserver: "sqlserver",
  splunk: "splunk",
};

export function normalizeConnectorType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  return CONNECTOR_ALIASES[normalized] || normalized;
}

export function assertRequired(value, label) {
  if (!String(value || "").trim()) {
    throw new Error(`${label} is required.`);
  }
}

export function parsePort(value, fallbackPort) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackPort;
}

export function truncateText(value, maxLength = 240) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

export async function withTimeout(task, timeoutMs, message) {
  let timeoutId;

  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildConnectorSourceBase({
  connectorType,
  connectorLabel,
  label,
  host,
  port,
  selection = {},
  sync = {},
  queryText = "",
}) {
  return {
    id: `connector-${Date.now()}-${randomUUID().slice(0, 8)}`,
    kind: "connector",
    connectorType,
    kindLabel: connectorLabel,
    label: label || connectorLabel,
    host: String(host || "").trim(),
    port,
    importedAt: new Date().toISOString(),
    selection,
    sync,
    queryText: truncateText(queryText, 600),
  };
}

