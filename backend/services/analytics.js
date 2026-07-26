const DEFAULT_LIMIT = 12;

const CHART_PATTERNS = [
  { pattern: /\b(doughnut|donut|pie)\b/i, chart: "pie" },
  { pattern: /\b(column|bar)\b/i, chart: "bar" },
  { pattern: /\b(line|trend)\b/i, chart: "trend" },
  { pattern: /\b(area)\b/i, chart: "area" },
  { pattern: /\b(scatter|bubble)\b/i, chart: "scatter" },
  { pattern: /\b(radar|spider)\b/i, chart: "radar" },
  { pattern: /\b(map|geo|geomap|choropleth)\b/i, chart: "geomap" },
  { pattern: /\b(table|grid|list)\b/i, chart: "table" },
];

const OPERATORS = {
  "=": "equals",
  "==": "equals",
  is: "equals",
  equals: "equals",
  "!=": "not_equals",
  "<>": "not_equals",
  "is not": "not_equals",
  not_equals: "not_equals",
  contains: "contains",
  includes: "contains",
  in: "in",
  ">": "gt",
  gt: "gt",
  ">=": "gte",
  gte: "gte",
  "<": "lt",
  lt: "lt",
  "<=": "lte",
  lte: "lte",
};

const DIMENSION_HINTS = {
  date: ["date", "day", "week", "month", "time", "timeline", "opened", "created", "closed", "resolved"],
  region: ["region", "country", "market", "location", "territory", "geo", "geography"],
  department: ["department", "division", "function", "business unit"],
  team: ["team", "assignment group", "support team", "squad"],
  application: ["application", "app", "service", "system", "platform"],
  project: ["project", "initiative", "program", "epic"],
  product: ["product", "item", "sku"],
  category: ["category", "segment", "type", "issue type", "incident type"],
  customer_type: ["customer", "customer type", "customer segment"],
  priority: ["priority", "severity", "impact", "urgency", "p1", "p2", "p3"],
  status: ["status", "state", "resolution", "open", "closed", "resolved", "unresolved"],
  owner: ["owner", "assignee", "assigned", "manager", "agent"],
};

const METRIC_HINTS = {
  revenue: ["revenue", "sales", "income", "amount", "gmv", "turnover"],
  profit: ["profit", "margin", "earnings"],
  units_sold: ["units", "units sold", "quantity", "volume"],
  incident_count: ["incident volume", "incident", "ticket volume", "ticket", "case volume"],
  downtime_hours: ["downtime", "outage", "hours down"],
  alert_count: ["security alert", "alert", "event"],
  vulnerability_count: ["vulnerability", "finding"],
  workload: ["workload", "story point", "task volume", "capacity"],
  budget: ["budget", "planned budget", "allocated budget"],
  spend: ["spend", "cost", "spent", "expense"],
  sla_breach_count: ["sla breach", "missed sla", "breach"],
  attrition_count: ["attrition", "leaver"],
  performance_score: ["performance", "score"],
};

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isLikelyIdentifierField(fieldName) {
  const normalized = normalizeToken(fieldName);
  return (
    /^id$/.test(normalized) ||
    /(^id_|_id$)/.test(normalized) ||
    normalized.includes("identifier") ||
    /^reference_(no|number)$/.test(normalized)
  );
}

function looksLikeDate(value) {
  const stringValue = String(value || "").trim();

  if (!stringValue) {
    return false;
  }

  if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}([ t]\d{1,2}:\d{2}(:\d{2})?)?$/i.test(stringValue)) {
    return false;
  }

  return !Number.isNaN(Date.parse(stringValue));
}

function getFieldNames(datasetContext, kind) {
  if (!datasetContext) {
    return [];
  }

  if (kind === "metric") {
    return (datasetContext.metrics || []).map((field) => field.field);
  }

  if (kind === "dimension") {
    return (datasetContext.dimensions || []).map((field) => field.field);
  }

  return (datasetContext.fields || []).map((field) => field.field);
}

function getFieldMetadata(datasetContext, fieldName) {
  return (datasetContext?.fields || []).find((field) => field.field === fieldName) || null;
}

function findFieldByHint(question, datasetContext, hintMap, allowedFields) {
  const normalizedQuestion = normalizeToken(question);

  for (const [fieldName, aliases] of Object.entries(hintMap)) {
    if (!allowedFields.includes(fieldName)) {
      continue;
    }

    if (
      aliases.some((alias) =>
        new RegExp(`\\b${escapeRegExp(normalizeToken(alias))}\\b`, "i").test(
          normalizedQuestion
        )
      )
    ) {
      return fieldName;
    }
  }

  return null;
}

function normalizeField(value, allowedFields, datasetContext) {
  const token = normalizeToken(value);

  if (!token) {
    return null;
  }

  const direct = allowedFields.find((field) => normalizeToken(field) === token);

  if (direct) {
    return direct;
  }

  const labelMatch = (datasetContext?.fields || []).find(
    (field) => allowedFields.includes(field.field) && normalizeToken(field.label) === token
  );

  if (labelMatch) {
    return labelMatch.field;
  }

  const partialMatch = allowedFields.find((field) => normalizeToken(field).includes(token) || token.includes(normalizeToken(field)));

  if (partialMatch) {
    return partialMatch;
  }

  return null;
}

function normalizeMetricField(value, datasetContext) {
  const token = normalizeToken(value);

  if (!token) {
    return null;
  }

  if (["count", "record", "records", "rows", "tickets", "incidents"].includes(token)) {
    return "records";
  }

  return normalizeField(value, getFieldNames(datasetContext, "metric"), datasetContext);
}

function normalizeDimensionField(value, datasetContext) {
  return normalizeField(value, getFieldNames(datasetContext, "dimension"), datasetContext);
}

function normalizeChartType(value) {
  const token = normalizeToken(value);

  if (!token) {
    return null;
  }

  for (const { pattern, chart } of CHART_PATTERNS) {
    if (pattern.test(token)) {
      return chart;
    }
  }

  return null;
}

function detectRequestedChart(question) {
  return normalizeChartType(question);
}

function guessMetricField(question, datasetContext) {
  const numericFields = getFieldNames(datasetContext, "metric");

  if (!numericFields.length) {
    return "records";
  }

  const hintedMetric = findFieldByHint(question, datasetContext, METRIC_HINTS, numericFields);

  if (hintedMetric) {
    return hintedMetric;
  }

  if (/\b(ticket|incident|case|vulnerability|alert|issue|employee|record|count)\b/i.test(question)) {
    return "records";
  }

  if (numericFields.includes("revenue")) {
    return "revenue";
  }

  return numericFields[0];
}

function guessDimension(question, datasetContext, chartType) {
  const dimensionFields = getFieldNames(datasetContext, "dimension");

  if (!dimensionFields.length) {
    return null;
  }

  const hintedDimension = findFieldByHint(question, datasetContext, DIMENSION_HINTS, dimensionFields);

  if (hintedDimension) {
    return hintedDimension;
  }

  const primaryDateField = datasetContext?.primaryDateField || null;

  if (chartType === "geomap" && dimensionFields.includes("region")) {
    return "region";
  }

  if ((chartType === "trend" || chartType === "area") && primaryDateField) {
    return primaryDateField;
  }

  if (dimensionFields.includes("team")) {
    return "team";
  }

  if (dimensionFields.includes("region")) {
    return "region";
  }

  return dimensionFields[0];
}

function deriveQuestionIntent(question) {
  const q = normalizeToken(question);

  return {
    asksWhich: /\b(which|what|who)\b/.test(q),
    asksDistribution: /\b(distribution|share|split|composition|mix|proportion)\b/.test(q),
    wantsLowest: /\b(lowest|least|minimum|min|worst|smallest|underperform\w*)\b/.test(q),
    wantsHighest: /\b(highest|most|maximum|max|best|top|largest)\b/.test(q),
    wantsTrend: /\b(trend|over time|timeline|daily|day by day|line|area|month by month|week by week)\b/.test(q),
    wantsList: /\b(show|list|display|view)\b/.test(q),
  };
}

function hasExplicitAverageIntent(question) {
  return /\b(avg|average|mean)\b/.test(normalizeToken(question));
}

function hasExplicitSingleRecordExtremaIntent(question) {
  return /\b(single|individual|transaction|record|row|entry|min value|max value)\b/.test(
    normalizeToken(question)
  );
}

function suggestChartType({ question, groupBy, intent }) {
  const q = normalizeToken(question);

  if (/map|geo|geomap|choropleth/.test(q)) {
    return "geomap";
  }

  if (/scatter|bubble|correlation|relationship/.test(q)) {
    return "scatter";
  }

  if (/radar|spider/.test(q)) {
    return "radar";
  }

  if (/table|grid|list/.test(q) || (intent?.wantsList && !groupBy)) {
    return "table";
  }

  if (/distribution|share|composition|split|mix|proportion/.test(q) && groupBy && groupBy !== "date") {
    return "pie";
  }

  if (groupBy && normalizeToken(groupBy).includes("date")) {
    return intent?.wantsTrend ? "trend" : "bar";
  }

  return "bar";
}

function normalizeAggregation(value, metricField) {
  const token = normalizeToken(value);

  if (token === "raw" || token === "list") {
    return "raw";
  }

  if (token === "avg" || token === "average" || token === "mean") {
    return "avg";
  }

  if (token === "min" || token === "minimum" || token === "lowest") {
    return "min";
  }

  if (token === "max" || token === "maximum" || token === "highest") {
    return "max";
  }

  if (token === "count" || metricField === "records") {
    return "count";
  }

  return "sum";
}

function guessSortDirection(question) {
  const q = normalizeToken(question);

  if (/lowest|bottom|least|worst|underperform\w*/.test(q)) {
    return "asc";
  }

  if (/highest|top|best|largest|most/.test(q)) {
    return "desc";
  }

  return null;
}

function normalizeSortBy(value, groupBy, chartType, intent) {
  const token = normalizeToken(value);

  if (token === "name" || token === "label") {
    return "name";
  }

  if (token === "value" || token === "metric") {
    return "value";
  }

  if (chartType === "trend" || chartType === "area") {
    return "name";
  }

  if (intent?.wantsLowest || intent?.wantsHighest) {
    return "value";
  }

  return groupBy === "date" ? "name" : "value";
}

function normalizeSortDirection(value, question, groupBy) {
  const token = normalizeToken(value);

  if (token === "asc" || token === "ascending") {
    return "asc";
  }

  if (token === "desc" || token === "descending") {
    return "desc";
  }

  if (groupBy === "date") {
    return "asc";
  }

  return guessSortDirection(question) || "desc";
}

function clampLimit(value, chartType) {
  const parsed = Number(value);
  const fallback = chartType === "pie" || chartType === "radar" ? 8 : DEFAULT_LIMIT;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 20);
}

function normalizeOperator(value) {
  return OPERATORS[normalizeToken(value)] || null;
}

function isNumericField(field, datasetContext) {
  return getFieldNames(datasetContext, "metric").includes(field);
}

function coerceFilterValue(field, value, datasetContext) {
  if (Array.isArray(value)) {
    return value.map((item) => coerceFilterValue(field, item, datasetContext));
  }

  if (field && isNumericField(field, datasetContext)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}

function sanitizeFilters(filters = [], datasetContext) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map((filter) => {
      const field = normalizeField(
        filter?.field,
        [...getFieldNames(datasetContext, "dimension"), ...getFieldNames(datasetContext, "metric")],
        datasetContext
      );
      const operator = normalizeOperator(filter?.operator || "equals");

      if (!field || !operator || filter?.value === undefined || filter?.value === null) {
        return null;
      }

      return {
        field,
        operator,
        value: coerceFilterValue(field, filter.value, datasetContext),
      };
    })
    .filter(Boolean);
}

function questionIncludesToken(question, token) {
  const normalizedQuestion = normalizeToken(question);
  const normalizedToken = normalizeToken(token);

  if (!normalizedQuestion || !normalizedToken) {
    return false;
  }

  const pattern = new RegExp(`\\b${escapeRegExp(normalizedToken)}\\b`, "i");
  return pattern.test(normalizedQuestion);
}

function deriveContextFilters(question, datasetContext, existingFilters) {
  if (!datasetContext?.dimensions) {
    return [];
  }

  return datasetContext.dimensions
    .filter((dimension) => !existingFilters.some((filter) => filter.field === dimension.field))
    .flatMap((dimension) => {
      const matchedValue = (dimension.sampleValues || []).find((value) => questionIncludesToken(question, value));

      if (!matchedValue) {
        return [];
      }

      return [
        {
          field: dimension.field,
          operator: "equals",
          value: matchedValue,
        },
      ];
    });
}

function matchText(actual, expected) {
  return normalizeToken(actual) === normalizeToken(expected);
}

function matchContains(actual, expected) {
  return normalizeToken(actual).includes(normalizeToken(expected));
}

function compareValues(actual, expected) {
  const left = actual instanceof Date ? actual.getTime() : actual;
  const right = expected instanceof Date ? expected.getTime() : expected;

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right));
}

function normalizeComparableValue(field, value, datasetContext) {
  const fieldMeta = getFieldMetadata(datasetContext, field);

  if (fieldMeta?.kind === "date") {
    return String(value || "");
  }

  if (fieldMeta?.kind === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return value;
}

function matchesFilter(record, filter, datasetContext) {
  const actual = normalizeComparableValue(filter.field, record[filter.field], datasetContext);
  const expected = coerceFilterValue(filter.field, filter.value, datasetContext);

  switch (filter.operator) {
    case "equals":
      return Array.isArray(expected)
        ? expected.some((value) => matchText(actual, value))
        : matchText(actual, expected);
    case "not_equals":
      return Array.isArray(expected)
        ? expected.every((value) => !matchText(actual, value))
        : !matchText(actual, expected);
    case "contains":
      return matchContains(actual, expected);
    case "in":
      return Array.isArray(expected)
        ? expected.some((value) => matchText(actual, value))
        : matchText(actual, expected);
    case "gt":
      return compareValues(actual, expected) > 0;
    case "gte":
      return compareValues(actual, expected) >= 0;
    case "lt":
      return compareValues(actual, expected) < 0;
    case "lte":
      return compareValues(actual, expected) <= 0;
    default:
      return true;
  }
}

function roundValue(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function getMetricValue(record, metricField) {
  if (metricField === "records") {
    return 1;
  }

  const value = Number(record?.[metricField]);
  return Number.isFinite(value) ? value : 0;
}

function finalizeAggregate(state, aggregation) {
  if (aggregation === "count") {
    return state.count;
  }

  if (aggregation === "avg") {
    return state.count ? state.sum / state.count : 0;
  }

  if (aggregation === "min") {
    return state.min === Infinity ? 0 : state.min;
  }

  if (aggregation === "max") {
    return state.max === -Infinity ? 0 : state.max;
  }

  return state.sum;
}

function buildAggregateState() {
  return {
    sum: 0,
    count: 0,
    min: Infinity,
    max: -Infinity,
  };
}

function updateAggregate(state, value) {
  state.sum += value;
  state.count += 1;
  state.min = Math.min(state.min, value);
  state.max = Math.max(state.max, value);
}

function collapseRows(rows, limit) {
  if (rows.length <= limit || limit < 2) {
    return rows.slice(0, limit);
  }

  const visibleRows = rows.slice(0, limit - 1);
  const otherRows = rows.slice(limit - 1);
  const otherTotal = otherRows.reduce((sum, row) => sum + row.value, 0);

  return [...visibleRows, { name: "Others", value: roundValue(otherTotal) }];
}

function defaultSortRows(rows, plan) {
  const sorted = [...rows];

  sorted.sort((left, right) => {
    if (plan.sortBy === "name") {
      const nameCompare = String(left.name).localeCompare(String(right.name));
      return plan.sortDirection === "asc" ? nameCompare : nameCompare * -1;
    }

    const valueCompare = left.value - right.value;
    return plan.sortDirection === "asc" ? valueCompare : valueCompare * -1;
  });

  return sorted;
}

function sortRawRows(rows, datasetContext) {
  const primaryDateField = datasetContext?.primaryDateField;

  if (!primaryDateField) {
    return rows;
  }

  return [...rows].sort((left, right) =>
    String(right?.[primaryDateField] || "").localeCompare(String(left?.[primaryDateField] || ""))
  );
}

function buildSingleValueRow(records, plan) {
  const state = buildAggregateState();

  for (const record of records) {
    updateAggregate(state, getMetricValue(record, plan.metricField));
  }

  return [
    {
      name: buildMetricLabel(plan),
      value: roundValue(finalizeAggregate(state, plan.aggregation)),
    },
  ];
}

function buildGroupedRows(records, plan) {
  const grouped = new Map();

  for (const record of records) {
    const groupValue = record?.[plan.groupBy];
    const key =
      groupValue === undefined || groupValue === null || groupValue === ""
        ? "Unknown"
        : String(groupValue);

    if (!grouped.has(key)) {
      grouped.set(key, buildAggregateState());
    }

    updateAggregate(grouped.get(key), getMetricValue(record, plan.metricField));
  }

  return [...grouped.entries()].map(([name, state]) => ({
    name,
    value: roundValue(finalizeAggregate(state, plan.aggregation)),
  }));
}

function buildMetricLabel(plan) {
  if (plan.metricField === "records") {
    return "Record Count";
  }

  const aggregationLabel = plan.aggregation === "sum" ? "Total" : plan.aggregation.toUpperCase();

  return `${aggregationLabel} ${humanize(plan.metricField)}`;
}

function buildDefaultTitle(plan) {
  if (plan.aggregation === "raw") {
    if (plan.groupBy) {
      return `${humanize(plan.groupBy)} records`;
    }

    return "Matching Records";
  }

  const metricLabel = buildMetricLabel(plan);

  if (!plan.groupBy) {
    return metricLabel;
  }

  return `${metricLabel} by ${humanize(plan.groupBy)}`;
}

function formatValue(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getGroupLabel(groupBy) {
  const labels = {
    date: "period",
    region: "region",
    department: "department",
    team: "team",
    application: "application",
    project: "project",
    product: "product",
    category: "category",
    customer_type: "customer segment",
    priority: "priority band",
    status: "status",
    owner: "owner",
  };

  return labels[groupBy] || "segment";
}

function buildFallbackRecommendation(plan, summary, intent, targetPoint) {
  if (plan.aggregation === "raw") {
    return "Review the matching rows, assign owners, and prioritize the highest-risk items first.";
  }

  if (!targetPoint) {
    return "Use this view to compare performance and drill into the strongest and weakest segments.";
  }

  if (intent.wantsLowest) {
    const comparison =
      summary.topPoint && summary.topPoint.name !== targetPoint.name
        ? ` Compare it with ${summary.topPoint.name}, which is currently strongest.`
        : "";

    return `Investigate why ${targetPoint.name} is underperforming and address the drivers behind the dip.${comparison}`;
  }

  if (intent.wantsHighest) {
    return `Analyze what worked for ${targetPoint.name} and replicate those drivers across other ${getGroupLabel(plan.groupBy)}s.`;
  }

  if (intent.asksDistribution) {
    return "Use this distribution to focus on the smaller segments and improve overall balance.";
  }

  return "Use this view to compare performance and drill into the strongest and weakest segments.";
}

function dedupeStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function buildMetricQuestionLabel(plan) {
  return plan.metricField === "records"
    ? "records"
    : humanize(plan.metricField).toLowerCase();
}

function buildFallbackBusinessImpact(plan, summary, intent, targetPoint) {
  const metricLabel = buildMetricQuestionLabel(plan);

  if (plan.aggregation === "raw") {
    return "These matching records indicate operational exposure that can affect delivery quality, responsiveness, or compliance if not addressed quickly.";
  }

  if (intent.wantsLowest && targetPoint) {
    return `${targetPoint.name}'s weaker ${metricLabel} may drag down overall performance and put near-term targets at risk.`;
  }

  if (intent.wantsHighest && targetPoint) {
    return `${targetPoint.name} is driving a large share of ${metricLabel}, creating both momentum and concentration risk.`;
  }

  if (intent.asksDistribution) {
    return `The current ${metricLabel} mix is uneven across segments, which can affect planning, investment, and resource allocation decisions.`;
  }

  return `This view highlights where ${metricLabel} is concentrated and where targeted action can improve business performance.`;
}

function buildFallbackKeyRisks(plan, summary, intent, targetPoint) {
  const metricLabel = buildMetricQuestionLabel(plan);

  if (plan.aggregation === "raw") {
    return dedupeStrings([
      "High-priority items may remain unresolved without immediate ownership.",
      "Operational bottlenecks could expand if the matching records continue to grow.",
    ]).slice(0, 3);
  }

  if (intent.wantsLowest && targetPoint) {
    return dedupeStrings([
      `Continued underperformance in ${targetPoint.name} could reduce overall ${metricLabel}.`,
      `Delayed intervention may allow the gap in ${targetPoint.name} to widen further.`,
      "Management focus may shift reactively instead of addressing root causes early.",
    ]).slice(0, 3);
  }

  if (intent.wantsHighest && targetPoint) {
    return dedupeStrings([
      `Overreliance on ${targetPoint.name} could create concentration risk.`,
      `Other segments may continue to lag if best practices are not replicated.`,
      `Unexpected changes in ${targetPoint.name} could materially affect overall ${metricLabel}.`,
    ]).slice(0, 3);
  }

  return dedupeStrings([
    `Uneven ${metricLabel} performance across segments may make forecasting less predictable.`,
    "Without follow-up analysis, important drivers behind the result may remain hidden.",
  ]).slice(0, 3);
}

function buildFallbackActions(plan, summary, intent, targetPoint) {
  const groupLabel = getGroupLabel(plan.groupBy);
  const metricLabel = buildMetricQuestionLabel(plan);

  return dedupeStrings([
    buildFallbackRecommendation(plan, summary, intent, targetPoint),
    targetPoint && plan.groupBy
      ? `Review the drivers behind ${targetPoint.name} and compare them with other ${groupLabel}s.`
      : `Review the strongest and weakest contributors to overall ${metricLabel}.`,
    `Track ${metricLabel} in the next reporting period to confirm whether actions are improving the result.`,
  ]).slice(0, 3);
}

function buildFallbackFollowUpQuestions(plan, intent, targetPoint) {
  const metricLabel = buildMetricQuestionLabel(plan);
  const targetLabel = targetPoint?.name || "this segment";
  const driverVerb = intent.wantsLowest ? "underperform" : "perform this way";

  return dedupeStrings([
    `Why did ${targetLabel} ${driverVerb}?`,
    `Which segments contributed most to overall ${metricLabel}?`,
    `What is the trend of ${metricLabel} over time?`,
  ]).slice(0, 3);
}

function buildFallbackNarrative(question, plan, summary) {
  const intent = plan.intent || deriveQuestionIntent(question);
  const targetPoint = intent.wantsLowest ? summary.bottomPoint : summary.topPoint;
  const metricLabel = plan.metricField === "records" ? "record count" : humanize(plan.metricField).toLowerCase();
  const groupLabel = getGroupLabel(plan.groupBy);

  if (plan.aggregation === "raw") {
    const answer = `Found ${summary.recordCount} matching records for "${question}".`;
    const explanation = `Showing the top ${summary.pointCount} matching rows from the current dataset.`;
    const recommendedActions = buildFallbackActions(plan, summary, intent, targetPoint);

    return {
      chartTitle: buildDefaultTitle(plan),
      answer,
      explanation,
      recommendation: recommendedActions[0],
      executiveSummary: `${answer}\n${explanation}`,
      businessImpact: buildFallbackBusinessImpact(plan, summary, intent, targetPoint),
      keyRisks: buildFallbackKeyRisks(plan, summary, intent, targetPoint),
      recommendedActions,
      followUpQuestions: buildFallbackFollowUpQuestions(plan, intent, targetPoint),
    };
  }

  if (!targetPoint) {
    const answer = `Showing ${buildDefaultTitle(plan).toLowerCase()} for "${question}".`;
    const explanation = "The selected view is ready.";
    const recommendedActions = buildFallbackActions(plan, summary, intent, targetPoint);

    return {
      chartTitle: buildDefaultTitle(plan),
      answer,
      explanation,
      recommendation: recommendedActions[0],
      executiveSummary: `${answer}\n${explanation}`,
      businessImpact: buildFallbackBusinessImpact(plan, summary, intent, targetPoint),
      keyRisks: buildFallbackKeyRisks(plan, summary, intent, targetPoint),
      recommendedActions,
      followUpQuestions: buildFallbackFollowUpQuestions(plan, intent, targetPoint),
    };
  }

  const formattedValue = formatValue(targetPoint.value);
  let answer;

  if (intent.wantsLowest) {
    answer = `The lowest ${metricLabel} ${groupLabel} is ${targetPoint.name} at ${formattedValue}.`;
  } else if (intent.wantsHighest) {
    answer = `The highest ${metricLabel} ${groupLabel} is ${targetPoint.name} at ${formattedValue}.`;
  } else if (intent.asksDistribution) {
    answer = `${targetPoint.name} has the largest share with ${formattedValue}.`;
  } else {
    answer = `${targetPoint.name} leads at ${formattedValue}.`;
  }

  const explanation = answer;
  const recommendedActions = buildFallbackActions(plan, summary, intent, targetPoint);

  return {
    chartTitle: buildDefaultTitle(plan),
    answer,
    explanation,
    recommendation: recommendedActions[0],
    executiveSummary: `${answer}\n${explanation}`,
    businessImpact: buildFallbackBusinessImpact(plan, summary, intent, targetPoint),
    keyRisks: buildFallbackKeyRisks(plan, summary, intent, targetPoint),
    recommendedActions,
    followUpQuestions: buildFallbackFollowUpQuestions(plan, intent, targetPoint),
  };
}

function inferFields(data) {
  const fieldMap = new Map();

  for (const row of data) {
    if (!row || typeof row !== "object") {
      continue;
    }

    for (const [field, value] of Object.entries(row)) {
      if (!fieldMap.has(field)) {
        fieldMap.set(field, {
          field,
          label: humanize(field),
          nonEmptyCount: 0,
          numericCount: 0,
          dateCount: 0,
          sampleValues: [],
          sampleSet: new Set(),
          min: Infinity,
          max: -Infinity,
        });
      }

      const stats = fieldMap.get(field);

      if (value === undefined || value === null || value === "") {
        continue;
      }

      stats.nonEmptyCount += 1;

      if (typeof value === "number" && Number.isFinite(value)) {
        stats.numericCount += 1;
        stats.min = Math.min(stats.min, value);
        stats.max = Math.max(stats.max, value);
      } else if (looksLikeDate(value)) {
        stats.dateCount += 1;
      }

      if (stats.sampleValues.length < 6 && !stats.sampleSet.has(value)) {
        stats.sampleSet.add(value);
        stats.sampleValues.push(String(value));
      }

      stats.sampleSet.add(String(value));
    }
  }

  return [...fieldMap.values()].map((stats) => {
    const numericRatio = stats.nonEmptyCount ? stats.numericCount / stats.nonEmptyCount : 0;
    const dateRatio = stats.nonEmptyCount ? stats.dateCount / stats.nonEmptyCount : 0;
    const uniqueRatio = stats.nonEmptyCount ? stats.sampleSet.size / stats.nonEmptyCount : 0;
    const normalizedField = normalizeToken(stats.field);
    let kind = "dimension";
    const identifierLike =
      isLikelyIdentifierField(stats.field) && uniqueRatio >= 0.85;

    if (identifierLike) {
      kind = "identifier";
    } else if (numericRatio >= 0.65) {
      kind = "number";
    } else if (
      dateRatio >= 0.65 ||
      /\b(date|day|week|month|timestamp|opened|created|closed|resolved)\b/.test(normalizedField)
    ) {
      kind = "date";
    }

    return {
      field: stats.field,
      label: stats.label,
      kind,
      sampleValues: stats.sampleValues,
      min: stats.min === Infinity ? 0 : stats.min,
      max: stats.max === -Infinity ? 0 : stats.max,
    };
  });
}

export function buildDatasetContext(data) {
  const fields = inferFields(data);
  const dimensions = fields.filter((field) => field.kind === "dimension" || field.kind === "date");
  const metrics = fields.filter((field) => field.kind === "number");
  const primaryDateField =
    fields.find((field) => field.kind === "date" && field.field === "date")?.field ||
    fields.find((field) => field.kind === "date")?.field ||
    null;

  return {
    rowCount: data.length,
    fields,
    dimensions,
    metrics,
    primaryDateField,
    sampleRows: data.slice(0, 5),
  };
}

export function sanitizePlan(rawPlan, question, datasetContext) {
  const intent = deriveQuestionIntent(question);
  const explicitChart = detectRequestedChart(question);
  const requestedChart = explicitChart || normalizeChartType(rawPlan?.requestedChart);
  let chartType = normalizeChartType(rawPlan?.chartType) || requestedChart || suggestChartType({ question, intent });
  let groupBy = normalizeDimensionField(rawPlan?.groupBy, datasetContext) || guessDimension(question, datasetContext, chartType);
  const metricField = normalizeMetricField(rawPlan?.metricField, datasetContext) || guessMetricField(question, datasetContext);
  let aggregation = normalizeAggregation(rawPlan?.aggregation, metricField);
  const explicitFilters = sanitizeFilters(rawPlan?.filters, datasetContext);
  const implicitFilters = deriveContextFilters(question, datasetContext, explicitFilters);
  const filters = [...explicitFilters, ...implicitFilters];

  if (!groupBy && (chartType === "trend" || chartType === "area")) {
    groupBy = datasetContext?.primaryDateField;
  }

  if (!groupBy && chartType === "geomap" && getFieldNames(datasetContext, "dimension").includes("region")) {
    groupBy = "region";
  }

  if (!chartType) {
    chartType = suggestChartType({ question, groupBy, intent });
  }

  if (chartType === "geomap" && groupBy !== "region") {
    chartType = "bar";
  }

  if (
    groupBy &&
    metricField !== "records" &&
    (intent.wantsLowest || intent.wantsHighest) &&
    !hasExplicitAverageIntent(question) &&
    !hasExplicitSingleRecordExtremaIntent(question)
  ) {
    aggregation = "sum";
  }

  if (chartType === "table" && !groupBy && intent.wantsList) {
    aggregation = "raw";
  }

  if (!requestedChart && chartType === "bar" && groupBy === datasetContext?.primaryDateField && intent.wantsTrend) {
    chartType = "trend";
  }

  let sortBy = normalizeSortBy(rawPlan?.sortBy, groupBy, chartType, intent);
  let sortDirection = normalizeSortDirection(rawPlan?.sortDirection, question, groupBy);
  let limit = clampLimit(rawPlan?.limit, chartType);

  if (aggregation === "raw") {
    sortBy = "name";
    sortDirection = "desc";
    limit = Math.min(limit, 15);
  } else if (!requestedChart && groupBy && (intent.wantsLowest || intent.wantsHighest) && !intent.wantsTrend) {
    chartType = "bar";
    sortBy = "value";
    sortDirection = intent.wantsLowest ? "asc" : "desc";
    limit = DEFAULT_LIMIT;
  }

  return {
    requestedChart: requestedChart || "auto",
    chartType,
    metricField,
    aggregation,
    groupBy,
    filters,
    sortBy,
    sortDirection,
    limit,
    intent,
    answerFocus: String(rawPlan?.answerFocus || "").trim(),
  };
}

export function applyPlan(data, plan, datasetContext) {
  const filteredRows = data.filter((record) => plan.filters.every((filter) => matchesFilter(record, filter, datasetContext)));

  if (plan.aggregation === "raw") {
    const rawRows = sortRawRows(filteredRows, datasetContext).slice(0, plan.limit);
    const summary = {
      recordCount: filteredRows.length,
      pointCount: rawRows.length,
      totalValue: filteredRows.length,
      averageValue: filteredRows.length,
      topPoint: null,
      bottomPoint: null,
      title: buildDefaultTitle(plan),
    };

    return {
      filteredRows,
      chartData: rawRows,
      summary,
    };
  }

  const baseRows = plan.groupBy ? buildGroupedRows(filteredRows, plan) : buildSingleValueRow(filteredRows, plan);
  const sortedRows = defaultSortRows(baseRows, plan);
  const limitedRows =
    plan.chartType === "pie" || plan.chartType === "radar"
      ? collapseRows(sortedRows, plan.limit)
      : sortedRows.slice(0, plan.limit);

  const rankedRows = [...limitedRows].sort((left, right) => right.value - left.value);
  const totalValue = rankedRows.reduce((sum, row) => sum + row.value, 0);

  const summary = {
    recordCount: filteredRows.length,
    pointCount: limitedRows.length,
    totalValue: roundValue(totalValue),
    averageValue: roundValue(limitedRows.length ? totalValue / limitedRows.length : 0),
    topPoint: rankedRows[0] || null,
    bottomPoint: rankedRows[rankedRows.length - 1] || null,
    title: buildDefaultTitle(plan),
  };

  return {
    filteredRows,
    chartData: limitedRows,
    summary,
  };
}

export function buildResponse({ plan, chartData, narrative, summary, mode = "fallback" }) {
  const fallbackNarrative = buildFallbackNarrative(
    "the selected question",
    plan,
    summary
  );
  const safeNarrative = narrative || fallbackNarrative;
  const executiveSummary =
    String(safeNarrative.executiveSummary || "").trim() ||
    String(
      fallbackNarrative.executiveSummary ||
        safeNarrative.explanation ||
        safeNarrative.answer ||
        ""
    ).trim();
  const businessImpact =
    String(safeNarrative.businessImpact || "").trim() ||
    String(
      fallbackNarrative.businessImpact || safeNarrative.recommendation || ""
    ).trim();
  const keyRisks = dedupeStrings([
    ...(safeNarrative.keyRisks || []),
    ...(fallbackNarrative.keyRisks || []),
  ]).slice(0, 3);
  const recommendedActions = dedupeStrings([
    ...(safeNarrative.recommendedActions || []),
    ...(fallbackNarrative.recommendedActions || []),
    safeNarrative.recommendation,
  ]).slice(0, 3);
  const followUpQuestions = dedupeStrings([
    ...(safeNarrative.followUpQuestions || []),
    ...(fallbackNarrative.followUpQuestions || []),
  ]).slice(0, 3);

  const copilot = {
    executiveSummary,
    keyRisks,
    businessImpact,
    recommendedActions,
    followUpQuestions,
  };

  return {
    type: plan.chartType,
    insightType: plan.chartType,
    requestedChart: plan.requestedChart,
    title: safeNarrative.chartTitle || summary.title,
    answer: safeNarrative.answer,
    data: chartData,
    explanation: safeNarrative.explanation,
    recommendation: recommendedActions[0] || safeNarrative.recommendation,
    cards: [
      { title: "Executive Summary", text: executiveSummary, type: "insight" },
      { title: "Business Impact", text: businessImpact, type: "impact" },
      { title: "Recommended Action", text: recommendedActions[0], type: "recommendation" },
    ].filter((card) => card.text),
    copilot,
    meta: {
      mode,
      metricField: plan.metricField,
      aggregation: plan.aggregation,
      groupBy: plan.groupBy,
      filters: plan.filters,
      recordCount: summary.recordCount,
      pointCount: summary.pointCount,
      totalValue: summary.totalValue,
    },
  };
}

export function buildNoDataResponse(plan) {
  const followUpQuestions = dedupeStrings([
    "Can you broaden the filters or remove one constraint?",
    "What does this metric look like over time?",
    "Which segment has the highest volume overall?",
  ]);

  return {
    type: plan.chartType || "table",
    insightType: plan.chartType || "table",
    requestedChart: plan.requestedChart || "auto",
    title: buildDefaultTitle(plan),
    answer: "I could not find any records that match that request in the current dataset.",
    data: [],
    explanation: "No rows matched the selected filters and grouping.",
    recommendation: "Try a broader question or remove some filters to see more data.",
    cards: [
      { title: "Executive Summary", text: "No rows matched the selected filters and grouping.", type: "insight" },
      { title: "Business Impact", text: "Decision-making may be delayed until the scope is widened or additional data is included.", type: "impact" },
      { title: "Recommended Action", text: "Try a broader question or remove some filters to see more data.", type: "recommendation" },
    ],
    copilot: {
      executiveSummary: "No matching data was found for the current request.\nThe question likely needs a broader scope or fewer filters.",
      businessImpact: "Decision-making may be delayed until the scope is widened or additional data is included.",
      keyRisks: [
        "Important records may be excluded by overly narrow filters.",
        "The current slice may be too small to support a reliable conclusion.",
      ],
      recommendedActions: [
        "Broaden the question or remove some filters.",
        "Check whether the requested segment exists in the uploaded dataset.",
      ],
      followUpQuestions,
    },
    suggestedFollowUpQuestions: followUpQuestions,
  };
}

export function buildFallbackNarrativeResponse(question, plan, summary) {
  return buildFallbackNarrative(question, plan, summary);
}
