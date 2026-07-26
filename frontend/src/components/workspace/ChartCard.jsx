import ChartView from "../ChartView";

export default function ChartCard({
  response,
  title,
  onOpenDetails,
  onExplain,
  onDrillDown,
  onExport,
  onShare,
  showExplain,
  showDrillDown,
  showExport,
  showShare,
}) {
  if (!response?.data?.length) {
    return (
      <div className="empty-state">
        Ask a question to generate a chart, table, and drill-down ready analysis.
      </div>
    );
  }

  return (
    <div className="chart-card-shell">
      <ChartView
        type={response.type}
        insightType={response.insightType}
        title={title || response.title}
        data={response.data}
        onOpen={onOpenDetails}
        onExplain={onExplain}
        onDrillDown={onDrillDown}
        onExport={onExport}
        onShare={onShare}
        showExplain={showExplain}
        showDrillDown={showDrillDown}
        showExport={showExport}
        showShare={showShare}
      />
    </div>
  );
}
