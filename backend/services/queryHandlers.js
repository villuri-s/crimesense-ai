import { getFieldMetadata, normalizeToken } from "./schemaService.js";

function toComparable(fieldMeta, value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (fieldMeta?.kind === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return value;
}

function compareText(left, right) {
  return normalizeToken(left) === normalizeToken(right);
}

function compareValues(left, right) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left ?? "").localeCompare(String(right ?? ""));
}

export function applyFilters(rows, filters = [], schema) {
  return rows.filter((row) =>
    filters.every((filter) => {
      const fieldMeta = getFieldMetadata(schema, filter.field);
      const actual = toComparable(fieldMeta, row?.[filter.field]);
      const expected = Array.isArray(filter.value)
        ? filter.value.map((value) => toComparable(fieldMeta, value))
        : toComparable(fieldMeta, filter.value);

      switch (filter.operator) {
        case "equals":
          return Array.isArray(expected)
            ? expected.some((value) => compareText(actual, value))
            : compareText(actual, expected);
        case "in":
          return Array.isArray(expected)
            ? expected.some((value) => compareText(actual, value))
            : compareText(actual, expected);
        case "contains":
          return normalizeToken(actual).includes(normalizeToken(expected));
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
    })
  );
}

export function queryRows(rows, { filters = [], schema, limit = 10, fields = null } = {}) {
  const filteredRows = applyFilters(rows, filters, schema);
  const projectedRows = filteredRows.slice(0, limit).map((row) => {
    if (!Array.isArray(fields) || !fields.length) {
      return row;
    }

    return fields.reduce((result, field) => {
      result[field] = row?.[field] ?? null;
      return result;
    }, {});
  });

  return {
    status: "success",
    rows: projectedRows,
    filteredRows,
    totalMatches: filteredRows.length,
  };
}

export function queryEmployee(rows, { schema, field = "name", value, limit = 10, fields = null } = {}) {
  return queryRows(rows, {
    schema,
    limit,
    fields,
    filters: value
      ? [
          {
            field,
            operator: "equals",
            value,
          },
        ]
      : [],
  });
}

export function queryDepartment(rows, options = {}) {
  return queryRows(rows, options);
}

function getNumericValue(row, field) {
  const value = Number(row?.[field]);
  return Number.isFinite(value) ? value : null;
}

export function aggregateMetric(rows, metricField, aggregation = "sum") {
  const numericValues = rows
    .map((row) => getNumericValue(row, metricField))
    .filter((value) => Number.isFinite(value));

  if (!numericValues.length) {
    return null;
  }

  if (aggregation === "avg") {
    return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
  }

  if (aggregation === "min") {
    return Math.min(...numericValues);
  }

  if (aggregation === "max") {
    return Math.max(...numericValues);
  }

  if (aggregation === "median") {
    const sorted = [...numericValues].sort((left, right) => left - right);
    const midpoint = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint];
  }

  if (aggregation === "count") {
    return numericValues.length;
  }

  return numericValues.reduce((sum, value) => sum + value, 0);
}

export function queryAverage(rows, { schema, metricField, filters = [], groupBy = null } = {}) {
  const filteredRows = applyFilters(rows, filters, schema);

  if (!groupBy) {
    return {
      status: "success",
      value: aggregateMetric(filteredRows, metricField, "avg"),
      rows: [],
      filteredRows,
    };
  }

  return queryGroupedAggregation(rows, {
    schema,
    filters,
    metricField,
    aggregation: "avg",
    groupBy,
    limit: 12,
    sortDirection: "desc",
  });
}

export function queryGroupedAggregation(
  rows,
  {
    schema,
    filters = [],
    metricField,
    aggregation = "sum",
    groupBy,
    limit = 12,
    sortDirection = "desc",
  } = {}
) {
  const filteredRows = applyFilters(rows, filters, schema);
  const groups = new Map();

  for (const row of filteredRows) {
    const key = row?.[groupBy] ?? "Unknown";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(row);
  }

  const groupedRows = [...groups.entries()]
    .map(([name, groupRows]) => ({
      name: String(name),
      value:
        metricField === "records"
          ? groupRows.length
          : aggregateMetric(groupRows, metricField, aggregation),
      count: groupRows.length,
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort((left, right) =>
      sortDirection === "asc"
        ? left.value - right.value
        : right.value - left.value
    )
    .slice(0, limit);

  return {
    status: "success",
    rows: groupedRows,
    filteredRows,
    totalMatches: filteredRows.length,
  };
}

export function queryTop(
  rows,
  {
    schema,
    filters = [],
    metricField,
    groupBy = null,
    aggregation = "sum",
    limit = 5,
  } = {}
) {
  if (groupBy) {
    return queryGroupedAggregation(rows, {
      schema,
      filters,
      metricField,
      aggregation,
      groupBy,
      limit,
      sortDirection: "desc",
    });
  }

  const filteredRows = applyFilters(rows, filters, schema);
  const sortedRows = [...filteredRows]
    .filter((row) => Number.isFinite(getNumericValue(row, metricField)))
    .sort((left, right) => getNumericValue(right, metricField) - getNumericValue(left, metricField))
    .slice(0, limit);

  return {
    status: "success",
    rows: sortedRows,
    filteredRows,
    totalMatches: filteredRows.length,
  };
}

export function queryBottom(
  rows,
  {
    schema,
    filters = [],
    metricField,
    groupBy = null,
    aggregation = "sum",
    limit = 5,
  } = {}
) {
  if (groupBy) {
    return queryGroupedAggregation(rows, {
      schema,
      filters,
      metricField,
      aggregation,
      groupBy,
      limit,
      sortDirection: "asc",
    });
  }

  const filteredRows = applyFilters(rows, filters, schema);
  const sortedRows = [...filteredRows]
    .filter((row) => Number.isFinite(getNumericValue(row, metricField)))
    .sort((left, right) => getNumericValue(left, metricField) - getNumericValue(right, metricField))
    .slice(0, limit);

  return {
    status: "success",
    rows: sortedRows,
    filteredRows,
    totalMatches: filteredRows.length,
  };
}

export function queryComparison(
  rows,
  {
    schema,
    filters = [],
    metricField,
    groupBy,
    aggregation = "sum",
    limit = 12,
  } = {}
) {
  return queryGroupedAggregation(rows, {
    schema,
    filters,
    metricField,
    aggregation,
    groupBy,
    limit,
    sortDirection: "desc",
  });
}

export function queryRevenue(rows, options = {}) {
  return queryTop(rows, {
    ...options,
    metricField: options.metricField || "revenue",
  });
}

export function querySalary(rows, options = {}) {
  return queryTop(rows, {
    ...options,
    metricField: options.metricField || "salary",
  });
}
