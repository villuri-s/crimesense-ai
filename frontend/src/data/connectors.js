const sharedSyncSection = [
  {
    title: "Access & Sync",
    fields: [
      {
        name: "username",
        label: "Service account",
        placeholder: "insightiq_reader",
      },
      {
        name: "secret",
        label: "Secret",
        type: "password",
        placeholder: "********",
      },
      {
        name: "refresh",
        label: "Refresh cadence",
        type: "select",
        options: [
          "Manual",
          "Every 5 minutes",
          "Every 15 minutes",
          "Hourly",
          "Daily",
        ],
      },
      {
        name: "loadStrategy",
        label: "Load strategy",
        type: "select",
        options: [
          "Incremental watermark",
          "Full snapshot",
          "Append only",
        ],
      },
    ],
  },
];

export const CONNECTOR_CATALOG = [
  {
    id: "sqlserver",
    label: "SQL Server",
    description:
      "Operational marts, finance tables, and warehouse views from Microsoft SQL Server.",
    domain: "Revenue Operations",
    requiredFields: ["label", "host", "database", "object"],
    defaults: {
      label: "North America Orders Mart",
      host: "sql-prod.internal.company.com",
      port: "1433",
      database: "operations",
      schema: "dbo",
      object: "order_fact",
      username: "insightiq_reader",
      secret: "",
      refresh: "Every 15 minutes",
      loadStrategy: "Incremental watermark",
      authMode: "Username + password",
      watermark: "updated_at",
      filter:
        "SELECT region, order_status, net_revenue, updated_at FROM dbo.order_fact WHERE updated_at >= DATEADD(day, -30, GETDATE())",
    },
    formSections: [
      {
        title: "Connection Details",
        fields: [
          {
            name: "label",
            label: "Connection label",
            placeholder: "North America Orders Mart",
            grid: "wide",
          },
          {
            name: "host",
            label: "Server host",
            placeholder: "sql-prod.internal.company.com",
          },
          {
            name: "port",
            label: "Port",
            placeholder: "1433",
          },
          {
            name: "database",
            label: "Database",
            placeholder: "operations",
          },
          {
            name: "schema",
            label: "Schema",
            placeholder: "dbo",
          },
          {
            name: "object",
            label: "Table or view",
            placeholder: "order_fact",
          },
        ],
      },
      {
        title: "Security & Sync",
        fields: [
          {
            name: "authMode",
            label: "Authentication",
            type: "select",
            options: [
              "Username + password",
              "Managed identity",
              "Azure AD service principal",
            ],
          },
          {
            name: "username",
            label: "Service account",
            placeholder: "insightiq_reader",
          },
          {
            name: "secret",
            label: "Secret",
            type: "password",
            placeholder: "********",
          },
          {
            name: "refresh",
            label: "Refresh cadence",
            type: "select",
            options: [
              "Every 5 minutes",
              "Every 15 minutes",
              "Hourly",
              "Daily",
            ],
          },
          {
            name: "loadStrategy",
            label: "Load strategy",
            type: "select",
            options: [
              "Incremental watermark",
              "Full snapshot",
              "Append only",
            ],
          },
          {
            name: "watermark",
            label: "Incremental field",
            placeholder: "updated_at",
          },
        ],
      },
      {
        title: "Data Selection",
        fields: [
          {
            name: "filter",
            label: "SQL or filter",
            type: "textarea",
            placeholder:
              "SELECT region, net_revenue, updated_at FROM dbo.order_fact WHERE updated_at >= DATEADD(day, -30, GETDATE())",
            grid: "wide",
          },
        ],
      },
    ],
    preview: {
      badge: "CDC ready",
      headline: "Curated warehouse replication for order and finance analytics.",
      summary:
        "Profile operational facts, land them in a governed workspace, and keep conversational analysis close to the source of truth.",
      rowEstimate: "12.4M",
      fieldCount: 28,
      freshness: "Every 15 minutes",
      governance: "SOX tagged",
      metrics: [
        { label: "Expected volume", value: "12.4M rows" },
        { label: "Freshness", value: "Every 15 minutes" },
        { label: "Governance", value: "SOX tagged" },
        { label: "Delivery", value: "Warehouse sync" },
      ],
    },
    workflow: [
      "Validate credentials",
      "Profile schema",
      "Set watermark",
      "Publish workspace",
    ],
    sampleFields: [
      { field: "updated_at", label: "updated_at", kind: "date" },
      { field: "region", label: "region", kind: "dimension" },
      { field: "order_status", label: "order_status", kind: "dimension" },
      { field: "net_revenue", label: "net_revenue", kind: "number" },
      { field: "gross_margin", label: "gross_margin", kind: "number" },
      { field: "sales_rep", label: "sales_rep", kind: "dimension" },
    ],
    quickPrompts: [
      "Which regions are creating the largest revenue gap week over week?",
      "Show the top order statuses driving delayed fulfillment this month.",
      "Where is gross margin dropping fastest across the SQL warehouse data?",
    ],
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    description:
      "Product, subscription, and event data from analytics-grade PostgreSQL instances.",
    domain: "Product Analytics",
    requiredFields: ["label", "host", "database", "object"],
    defaults: {
      label: "Subscription Events",
      host: "postgres.analytics.company.com",
      port: "5432",
      database: "analytics",
      schema: "public",
      object: "subscription_events",
      username: "insightiq_reader",
      secret: "",
      refresh: "Hourly",
      loadStrategy: "Append only",
      sslMode: "Require",
      watermark: "event_timestamp",
      filter:
        "SELECT workspace_id, plan_tier, event_type, mrr_delta, event_timestamp FROM public.subscription_events WHERE event_timestamp >= NOW() - INTERVAL '45 days'",
    },
    formSections: [
      {
        title: "Connection Details",
        fields: [
          {
            name: "label",
            label: "Connection label",
            placeholder: "Subscription Events",
            grid: "wide",
          },
          {
            name: "host",
            label: "Host",
            placeholder: "postgres.analytics.company.com",
          },
          {
            name: "port",
            label: "Port",
            placeholder: "5432",
          },
          {
            name: "database",
            label: "Database",
            placeholder: "analytics",
          },
          {
            name: "schema",
            label: "Schema",
            placeholder: "public",
          },
          {
            name: "object",
            label: "Table or view",
            placeholder: "subscription_events",
          },
        ],
      },
      {
        title: "Security & Sync",
        fields: [
          {
            name: "username",
            label: "Service account",
            placeholder: "insightiq_reader",
          },
          {
            name: "secret",
            label: "Secret",
            type: "password",
            placeholder: "********",
          },
          {
            name: "sslMode",
            label: "SSL mode",
            type: "select",
            options: ["Require", "Verify CA", "Verify full"],
          },
          {
            name: "refresh",
            label: "Refresh cadence",
            type: "select",
            options: ["Every 15 minutes", "Hourly", "Daily"],
          },
          {
            name: "loadStrategy",
            label: "Load strategy",
            type: "select",
            options: ["Append only", "Incremental watermark", "Full snapshot"],
          },
          {
            name: "watermark",
            label: "Incremental field",
            placeholder: "event_timestamp",
          },
        ],
      },
      {
        title: "Data Selection",
        fields: [
          {
            name: "filter",
            label: "SQL or filter",
            type: "textarea",
            placeholder:
              "SELECT workspace_id, plan_tier, mrr_delta, event_timestamp FROM public.subscription_events WHERE event_timestamp >= NOW() - INTERVAL '45 days'",
            grid: "wide",
          },
        ],
      },
    ],
    preview: {
      badge: "Product telemetry",
      headline: "Subscription and product behavior streamed from PostgreSQL.",
      summary:
        "Model user journeys, expansion signals, and retention shifts from event tables without forcing stakeholders into raw SQL.",
      rowEstimate: "4.8M",
      fieldCount: 24,
      freshness: "Hourly",
      governance: "PII masked",
      metrics: [
        { label: "Expected volume", value: "4.8M events" },
        { label: "Freshness", value: "Hourly" },
        { label: "Governance", value: "PII masked" },
        { label: "Delivery", value: "Append stream" },
      ],
    },
    workflow: [
      "Open secure tunnel",
      "Profile events",
      "Map business fields",
      "Publish workspace",
    ],
    sampleFields: [
      { field: "event_timestamp", label: "event_timestamp", kind: "date" },
      { field: "workspace_id", label: "workspace_id", kind: "dimension" },
      { field: "plan_tier", label: "plan_tier", kind: "dimension" },
      { field: "event_type", label: "event_type", kind: "dimension" },
      { field: "mrr_delta", label: "mrr_delta", kind: "number" },
      { field: "seats_added", label: "seats_added", kind: "number" },
    ],
    quickPrompts: [
      "Which plan tiers are generating the strongest expansion revenue?",
      "Show the product events most associated with churn in the last 45 days.",
      "Where are signup-to-activation drop-offs appearing across PostgreSQL data?",
    ],
  },
  {
    id: "splunk",
    label: "Splunk",
    description:
      "Security, service, and observability streams from Splunk indexes and saved searches.",
    domain: "Operations Intelligence",
    requiredFields: ["label", "host", "index", "search"],
    defaults: {
      label: "Production Error Stream",
      host: "splunk.company.com",
      port: "8089",
      index: "prod_ops",
      sourceType: "application_logs",
      username: "svc_insightiq",
      secret: "",
      refresh: "Manual",
      loadStrategy: "Append only",
      timeRange: "Last 24 hours",
      search: "",
    },
    formSections: [
      {
        title: "Connection Details",
        fields: [
          {
            name: "label",
            label: "Connection label",
            placeholder: "Production Error Stream",
            grid: "wide",
          },
          {
            name: "host",
            label: "Search head",
            placeholder: "splunk.company.com",
          },
          {
            name: "port",
            label: "Port",
            placeholder: "8089",
          },
          {
            name: "index",
            label: "Index",
            placeholder: "prod_ops",
          },
          {
            name: "sourceType",
            label: "Source type",
            placeholder: "application_logs",
          },
          {
            name: "timeRange",
            label: "Time window",
            type: "select",
            options: [
              "Last 4 hours rolling",
              "Last 24 hours rolling",
              "Last 7 days rolling",
            ],
          },
        ],
      },
      ...sharedSyncSection,
      {
        title: "Search Definition",
        fields: [
          {
            name: "search",
            label: "SPL query",
            type: "textarea",
            placeholder:
              "index=prod_ops sourcetype=application_logs severity=error | stats count by service, error_code, region",
            grid: "wide",
          },
        ],
      },
    ],
    preview: {
      badge: "Near real-time",
      headline: "Turn machine data and incident signals into an operator cockpit.",
      summary:
        "Sync indexed Splunk searches into a structured workspace so leaders can ask about incident spikes, owners, services, and noisy regions in plain language.",
      rowEstimate: "1.1M",
      fieldCount: 18,
      freshness: "Every 5 minutes",
      governance: "Token secured",
      metrics: [
        { label: "Expected volume", value: "1.1M events" },
        { label: "Freshness", value: "Every 5 minutes" },
        { label: "Governance", value: "Token secured" },
        { label: "Delivery", value: "Search result sync" },
      ],
    },
    workflow: [
      "Validate search head",
      "Run source query",
      "Extract key fields",
      "Publish workspace",
    ],
    sampleFields: [
      { field: "_time", label: "_time", kind: "date" },
      { field: "service", label: "service", kind: "dimension" },
      { field: "region", label: "region", kind: "dimension" },
      { field: "severity", label: "severity", kind: "dimension" },
      { field: "error_count", label: "error_count", kind: "number" },
      { field: "latency_ms", label: "latency_ms", kind: "number" },
    ],
    quickPrompts: [
      "Which services are driving the biggest error spikes in Splunk today?",
      "Show the regions with the highest concentration of Sev-1 events.",
      "What changed in the last 24 hours before latency alerts increased?",
    ],
  },
];

export function createInitialConnectorForms() {
  return CONNECTOR_CATALOG.reduce((forms, connector) => {
    forms[connector.id] = { ...connector.defaults };
    return forms;
  }, {});
}

export function getConnectorById(connectorId) {
  return (
    CONNECTOR_CATALOG.find((connector) => connector.id === connectorId) ||
    CONNECTOR_CATALOG[0]
  );
}

function buildTargetLabel(connector, form) {
  if (connector.id === "splunk") {
    return form.index ? `index=${form.index}` : connector.label;
  }

  const objectName = [form.schema, form.object].filter(Boolean).join(".");

  return [form.database, objectName].filter(Boolean).join(" / ") || connector.label;
}

function buildConnectionLabel(connector, form) {
  if (connector.id === "splunk") {
    return `${form.label || connector.label} • ${buildTargetLabel(connector, form)}`;
  }

  return `${form.label || connector.label} • ${form.database || "database"} / ${form.object || "table"}`;
}

export function validateConnectorForm(connector, form) {
  const missingField = (connector.requiredFields || []).find(
    (fieldName) => !String(form?.[fieldName] || "").trim()
  );

  if (!missingField) {
    return "";
  }

  const fieldConfig = connector.formSections
    .flatMap((section) => section.fields)
    .find((field) => field.name === missingField);

  return `Add ${fieldConfig?.label?.toLowerCase() || missingField} before starting ingestion.`;
}

export function buildConnectorPayload(connector, form) {
  const base = {
    connectorType: connector.id,
    connection: {
      label: form.label,
      host: form.host,
      port: form.port,
      username: form.username,
      secret: form.secret,
    },
    sync: {
      refresh: form.refresh,
      loadStrategy: form.loadStrategy,
      watermark: form.watermark,
      authMode: form.authMode,
      sslMode: form.sslMode,
      timeRange: form.timeRange,
    },
  };

  if (connector.id === "splunk") {
    base.selection = {
      index: form.index,
      sourcetype: form.sourceType,
      search: form.search,
    };
  } else {
    base.selection = {
      database: form.database,
      schema: form.schema,
      object: form.object,
      filter: form.filter,
    };
  }

  return base;
}

export function buildStagedDataset(connector, form) {
  return {
    source: {
      label: buildConnectionLabel(connector, form),
      kind: connector.id,
      kindLabel: connector.label,
      host: form.host,
    },
    domain: connector.domain,
    summary: {
      rowCount: connector.preview.rowEstimate,
      fieldCount: connector.preview.fieldCount,
      fields: connector.sampleFields,
    },
    ingestion: {
      freshness: form.refresh || connector.preview.freshness,
      strategy: form.loadStrategy || "Incremental watermark",
    },
    quickPrompts: connector.quickPrompts,
    staging: null,
  };
}

export function buildConnectorRun(connector, form, mode = "staged") {
  const timestamp = new Date().toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return {
    id: `${connector.id}-${Date.now()}`,
    connectorId: connector.id,
    connectorLabel: connector.label,
    target: buildTargetLabel(connector, form),
    label: form.label || connector.label,
    refresh: form.refresh || connector.preview.freshness,
    strategy:
      connector.id === "splunk"
        ? form.timeRange || form.loadStrategy
        : form.loadStrategy || "Incremental watermark",
    status: mode,
    statusLabel: mode === "live" ? "Live sync" : "Staged locally",
    timestamp,
  };
}
