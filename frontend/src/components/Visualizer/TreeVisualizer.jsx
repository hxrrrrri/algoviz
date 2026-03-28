import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { flattenValue } from '../../utils/vizMapper';
import './TreeVisualizer.css';

const NODE_R  = 22;
const H_GAP   = 52;   // horizontal spacing between sibling subtrees
const V_GAP   = 68;   // vertical spacing between levels

/* ── Parse safe_repr into a plain tree ── */
function parseNode(repr, depth = 0, maxDepth = 9) {
  if (!repr || depth > maxDepth) return null;
  if (repr.type === 'none' || repr.type === 'ellipsis') return null;
  if (repr.type !== 'object') return null;

  const attrs = repr.attrs || {};
  const valRepr = attrs.val ?? attrs.value ?? attrs.data ?? attrs.key ?? null;
  const val = valRepr ? String(flattenValue(valRepr) ?? '?') : '?';

  return {
    val,
    left:  parseNode(attrs.left,  depth + 1, maxDepth),
    right: parseNode(attrs.right, depth + 1, maxDepth),
    // extra fields assigned later
    x: 0, y: depth * V_GAP,
  };
}

/* ── In-order traversal to assign X coordinates ── */
function assignX(node, counter) {
  if (!node) return;
  assignX(node.left, counter);
  node.x = counter.v * H_GAP;
  counter.v += 1;
  assignX(node.right, counter);
}

/* ── Collect all nodes flat ── */
function collectNodes(node, arr = []) {
  if (!node) return arr;
  arr.push(node);
  collectNodes(node.left, arr);
  collectNodes(node.right, arr);
  return arr;
}

/* ── Collect all edges ── */
function collectEdges(node, arr = []) {
  if (!node) return arr;
  if (node.left)  arr.push({ x1: node.x, y1: node.y, x2: node.left.x,  y2: node.left.y  });
  if (node.right) arr.push({ x1: node.x, y1: node.y, x2: node.right.x, y2: node.right.y });
  collectEdges(node.left, arr);
  collectEdges(node.right, arr);
  return arr;
}

/* ── Main visualizer ── */
export default function TreeVisualizer({ name, repr }) {
  const layout = useMemo(() => {
    const root = parseNode(repr);
    if (!root) return null;

    // Assign Y by depth via DFS
    function setY(node, depth) {
      if (!node) return;
      node.y = depth * V_GAP;
      setY(node.left,  depth + 1);
      setY(node.right, depth + 1);
    }
    setY(root, 0);

    // Assign X via in-order traversal
    const counter = { v: 0 };
    assignX(root, counter);

    const nodes = collectNodes(root);
    const edges = collectEdges(root);

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    // Shift so minX = 0
    nodes.forEach(n => { n.x -= minX; });
    edges.forEach(e => { e.x1 -= minX; e.x2 -= minX; });

    const svgW = maxX - minX + NODE_R * 4;
    const svgH = maxY + NODE_R * 4;

    return { nodes, edges, svgW, svgH };
  }, [repr]);

  if (!layout) return null;
  const { nodes, edges, svgW, svgH } = layout;
  const pad = NODE_R * 2;

  return (
    <div className="tv">
      <div className="tv-label">
        <span className="tv-name">{name}</span>
        <span className="tv-type-badge">TreeNode</span>
        <span className="tv-count">{nodes.length} nodes</span>
      </div>

      <div className="tv-scroll">
        <svg
          width={svgW + pad * 2}
          height={svgH + pad * 2}
          viewBox={`${-pad} ${-pad} ${svgW + pad * 2} ${svgH + pad * 2}`}
          className="tv-svg"
        >
          {/* Edge lines drawn first (behind nodes) */}
          {edges.map((e, i) => (
            <line key={i}
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              className="tv-edge"
            />
          ))}

          {/* Nodes */}
          {nodes.map((n, i) => (
            <motion.g key={i}
              transform={`translate(${n.x},${n.y})`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28, delay: i * 0.025 }}
            >
              {/* Glow ring */}
              <circle r={NODE_R + 3} className="tv-node-glow" />
              {/* Node circle */}
              <circle r={NODE_R} className="tv-node" />
              {/* Value text */}
              <text
                textAnchor="middle"
                dominantBaseline="central"
                className="tv-node-val"
              >
                {n.val.length > 4 ? n.val.slice(0, 4) : n.val}
              </text>
            </motion.g>
          ))}
        </svg>
      </div>
    </div>
  );
}