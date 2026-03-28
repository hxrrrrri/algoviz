import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { flattenValue } from '../../utils/vizMapper';
import './TreeVisualizer.css';

const NODE_R = 24;
const H_STEP = 72;
const V_GAP  = 96;
const PAD    = 40;

/* ── Parse ── */
function parseNode(repr, path = '', depth = 0, maxDepth = 12) {
  if (!repr || depth > maxDepth) return null;
  if (repr.type === 'none' || repr.type === 'ellipsis') return null;
  if (repr.type !== 'object') return null;

  const attrs   = repr.attrs || {};
  const valRepr = attrs.val ?? attrs.value ?? attrs.data ?? attrs.key ?? null;
  const val     = valRepr != null ? String(flattenValue(valRepr) ?? '?') : '?';

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
  counter.v++;
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
  if (node.left)  arr.push({ from: node, to: node.left,  dir: 'L' });
  if (node.right) arr.push({ from: node, to: node.right, dir: 'R' });
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

/* Smooth bezier edge from bottom of parent circle to top of child circle */
function bezierPath(px, py, cx, cy) {
  const sy = py + NODE_R;
  const ey = cy - NODE_R;
  const cp1y = sy + (ey - sy) * 0.5;
  const cp2y = ey - (ey - sy) * 0.3;
  return `M ${px} ${sy} C ${px} ${cp1y}, ${cx} ${cp2y}, ${cx} ${ey}`;
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

    const rawMinX = Math.min(...nodes.map(n => n.x));
    const shiftX  = -rawMinX + PAD;
    const shiftY  = PAD;

    nodes.forEach(n => {
      n.x += shiftX;
      n.y += shiftY;
      n.isNew = !prevPaths.has(n.path) && prevPaths.size > 0;
    });

    const edges = collectEdges(root).map(e => ({
      px: e.from.x + shiftX - (e.from.x), // already shifted via nodes
      py: e.from.y,
      cx: e.to.x,
      cy: e.to.y,
      dir: e.dir,
      isNew: !prevPaths.has(e.to.path) && prevPaths.size > 0,
    }));

    // Re-read x/y from shifted nodes
    const edgesFinal = collectEdges(root).map(e => ({
      px: nodes.find(n => n.path === e.from.path)?.x ?? 0,
      py: nodes.find(n => n.path === e.from.path)?.y ?? 0,
      cx: nodes.find(n => n.path === e.to.path)?.x ?? 0,
      cy: nodes.find(n => n.path === e.to.path)?.y ?? 0,
      dir: e.dir,
      isNew: !prevPaths.has(e.to.path) && prevPaths.size > 0,
    }));

    const maxX = Math.max(...nodes.map(n => n.x));
    const maxY = Math.max(...nodes.map(n => n.y));

    return { nodes, edges: edgesFinal, svgW: maxX + PAD, svgH: maxY + PAD };
  }, [repr, prevRepr]);

  if (!layout) return null;
  const { nodes, edges, svgW, svgH } = layout;
  const newCount = nodes.filter(n => n.isNew).length;

  return (
    <div className="tv">
      <div className="tv-label">
        <span className="tv-name">{name}</span>
        <span className="tv-type-badge">Binary Tree</span>
        <span className="tv-count">{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
        <AnimatePresence>
          {newCount > 0 && (
            <motion.span className="tv-new-badge" key="nb"
              initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
              +{newCount} new
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="tv-scroll">
        <svg width={svgW} height={svgH} className="tv-svg">
          <defs>
            <filter id="tv-node-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(0,0,0,0.35)" floodOpacity="1"/>
            </filter>
            <filter id="tv-node-shadow-new" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="rgba(45,212,160,0.5)" floodOpacity="1"/>
            </filter>
          </defs>

          {/* ── Edges ── */}
          <AnimatePresence>
            {edges.map((e, i) => {
              const d = bezierPath(e.px, e.py, e.cx, e.cy);
              return (
                <motion.path key={`e-${i}`} d={d} fill="none"
                  className={`tv-edge ${e.isNew ? 'tv-edge-new' : ''}`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.45, delay: i * 0.05, ease: 'easeOut' }}
                />
              );
            })}
          </AnimatePresence>

          {/* ── Edge direction labels (L / R) ── */}
          {edges.map((e, i) => {
            const midX = (e.px + e.cx) / 2 + (e.dir === 'L' ? -10 : 10);
            const midY = (e.py + NODE_R + e.cy - NODE_R) / 2;
            return (
              <text key={`el-${i}`} x={midX} y={midY}
                textAnchor="middle" dominantBaseline="middle"
                className="tv-edge-label">
                {e.dir}
              </text>
            );
          })}

          {/* ── Nodes ── */}
          <AnimatePresence>
            {nodes.map((n, i) => (
              <g key={n.path || `nd-${i}`} transform={`translate(${n.x},${n.y})`}>
                {/* Ripple for new nodes */}
                {n.isNew && (
                  <motion.circle r={NODE_R} fill="none" stroke="rgba(45,212,160,0.6)" strokeWidth={2}
                    initial={{ r: NODE_R, opacity: 0.9 }}
                    animate={{ r: NODE_R + 22, opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                )}

                {/* Node body */}
                <motion.circle r={NODE_R}
                  className={`tv-node ${n.isNew ? 'tv-node-new' : ''}`}
                  filter={`url(#${n.isNew ? 'tv-node-shadow-new' : 'tv-node-shadow'})`}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: NODE_R, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26, delay: i * 0.04 }}
                />

                {/* Value */}
                <motion.text textAnchor="middle" dominantBaseline="central"
                  className={`tv-node-val ${n.isNew ? 'tv-node-val-new' : ''}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 + 0.15, duration: 0.2 }}>
                  {n.val.length > 5 ? n.val.slice(0, 5) + '…' : n.val}
                </motion.text>

                {/* Depth index (top-right) */}
                <text x={NODE_R - 4} y={-NODE_R + 7}
                  textAnchor="end" className="tv-node-depth">
                  {n.depth}
                </text>
              </g>
            ))}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
}
