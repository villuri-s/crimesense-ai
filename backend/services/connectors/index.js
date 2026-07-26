import {
  ingestSqlServerDataset,
  testSqlServerConnection,
} from "./sqlServerConnector.js";
import {
  ingestSplunkDataset,
  testSplunkConnection,
} from "./splunkConnector.js";
import { normalizeConnectorType } from "./shared.js";

const CONNECTOR_HANDLERS = {
  sqlserver: {
    test: testSqlServerConnection,
    ingest: ingestSqlServerDataset,
  },
  splunk: {
    test: testSplunkConnection,
    ingest: ingestSplunkDataset,
  },
};

function resolveConnectorType(payload, fallbackType) {
  const connectorType = normalizeConnectorType(
    fallbackType || payload?.sourceType || payload?.connectorType
  );

  if (!connectorType || !CONNECTOR_HANDLERS[connectorType]) {
    throw new Error("This connector is not available yet.");
  }

  return connectorType;
}

export async function testConnectorConnection(payload, options = {}) {
  const connectorType = resolveConnectorType(payload, options.sourceType);
  return CONNECTOR_HANDLERS[connectorType].test({
    ...payload,
    sourceType: connectorType,
  });
}

export async function ingestConnectorDataset(payload, options = {}) {
  const connectorType = resolveConnectorType(payload, options.sourceType);
  return CONNECTOR_HANDLERS[connectorType].ingest({
    ...payload,
    sourceType: connectorType,
  });
}

