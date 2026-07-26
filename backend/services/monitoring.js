function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function findField(datasetContext, candidates = []) {
  const fields = new Set((datasetContext?.fields || []).map((field) => field.field));
  return candidates.find((candidate) => fields.has(candidate)) || null;
}

function getNumericTotal(rows, field) {
  if (!field) {
    return 0;
  }

  return rows.reduce((sum, row) => {
    const value = Number(row?.[field]);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function countMatchingRows(rows, field, matcher) {
  if (!field) {
    return 0;
  }

  return rows.filter((row) => matcher(String(row?.[field] || ""))).length;
}

function inferDomain(datasetContext) {
  const fields = new Set((datasetContext?.fields || []).map((field) => field.field));

  if (fields.has("alert_count") || fields.has("vulnerability_count")) {
    return "Security";
  }

  if (fields.has("incident_count") || fields.has("downtime_hours") || fields.has("application")) {
    return "IT Operations";
  }

  if (fields.has("project") || fields.has("budget") || fields.has("spend") || fields.has("sla_breach_count")) {
    return "Project Delivery";
  }

  if (fields.has("attrition_count") || fields.has("department") || fields.has("team")) {
    return "HR / Workforce";
  }

  if (fields.has("revenue") || fields.has("profit")) {
    return "Business Reporting";
  }

  return "Enterprise Analytics";
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function buildKpiCards(rows, datasetContext, source) {
  const primaryMetricField =
    findField(datasetContext, [
      "revenue",
      "incident_count",
      "alert_count",
      "vulnerability_count",
      "downtime_hours",
      "workload",
      "spend",
      "budget",
      "profit",
    ]) ||
    datasetContext?.metrics?.[0]?.field ||
    null;

  const statusField = findField(datasetContext, ["status"]);
  const unresolvedCount = countMatchingRows(
    rows,
    statusField,
    (value) => /\b(open|unresolved|pending|backlog|active)\b/i.test(value)
  );
  const teamField = findField(datasetContext, ["team", "department", "application", "project", "region"]);
  const teamCount = teamField ? new Set(rows.map((row) => row?.[teamField]).filter(Boolean)).size : 0;

  const cards = [
    {
      title: "Active Rows",
      value: formatCompactNumber(rows.length),
      tone: "blue",
      subtitle: `${source.kind === "demo" ? "Demo" : "Uploaded"} dataset`,
    },
  ];

  if (primaryMetricField) {
    cards.push({
      title: humanize(primaryMetricField),
      value: formatCompactNumber(getNumericTotal(rows, primaryMetricField)),
      tone: "green",
      subtitle: "Total monitored value",
    });
  }

  if (statusField) {
    cards.push({
      title: "Open Items",
      value: formatCompactNumber(unresolvedCount),
      tone: unresolvedCount > 0 ? "amber" : "green",
      subtitle: "Rows still unresolved",
    });
  }

  if (teamField) {
    cards.push({
      title: humanize(teamField),
      value: formatCompactNumber(teamCount),
      tone: "slate",
      subtitle: "Distinct groups in view",
    });
  }

  return cards.slice(0, 4);
}

function buildTrendAlert(rows, datasetContext, metricField, title, negativeIsBad = false) {
  const dateField = datasetContext?.primaryDateField;

  if (!dateField || !metricField) {
    return null;
  }

  const grouped = new Map();

  for (const row of rows) {
    const period = row?.[dateField];
    const value = Number(row?.[metricField]);

    if (!period || !Number.isFinite(value)) {
      continue;
    }

    grouped.set(period, (grouped.get(period) || 0) + value);
  }

  const periods = [...grouped.entries()].sort((left, right) => String(left[0]).localeCompare(String(right[0])));

  if (periods.length < 2) {
    return null;
  }

  const [previousPeriod, previousValue] = periods[periods.length - 2];
  const [latestPeriod, latestValue] = periods[periods.length - 1];

  if (!previousValue) {
    return null;
  }

  const delta = ((latestValue - previousValue) / previousValue) * 100;
  const isBad = negativeIsBad ? delta < -10 : delta > 10;

  if (!isBad) {
    return null;
  }

  const direction = delta > 0 ? "increased" : "dropped";
  const severity = Math.abs(delta) >= 25 ? "high" : "medium";

  return {
    severity,
    title,
    description: `${humanize(metricField)} ${direction} ${Math.abs(delta).toFixed(1)}% from ${previousPeriod} to ${latestPeriod}.`,
    action: `Review the drivers behind the ${direction} trend in ${latestPeriod}.`,
  };
}

function buildAlerts(rows, datasetContext) {
  const alerts = [];
  const statusField = findField(datasetContext, ["status"]);
  const priorityField = findField(datasetContext, ["priority"]);
  const projectField = findField(datasetContext, ["project"]);
  const spendField = findField(datasetContext, ["spend"]);
  const budgetField = findField(datasetContext, ["budget"]);
  const slaField = findField(datasetContext, ["sla_breach_count"]);

  if (statusField) {
    const unresolvedCount = countMatchingRows(
      rows,
      statusField,
      (value) => /\b(open|unresolved|pending|backlog|active)\b/i.test(value)
    );

    if (unresolvedCount > 0) {
      alerts.push({
        severity: unresolvedCount >= 10 ? "high" : "medium",
        title: "Open work detected",
        description: `${unresolvedCount} rows are still open or unresolved in the active dataset.`,
        action: "Prioritize the oldest open items and confirm owners.",
      });
    }
  }

  if (statusField && priorityField) {
    const urgentOpenCount = rows.filter((row) => {
      const status = String(row?.[statusField] || "");
      const priority = String(row?.[priorityField] || "");
      return /\b(open|unresolved|pending|backlog|active)\b/i.test(status) && /\bp1|critical|sev1\b/i.test(priority);
    }).length;

    if (urgentOpenCount > 0) {
      alerts.push({
        severity: "high",
        title: "Urgent unresolved items",
        description: `${urgentOpenCount} P1 or critical rows are still unresolved.`,
        action: "Escalate these items immediately and verify SLA coverage.",
      });
    }
  }

  if (projectField && spendField && budgetField) {
    const overBudgetProjects = rows.filter((row) => {
      const spend = Number(row?.[spendField]);
      const budget = Number(row?.[budgetField]);
      return Number.isFinite(spend) && Number.isFinite(budget) && spend > budget;
    });

    if (overBudgetProjects.length > 0) {
      const exampleProject = overBudgetProjects[0]?.[projectField];
      alerts.push({
        severity: overBudgetProjects.length >= 3 ? "high" : "medium",
        title: "Budget overrun detected",
        description: `${overBudgetProjects.length} project rows exceeded budget${exampleProject ? `, including ${exampleProject}` : ""}.`,
        action: "Review cost drivers and update the recovery plan.",
      });
    }
  }

  if (slaField) {
    const totalBreaches = getNumericTotal(rows, slaField);

    if (totalBreaches > 0) {
      alerts.push({
        severity: totalBreaches >= 10 ? "high" : "medium",
        title: "SLA breach exposure",
        description: `${formatCompactNumber(totalBreaches)} SLA breach events are present in the current dataset.`,
        action: "Focus on the breach-heavy teams or projects first.",
      });
    }
  }

  const revenueAlert = buildTrendAlert(rows, datasetContext, findField(datasetContext, ["revenue"]), "Revenue performance shift", true);
  const downtimeAlert = buildTrendAlert(rows, datasetContext, findField(datasetContext, ["downtime_hours"]), "Downtime trend warning");
  const incidentAlert = buildTrendAlert(rows, datasetContext, findField(datasetContext, ["incident_count"]), "Incident volume change");

  for (const alert of [revenueAlert, downtimeAlert, incidentAlert]) {
    if (alert) {
      alerts.push(alert);
    }
  }

  return alerts.slice(0, 5);
}

function buildQuickPrompts(datasetContext) {
  const fields = new Set((datasetContext?.fields || []).map((field) => field.field));
  const prompts = [];

  if (fields.has("team")) {
    prompts.push("Which team has the highest incident volume?");
  }

  if (fields.has("priority") && fields.has("status")) {
    prompts.push("Show unresolved P1 tickets.");
  }

  if (fields.has("project") && (fields.has("sla_breach_count") || fields.has("status"))) {
    prompts.push("Which project exceeded SLA?");
  }

  if (fields.has("region") && fields.has("alert_count")) {
    prompts.push("Which region has the most security alerts?");
  }

  if (fields.has("application") && fields.has("downtime_hours")) {
    prompts.push("Which application had the highest downtime?");
  }

  if (fields.has("budget") && fields.has("spend")) {
    prompts.push("Which projects exceeded budget?");
  }

  if (fields.has("department") && fields.has("attrition_count")) {
    prompts.push("Which team has the highest attrition?");
  }

  if (fields.has("revenue")) {
    prompts.push("Which region underperformed this period?");
  }

  prompts.push("Summarize the biggest risks in this dataset.");

  return [...new Set(prompts)].slice(0, 6);
}

function buildSupportedSources() {
  return [
    { id: "upload", label: "File Upload", status: "available", detail: "JSON, CSV, Excel" },
    { id: "servicenow", label: "ServiceNow", status: "roadmap", detail: "Incidents, tickets, SLA data" },
    { id: "sharepoint", label: "SharePoint", status: "roadmap", detail: "Shared reports and lists" },
    { id: "sql", label: "SQL Databases", status: "roadmap", detail: "Operational and business data" },
    { id: "azure", label: "Azure Storage", status: "roadmap", detail: "Blob and data lake ingestion" },
    { id: "jira", label: "Jira", status: "roadmap", detail: "Projects, epics, sprint workload" },
    { id: "powerbi", label: "Power BI", status: "roadmap", detail: "Existing BI datasets" },
    { id: "purview", label: "Microsoft Purview", status: "roadmap", detail: "Catalog and governance context" },
  ];
}

function buildDepartmentUseCases() {
  return [
    {
      name: "IT Operations",
      examples: ["Which application had highest downtime?", "Show ticket trend by month."],
    },
    {
      name: "Security",
      examples: ["Which region has most security alerts?", "Show unresolved vulnerabilities."],
    },
    {
      name: "Project Management",
      examples: ["Which projects missed deadlines?", "Which team has highest workload?"],
    },
    {
      name: "Business Reporting",
      examples: ["Which region underperformed?", "Summarize the top business risks."],
    },
  ];
}

export function buildDatasetStatus({ rows, source, datasetContext }) {
  return {
    source,
    domain: inferDomain(datasetContext),
    summary: {
      rowCount: datasetContext?.rowCount || rows.length,
      fieldCount: (datasetContext?.fields || []).length,
      metricCount: (datasetContext?.metrics || []).length,
      dimensionCount: (datasetContext?.dimensions || []).length,
      fields: (datasetContext?.fields || []).map((field) => ({
        field: field.field,
        label: field.label,
        kind: field.kind,
      })),
    },
    kpis: buildKpiCards(rows, datasetContext, source),
    alerts: buildAlerts(rows, datasetContext),
    quickPrompts: buildQuickPrompts(datasetContext),
    supportedSources: buildSupportedSources(),
    departmentUseCases: buildDepartmentUseCases(),
  };
}
