function toTrendType(chartType) {
  return chartType === "trend" ? "trend" : chartType;
}

export function buildVisualizationPayload({ plan, result }) {
  return {
    type: toTrendType(plan.chartType || "table"),
    insightType: toTrendType(plan.chartType || "table"),
    requestedChart: plan.requestedChart || plan.chartType || "auto",
    data: Array.isArray(result?.chartData) ? result.chartData : [],
  };
}
