import { Download, FileText, Presentation, Share2 } from "lucide-react";

const DEFAULT_ACTIONS = [
  { id: "pdf", label: "Download PDF", icon: FileText },
  { id: "ppt", label: "Export PPT", icon: Presentation },
  { id: "csv", label: "Export Data", icon: Download },
  { id: "share", label: "Share", icon: Share2 },
];

export default function ExportMenu({ actions = DEFAULT_ACTIONS, onAction }) {
  return (
    <div className="export-menu">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.id}
            type="button"
            className="chart-toolbar-button"
            onClick={() => onAction?.(action.id)}
          >
            <Icon size={14} />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
