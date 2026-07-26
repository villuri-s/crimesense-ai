import { detectIntent } from "./intentService.js";
import {
  findBestEntityMatch,
  findFieldByHint,
  findFieldValueMatches,
  findMentionedFields,
  getDimensionFields,
  getMetricFields,
  humanize,
  normalizeToken,
} from "./schemaService.js";

function extractLookupParts(question) {
  const text = String(question || "").trim();
  const possessiveMatch = text.match(
    /(?:what(?:'s| is)\s+|show\s+|tell me\s+|give me\s+)?(.+?)'s\s+(.+?)(?:\?|$)/i
  );

  if (possessiveMatch) {
    return {
      entityText: possessiveMatch[1].trim(),
      fieldText: possessiveMatch[2].trim(),
    };
  }

  const ofMatch = text.match(
    /(?:what(?:'s| is)\s+|show\s+|tell me\s+|give me\s+)?(.+?)\s+of\s+(.+?)(?:\?|$)/i
  );

  if (ofMatch) {
    return {
      fieldText: ofMatch[1].trim(),
      entityText: ofMatch[2].trim(),
    };
  }

  const forMatch = text.match(
    /(?:what(?:'s| is)\s+|show\s+|tell me\s+|give me\s+)?(.+?)\s+for\s+(.+?)(?:\?|$)/i
  );

  if (forMatch) {
    return {
      fieldText: forMatch[1].trim(),
      entityText: forMatch[2].trim(),
    };
  }

  return null;
}

function extractGroupByField(question, schema) {
  const text = String(question || "").trim();
  const explicitMatch = text.match(/\b(?:by|per)\s+([a-z0-9 _-]+?)(?:\?|$|,| with | where )/i);

  if (explicitMatch) {
    const field = findFieldByHint(explicitMatch[1], schema, {
      kind: ["dimension", "date"],
    });

    if (field) {
      return field.field;
    }
  }

  return null;
}

function selectDefaultMetric(schema) {
  const preferredMetrics = ["revenue", "salary", "profit", "budget", "spend"];
  const metrics = getMetricFields(schema);

  for (const field of preferredMetrics) {
    const match = metrics.find((item) => item.field === field);

    if (match) {
      return match.field;
    }
  }

  return metrics[0]?.field || "records";
}

function selectDefaultDimension(schema) {
  const preferredDimensions = [
    "department",
    "team",
    "region",
    "status",
    "priority",
    "application",
    "project",
    schema?.primaryDateField,
  ].filter(Boolean);
  const dimensions = getDimensionFields(schema);

  for (const field of preferredDimensions) {
    const match = dimensions.find((item) => item.field === field);

    if (match) {
      return match.field;
    }
  }

  return dimensions.find((item) => item.kind !== "identifier")?.field || dimensions[0]?.field || null;
}

function buildIntentFlags(intentInfo) {
  return {
    wantsLowest:
      intentInfo.type === "bottom_n" || Boolean(intentInfo.flags?.wantsBottom),
    wantsHighest:
      intentInfo.type === "top_n" || Boolean(intentInfo.flags?.wantsTop),
    wantsTrend: Boolean(intentInfo.flags?.asksTrend),
    asksDistribution: intentInfo.requestedChart === "pie",
  };
}

function buildFiltersFromMatches(question, rows, schema, excludedFields = new Set()) {
  const matchesByField = new Map();

  for (const field of getDimensionFields(schema)) {
    if (excludedFields.has(field.field)) {
      continue;
    }

    const matches = findFieldValueMatches(question, rows, field.field, {
      threshold: field.field === "name" ? 0.82 : 0.72,
      maxValues: 750,
    });

    if (matches.length) {
      matchesByField.set(field.field, matches);
    }
  }

  return matchesByField;
}

function collapseFilterMap(matchesByField) {
  const filters = [];

  for (const [field, matches] of matchesByField.entries()) {
    if (!matches.length) {
      continue;
    }

    filters.push({
      field,
      operator: "equals",
      value: matches[0].value,
    });
  }

  return filters;
}

function dedupeFilters(filters = []) {
  const seen = new Set();

  return filters.filter((filter) => {
    const key = JSON.stringify([filter.field, filter.operator, filter.value]);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function inferChartType(intentInfo, groupBy, requestedChart, schema) {
  if (requestedChart && requestedChart !== "auto") {
    return requestedChart;
  }

  if (groupBy && schema?.primaryDateField && groupBy === schema.primaryDateField) {
    return "trend";
  }

  if (
    intentInfo.type === "filter" ||
    intentInfo.type === "row_lookup" ||
    intentInfo.type === "column_lookup"
  ) {
    return "table";
  }

  return "bar";
}

function buildAnalyticsPlan({
  intentInfo,
  requestedChart,
  chartType,
  metricField,
  aggregation,
  groupBy,
  filters,
  limit,
  sortDirection,
  answerFocus,
}) {
  return {
    requestedChart,
    chartType,
    metricField,
    aggregation,
    groupBy,
    filters,
    sortBy: groupBy ? "value" : "name",
    sortDirection,
    limit,
    intent: buildIntentFlags(intentInfo),
    answerFocus,
  };
}

function resolveLookupTargetField(question, schema) {
  const lookupParts = extractLookupParts(question);

  if (!lookupParts?.fieldText) {
    const mentionedFields = findMentionedFields(question, schema);
    return mentionedFields[0]?.field || null;
  }

  const field = findFieldByHint(lookupParts.fieldText, schema);
  return field?.field || null;
}

function resolveLookupEntity(question, rows, schema, targetField) {
  const lookupParts = extractLookupParts(question);
  const entityQuestion = lookupParts?.entityText || question;

  return findBestEntityMatch(entityQuestion, rows, schema, {
    preferredFields: ["name", "employee", "owner", "caller"],
    excludeFields: targetField ? [targetField] : [],
    maxValues: 750,
  });
}

function resolveMetricField(question, schema) {
  return (
    findFieldByHint(question, schema, { kind: "number" })?.field ||
    selectDefaultMetric(schema)
  );
}

function inferGroupBy(question, schema, metricField) {
  const explicitGroupBy = extractGroupByField(question, schema);

  if (explicitGroupBy) {
    return explicitGroupBy;
  }

  const mentionedDimensions = findMentionedFields(question, schema, {
    kind: ["dimension", "date"],
  }).filter((field) => field.field !== metricField);

  if (mentionedDimensions.length) {
    return mentionedDimensions[0].field;
  }

  return null;
}

function buildLookupPlan({ question, rows, schema, intentInfo }) {
  const targetField = resolveLookupTargetField(question, schema);
  const entityMatch = resolveLookupEntity(question, rows, schema, targetField);
  const lookupFields = targetField
    ? [entityMatch?.field || "name", targetField].filter(Boolean)
    : null;
  const filters = entityMatch
    ? [
        {
          field: entityMatch.field,
          operator: "equals",
          value: entityMatch.value,
        },
      ]
    : [];

  return {
    intentType:
      getMetricFields(schema).some((field) => field.field === targetField)
        ? "column_lookup"
        : "row_lookup",
    executionType: "analytics_raw",
    requestedChart: intentInfo.requestedChart,
    chartType: "table",
    targetField,
    entityMatch,
    filters,
    limit: 5,
    selectedFields: lookupFields,
    answerFocus: targetField
      ? `Look up ${humanize(targetField)} for ${entityMatch?.value || "the matched record"}`
      : "Look up matching records",
    analyticsPlan: buildAnalyticsPlan({
      intentInfo,
      requestedChart: "table",
      chartType: "table",
      metricField: "records",
      aggregation: "raw",
      groupBy: null,
      filters,
      limit: 5,
      sortDirection: "desc",
      answerFocus: targetField
        ? `Look up ${humanize(targetField)} for ${entityMatch?.value || "the matched record"}`
        : "Look up matching records",
    }),
  };
}

function buildFilterPlan({ question, rows, schema, intentInfo }) {
  const matchesByField = buildFiltersFromMatches(question, rows, schema);
  const filters = dedupeFilters(collapseFilterMap(matchesByField));

  return {
    intentType: "filter",
    executionType: "analytics_raw",
    requestedChart: intentInfo.requestedChart,
    chartType: "table",
    filters,
    limit: 15,
    selectedFields: null,
    answerFocus: "Return matching rows from the dataset",
    analyticsPlan: buildAnalyticsPlan({
      intentInfo,
      requestedChart: "table",
      chartType: "table",
      metricField: "records",
      aggregation: "raw",
      groupBy: null,
      filters,
      limit: 15,
      sortDirection: "desc",
      answerFocus: "Return matching rows from the dataset",
    }),
  };
}

function buildScalarAggregationPlan({ question, schema, intentInfo, filters = [] }) {
  const metricField = resolveMetricField(question, schema);
  let aggregation = "sum";

  if (/\b(avg|average|mean)\b/i.test(question)) {
    aggregation = "avg";
  } else if (/\b(count|how many|number of)\b/i.test(question) || metricField === "records") {
    aggregation = "count";
  } else if (/\b(median)\b/i.test(question)) {
    aggregation = "median";
  } else if (/\b(lowest|minimum|min)\b/i.test(question)) {
    aggregation = "min";
  } else if (/\b(highest|maximum|max)\b/i.test(question)) {
    aggregation = "max";
  }

  return {
    intentType: "aggregation",
    executionType: "scalar_metric",
    requestedChart: intentInfo.requestedChart,
    chartType: inferChartType(intentInfo, null, intentInfo.requestedChart, schema),
    filters,
    metricField,
    aggregation,
    groupBy: null,
    limit: 1,
    answerFocus: `${aggregation.toUpperCase()} ${humanize(metricField)}`,
  };
}

function buildGroupedPlan({
  intentType,
  question,
  rows,
  schema,
  intentInfo,
  filters = [],
  sortDirection,
  limit,
}) {
  const metricField = resolveMetricField(question, schema);
  const groupBy = inferGroupBy(question, schema, metricField) || selectDefaultDimension(schema);
  let aggregation = "sum";

  if (/\b(avg|average|mean)\b/i.test(question)) {
    aggregation = "avg";
  } else if (/\b(count|how many|number of)\b/i.test(question) || metricField === "records") {
    aggregation = "count";
  } else if (/\b(lowest|minimum|min)\b/i.test(question)) {
    aggregation = "min";
  } else if (/\b(highest|maximum|max)\b/i.test(question)) {
    aggregation = "max";
  }

  const chartType = inferChartType(intentInfo, groupBy, intentInfo.requestedChart, schema);
  const requestedChart =
    intentInfo.type === "chart_generation" && intentInfo.requestedChart !== "auto"
      ? intentInfo.requestedChart
      : chartType;

  return {
    intentType,
    executionType: "analytics_grouped",
    requestedChart,
    chartType,
    filters,
    metricField,
    aggregation,
    groupBy,
    limit,
    sortDirection,
    answerFocus: `${humanize(metricField)} by ${humanize(groupBy)}`,
    analyticsPlan: buildAnalyticsPlan({
      intentInfo,
      requestedChart,
      chartType,
      metricField,
      aggregation,
      groupBy,
      filters,
      limit,
      sortDirection,
      answerFocus: `${humanize(metricField)} by ${humanize(groupBy)}`,
    }),
  };
}

function buildRowRankingPlan({ intentType, question, rows, schema, intentInfo, filters = [] }) {
  const metricField = resolveMetricField(question, schema);
  const limit = intentInfo.requestedLimit || (intentType === "aggregation" ? 1 : 5);
  const sortDirection =
    intentType === "bottom_n" || intentInfo.flags?.wantsBottom ? "asc" : "desc";

  return {
    intentType,
    executionType: "row_ranking",
    requestedChart: intentInfo.requestedChart,
    chartType:
      intentInfo.requestedChart && intentInfo.requestedChart !== "auto"
        ? intentInfo.requestedChart
        : "table",
    filters,
    metricField,
    aggregation: sortDirection === "asc" ? "min" : "max",
    groupBy: null,
    limit,
    sortDirection,
    answerFocus: `${sortDirection === "asc" ? "Lowest" : "Highest"} ${humanize(metricField)} rows`,
  };
}

function buildComparisonPlan({ question, rows, schema, intentInfo }) {
  const metricField = resolveMetricField(question, schema);
  const explicitGroupBy = inferGroupBy(question, schema, metricField);
  const matchesByField = buildFiltersFromMatches(question, rows, schema);
  let groupBy = explicitGroupBy;
  let filters = [];

  for (const [field, matches] of matchesByField.entries()) {
    if (matches.length >= 2) {
      groupBy = groupBy || field;
      filters = [
        {
          field,
          operator: "in",
          value: matches.slice(0, 4).map((match) => match.value),
        },
      ];
      break;
    }
  }

  if (!groupBy) {
    groupBy = selectDefaultDimension(schema);
  }

  return {
    intentType: "comparison",
    executionType: "analytics_grouped",
    requestedChart: intentInfo.requestedChart === "auto" ? "bar" : intentInfo.requestedChart,
    chartType: inferChartType(intentInfo, groupBy, "bar", schema),
    filters,
    metricField,
    aggregation: /\b(avg|average|mean)\b/i.test(question) ? "avg" : "sum",
    groupBy,
    limit: 12,
    sortDirection: "desc",
    answerFocus: `Compare ${humanize(metricField)} across ${humanize(groupBy)}`,
    analyticsPlan: buildAnalyticsPlan({
      intentInfo,
      requestedChart: intentInfo.requestedChart === "auto" ? "bar" : intentInfo.requestedChart,
      chartType: inferChartType(intentInfo, groupBy, "bar", schema),
      metricField,
      aggregation: /\b(avg|average|mean)\b/i.test(question) ? "avg" : "sum",
      groupBy,
      filters,
      limit: 12,
      sortDirection: "desc",
      answerFocus: `Compare ${humanize(metricField)} across ${humanize(groupBy)}`,
    }),
  };
}

function buildTrendPlan({ question, schema, intentInfo, filters = [] }) {
  const metricField = resolveMetricField(question, schema);
  const groupBy = schema?.primaryDateField || selectDefaultDimension(schema);

  return {
    intentType: "trend",
    executionType: "analytics_grouped",
    requestedChart: "trend",
    chartType: "trend",
    filters,
    metricField,
    aggregation: /\b(avg|average|mean)\b/i.test(question) ? "avg" : "sum",
    groupBy,
    limit: 24,
    sortDirection: "asc",
    answerFocus: `${humanize(metricField)} trend over ${humanize(groupBy)}`,
    analyticsPlan: buildAnalyticsPlan({
      intentInfo,
      requestedChart: "trend",
      chartType: "trend",
      metricField,
      aggregation: /\b(avg|average|mean)\b/i.test(question) ? "avg" : "sum",
      groupBy,
      filters,
      limit: 24,
      sortDirection: "asc",
      answerFocus: `${humanize(metricField)} trend over ${humanize(groupBy)}`,
    }),
  };
}

function buildSummaryPlan({ schema, intentInfo }) {
  const metricField = selectDefaultMetric(schema);
  const groupBy = selectDefaultDimension(schema);

  if (!groupBy) {
    return {
      intentType: "summary",
      executionType: "scalar_metric",
      requestedChart: "bar",
      chartType: "bar",
      filters: [],
      metricField,
      aggregation: metricField === "records" ? "count" : "sum",
      groupBy: null,
      limit: 1,
      answerFocus: "Summarize the active dataset",
    };
  }

  return {
    intentType: "summary",
    executionType: "analytics_grouped",
    requestedChart: intentInfo.requestedChart === "auto" ? "bar" : intentInfo.requestedChart,
    chartType: inferChartType(intentInfo, groupBy, "bar", schema),
    filters: [],
    metricField,
    aggregation: metricField === "records" ? "count" : "sum",
    groupBy,
    limit: 8,
    sortDirection: "desc",
    answerFocus: "Summarize the active dataset",
    analyticsPlan: buildAnalyticsPlan({
      intentInfo,
      requestedChart: intentInfo.requestedChart === "auto" ? "bar" : intentInfo.requestedChart,
      chartType: inferChartType(intentInfo, groupBy, "bar", schema),
      metricField,
      aggregation: metricField === "records" ? "count" : "sum",
      groupBy,
      filters: [],
      limit: 8,
      sortDirection: "desc",
      answerFocus: "Summarize the active dataset",
    }),
  };
}

export function createQueryPlan({ question, rows, schema }) {
  const intentInfo = detectIntent(question, schema);

  if (intentInfo.type === "row_lookup" || intentInfo.type === "column_lookup") {
    return buildLookupPlan({ question, rows, schema, intentInfo });
  }

  if (intentInfo.type === "filter") {
    return buildFilterPlan({ question, rows, schema, intentInfo });
  }

  if (intentInfo.type === "top_n") {
    const groupBy = inferGroupBy(question, schema, resolveMetricField(question, schema));
    return groupBy
      ? buildGroupedPlan({
          intentType: "top_n",
          question,
          rows,
          schema,
          intentInfo,
          filters: [],
          sortDirection: "desc",
          limit: intentInfo.requestedLimit || 5,
        })
      : buildRowRankingPlan({
          intentType: "top_n",
          question,
          rows,
          schema,
          intentInfo,
          filters: [],
        });
  }

  if (intentInfo.type === "bottom_n") {
    const groupBy = inferGroupBy(question, schema, resolveMetricField(question, schema));
    return groupBy
      ? buildGroupedPlan({
          intentType: "bottom_n",
          question,
          rows,
          schema,
          intentInfo,
          filters: [],
          sortDirection: "asc",
          limit: intentInfo.requestedLimit || 5,
        })
      : buildRowRankingPlan({
          intentType: "bottom_n",
          question,
          rows,
          schema,
          intentInfo,
          filters: [],
        });
  }

  if (intentInfo.type === "comparison") {
    return buildComparisonPlan({ question, rows, schema, intentInfo });
  }

  if (intentInfo.type === "trend") {
    return buildTrendPlan({ question, schema, intentInfo });
  }

  if (intentInfo.type === "chart_generation" || intentInfo.type === "root_cause") {
    return buildGroupedPlan({
      intentType: intentInfo.type,
      question,
      rows,
      schema,
      intentInfo,
      filters: [],
      sortDirection: "desc",
      limit: 12,
    });
  }

  if (intentInfo.type === "aggregation") {
    const metricField = resolveMetricField(question, schema);
    const groupBy = inferGroupBy(question, schema, metricField);
    const matchesByField = buildFiltersFromMatches(question, rows, schema, new Set(groupBy ? [groupBy] : []));
    const filters = dedupeFilters(collapseFilterMap(matchesByField));

    if (groupBy) {
      return buildGroupedPlan({
        intentType: "aggregation",
        question,
        rows,
        schema,
        intentInfo,
        filters,
        sortDirection: intentInfo.flags?.wantsBottom ? "asc" : "desc",
        limit: 12,
      });
    }

    if (intentInfo.flags?.wantsTop || intentInfo.flags?.wantsBottom) {
      return buildRowRankingPlan({
        intentType: "aggregation",
        question,
        rows,
        schema,
        intentInfo,
        filters,
      });
    }

    return buildScalarAggregationPlan({
      question,
      schema,
      intentInfo,
      filters,
    });
  }

  return buildSummaryPlan({ schema, intentInfo });
}
