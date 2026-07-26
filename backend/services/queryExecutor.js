import { applyPlan } from "./analytics.js";
import {
  aggregateMetric,
  applyFilters,
  queryAverage,
  queryBottom,
  queryComparison,
  queryDepartment,
  queryEmployee,
  queryRevenue,
  queryRows,
  querySalary,
  queryTop,
} from "./queryHandlers.js";
import { getDimensionFields, humanize } from "./schemaService.js";

function roundValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function chooseRowLabelField(schema) {
  const preferredFields = ["name", "employee", "owner", "department", "team", "region"];
  const dimensions = getDimensionFields(schema);

  for (const field of preferredFields) {
    const match = dimensions.find((item) => item.field === field);

    if (match) {
      return match.field;
    }
  }

  return dimensions[0]?.field || null;
}

function buildGroupedSummary(rows, title, filteredRows) {
  const numericRows = rows.filter((row) => Number.isFinite(Number(row?.value)));
  const rankedRows = [...numericRows].sort((left, right) => right.value - left.value);
  const totalValue = rankedRows.reduce((sum, row) => sum + row.value, 0);

  return {
    title,
    recordCount: filteredRows.length,
    pointCount: rows.length,
    totalValue: roundValue(totalValue),
    averageValue: rows.length ? roundValue(totalValue / rows.length) : null,
    topPoint: rankedRows[0] || null,
    bottomPoint: rankedRows[rankedRows.length - 1] || null,
  };
}

function projectSelectedFields(rows, selectedFields) {
  if (!Array.isArray(selectedFields) || !selectedFields.length) {
    return rows;
  }

  return rows.map((row) =>
    selectedFields.reduce((result, field) => {
      result[field] = row?.[field] ?? null;
      return result;
    }, {})
  );
}

function executeAnalyticsPlan(rows, schema, plan) {
  const result = applyPlan(rows, plan.analyticsPlan, schema);
  const projectedRows =
    plan.executionType === "analytics_raw"
      ? projectSelectedFields(result.chartData, plan.selectedFields)
      : result.chartData;

  return {
    status: "success",
    rows: projectedRows,
    filteredRows: result.filteredRows,
    chartData: projectedRows,
    summary: result.summary,
    primaryRow: projectedRows[0] || null,
    primaryValue:
      plan.targetField && projectedRows[0]
        ? projectedRows[0][plan.targetField]
        : null,
  };
}

function executeScalarPlan(rows, schema, plan) {
  const filteredRows = applyFilters(rows, plan.filters, schema);
  const label = `${plan.aggregation.toUpperCase()} ${humanize(plan.metricField)}`;
  let value = null;

  if (plan.aggregation === "avg") {
    value = queryAverage(rows, {
      schema,
      metricField: plan.metricField,
      filters: plan.filters,
    }).value;
  } else if (plan.aggregation === "count" || plan.metricField === "records") {
    value = filteredRows.length;
  } else {
    value = aggregateMetric(filteredRows, plan.metricField, plan.aggregation);
  }

  const chartData = Number.isFinite(value)
    ? [{ name: label, value: roundValue(value) }]
    : [];

  return {
    status: "success",
    rows: [],
    filteredRows,
    chartData,
    summary: buildGroupedSummary(chartData, label, filteredRows),
    primaryRow: null,
    primaryValue: roundValue(value),
  };
}

function buildRankingChartData(rows, schema, metricField) {
  const labelField = chooseRowLabelField(schema);

  return rows.map((row, index) => ({
    name:
      (labelField && String(row?.[labelField] ?? "").trim()) ||
      `Row ${index + 1}`,
    value: roundValue(Number(row?.[metricField])),
  }));
}

function executeRowRankingPlan(rows, schema, plan) {
  let result;

  if (plan.sortDirection === "asc") {
    result = queryBottom(rows, {
      schema,
      filters: plan.filters,
      metricField: plan.metricField,
      limit: plan.limit,
    });
  } else if (plan.metricField === "salary") {
    result = querySalary(rows, {
      schema,
      filters: plan.filters,
      metricField: plan.metricField,
      limit: plan.limit,
    });
  } else if (plan.metricField === "revenue") {
    result = queryRevenue(rows, {
      schema,
      filters: plan.filters,
      metricField: plan.metricField,
      limit: plan.limit,
    });
  } else {
    result = queryTop(rows, {
      schema,
      filters: plan.filters,
      metricField: plan.metricField,
      limit: plan.limit,
    });
  }

  const chartData =
    plan.chartType === "table"
      ? result.rows
      : buildRankingChartData(result.rows, schema, plan.metricField);
  const summaryRows =
    plan.chartType === "table"
      ? buildRankingChartData(result.rows, schema, plan.metricField)
      : chartData;

  return {
    status: "success",
    rows: result.rows,
    filteredRows: result.filteredRows,
    chartData,
    summary: buildGroupedSummary(
      summaryRows,
      `${humanize(plan.metricField)} ranking`,
      result.filteredRows
    ),
    primaryRow: result.rows[0] || null,
    primaryValue: result.rows[0]?.[plan.metricField] ?? null,
  };
}

export function executeQueryPlan({ rows, schema, plan }) {
  if (plan.executionType === "analytics_raw" || plan.executionType === "analytics_grouped") {
    return executeAnalyticsPlan(rows, schema, plan);
  }

  if (plan.executionType === "scalar_metric") {
    return executeScalarPlan(rows, schema, plan);
  }

  if (plan.executionType === "row_ranking") {
    return executeRowRankingPlan(rows, schema, plan);
  }

  if (plan.intentType === "comparison") {
    const result = queryComparison(rows, {
      schema,
      filters: plan.filters,
      metricField: plan.metricField,
      groupBy: plan.groupBy,
      aggregation: plan.aggregation,
      limit: plan.limit,
    });

    return {
      status: "success",
      rows: result.rows,
      filteredRows: result.filteredRows,
      chartData: result.rows,
      summary: buildGroupedSummary(
        result.rows,
        `${humanize(plan.metricField)} comparison`,
        result.filteredRows
      ),
      primaryRow: result.rows[0] || null,
      primaryValue: result.rows[0]?.value ?? null,
    };
  }

  const fallbackRows = queryRows(rows, {
    schema,
    filters: plan.filters,
    limit: plan.limit || 10,
  });
  const projectedRows =
    plan.entityMatch?.field === "name"
      ? queryEmployee(rows, {
          schema,
          field: plan.entityMatch.field,
          value: plan.entityMatch.value,
          limit: plan.limit || 10,
          fields: plan.selectedFields,
        }).rows
      : queryDepartment(rows, {
          schema,
          filters: plan.filters,
          limit: plan.limit || 10,
          fields: plan.selectedFields,
        }).rows;

  return {
    status: "success",
    rows: projectedRows,
    filteredRows: fallbackRows.filteredRows,
    chartData: projectedRows,
    summary: {
      title: "Matching Records",
      recordCount: fallbackRows.filteredRows.length,
      pointCount: projectedRows.length,
      totalValue: fallbackRows.filteredRows.length,
      averageValue: fallbackRows.filteredRows.length,
      topPoint: null,
      bottomPoint: null,
    },
    primaryRow: projectedRows[0] || null,
    primaryValue:
      plan.targetField && projectedRows[0]
        ? projectedRows[0][plan.targetField]
        : null,
  };
}
