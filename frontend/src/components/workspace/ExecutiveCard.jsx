export default function ExecutiveCard({ title = "Executive Summary", children }) {
  return (
    <div className="sidebar-card executive-card">
      <div className="section-kicker">Executive Report</div>
      <h4>{title}</h4>
      <p className="copilot-copy">{children}</p>
    </div>
  );
}
