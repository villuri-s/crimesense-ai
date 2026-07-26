export default function WorkspaceSidebar({
  activeView,
  sections = [],
  onSelectView,
  sidebarOpen,
  onToggle,
}) {
  return (
    <aside className={sidebarOpen ? "sidebar open workspace-sidebar" : "sidebar closed workspace-sidebar"}>
      <div className="sidebar-header workspace-sidebar-header">
        {sidebarOpen ? (
          <>
            <div className="workspace-sidebar-brand">
              <span className="workspace-sidebar-mark">🔍</span>
              <div>
                <h2>CrimeSense AI</h2>
                <p className="sidebar-subtitle">Crime Intelligence Platform</p>
              </div>
            </div>
            <button
              className="icon-button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <span className="sidebar-toggle-mark">||</span>
            </button>
          </>
        ) : (
          <button
            className="icon-button collapsed"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <span className="sidebar-toggle-mark">||</span>
          </button>
        )}
      </div>

      <nav className="workspace-nav" aria-label="Workspace sections">
        {sections.map((section) => (
          <div key={section.label} className="workspace-nav-section">
            {sidebarOpen ? (
              <div className="workspace-nav-section-title">{section.label}</div>
            ) : null}

            <div className="workspace-nav-section-items">
              {section.items.map((item) => {
                const Icon = item.icon;
                const selected = item.id === activeView;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={selected ? "workspace-nav-item active" : "workspace-nav-item"}
                    onClick={() => onSelectView(item.id)}
                    title={item.label}
                  >
                    <span className="workspace-nav-icon">
                      <Icon size={17} />
                    </span>
                    {sidebarOpen ? (
                      <span className="workspace-nav-copy">
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
