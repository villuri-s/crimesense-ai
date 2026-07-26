import { applyPlan } from "./analytics.js";

const ROOT_CAUSE_MAX_GROUPS = 200;
const ROOT_CAUSE_PREVIEW_LIMIT = 8;

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

function roundValue(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number.isInteger(value) ? value : Number(value.toFixed(2));
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

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

function buildMetricLabel(plan) {
  if (plan.metricField === "records") {
    return "Record Count";
  }

  if (plan.aggregation === "count") {
    return `Count of ${humanize(plan.metricField)}`;
  }

  if (plan.aggregation === "avg") {
    return `Average ${humanize(plan.metricField)}`;
  }

  if (plan.aggregation === "min") {
    return `Minimum ${humanize(plan.metricField)}`;
  }

  if (plan.aggregation === "max") {
    return `Maximum ${humanize(plan.metricField)}`;
  }

  return `Total ${humanize(plan.metricField)}`;
}

function getDimensionMetadata(datasetContext, field) {
  return (datasetContext?.dimensions || []).find((dimension) => dimension.field === field) || null;
}

function buildNodeId(field, value, level) {
  const fieldKey = field || "overall";
  const valueKey = String(value || "current")
    .trim()
    .toLowerCase()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${fieldKey}:${valueKey || "current"}:${level}`;
}

function toMagnitude(value) {
  return Math.abs(Number.isFinite(value) ? value : 0);
}

function getMagnitudeTotal(rows = []) {
  return rows.reduce((sum, row) => sum + toMagnitude(row?.value), 0);
}

function countRowsByField(rows = [], field, value) {
  if (!field) {
    return Array.isArray(rows) ? rows.length : 0;
  }

  const expected = normalizeToken(value);
  return rows.filter((row) => normalizeToken(row?.[field]) === expected).length;
}

function getUsedFields(path = []) {
  return new Set(path.map((node) => node?.field).filter(Boolean));
}

function getRemainingDimensions(datasetContext, path = []) {
  const usedFields = getUsedFields(path);

  return (datasetContext?.dimensions || [])
    .filter((dimension) => !usedFields.has(dimension.field))
    .sort((left, right) => {
      const leftPriority = left.kind === "date" ? 1 : 0;
      const rightPriority = right.kind === "date" ? 1 : 0;
      return leftPriority - rightPriority;
    });
}

function buildScopeFilters(plan, path = []) {
  const scopeFilters = [...(Array.isArray(plan.filters) ? plan.filters : [])];

  for (const node of path) {
    if (!node?.field) {
      continue;
    }

    scopeFilters.push({
      field: node.field,
      operator: "equals",
      value: node.value,
    });
  }

  return scopeFilters;
}

function normalizeRootCausePlan(basePlan = {}) {
  const aggregation =
    basePlan.aggregation === "raw" ? "count" : basePlan.aggregation || "count";

  return {
    requestedChart: basePlan.requestedChart || "auto",
    chartType: basePlan.chartType || "bar",
    metricField: basePlan.metricField || "records",
    aggregation,
    groupBy: basePlan.groupBy || null,
    filters: Array.isArray(basePlan.filters) ? basePlan.filters : [],
    intent: basePlan.intent && typeof basePlan.intent === "object" ? basePlan.intent : {},
    sortBy: basePlan.sortBy || "value",
    sortDirection: basePlan.sortDirection || "desc",
  };
}

function buildScopedPlan(plan, filters, overrides = {}) {
  return {
    ...plan,
    chartType: overrides.chartType || "bar",
    groupBy: overrides.groupBy ?? plan.groupBy ?? null,
    filters,
    sortBy: overrides.sortBy || "value",
    sortDirection: overrides.sortDirection || "desc",
    limit: overrides.limit || ROOT_CAUSE_MAX_GROUPS,
  };
}

function buildScopedResult(data, plan, datasetContext, path = [], overrides = {}) {
  const scopeFilters = buildScopeFilters(plan, path);
  return applyPlan(
    data,
    buildScopedPlan(plan, scopeFilters, overrides),
    datasetContext
  );
}

function findChartRow(rows = [], value) {
  const token = normalizeToken(value);
  return rows.find((row) => normalizeToken(row?.name) === token) || null;
}

function findDominantRow(rows = []) {
  if (!rows.length) {
    return null;
  }

  return rows.reduce((best, current) => {
    if (!best) {
      return current;
    }

    return toMagnitude(current.value) > toMagnitude(best.value) ? current : best;
  }, null);
}

function buildRootHeadline(node, plan) {
  if (!node.field) {
    return "This is the current result in scope.";
  }

  if (plan.intent?.wantsLowest) {
    return `${node.label} is the weakest current ${node.fieldLabel.toLowerCase()}.`;
  }

  if (plan.intent?.wantsHighest || plan.intent?.asksDistribution) {
    return `${node.label} is the strongest current contributor.`;
  }

  if (plan.groupBy === node.field) {
    return `${node.label} is the focal segment for this answer.`;
  }

  return `${node.label} is the current segment in focus.`;
}

function buildRootExplanation(node, plan, metricLabel) {
  if (!node.field) {
    return `The current answer is based on ${node.recordCount} matching rows and ${metricLabel.toLowerCase()} of ${node.metricDisplayValue}.`;
  }

  const parts = [
    `${node.label} contributes ${node.shareOfParentLabel} of the scoped ${metricLabel.toLowerCase()}.`,
  ];

  if (Number.isFinite(node.deviationFromAveragePct)) {
    const direction = node.deviationFromAveragePct >= 0 ? "above" : "below";
    parts.push(
      `Its result is ${Math.abs(node.deviationFromAveragePct).toFixed(1)}% ${direction} the peer average.`
    );
  }

  parts.push(`This slice contains ${node.recordCount} matching rows.`);

  return parts.join(" ");
}

function buildDriverHeadline(node) {
  return `${node.label} is the strongest contributor within ${node.parentLabel}.`;
}

function buildDriverExplanation(node, metricLabel) {
  const parts = [
    `${node.label} accounts for ${node.shareOfParentLabel} of ${node.parentLabel}'s ${metricLabel.toLowerCase()}.`,
  ];

  if (Number.isFinite(node.shareDeltaPct)) {
    const direction = node.shareDeltaPct >= 0 ? "higher" : "lower";
    parts.push(
      `That share is ${Math.abs(node.shareDeltaPct).toFixed(1)} points ${direction} than in ${node.referenceLabel}.`
    );
  }

  parts.push(`It is backed by ${node.recordCount} matching rows in the current slice.`);

  return parts.join(" ");
}

function chooseInitialTarget(result, plan, datasetContext) {
  const rows = result?.chartData || [];

  if (!plan.groupBy || rows.length < 2) {
    return null;
  }

  if (plan.groupBy === datasetContext?.primaryDateField && rows.length > 0) {
    return rows[rows.length - 1];
  }

  if (plan.intent?.wantsLowest && result?.summary?.bottomPoint) {
    return result.summary.bottomPoint;
  }

  if (result?.summary?.topPoint) {
    return result.summary.topPoint;
  }

  return rows[0] || null;
}

function buildInitialPath({ plan, result, datasetContext, metricLabel }) {
  const target = chooseInitialTarget(result, plan, datasetContext);

  if (!target) {
    const totalValue =
      plan.aggregation === "count" && plan.metricField === "records"
        ? result.summary.recordCount
        : result.summary.totalValue;
    const overallNode = {
      id: buildNodeId(null, "current-result", 0),
      level: 0,
      field: null,
      fieldLabel: "Current Result",
      value: null,
      label: "Current Result",
      metricField: plan.metricField,
      metricLabel,
      metricValue: roundValue(totalValue),
      metricDisplayValue: formatValue(roundValue(totalValue)),
      recordCount: result.summary.recordCount,
      shareOfParent: 1,
      shareOfParentLabel: "100%",
      shareOfReference: null,
      shareOfReferenceLabel: null,
      shareDeltaPct: null,
      deviationFromAveragePct: null,
      parentLabel: "the current scope",
      referenceLabel: "the current scope",
      headline: "This is the current result in scope.",
      explanation: `The current answer is based on ${result.summary.recordCount} matching rows and ${metricLabel.toLowerCase()} of ${formatValue(roundValue(totalValue))}.`,
      isRoot: true,
    };

    return [overallNode];
  }

  const magnitudeTotal = getMagnitudeTotal(result.chartData);
  const averageMagnitude =
    result.chartData.length > 0 ? magnitudeTotal / result.chartData.length : 0;
  const shareOfParent = magnitudeTotal
    ? toMagnitude(target.value) / magnitudeTotal
    : 0;
  const deviationFromAverage =
    averageMagnitude > 0
      ? ((toMagnitude(target.value) - averageMagnitude) / averageMagnitude) * 100
      : null;
  const node = {
    id: buildNodeId(plan.groupBy, target.name, 0),
    level: 0,
    field: plan.groupBy,
    fieldLabel: humanize(plan.groupBy),
    value: target.name,
    label: String(target.name),
    metricField: plan.metricField,
    metricLabel,
    metricValue: roundValue(target.value),
    metricDisplayValue: formatValue(roundValue(target.value)),
    recordCount: countRowsByField(result.filteredRows, plan.groupBy, target.name),
    shareOfParent,
    shareOfParentLabel: formatPercent(shareOfParent),
    shareOfReference: shareOfParent,
    shareOfReferenceLabel: formatPercent(shareOfParent),
    shareDeltaPct: null,
    deviationFromAveragePct: Number.isFinite(deviationFromAverage)
      ? Number(deviationFromAverage.toFixed(1))
      : null,
    parentLabel: "the current scope",
    referenceLabel: "the current scope",
    headline: "",
    explanation: "",
    isRoot: true,
  };

  node.headline = buildRootHeadline(node, plan);
  node.explanation = buildRootExplanation(node, plan, metricLabel);

  return [node];
}

function buildReferencePath(path = []) {
  if (!path.length) {
    return [];
  }

  return path.slice(0, -1);
}

function buildDriverNode({
  plan,
  metricLabel,
  parentNode,
  referencePath,
  candidateField,
  currentResult,
  referenceResult,
  dominantRow,
}) {
  const currentMagnitudeTotal = getMagnitudeTotal(currentResult.chartData);
  const referenceMagnitudeTotal = getMagnitudeTotal(referenceResult.chartData);
  const referenceRow = findChartRow(referenceResult.chartData, dominantRow.name);
  const shareOfParent = currentMagnitudeTotal
    ? toMagnitude(dominantRow.value) / currentMagnitudeTotal
    : 0;
  const shareOfReference =
    referenceRow && referenceMagnitudeTotal
      ? toMagnitude(referenceRow.value) / referenceMagnitudeTotal
      : 0;
  const shareDeltaPct = (shareOfParent - shareOfReference) * 100;
  const level = parentNode.level + 1;
  const node = {
    id: buildNodeId(candidateField, dominantRow.name, level),
    level,
    field: candidateField,
    fieldLabel: humanize(candidateField),
    value: dominantRow.name,
    label: String(dominantRow.name),
    metricField: plan.metricField,
    metricLabel,
    metricValue: roundValue(dominantRow.value),
    metricDisplayValue: formatValue(roundValue(dominantRow.value)),
    recordCount: countRowsByField(
      currentResult.filteredRows,
      candidateField,
      dominantRow.name
    ),
    shareOfParent,
    shareOfParentLabel: formatPercent(shareOfParent),
    shareOfReference,
    shareOfReferenceLabel: formatPercent(shareOfReference),
    shareDeltaPct: Number.isFinite(shareDeltaPct)
      ? Number(shareDeltaPct.toFixed(1))
      : null,
    parentLabel: parentNode.label,
    referenceLabel:
      referencePath.length > 0
        ? referencePath[referencePath.length - 1].label
        : "the broader scope",
    headline: "",
    explanation: "",
    isRoot: false,
  };

  node.headline = buildDriverHeadline(node);
  node.explanation = buildDriverExplanation(node, metricLabel);

  return node;
}

function buildBreakdownTitle(metricLabel, candidateField, parentNode) {
  const scopeLabel = parentNode?.label || "the current scope";
  return `${metricLabel} by ${humanize(candidateField)} within ${scopeLabel}`;
}

function scoreCandidate(currentResult, referenceResult, dominantRow) {
  if (!dominantRow) {
    return -Infinity;
  }

  const currentMagnitudeTotal = getMagnitudeTotal(currentResult.chartData);
  const referenceMagnitudeTotal = getMagnitudeTotal(referenceResult.chartData);
  const referenceRow = findChartRow(referenceResult.chartData, dominantRow.name);
  const shareOfParent = currentMagnitudeTotal
    ? toMagnitude(dominantRow.value) / currentMagnitudeTotal
    : 0;
  const shareOfReference =
    referenceRow && referenceMagnitudeTotal
      ? toMagnitude(referenceRow.value) / referenceMagnitudeTotal
      : 0;
  const secondRow = [...currentResult.chartData]
    .filter((row) => row?.name !== dominantRow.name)
    .sort((left, right) => toMagnitude(right.value) - toMagnitude(left.value))[0];
  const dominanceGap =
    secondRow && toMagnitude(dominantRow.value) > 0
      ? (toMagnitude(dominantRow.value) - toMagnitude(secondRow.value)) /
        toMagnitude(dominantRow.value)
      : 0;

  return shareOfParent * 0.7 + Math.max(shareOfParent - shareOfReference, 0) * 0.2 + dominanceGap * 0.1;
}

function findNextDriver({ data, plan, datasetContext, path, metricLabel }) {
  const parentNode = path[path.length - 1] || null;
  const remainingDimensions = getRemainingDimensions(datasetContext, path);

  if (!remainingDimensions.length) {
    return null;
  }

  const referencePath = buildReferencePath(path);
  let bestCandidate = null;

  for (const dimension of remainingDimensions) {
    const currentResult = buildScopedResult(data, plan, datasetContext, path, {
      groupBy: dimension.field,
      limit: ROOT_CAUSE_MAX_GROUPS,
    });

    if (!currentResult.chartData.length || currentResult.chartData.length < 2) {
      continue;
    }

    const dominantRow = findDominantRow(currentResult.chartData);

    if (!dominantRow) {
      continue;
    }

    const referenceResult = buildScopedResult(
      data,
      plan,
      datasetContext,
      referencePath,
      {
        groupBy: dimension.field,
        limit: ROOT_CAUSE_MAX_GROUPS,
      }
    );
    const score = scoreCandidate(currentResult, referenceResult, dominantRow);

    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = {
        field: dimension.field,
        fieldLabel: dimension.label || humanize(dimension.field),
        currentResult,
        referenceResult,
        dominantRow,
        score,
      };
    }
  }

  if (!bestCandidate) {
    return null;
  }

  const node = buildDriverNode({
    plan,
    metricLabel,
    parentNode,
    referencePath,
    candidateField: bestCandidate.field,
    currentResult: bestCandidate.currentResult,
    referenceResult: bestCandidate.referenceResult,
    dominantRow: bestCandidate.dominantRow,
  });

  return {
    node,
    breakdown: {
      title: buildBreakdownTitle(metricLabel, bestCandidate.field, parentNode),
      type: "bar",
      data: bestCandidate.currentResult.chartData.slice(0, ROOT_CAUSE_PREVIEW_LIMIT),
      dimensionField: bestCandidate.field,
      dimensionLabel: bestCandidate.fieldLabel,
      metricLabel,
      scopeLabel: parentNode?.label || "Current Result",
      summary: {
        recordCount: bestCandidate.currentResult.summary.recordCount,
        pointCount: bestCandidate.currentResult.summary.pointCount,
        totalValue: bestCandidate.currentResult.summary.totalValue,
      },
    },
  };
}

function normalizePath(path = [], datasetContext) {
  if (!Array.isArray(path)) {
    return [];
  }

  return path
    .map((node, index) => {
      if (!node || typeof node !== "object") {
        return null;
      }

      if (!node.field) {
        if (index !== 0) {
          return null;
        }

        return {
          ...node,
          id: node.id || buildNodeId(null, "current-result", 0),
          level: 0,
          field: null,
          fieldLabel: "Current Result",
          value: null,
          label: node.label || "Current Result",
          isRoot: true,
        };
      }

      const fieldMeta = getDimensionMetadata(datasetContext, node.field);

      if (!fieldMeta || node.value === undefined || node.value === null || node.value === "") {
        return null;
      }

      return {
        ...node,
        id: node.id || buildNodeId(node.field, node.value, index),
        level: index,
        field: fieldMeta.field,
        fieldLabel: fieldMeta.label || humanize(fieldMeta.field),
        value: node.value,
        label: String(node.value),
        isRoot: index === 0,
      };
    })
    .filter(Boolean);
}

function buildDrillSummary(path, nextNode) {
  const targetNode = nextNode || path[path.length - 1];

  if (!targetNode) {
    return "No additional drill-down path is available for this result.";
  }

  return `${targetNode.label} is the latest drill-down contributor in the current explanation path.`;
}

export function buildRootCauseConfig({ question, plan, datasetContext }) {
  const normalizedPlan = normalizeRootCausePlan(plan);
  const remainingDimensions = getRemainingDimensions(datasetContext, []);
  const available =
    remainingDimensions.length > 0 && Boolean(normalizedPlan.metricField);

  return {
    available,
    buttonLabel: "Root Cause Analysis",
    summary: available
      ? "Explain why this result happened by drilling into the strongest contributing dimensions."
      : "No additional root-cause drill-down is available for this result.",
    request: {
      question,
      plan: normalizedPlan,
    },
    remainingDimensions: remainingDimensions.map((dimension) => ({
      field: dimension.field,
      label: dimension.label || humanize(dimension.field),
    })),
  };
}

export function buildRootCauseAnalysis({
  data,
  question,
  basePlan,
  datasetContext,
  path = [],
}) {
  const plan = normalizeRootCausePlan(basePlan);
  const metricLabel = buildMetricLabel(plan);
  const normalizedPath = normalizePath(path, datasetContext);
  const initialPath =
    normalizedPath.length > 0
      ? normalizedPath
      : buildInitialPath({
          plan,
          result: buildScopedResult(data, plan, datasetContext, [], {
            groupBy: plan.groupBy,
            sortBy: plan.sortBy || "name",
            sortDirection: plan.sortDirection || "asc",
            limit: ROOT_CAUSE_MAX_GROUPS,
          }),
          datasetContext,
          metricLabel,
        });

  const nextDriver = findNextDriver({
    data,
    plan,
    datasetContext,
    path: initialPath,
    metricLabel,
  });
  const fullPath = nextDriver ? [...initialPath, nextDriver.node] : initialPath;
  const deeperDriver = nextDriver
    ? findNextDriver({
        data,
        plan,
        datasetContext,
        path: fullPath,
        metricLabel,
      })
    : null;

  return {
    available: true,
    title: "Root Cause Analysis",
    summary: buildDrillSummary(fullPath, nextDriver?.node),
    path: fullPath,
    currentNode: nextDriver?.node || fullPath[fullPath.length - 1] || null,
    breakdown: nextDriver?.breakdown || null,
    canDrillDown: Boolean(deeperDriver),
    remainingDimensions: getRemainingDimensions(datasetContext, fullPath).map(
      (dimension) => ({
        field: dimension.field,
        label: dimension.label || humanize(dimension.field),
      })
    ),
    exhaustedReason: deeperDriver
      ? null
      : "No additional dimensions are available for a deeper drill-down.",
    buttonLabel: deeperDriver ? "Why again?" : "No deeper drill-down",
    question,
    metricLabel,
  };
}
