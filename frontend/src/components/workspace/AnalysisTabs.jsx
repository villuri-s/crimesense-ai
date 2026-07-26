export default function AnalysisTabs({
  tabs = [],
  activeTab,
  onChange,
}) {
  return (
    <div className="analysis-tabs-shell">
      <div className="analysis-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? "analysis-tab active" : "analysis-tab"}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
