import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { flattenValue } from '../../utils/vizMapper';
import './TreeVisualizer.css';

const NODE_R = 26;
const H_STEP = 66;   // horizontal gap between adjacent in-order positions
const V_GAP  = 90;   // vertical gap between levels

/* ────────────────────────────────────────────────
   Parse safe_repr tree into a plain JS tree.
   Each node gets a "path" string (L/R from root)
   so we can detect newly-added nodes.
──────────────────────────────────────────────── */
function parseNode(repr, path = '', depth = 0, maxDepth = 12) {
  if (!repr || depth > maxDepth) return null;
  if (repr.type === 'none' || repr.type === 'ellipsis') return null;
  if (repr.type !== 'object') return null;

  const attrs = repr.attrs || {};
  const valRepr = attrs.val ?? attrs.value ?? attrs.data ?? attrs.key ?? null;
  const val = (valRepr !== null && valRepr !== undefined)
    ? String(flattenValue(valRepr) ?? '?')
    : '?';

  return {
    val,
    path,
    depth,
    left:  parseNode(attrs.left,  path + 'L', depth + 1, maxDepth),
    right: parseNode(attrs.right, path + 'R', depth + 1, maxDepth),
    x: 0,
    y: 0,
  };
}

/* In-order traversal → assign X positions */
function assignX(node, counter) {
  if (!node) return;
  assignX(node.left, counter);
  node.x = counter.v * H_STEP;
  counter.v += 1;
  assignX(node.right, counter);
}

/* Depth-first → assign Y positions */
function assignY(node, depth = 0) {
  if (!node) return;
  node.y = depth * V_GAP;
  assignY(node.left,  depth + 1);
  assignY(node.right, depth + 1);
}

/* Flatten tree to arrays */
function collectNodes(node, arr = []) {
  if (!node) return arr;
  arr.push(node);
  collectNodes(node.left,  arr);
  collectNodes(node.right, arr);
  return arr;
}

function collectEdges(node, arr = []) {
  if (!node) return arr;
  if (node.left)  arr.push({ px: node.x, py: node.y, cx: node.left.x,  cy: node.left.y,  dir: 'L', newChild: node.left.isNew  });
  if (node.right) arr.push({ px: node.x, py: node.y, cx: node.right.x, cy: node.right.y, dir: 'R', newChild: node.right.isNew });
  collectEdges(node.left,  arr);
  collectEdges(node.right, arr);
  return arr;
}

/* Build a Set of all node paths */
function pathSet(node, s = new Set()) {
  if (!node) return s;
  s.add(node.path);
  pathSet(node.left,  s);
  pathSet(node.right, s);
  return s;
}

/* ────────────────────────────────────────────────
   Null-leaf collector: positions where a null child
   would sit, so we can render them as hollow squares.
──────────────────────────────────────────────── */
function collectNullLeaves(node, arr = []) {
  if (!node) return arr;
  // Only show null markers for leaf nodes (both children null)
  if (!node.left && !node.right) return arr;
  if (!node.left) {
    // position null left child where it would be in a "full" tree
    const nx = node.x - H_STEP * 0.5;
    const ny = node.y + V_GAP;
    arr.push({ x: nx, y: ny, dir: 'L', parentX: node.x, parentY: node.y });
  }
  if (!node.right) {
    const nx = node.x + H_STEP * 0.5;
    const ny = node.y + V_GAP;
    arr.push({ x: nx, y: ny, dir: 'R', parentX: node.x, parentY: node.y });
  }
  collectNullLeaves(node.left,  arr);
  collectNullLeaves(node.right, arr);
  return arr;
}

/* Cubic bezier path for an edge */
function edgePath(px, py, cx, cy) {
  const midY = (py + cy) / 2;
  return `M ${px},${py + NODE_R} C ${px},${midY} ${cx},${midY} ${cx},${cy - NODE_R}`;
}

/* ────────────────────────────────────────────────
   Main component
──────────────────────────────────────────────── */
export default function TreeVisualizer({ name, repr, prevRepr }) {
  const layout = useMemo(() => {
    const root = parseNode(repr);
    if (!root) return null;

    const prevRoot = prevRepr ? parseNode(prevRepr) : null;
    const prevPaths = prevRoot ? pathSet(prevRoot) : new Set();

    assignY(root, 0);
    assignX(root, { v: 0 });

    const nodes = collectNodes(root);

    // Mark new nodes (appear in current but not prev trace step)
    const minX = Math.min(...nodes.map(n => n.x));
    const shiftX = -minX + NODE_R * 2;
    nodes.forEach(n => {
      n.x += shiftX;
      n.isNew = !prevPaths.has(n.path) && prevPaths.size > 0;
    });

    const edges     = collectEdges(root);
    const nullLeaves = collectNullLeaves(root);

    // Apply same shift to edges
    edges.forEach(e => { e.px += shiftX; e.cx += shiftX; });
    nullLeaves.forEach(n => { n.x += shiftX; n.parentX += shiftX; });

    const maxX = Math.max(...nodes.map(n => n.x));
    const maxY = Math.max(...nodes.map(n => n.y));

    return {
      nodes,
      edges,
      nullLeaves,
      svgW: maxX + NODE_R * 3,
      svgH: maxY + NODE_R * 3 + 20,
    };
  }, [repr, prevRepr]);

  if (!layout) return null;
  const { nodes, edges, nullLeaves, svgW, svgH } = layout;

  return (
    <div className="tv">
      {/* Header */}
      <div className="tv-label">
        <span className="tv-name">{name}</span>
        <span className="tv-type-badge">Binary Tree</span>
        <span className="tv-count">{nodes.length} nodes</span>
        {nodes.some(n => n.isNew) && (
          <motion.span className="tv-new-badge"
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
            +{nodes.filter(n => n.isNew).length} new
          </motion.span>
        )}
      </div>

      {/* SVG canvas */}
      <div className="tv-scroll">
        <svg
          width={svgW}
          height={svgH}
          className="tv-svg"
          style={{ minWidth: svgW }}
        >
          {/* ── Dashed edges to null leaves ── */}
          {nullLeaves.map((nl, i) => (
            <line key={`nl-${i}`}
              x1={nl.parentX} y1={nl.parentY + NODE_R}
              x2={nl.x}        y2={nl.y - 10}
              className="tv-null-edge"
            />
          ))}

          {/* ── Null leaf squares ── */}
          {nullLeaves.map((nl, i) => (
            <g key={`nlg-${i}`} transform={`translate(${nl.x},${nl.y})`}>
              <rect x={-9} y={-9} width={18} height={18} rx={3} className="tv-null-leaf" />
              <text textAnchor="middle" dominantBaseline="central" className="tv-null-text">∅</text>
              <text y={-15} textAnchor="middle" className="tv-edge-label">{nl.dir}</text>
            </g>
          ))}

          {/* ── Bezier edges ── */}
          <AnimatePresence>
            {edges.map((e, i) => {
              const d = edgePath(e.px, e.py, e.cx, e.cy);
              const mx = (e.px + e.cx) / 2;
              const my = (e.py + e.cy) / 2 - 4;
              return (
                <g key={`e-${i}`}>
                  <motion.path
                    d={d} fill="none"
                    className={`tv-edge ${e.newChild ? 'tv-edge-new' : ''}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                  />
                  {/* Direction label */}
                  <text x={mx} y={my} textAnchor="middle" className="tv-edge-label">
                    {e.dir}
                  </text>
                </g>
              );
            })}
          </AnimatePresence>

          {/* ── Nodes ── */}
          {/*
            IMPORTANT: We use plain <g transform="translate(x,y)"> for SVG positioning.
            Do NOT use motion.g with a transform prop — Framer Motion intercepts it and
            converts to CSS transform, which conflicts with SVG coordinate space.
            Instead we use motion.circle (animates SVG 'r' attribute) inside the <g>.
          */}
          <AnimatePresence>
            {nodes.map((n, i) => (
              <g key={n.path || `node-${i}`} transform={`translate(${n.x},${n.y})`}>
                {/* Glow halo for newly added nodes */}
                {n.isNew && (
                  <motion.circle
                    r={NODE_R + 10}
                    className="tv-node-new-halo"
                    initial={{ r: NODE_R, opacity: 0.8 }}
                    animate={{ r: NODE_R + 14, opacity: 0 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}

                {/* Outer glow ring */}
                <circle r={NODE_R + 4} className={`tv-node-glow ${n.isNew ? 'tv-node-glow-new' : ''}`} />

                {/* Node body — use motion.circle so we can animate r (NOT transform) */}
                <motion.circle
                  r={NODE_R}
                  className={`tv-node ${n.isNew ? 'tv-node-new' : ''}`}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: NODE_R, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28, delay: i * 0.045 }}
                />

                {/* Value label */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`tv-node-val ${n.isNew ? 'tv-node-val-new' : ''}`}
                >
                  {n.val.length > 5 ? n.val.slice(0, 5) + '…' : n.val}
                </text>

                {/* Depth label below */}
                <text y={NODE_R + 13} textAnchor="middle" className="tv-depth-label">
                  d:{n.depth}
                </text>
              </g>
            ))}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
}