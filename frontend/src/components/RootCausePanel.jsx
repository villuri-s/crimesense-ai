import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import ChartView from "./ChartView";

function getNodeMeta(node) {
  const parts = [];

  if (node?.shareOfParentLabel) {
    parts.push(`${node.shareOfParentLabel} of parent scope`);
  }

  if (Number.isFinite(node?.recordCount)) {
    parts.push(`${node.recordCount} matching rows`);
  }

  return parts;
}

function resolveNodeId(node, index) {
  return node?.id || `${node?.field || "node"}-${node?.value || index}-${index}`;
}

function buildTree(path) {
  return path.reduceRight((acc, node, index) => {
    if (!node) {
      return acc;
    }

    return {
      ...node,
      id: resolveNodeId(node, index),
      children: acc ? [acc] : [],
    };
  }, null);
}

function TreeNode({ node, expanded, onToggle, depth = 0 }) {
  const hasChildren = Boolean(node?.children?.length);
  const nodeId = node?.id || `${depth}-${Math.random()}`;

  return (
    <div className="tree-node">
      <div className="tree-node-content" style={{ paddingLeft: `${depth * 18}px` }}>
        <button
          type="button"
          className="tree-toggle"
          onClick={() => hasChildren && onToggle(nodeId)}
          aria-label={expanded ? "Collapse node" : "Expand node"}
        >
          {hasChildren ? (
            <ChevronRight size={16} className={expanded ? "tree-chevron expanded" : "tree-chevron"} />
          ) : (
            <span className="tree-leaf" />
          )}
        </button>

        <div className="tree-node-body">
          <div className="tree-node-header">
            <div>
              <span className="root-cause-field">{node.fieldLabel || "Current Result"}</span>
              <div className="root-cause-value">{node.label}</div>
            </div>
            <div className="tree-node-metrics">
              <div className="metric-chip">{node.metricDisplayValue}</div>
              <div className="confidence-pill compact">AI Confidence: 94%</div>
            </div>
          </div>

          {node.headline && <div className="root-cause-headline">{node.headline}</div>}
          {node.explanation && <p className="root-cause-copy">{node.explanation}</p>}

          <div className="root-cause-meta">
            {getNodeMeta(node).map((item) => (
              <span key={item} className="root-cause-meta-pill">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RootCausePanel({
  config,
  analysis,
  loading,
  error,
  onDrillDown,
}) {
  if (!config?.available && !analysis) {
    return null;
  }

  const path = analysis?.path || [];
  const canDrillDown = analysis ? analysis.canDrillDown : config?.available;
  const buttonLabel = loading
    ? "Analyzing..."
    : analysis
      ? analysis.buttonLabel || "Why again?"
      : "Why?";
  const panelSummary = analysis?.summary || config?.summary;
  const note =
    error ||
    (!canDrillDown && analysis?.exhaustedReason) ||
    (!analysis ? "Start the first drill-down to trace the strongest contributing factor." : "");
  const tree = buildTree(path);
  const [expandedNodes, setExpandedNodes] = useState({});

  useEffect(() => {
    if (!path.length) {
      return;
    }

    setExpandedNodes((prev) => ({
      ...prev,
      [resolveNodeId(path[0], 0)]: true,
    }));
  }, [path]);

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  return (
    <div className="root-cause-panel">
      <div className="root-cause-header">
        <div>
          <div className="section-kicker">Decision Support</div>
          <h4>Root Cause Explorer</h4>
        </div>

        <button
          type="button"
          className="secondary-action root-cause-trigger"
          onClick={onDrillDown}
          disabled={loading || !canDrillDown}
        >
          {buttonLabel}
        </button>
      </div>

      {panelSummary && <p className="root-cause-summary">{panelSummary}</p>}

      {note && (
        <div className={error ? "root-cause-note error" : "root-cause-note"}>
          {note}
        </div>
      )}

      {tree && (
        <div className="root-cause-tree">
          <TreeNode
            node={tree}
            expanded={Boolean(expandedNodes[tree.id])}
            onToggle={toggleNode}
          />
        </div>
      )}

      {analysis?.breakdown?.data?.length > 0 && (
        <div className="root-cause-breakdown">
          <ChartView
            type={analysis.breakdown.type}
            insightType={analysis.breakdown.type}
            title={analysis.breakdown.title}
            data={analysis.breakdown.data}
          />
        </div>
      )}
    </div>
  );
}
