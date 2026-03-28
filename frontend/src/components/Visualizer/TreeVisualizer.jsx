import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { flattenValue } from '../../utils/vizMapper';
import './TreeVisualizer.css';

const NODE_R = 28;
const H_STEP = 72;    // horizontal gap between in-order positions
const V_GAP  = 96;    // vertical gap between levels
const PAD    = 48;    // padding around the entire tree

/* ────────────────────────────────────────────────
   Parse safe_repr tree.
   Each node gets a "path" string (L/R from root).
──────────────────────────────────────────────── */
function parseNode(repr, path = '', depth = 0, maxDepth = 12) {
  if (!repr || depth > maxDepth) return null;
  if (repr.type === 'none' || repr.type === 'ellipsis') return null;
  if (repr.type !== 'object') return null;

  const attrs  = repr.attrs || {};
  const valRepr = attrs.val ?? attrs.value ?? attrs.data ?? attrs.key ?? null;
  const val = (valRepr !== null && valRepr !== undefined)
    ? String(flattenValue(valRepr) ?? '?') : '?';

  return {
    val, path, depth,
    left:  parseNode(attrs.left,  path + 'L', depth + 1, maxDepth),
    right: parseNode(attrs.right, path + 'R', depth + 1, maxDepth),
    x: 0, y: 0,
  };
}

function assignX(node, counter) {
  if (!node) return;
  assignX(node.left, counter);
  node.x = counter.v * H_STEP;
  counter.v += 1;
  assignX(node.right, counter);
}

function assignY(node, depth = 0) {
  if (!node) return;
  node.y = depth * V_GAP;
  assignY(node.left,  depth + 1);
  assignY(node.right, depth + 1);
}

function collectNodes(node, arr = []) {
  if (!node) return arr;
  arr.push(node);
  collectNodes(node.left,  arr);
  collectNodes(node.right, arr);
  return arr;
}

function collectEdges(node, arr = []) {
  if (!node) return arr;
  if (node.left)  arr.push({ px: node.x, py: node.y, cx: node.left.x,  cy: node.left.y,  dir: 'L', newChild: false });
  if (node.right) arr.push({ px: node.x, py: node.y, cx: node.right.x, cy: node.right.y, dir: 'R', newChild: false });
  collectEdges(node.left,  arr);
  collectEdges(node.right, arr);
  return arr;
}

function pathSet(node, s = new Set()) {
  if (!node) return s;
  s.add(node.path);
  pathSet(node.left, s);
  pathSet(node.right, s);
  return s;
}

/* Null-leaf placeholders — only for non-leaf nodes */
function collectNullLeaves(node, arr = []) {
  if (!node) return arr;
  if (!node.left && !node.right) return arr;
  if (!node.left)  arr.push({ x: node.x - H_STEP * 0.5, y: node.y + V_GAP, parentX: node.x, parentY: node.y });
  if (!node.right) arr.push({ x: node.x + H_STEP * 0.5, y: node.y + V_GAP, parentX: node.x, parentY: node.y });
  collectNullLeaves(node.left,  arr);
  collectNullLeaves(node.right, arr);
  return arr;
}

/* Smooth cubic bezier between two nodes */
function edgePath(px, py, cx, cy) {
  const midY = (py + cy) / 2;
  return `M ${px},${py + NODE_R} C ${px},${midY} ${cx},${midY} ${cx},${cy - NODE_R}`;
}

/* ════════════════════════════════════════════════
   Main component
════════════════════════════════════════════════ */
export default function TreeVisualizer({ name, repr, prevRepr }) {
  const layout = useMemo(() => {
    const root = parseNode(repr);
    if (!root) return null;

    const prevRoot  = prevRepr ? parseNode(prevRepr) : null;
    const prevPaths = prevRoot ? pathSet(prevRoot) : new Set();

    assignY(root, 0);
    assignX(root, { v: 0 });

    const nodes = collectNodes(root);

    /* Shift so tree starts at (PAD, PAD) — fixes top/left clipping */
    const rawMinX = Math.min(...nodes.map(n => n.x));
    const rawMinY = Math.min(...nodes.map(n => n.y)); // always 0, but explicit
    const shiftX  = -rawMinX + PAD;
    const shiftY  = -rawMinY + PAD;

    nodes.forEach(n => {
      n.x += shiftX;
      n.y += shiftY;
      n.isNew = !prevPaths.has(n.path) && prevPaths.size > 0;
    });

    /* Mark edges whose child is new */
    const edges = collectEdges(root);
    edges.forEach(e => {
      e.px += shiftX; e.cx += shiftX;
      e.py += shiftY; e.cy += shiftY;
      // find child node to set newChild flag
      const child = nodes.find(n => n.x === e.cx && n.y === e.cy);
      if (child) e.newChild = child.isNew;
    });

    const nullLeaves = collectNullLeaves(root);
    nullLeaves.forEach(n => {
      n.x       += shiftX; n.parentX += shiftX;
      n.y       += shiftY; n.parentY += shiftY;
    });

    const maxX = Math.max(...nodes.map(n => n.x));
    const maxY = Math.max(...nodes.map(n => n.y));

    return {
      nodes, edges, nullLeaves,
      svgW: maxX + PAD,
      svgH: maxY + PAD,
    };
  }, [repr, prevRepr]);

  if (!layout) return null;
  const { nodes, edges, nullLeaves, svgW, svgH } = layout;
  const gradId = `ng-${name}`;

  return (
    <div className="tv">
      {/* Header */}
      <div className="tv-label">
        <span className="tv-name">{name}</span>
        <span className="tv-type-badge">Binary Tree</span>
        <span className="tv-count">{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
        <AnimatePresence>
          {nodes.some(n => n.isNew) && (
            <motion.span className="tv-new-badge"
              key="new-badge"
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
              +{nodes.filter(n => n.isNew).length} new
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* SVG — centred in its scroll container */}
      <div className="tv-scroll">
        <svg
          width={svgW}
          height={svgH}
          className="tv-svg"
        >
          {/* ── Gradient + filter defs ── */}
          <defs>
            <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
              <stop offset="0%"   stopColor="rgba(165,180,252,0.30)" />
              <stop offset="60%"  stopColor="rgba(99,102,241,0.12)" />
              <stop offset="100%" stopColor="rgba(49,46,129,0.08)" />
            </radialGradient>
            <radialGradient id={`${gradId}-new`} cx="40%" cy="35%" r="65%">
              <stop offset="0%"   stopColor="rgba(110,231,183,0.40)" />
              <stop offset="60%"  stopColor="rgba(16,185,129,0.18)" />
              <stop offset="100%" stopColor="rgba(6,78,59,0.08)" />
            </radialGradient>
            <filter id="tv-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="tv-glow-new" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* ── Dashed lines to null leaves ── */}
          {nullLeaves.map((nl, i) => (
            <line key={`nl-${i}`}
              x1={nl.parentX} y1={nl.parentY + NODE_R}
              x2={nl.x}       y2={nl.y - 10}
              className="tv-null-edge"
            />
          ))}

          {/* ── Null leaf squares ── */}
          {nullLeaves.map((nl, i) => (
            <g key={`nlg-${i}`} transform={`translate(${nl.x},${nl.y})`}>
              <rect x={-9} y={-9} width={18} height={18} rx={3} className="tv-null-leaf" />
              <text textAnchor="middle" dominantBaseline="central" className="tv-null-text">∅</text>
            </g>
          ))}

          {/* ── Edges — animated draw-in ── */}
          <AnimatePresence>
            {edges.map((e, i) => {
              const d = edgePath(e.px, e.py, e.cx, e.cy);
              const labelX = e.dir === 'L' ? e.px - 16 : e.px + 16;
              const labelY = e.py + NODE_R + 16;
              return (
                <g key={`e-${e.px}-${e.py}-${e.dir}`}>
                  {/* Glow copy behind the edge for new edges */}
                  {e.newChild && (
                    <motion.path d={d} fill="none"
                      className="tv-edge-glow-bg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.08 + 0.1 }}
                    />
                  )}
                  <motion.path
                    d={d} fill="none"
                    className={`tv-edge ${e.newChild ? 'tv-edge-new' : ''}`}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.55, delay: i * 0.08, ease: 'easeOut' }}
                  />
                  <text x={labelX} y={labelY} textAnchor="middle" className="tv-edge-label">
                    {e.dir}
                  </text>
                </g>
              );
            })}
          </AnimatePresence>

          {/* ── Nodes ──
              IMPORTANT: plain <g transform> for position, motion.circle for animation.
              Never use motion.g with a transform prop — Framer Motion overrides SVG transforms.
          ── */}
          <AnimatePresence>
            {nodes.map((n, i) => (
              <g key={n.path || `node-${i}`} transform={`translate(${n.x},${n.y})`}>

                {/* Ripple burst for newly added nodes */}
                {n.isNew && (
                  <motion.circle r={NODE_R}
                    fill="none" stroke="var(--accent)" strokeWidth={2}
                    initial={{ r: NODE_R,      opacity: 0.9 }}
                    animate={{ r: NODE_R + 26, opacity: 0   }}
                    transition={{ duration: 0.9, delay: i * 0.04, ease: 'easeOut' }}
                  />
                )}
                {n.isNew && (
                  <motion.circle r={NODE_R}
                    fill="none" stroke="var(--accent)" strokeWidth={1.2}
                    initial={{ r: NODE_R,      opacity: 0.6 }}
                    animate={{ r: NODE_R + 18, opacity: 0   }}
                    transition={{ duration: 0.7, delay: i * 0.04 + 0.18, ease: 'easeOut' }}
                  />
                )}

                {/* Soft ambient glow ring */}
                <circle r={NODE_R + 5}
                  className={`tv-node-glow ${n.isNew ? 'tv-node-glow-new' : ''}`}
                />

                {/* Node body with gradient fill */}
                <motion.circle
                  r={NODE_R}
                  fill={`url(#${n.isNew ? `${gradId}-new` : gradId})`}
                  className={`tv-node ${n.isNew ? 'tv-node-new' : ''}`}
                  filter={`url(#${n.isNew ? 'tv-glow-new' : 'tv-glow'})`}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: NODE_R, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26, delay: i * 0.05 }}
                />

                {/* Value text — slides in after circle */}
                <motion.text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`tv-node-val ${n.isNew ? 'tv-node-val-new' : ''}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 + 0.18, duration: 0.25 }}
                >
                  {n.val.length > 5 ? n.val.slice(0, 5) + '…' : n.val}
                </motion.text>
              </g>
            ))}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
}