import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

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
  const nodeId = node?.id || `${depth}`;

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

          {node.headline ? <div className="root-cause-headline">{node.headline}</div> : null}
          {node.explanation ? <p className="root-cause-copy">{node.explanation}</p> : null}

          <div className="root-cause-meta">
            {getNodeMeta(node).map((item) => (
              <span key={item} className="root-cause-meta-pill">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {hasChildren && expanded ? (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={Boolean(expanded[child.id])}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function RootCauseTree({ path = [] }) {
  const tree = buildTree(path);
  const [expandedNodes, setExpandedNodes] = useState({});

  useEffect(() => {
    if (!path.length) {
      setExpandedNodes({});
      return;
    }

    setExpandedNodes((prev) => ({
      ...prev,
      [resolveNodeId(path[0], 0)]: true,
    }));
  }, [path]);

  if (!tree) {
    return null;
  }

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  return (
    <div className="root-cause-tree">
      <div className="root-cause-breadcrumb">
        {path.map((node, index) => (
          <span key={`${node.fieldLabel}-${index}`} className="root-cause-crumb">
            <span className="root-cause-crumb-label">{node.fieldLabel || node.label}</span>
            {index < path.length - 1 ? (
              <span className="root-cause-crumb-separator">/</span>
            ) : null}
          </span>
        ))}
      </div>

      <TreeNode
        node={tree}
        expanded={Boolean(expandedNodes[tree.id])}
        onToggle={toggleNode}
      />
    </div>
  );
}
