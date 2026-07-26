export default function TopNavigation({
  title,
  description,
  workspace,
  datasetMeta,
  datasetOptions = [],
  activeDatasetId,
  onDatasetChange,
}) {
  return (
    <header className="top-nav workspace-top-nav">
      <div className="workspace-page-heading">
        <div className="section-kicker">Crime Intelligence Platform</div>
        <div className="workspace-page-title">{title}</div>
        <div className="workspace-page-subtitle">{description}</div>
      </div>

      <div className="header-dataset-cluster">
        <div className="dataset-header-card">
          <div className="dataset-header-top">
            <span className="dataset-header-label">Current Dataset</span>
            <select
              className="dataset-switcher-select"
              value={activeDatasetId}
              onChange={(event) => onDatasetChange?.(event.target.value)}
            >
              {datasetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <strong className="dataset-header-name">
            {workspace?.source?.label || "No dataset loaded"}
          </strong>
          <div className="dataset-header-meta">{datasetMeta}</div>
        </div>
      </div>
    </header>
  );
}
