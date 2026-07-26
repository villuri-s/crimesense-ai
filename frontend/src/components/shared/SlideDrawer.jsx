import { X } from "lucide-react";

export default function SlideDrawer({
  open,
  title,
  subtitle,
  children,
  onClose,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="drawer-layer" role="presentation">
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside className="slide-drawer" aria-modal="true" role="dialog">
        <div className="slide-drawer-header">
          <div>
            <div className="section-kicker">Workspace Drawer</div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button drawer-close-button"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="slide-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
