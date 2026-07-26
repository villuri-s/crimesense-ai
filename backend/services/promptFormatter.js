import { humanize } from "./schemaService.js";

function formatValue(value) {
  if (typeof value === "string") {
    return value;
  }

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

function getBestLabel(row) {
  if (!row || typeof row !== "object") {
    return "the matching record";
  }

  const candidateFields = ["name", "employee", "owner", "department", "team", "region"];

  for (const field of candidateFields) {
    const value = row?.[field];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  const [firstValue] = Object.values(row);
  return String(firstValue || "the matching record");
}

function buildLookupNarrative(plan, result) {
  const row = result.primaryRow;

  if (!row) {
    return null;
  }

  const entityLabel = plan.entityMatch?.value || getBestLabel(row);

  if (plan.targetField) {
    const value = row?.[plan.targetField];
    const answer = `${entityLabel}'s ${humanize(plan.targetField).toLowerCase()} is ${formatValue(value)}.`;

    return {
      chartTitle: `${humanize(plan.targetField)} for ${entityLabel}`,
      answer,
      explanation: `Matched 1 row in the active dataset using ${humanize(plan.entityMatch?.field || "the selected field")}.`,
      executiveSummary: answer,
      businessImpact: `This lookup is grounded directly in the active dataset and returns the stored ${humanize(plan.targetField).toLowerCase()} value for ${entityLabel}.`,
      keyRisks: [
        "The answer depends on the current uploaded dataset being complete and up to date.",
      ],
      recommendedActions: [
        `Review the full record for ${entityLabel} if you need additional fields beyond ${humanize(plan.targetField).toLowerCase()}.`,
      ],
      followUpQuestions: [
        `Show the full record for ${entityLabel}.`,
        `What other ${humanize(plan.targetField).toLowerCase()} values are in this dataset?`,
      ],
    };
  }

  const answer =
    result.summary?.recordCount === 1
      ? `Found 1 matching record for ${entityLabel}.`
      : `Found ${result.summary?.recordCount || 0} matching records for ${entityLabel}.`;

  return {
    chartTitle: `Matching records for ${entityLabel}`,
    answer,
    explanation: "Showing the matching rows directly from the uploaded dataset.",
    executiveSummary: answer,
    businessImpact: "This response is retrieved directly from the dataset without generating values through the language model.",
    keyRisks: [
      "Similar names may require a more specific query if multiple records exist.",
    ],
    recommendedActions: [
      "Refine the query with another field if you want a narrower record match.",
    ],
    followUpQuestions: [
      `What is ${entityLabel}'s department?`,
      `What is ${entityLabel}'s salary?`,
    ],
  };
}

function buildFilterNarrative(plan, result) {
  const filter = plan.filters[0];
  const scopeLabel =
    filter?.field && filter?.value !== undefined
      ? `${humanize(filter.field)} = ${filter.value}`
      : "the requested filters";
  const answer = `Found ${result.summary?.recordCount || 0} matching rows for ${scopeLabel}.`;

  return {
    chartTitle: "Matching Records",
    answer,
    explanation: `Showing up to ${result.rows.length} rows that satisfy the dataset filters.`,
    executiveSummary: answer,
    businessImpact: "The response contains only records that match the requested dataset slice.",
    keyRisks: ["Narrow filters can hide relevant rows outside the selected slice."],
    recommendedActions: ["Broaden or add filters depending on whether you want more or fewer rows."],
    followUpQuestions: [
      "Show a chart for these records.",
      "Count these matching rows.",
    ],
  };
}

function buildScalarNarrative(plan, result) {
  const metricLabel = humanize(plan.metricField);
  const value = formatValue(result.primaryValue);
  let prefix = "Total";

  if (plan.aggregation === "avg") {
    prefix = "Average";
  } else if (plan.aggregation === "min") {
    prefix = "Minimum";
  } else if (plan.aggregation === "max") {
    prefix = "Maximum";
  } else if (plan.aggregation === "median") {
    prefix = "Median";
  } else if (plan.aggregation === "count" || plan.metricField === "records") {
    prefix = "Count";
  }

  const answer =
    plan.metricField === "records" || plan.aggregation === "count"
      ? `There are ${value} matching rows in the current dataset.`
      : `${prefix} ${metricLabel.toLowerCase()} is ${value}.`;

  return {
    chartTitle: `${prefix} ${metricLabel}`,
    answer,
    explanation: `Computed directly from ${result.summary?.recordCount || 0} matching rows in the active dataset.`,
    executiveSummary: answer,
    businessImpact: `This metric is calculated directly from the uploaded dataset with ${prefix.toLowerCase()} aggregation.`,
    keyRisks: ["Metric quality depends on the completeness of the underlying numeric field."],
    recommendedActions: [`Compare ${metricLabel.toLowerCase()} across a dimension if you need more context.`],
    followUpQuestions: [
      `${prefix} ${metricLabel.toLowerCase()} by department`,
      `Show the rows behind this ${metricLabel.toLowerCase()} calculation`,
    ],
  };
}

function buildRankingNarrative(plan, result) {
  const metricLabel = humanize(plan.metricField).toLowerCase();
  const row = result.primaryRow;
  const label = getBestLabel(row);
  const value = formatValue(result.primaryValue);
  const direction = plan.sortDirection === "asc" ? "lowest" : "highest";

  if ((plan.limit || 1) === 1 || plan.intentType === "aggregation") {
    const answer = `The ${direction} ${metricLabel} is ${value} for ${label}.`;

    return {
      chartTitle: `${humanize(plan.metricField)} ranking`,
      answer,
      explanation: `Sorted the matching rows by ${metricLabel} and returned the ${direction} result directly from the dataset.`,
      executiveSummary: answer,
      businessImpact: `${label} is the ${direction} observed ${metricLabel} record in the current dataset slice.`,
      keyRisks: ["Outlier rows should be reviewed in full context before action is taken."],
      recommendedActions: [`Inspect the full row for ${label} to understand the driver behind this ${metricLabel}.`],
      followUpQuestions: [
        `Show the top 5 ${metricLabel} rows`,
        `Which department has the ${direction} ${metricLabel}?`,
      ],
    };
  }

  const answer = `Showing the ${plan.limit} ${direction === "highest" ? "highest" : "lowest"} ${metricLabel} rows from the dataset.`;

  return {
    chartTitle: `${humanize(plan.metricField)} ranking`,
    answer,
    explanation: `Sorted the rows by ${metricLabel} and returned the requested ranking.`,
    executiveSummary: answer,
    businessImpact: "The ranked list shows which records sit at the top or bottom of the selected metric.",
    keyRisks: ["Single-point rankings can change as the dataset refreshes."],
    recommendedActions: ["Use a grouped chart if you want the ranking summarized by department, team, or region."],
    followUpQuestions: [
      `Who has the highest ${metricLabel}?`,
      `${humanize(plan.metricField)} by department`,
    ],
  };
}

function buildGroupedNarrative(plan, result) {
  const topPoint = result.summary?.topPoint;
  const bottomPoint = result.summary?.bottomPoint;
  const metricLabel = humanize(plan.metricField).toLowerCase();
  const groupLabel = humanize(plan.groupBy || "segment").toLowerCase();

  if (plan.chartType === "trend") {
    const firstPoint = result.chartData?.[0];
    const lastPoint = result.chartData?.[result.chartData.length - 1];
    const answer = lastPoint
      ? `${metricLabel} is ${formatValue(lastPoint.value)} in ${lastPoint.name}.`
      : `No trend points were found for ${metricLabel}.`;

    return {
      chartTitle: `${humanize(plan.metricField)} trend`,
      answer,
      explanation:
        firstPoint && lastPoint
          ? `The trend runs from ${formatValue(firstPoint.value)} in ${firstPoint.name} to ${formatValue(lastPoint.value)} in ${lastPoint.name}.`
          : "Trend values were computed directly from the dataset.",
      executiveSummary: answer,
      businessImpact: `The time-series view shows how ${metricLabel} changes across ${groupLabel}.`,
      keyRisks: ["Short time windows can hide broader trend movement."],
      recommendedActions: ["Compare the latest period with earlier points to confirm whether the trend is persistent."],
      followUpQuestions: [
        `Which ${groupLabel} has the highest ${metricLabel}?`,
        `Show the rows behind the latest trend point`,
      ],
    };
  }

  if (plan.intentType === "comparison" && result.chartData?.length >= 2) {
    const [leader, runnerUp] = [...result.chartData]
      .sort((left, right) => Number(right.value) - Number(left.value));
    const delta = Number(leader.value) - Number(runnerUp.value);
    const answer = `${leader.name} leads ${runnerUp.name} by ${formatValue(delta)} in ${metricLabel}.`;

    return {
      chartTitle: `${humanize(plan.metricField)} comparison`,
      answer,
      explanation: `Compared ${result.chartData.length} ${groupLabel} values directly from the dataset.`,
      executiveSummary: answer,
      businessImpact: `The comparison shows how far the leading ${groupLabel} is ahead of the next closest segment.`,
      keyRisks: ["Large gaps between compared groups may indicate uneven performance concentration."],
      recommendedActions: ["Review the largest and smallest groups together before making changes."],
      followUpQuestions: [
        `Show ${metricLabel} for each ${groupLabel}`,
        `Why is ${leader.name} ahead in ${metricLabel}?`,
      ],
    };
  }

  const answer =
    plan.sortDirection === "asc" && bottomPoint
      ? `${bottomPoint.name} has the lowest ${metricLabel} at ${formatValue(bottomPoint.value)}.`
      : topPoint
        ? `${topPoint.name} has the highest ${metricLabel} at ${formatValue(topPoint.value)}.`
        : `Showing ${metricLabel} by ${groupLabel}.`;

  return {
    chartTitle: result.summary?.title || `${humanize(plan.metricField)} by ${humanize(plan.groupBy)}`,
    answer,
    explanation: `Computed ${metricLabel} across ${result.summary?.pointCount || 0} ${groupLabel} groups directly from the dataset.`,
    executiveSummary: answer,
    businessImpact: `This view highlights where ${metricLabel} is concentrated across ${groupLabel} segments.`,
    keyRisks: ["Segment leaders and laggards should be verified against raw rows before action is taken."],
    recommendedActions: [`Drill into the ${groupLabel} rows behind ${topPoint?.name || "the leading segment"} for more detail.`],
    followUpQuestions: [
      `Show the rows behind ${topPoint?.name || "the top segment"}`,
      `Compare ${metricLabel} across another dimension`,
    ],
  };
}

export function buildDeterministicNarrative({ plan, result }) {
  if (plan.intentType === "row_lookup" || plan.intentType === "column_lookup") {
    return buildLookupNarrative(plan, result);
  }

  if (plan.intentType === "filter") {
    return buildFilterNarrative(plan, result);
  }

  if (plan.executionType === "scalar_metric") {
    return buildScalarNarrative(plan, result);
  }

  if (plan.executionType === "row_ranking") {
    return buildRankingNarrative(plan, result);
  }

  return buildGroupedNarrative(plan, result);
}

export function buildEmptyResultNarrative(plan) {
  const answer = "No matching record found.";

  return {
    chartTitle: plan.answerFocus || "No matching result",
    answer,
    explanation: "The current dataset does not contain any rows that match this request.",
    executiveSummary: answer,
    businessImpact: "No dataset-backed answer could be returned for the current request.",
    keyRisks: [
      "The requested record may not exist in the uploaded file.",
      "The query may need a more exact spelling or broader filter scope.",
    ],
    recommendedActions: [
      "Check the spelling of the entity or widen the filter criteria.",
    ],
    followUpQuestions: [
      "Show all rows from the dataset",
      "What fields are available in this dataset?",
    ],
  };
}

export function buildApiResponse({ plan, narrative, visualization, result }) {
  const executiveSummary = narrative.executiveSummary || narrative.answer;
  const businessImpact = narrative.businessImpact || narrative.explanation;
  const recommendedActions = narrative.recommendedActions || [];

  return {
    type: visualization.type,
    insightType: visualization.insightType,
    requestedChart: visualization.requestedChart,
    title: narrative.chartTitle,
    answer: narrative.answer,
    data: visualization.data,
    explanation: narrative.explanation,
    recommendation: recommendedActions[0] || null,
    cards: [
      { title: "Executive Summary", text: executiveSummary, type: "insight" },
      { title: "Business Impact", text: businessImpact, type: "impact" },
      {
        title: "Recommended Action",
        text: recommendedActions[0] || null,
        type: "recommendation",
      },
    ].filter((card) => card.text),
    copilot: {
      executiveSummary,
      businessImpact,
      keyRisks: narrative.keyRisks || [],
      recommendedActions,
      followUpQuestions: narrative.followUpQuestions || [],
    },
    meta: {
      mode: "dataset-first",
      intentType: plan.intentType,
      executionType: plan.executionType,
      metricField: plan.metricField || null,
      aggregation: plan.aggregation || null,
      groupBy: plan.groupBy || null,
      filters: plan.filters || [],
      recordCount: result.summary?.recordCount || 0,
      pointCount: result.summary?.pointCount || 0,
      totalValue: result.summary?.totalValue ?? null,
    },
  };
}
