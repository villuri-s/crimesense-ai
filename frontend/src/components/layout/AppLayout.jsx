export default function AppLayout({ sidebar, topbar, children }) {
  return (
    <div className="layout workspace-layout-shell">
      {sidebar}
      <main className="main workspace-main">
        <div className="card workspace-shell">
          {topbar}
          <div className="workspace-body">{children}</div>
        </div>
      </main>
    </div>
  );
}
