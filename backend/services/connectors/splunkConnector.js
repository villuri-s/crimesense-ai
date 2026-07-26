import splunkjs from "splunk-sdk";
import {
  assertRequired,
  buildConnectorSourceBase,
  CONNECTOR_TIMEOUT_MS,
  parsePort,
  truncateText,
  withTimeout,
} from "./shared.js";

function sanitizeSplunkError(error) {
  const message = String(error?.message || "Splunk connection failed.");

  if (/login failed|unauthorized|authentication/i.test(message)) {
    return "Splunk rejected the supplied credentials.";
  }

  if (/econnrefused|ehostunreach|enotfound|etimedout|socket hang up/i.test(message)) {
    return "Splunk is unreachable. Check the search head, management port, network path, and VPN.";
  }

  if (/parser|search|syntax|invalid/i.test(message)) {
    return `Splunk rejected the SPL query: ${message}`;
  }

  return message;
}

function buildSplunkService(payload) {
  const connection = payload?.connection || {};

  assertRequired(connection.host, "Search head");
  assertRequired(connection.username, "Username");
  assertRequired(connection.secret, "Password");

  return new splunkjs.Service({
    scheme: "https",
    host: String(connection.host).trim(),
    port: parsePort(connection.port, 8089),
    username: String(connection.username).trim(),
    password: String(connection.secret),
    version: "8.0",
  });
}

function buildSplunkQuery(payload) {
  const selection = payload?.selection || {};
  const index = String(selection.index || "").trim();
  const sourcetype = String(
    selection.sourcetype || selection.sourceType || ""
  ).trim();
  let query = String(selection.search || payload?.query || "").trim();

  assertRequired(index || query, "Index or SPL query");

  const prefixes = [];

  if (index && !/\bindex\s*=/.test(query)) {
    prefixes.push(`index=${index}`);
  }

  if (sourcetype && !/\bsourcetype\s*=/.test(query)) {
    prefixes.push(`sourcetype=${sourcetype}`);
  }

  if (!query) {
    return `search ${prefixes.join(" ")}`.trim();
  }

  if (/^\|/.test(query)) {
    if (!prefixes.length) {
      throw new Error("Splunk pipe searches must include an index or base search terms.");
    }

    return `search ${prefixes.join(" ")} ${query}`.trim();
  }

  if (/^(search|from|tstats|makeresults|inputlookup)\b/i.test(query)) {
    if (prefixes.length && /^search\b/i.test(query)) {
      return query.replace(/^search\b/i, `search ${prefixes.join(" ")}`);
    }

    return query;
  }

  return `search ${[...prefixes, query].join(" ")}`.trim();
}

function buildSplunkLabel(payload) {
  const connection = payload?.connection || {};
  const selection = payload?.selection || {};
  const connectionLabel = String(connection.label || "").trim();
  const target = selection.index ? `index=${selection.index}` : "search results";

  return [connectionLabel || "Splunk", target].filter(Boolean).join(" | ");
}

function sanitizeSplunkSource(payload, executedQuery) {
  const connection = payload?.connection || {};
  const selection = payload?.selection || {};

  return buildConnectorSourceBase({
    connectorType: "splunk",
    connectorLabel: "Splunk",
    label: buildSplunkLabel(payload),
    host: connection.host,
    port: parsePort(connection.port, 8089),
    selection: {
      index: String(selection.index || "").trim(),
      sourcetype: String(
        selection.sourcetype || selection.sourceType || ""
      ).trim(),
      timeRange: payload?.sync?.timeRange || "",
    },
    sync: {
      refresh: payload?.sync?.refresh || "",
      loadStrategy: payload?.sync?.loadStrategy || "",
      timeRange: payload?.sync?.timeRange || "",
    },
    queryText: truncateText(executedQuery, 600),
  });
}

function convertJsonRowsResult(results) {
  if (Array.isArray(results?.results)) {
    return results.results;
  }

  const fields = Array.isArray(results?.fields) ? results.fields : [];
  const rows = Array.isArray(results?.rows) ? results.rows : [];

  if (!fields.length || !rows.length) {
    return [];
  }

  return rows.map((row) =>
    fields.reduce((record, fieldName, index) => {
      record[fieldName] = row?.[index] ?? null;
      return record;
    }, {})
  );
}

async function waitForSearchJob(job) {
  await withTimeout(
    async () =>
      job.track(
        {
          period: 250,
        },
        {
          failed: () => {
            throw new Error("Splunk reported that the search job failed.");
          },
          error: (_job, error) => {
            throw error || new Error("Splunk search tracking failed.");
          },
        }
      ),
    CONNECTOR_TIMEOUT_MS,
    "Splunk search timed out after 30 seconds."
  );
}

async function executeSplunkSearch(payload, { mode = "ingest" } = {}) {
  const service = buildSplunkService(payload);
  const queryText = buildSplunkQuery(payload);

  try {
    // Log minimal connection info for debugging (avoid printing secrets)
    console.debug("Splunk executeSearch: host=", payload?.connection?.host, "port=", payload?.connection?.port, "mode=", mode);
    await withTimeout(
      async () => service.login(CONNECTOR_TIMEOUT_MS),
      CONNECTOR_TIMEOUT_MS,
      "Splunk login timed out after 30 seconds."
    );

    if (mode === "test") {
      return {
        queryText,
        rows: [],
      };
    }

    const [job] = await withTimeout(
      async () =>
        service.search(
          queryText,
          {
            exec_mode: "normal",
          },
          {},
          CONNECTOR_TIMEOUT_MS
        ),
      CONNECTOR_TIMEOUT_MS,
      "Splunk search submission timed out after 30 seconds."
    );

    await waitForSearchJob(job);

    const [results] = await withTimeout(
      async () =>
        job.results(
          {
            output_mode: "json_rows",
            count: 0,
          },
          CONNECTOR_TIMEOUT_MS
        ),
      CONNECTOR_TIMEOUT_MS,
      "Splunk result retrieval timed out after 30 seconds."
    );

    return {
      queryText,
      rows: convertJsonRowsResult(results),
    };
  } catch (error) {
    // Log full error for server-side debugging, but sanitize the message returned to the client
    try {
      console.error("Splunk search error:", { host: payload?.connection?.host, port: payload?.connection?.port, user: payload?.connection?.username, error });
    } catch (logErr) {
      console.error("Splunk search error (unable to log payload):", error);
    }

    throw new Error(sanitizeSplunkError(error));
  }
}

export async function testSplunkConnection(payload) {
  await executeSplunkSearch(payload, { mode: "test" });

  return {
    connected: true,
  };
}

export async function ingestSplunkDataset(payload) {
  const { queryText, rows } = await executeSplunkSearch(payload, {
    mode: "ingest",
  });

  if (!rows.length) {
    throw new Error("Splunk returned no rows for the supplied SPL query.");
  }

  return {
    rows,
    source: sanitizeSplunkSource(payload, queryText),
  };
}

