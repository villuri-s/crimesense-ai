import sql from "mssql";
import {
  assertRequired,
  buildConnectorSourceBase,
  CONNECTOR_TIMEOUT_MS,
  parsePort,
  truncateText,
  withTimeout,
} from "./shared.js";

function quoteIdentifier(value) {
  const identifier = String(value || "").trim();

  if (!identifier) {
    throw new Error("Table or view is required.");
  }

  return identifier
    .split(".")
    .filter(Boolean)
    .map((part) => `[${part.replace(/]/g, "]]")}]`)
    .join(".");
}

function sanitizeSqlServerError(error) {
  const message = String(error?.message || "SQL Server connection failed.");

  if (/login failed/i.test(message)) {
    return "SQL Server rejected the supplied credentials.";
  }

  if (/failed to connect|server was not found|econnrefused|ehostunreach|etimedout/i.test(message)) {
    return "SQL Server is unreachable. Check the host, port, network path, and VPN.";
  }

  if (/certificate|ssl|tls/i.test(message)) {
    return "SQL Server TLS negotiation failed. Verify certificate trust and encryption settings.";
  }

  return message;
}

function buildSqlServerConfig(payload) {
  const connection = payload?.connection || {};
  const selection = payload?.selection || {};
  const port = parsePort(connection.port, 1433);
  const database = String(selection.database || "").trim();

  assertRequired(connection.host, "Server host");
  assertRequired(database, "Database");
  assertRequired(connection.username, "Service account");
  assertRequired(connection.secret, "Secret");

  return {
    user: String(connection.username).trim(),
    password: String(connection.secret),
    server: String(connection.host).trim(),
    database,
    port,
    connectionTimeout: CONNECTOR_TIMEOUT_MS,
    requestTimeout: CONNECTOR_TIMEOUT_MS,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      max: 2,
      min: 0,
      idleTimeoutMillis: 10_000,
    },
  };
}

function buildSqlServerQuery(payload) {
  const selection = payload?.selection || {};
  const filter = String(selection.filter || "").trim();

  if (filter) {
    return filter;
  }

  const schema = String(selection.schema || "dbo").trim();
  const object = String(selection.object || "").trim();

  assertRequired(object, "Table or view");

  return `SELECT TOP (5000) * FROM ${quoteIdentifier(`${schema}.${object}`)}`;
}

function buildSqlServerLabel(payload) {
  const connection = payload?.connection || {};
  const selection = payload?.selection || {};
  const connectionLabel = String(connection.label || "").trim();
  const objectName = [selection.schema, selection.object].filter(Boolean).join(".");
  const target = [selection.database, objectName].filter(Boolean).join(" / ");

  return [connectionLabel || "SQL Server", target].filter(Boolean).join(" | ");
}

function sanitizeSqlServerSource(payload, executedQuery) {
  const connection = payload?.connection || {};
  const selection = payload?.selection || {};

  return buildConnectorSourceBase({
    connectorType: "sqlserver",
    connectorLabel: "SQL Server",
    label: buildSqlServerLabel(payload),
    host: connection.host,
    port: parsePort(connection.port, 1433),
    selection: {
      database: String(selection.database || "").trim(),
      schema: String(selection.schema || "dbo").trim(),
      object: String(selection.object || "").trim(),
      queryMode: String(selection.filter || "").trim() ? "custom-sql" : "table-scan",
    },
    sync: {
      refresh: payload?.sync?.refresh || "",
      loadStrategy: payload?.sync?.loadStrategy || "",
      watermark: payload?.sync?.watermark || "",
      authMode: payload?.sync?.authMode || "",
    },
    queryText: truncateText(executedQuery, 600),
  });
}

async function runSqlServerQuery(payload, queryText) {
  const config = buildSqlServerConfig(payload);
  const pool = new sql.ConnectionPool(config);

  console.debug("SQL Server connection config:", {
    server: config.server,
    port: config.port,
    database: config.database,
    user: config.user,
    encrypt: config.options?.encrypt,
    trustServerCertificate: config.options?.trustServerCertificate,
  });

  try {
    await withTimeout(
      async () => {
        await pool.connect();
      },
      CONNECTOR_TIMEOUT_MS,
      "SQL Server connection timed out after 30 seconds."
    );

    const request = pool.request();
    const result = await withTimeout(
      async () => request.query(queryText),
      CONNECTOR_TIMEOUT_MS,
      "SQL Server query timed out after 30 seconds."
    );

    return result?.recordset || [];
  } catch (error) {
    throw new Error(sanitizeSqlServerError(error));
  } finally {
    await pool.close().catch(() => {});
  }
}

export async function testSqlServerConnection(payload) {
  await runSqlServerQuery(payload, "SELECT 1 AS ok");

  return {
    connected: true,
  };
}

export async function ingestSqlServerDataset(payload) {
  const queryText = buildSqlServerQuery(payload);
  const rows = await runSqlServerQuery(payload, queryText);

  if (!rows.length) {
    throw new Error("SQL Server returned no rows for the selected table or query.");
  }

  return {
    rows,
    source: sanitizeSqlServerSource(payload, queryText),
  };
}

