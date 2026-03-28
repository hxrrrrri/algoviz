import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { flattenValue } from '../../utils/vizMapper';
import './TreeVisualizer.css';

const NODE_R = 26;
const H_STEP = 76;
const V_GAP  = 100;
const PAD    = 48;

/* ─── Parse repr → tree ─── */
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
  assignY(node.left, depth + 1);
  assignY(node.right, depth + 1);
}

function collectNodes(node, arr = []) {
  if (!node) return arr;
  arr.push(node);
  collectNodes(node.left, arr);
  collectNodes(node.right, arr);
  return arr;
}

function collectEdgesRaw(node, arr = []) {
  if (!node) return arr;
  if (node.left)  arr.push({ fromPath: node.path, toPath: node.left.path,  dir: 'L' });
  if (node.right) arr.push({ fromPath: node.path, toPath: node.right.path, dir: 'R' });
  collectEdgesRaw(node.left, arr);
  collectEdgesRaw(node.right, arr);
  return arr;
}

function pathSet(node, s = new Set()) {
  if (!node) return s;
  s.add(node.path);
  pathSet(node.left, s);
  pathSet(node.right, s);
  return s;
}

/* Smooth bezier: bottom of parent → top of child */
function bezier(px, py, cx, cy) {
  const sy  = py + NODE_R;
  const ey  = cy - NODE_R;
  const mid = (sy + ey) / 2;
  return `M ${px} ${sy} C ${px} ${mid}, ${cx} ${mid}, ${cx} ${ey}`;
}

/* ════════════════════════════════════════════════ */
export default function TreeVisualizer({ name, repr, prevRepr }) {
  const layout = useMemo(() => {
    const root = parseNode(repr);
    if (!root) return null;

    const prevRoot  = prevRepr ? parseNode(prevRepr) : null;
    const prevPaths = prevRoot ? pathSet(prevRoot) : new Set();

    assignY(root, 0);
    assignX(root, { v: 0 });

    const allNodes = collectNodes(root);
    const rawMinX  = Math.min(...allNodes.map(n => n.x));
    const shiftX   = -rawMinX + PAD;

    // Apply shift & mark new
    allNodes.forEach(n => {
      n.x += shiftX;
      n.y += PAD;
      n.isNew = !prevPaths.has(n.path) && prevPaths.size > 0;
    });

    // Build path→node map
    const byPath = {};
    allNodes.forEach(n => { byPath[n.path] = n; });

    // For each new node: record its parent position (for drop-from animation)
    allNodes.forEach(n => {
      if (n.isNew && n.path.length > 0) {
        const parentPath = n.path.slice(0, -1);
        const parent     = byPath[parentPath];
        n.parentX  = parent?.x ?? n.x;
        n.parentY  = parent?.y ?? n.y;
        n.insertDir = n.path.slice(-1); // 'L' or 'R'
      }
    });

    // Mark parents of new children so we can highlight them
    const newPaths = new Set(allNodes.filter(n => n.isNew).map(n => n.path));
    allNodes.forEach(n => {
      const lNew = newPaths.has(n.path + 'L');
      const rNew = newPaths.has(n.path + 'R');
      n.isParentOfNew = lNew || rNew;
      n.newChildDir   = lNew ? 'L' : rNew ? 'R' : null;
    });

    // Build edge list
    const edges = collectEdgesRaw(root).map(e => ({
      ...e,
      px: byPath[e.fromPath]?.x ?? 0,
      py: byPath[e.fromPath]?.y ?? 0,
      cx: byPath[e.toPath]?.x  ?? 0,
      cy: byPath[e.toPath]?.y  ?? 0,
      isNew: newPaths.has(e.toPath),
    }));

    const maxX = Math.max(...allNodes.map(n => n.x));
    const maxY = Math.max(...allNodes.map(n => n.y));

    return { nodes: allNodes, edges, svgW: maxX + PAD, svgH: maxY + PAD };
  }, [repr, prevRepr]);

  if (!layout) return null;
  const { nodes, edges, svgW, svgH } = layout;
  const newCount = nodes.filter(n => n.isNew).length;

  const oldEdges = edges.filter(e => !e.isNew);
  const newEdges = edges.filter(e => e.isNew);
  const oldNodes = nodes.filter(n => !n.isNew);
  const newNodes = nodes.filter(n =>  n.isNew);

  return (
    <div className="tv">
      {/* ── Header ── */}
      <div className="tv-label">
        <span className="tv-name">{name}</span>
        <span className="tv-type-badge">Binary Tree</span>
        <span className="tv-count">{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
        <AnimatePresence>
          {newCount > 0 && (
            <motion.span className="tv-new-badge" key="nb"
              initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}>
              +{newCount} inserting
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Legend ── */}
      {newCount > 0 && (
        <div className="tv-legend">
          <span className="tv-leg-item tv-leg-existing">existing node</span>
          <span className="tv-leg-sep">→</span>
          <span className="tv-leg-item tv-leg-edge">edge drawn</span>
          <span className="tv-leg-sep">→</span>
          <span className="tv-leg-item tv-leg-new">new node drops in</span>
        </div>
      )}

      <div className="tv-scroll">
        <svg width={svgW} height={svgH} className="tv-svg">
          <defs>
            <filter id="tv-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="rgba(0,0,0,0.4)"/>
            </filter>
            <filter id="tv-shadow-parent" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="rgba(45,212,160,0.45)"/>
            </filter>
            <filter id="tv-shadow-new" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="rgba(99,179,237,0.5)"/>
            </filter>
            <marker id="tv-arrowhead" markerWidth="6" markerHeight="6"
              refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="rgba(148,163,184,0.5)"/>
            </marker>
            <marker id="tv-arrowhead-new" markerWidth="6" markerHeight="6"
              refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="rgba(99,179,237,0.85)"/>
            </marker>
          </defs>

          {/* ══ LAYER 1: Static existing edges ══ */}
          {oldEdges.map(e => (
            <path key={`oe-${e.fromPath}-${e.dir}`}
              d={bezier(e.px, e.py, e.cx, e.cy)}
              className="tv-edge"
              markerEnd="url(#tv-arrowhead)"
            />
          ))}

          {/* ══ LAYER 2: Old edge L/R labels ══ */}
          {oldEdges.map(e => {
            const lx = (e.px + e.cx) / 2 + (e.dir === 'L' ? -14 : 14);
            const ly = (e.py + NODE_R + e.cy - NODE_R) / 2;
            return (
              <g key={`ol-${e.fromPath}-${e.dir}`}>
                <rect x={lx - 8} y={ly - 8} width={16} height={16} rx={4}
                  className={`tv-dir-pill tv-dir-pill-${e.dir === 'L' ? 'l' : 'r'} tv-dir-pill-dim`}/>
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                  className="tv-dir-text tv-dir-text-dim">{e.dir}</text>
              </g>
            );
          })}

          {/* ══ LAYER 3: Static existing nodes ══ */}
          {oldNodes.map(n => (
            <g key={`on-${n.path}`} transform={`translate(${n.x},${n.y})`}>

              {/* Parent-of-new: expanding ring pulse to signal "I'm receiving a child" */}
              {n.isParentOfNew && (
                <>
                  <motion.circle r={NODE_R + 4} fill="none"
                    stroke="rgba(45,212,160,0.55)" strokeWidth={1.8}
                    initial={{ r: NODE_R + 4, opacity: 0.8 }}
                    animate={{ r: NODE_R + 20, opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.4 }}
                  />
                  <motion.circle r={NODE_R + 4} fill="none"
                    stroke="rgba(45,212,160,0.3)" strokeWidth={1}
                    initial={{ r: NODE_R + 4, opacity: 0.6 }}
                    animate={{ r: NODE_R + 30, opacity: 0 }}
                    transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15, repeat: Infinity, repeatDelay: 0.25 }}
                  />
                </>
              )}

              {/* Node body */}
              <circle r={NODE_R}
                className={`tv-node ${n.isParentOfNew ? 'tv-node-parent' : ''}`}
                filter={`url(#${n.isParentOfNew ? 'tv-shadow-parent' : 'tv-shadow'})`}
              />

              {/* Direction arrow hint on the parent — points toward new child */}
              {n.isParentOfNew && (
                <motion.text
                  x={n.newChildDir === 'L' ? -(NODE_R + 10) : (NODE_R + 10)}
                  y={6}
                  textAnchor="middle" dominantBaseline="central"
                  className={`tv-insert-arrow tv-insert-arrow-${n.newChildDir === 'L' ? 'l' : 'r'}`}
                  initial={{ opacity: 0, x: n.newChildDir === 'L' ? -NODE_R : NODE_R }}
                  animate={{ opacity: [0, 1, 1, 0], x: n.newChildDir === 'L' ? -(NODE_R + 10) : (NODE_R + 10) }}
                  transition={{ duration: 1.2, times: [0, 0.2, 0.75, 1.0] }}>
                  {n.newChildDir === 'L' ? '←L' : 'R→'}
                </motion.text>
              )}

              {/* Value */}
              <text textAnchor="middle" dominantBaseline="central"
                className="tv-node-val">
                {n.val.length > 5 ? n.val.slice(0, 5) + '…' : n.val}
              </text>

              {/* Depth badge */}
              <rect x={NODE_R - 14} y={-NODE_R - 12} width={14} height={12} rx={3}
                className="tv-depth-bg"/>
              <text x={NODE_R - 7} y={-NODE_R - 6} textAnchor="middle" dominantBaseline="central"
                className="tv-depth-text">d{n.depth}</text>
            </g>
          ))}

          {/* ══ LAYER 4: New edges — animate drawing from parent to child ══ */}
          <AnimatePresence>
            {newEdges.map(e => {
              const d   = bezier(e.px, e.py, e.cx, e.cy);
              const lx  = (e.px + e.cx) / 2 + (e.dir === 'L' ? -14 : 14);
              const ly  = (e.py + NODE_R + e.cy - NODE_R) / 2;
              return (
                <g key={`ne-${e.toPath}`}>
                  {/* Glow trail behind edge */}
                  <motion.path d={d} fill="none" className="tv-edge-new-glow"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: [0, 0.6, 0.3] }}
                    transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
                  />
                  {/* Main new edge — draws from parent down to child */}
                  <motion.path d={d} fill="none" className="tv-edge tv-edge-new"
                    markerEnd="url(#tv-arrowhead-new)"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.42, delay: 0.08, ease: 'easeOut' }}
                  />
                  {/* L/R label badge — appears after edge finishes drawing */}
                  <motion.g
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.48, type: 'spring', stiffness: 450, damping: 22 }}>
                    <rect x={lx - 9} y={ly - 9} width={18} height={18} rx={5}
                      className={`tv-dir-pill tv-dir-pill-${e.dir === 'L' ? 'l' : 'r'}`}/>
                    <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                      className="tv-dir-text">{e.dir}</text>
                  </motion.g>
                </g>
              );
            })}
          </AnimatePresence>

          {/* ══ LAYER 5: New nodes — drop from parent position ══ */}
          <AnimatePresence>
            {newNodes.map(n => {
              const dropY = (n.parentY ?? n.y) - n.y; // positive = drop downward

              return (
                <g key={`nn-${n.path}`} transform={`translate(${n.x},${n.y})`}>

                  {/* Arrival burst ring — expands outward when node lands */}
                  <motion.circle r={NODE_R} fill="none"
                    stroke="rgba(99,179,237,0.7)" strokeWidth={2}
                    initial={{ r: NODE_R * 0.6, opacity: 0 }}
                    animate={{ r: NODE_R + 24, opacity: [0, 0.8, 0] }}
                    transition={{ duration: 0.65, delay: 0.52, ease: 'easeOut' }}
                  />
                  <motion.circle r={NODE_R} fill="none"
                    stroke="rgba(99,179,237,0.35)" strokeWidth={1.2}
                    initial={{ r: NODE_R * 0.6, opacity: 0 }}
                    animate={{ r: NODE_R + 38, opacity: [0, 0.5, 0] }}
                    transition={{ duration: 0.85, delay: 0.56, ease: 'easeOut' }}
                  />

                  {/* Node group — drops from parent y, springs into place */}
                  <motion.g
                    initial={{ y: -dropY, opacity: 0, scale: 0.45 }}
                    animate={{ y: 0,       opacity: 1, scale: 1    }}
                    transition={{
                      type: 'spring', stiffness: 260, damping: 20, delay: 0.36,
                      opacity: { duration: 0.15, delay: 0.36 },
                      scale:   { type: 'spring', stiffness: 320, damping: 22, delay: 0.36 },
                    }}>

                    {/* Node circle */}
                    <circle r={NODE_R}
                      className="tv-node tv-node-new"
                      filter="url(#tv-shadow-new)"
                    />

                    {/* Value text — fades in after node settles */}
                    <motion.text textAnchor="middle" dominantBaseline="central"
                      className="tv-node-val tv-node-val-new"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.6, duration: 0.22 }}>
                      {n.val.length > 5 ? n.val.slice(0, 5) + '…' : n.val}
                    </motion.text>

                    {/* Depth badge */}
                    <rect x={NODE_R - 14} y={-NODE_R - 12} width={14} height={12} rx={3}
                      className="tv-depth-bg tv-depth-bg-new"/>
                    <motion.text x={NODE_R - 7} y={-NODE_R - 6}
                      textAnchor="middle" dominantBaseline="central"
                      className="tv-depth-text tv-depth-text-new"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.62, duration: 0.2 }}>
                      d{n.depth}
                    </motion.text>

                    {/* "NEW" tag — appears briefly */}
                    <motion.g
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: [0, 1, 1, 0], y: [-4, -8, -10, -12] }}
                      transition={{ duration: 1.4, delay: 0.62, times: [0, 0.15, 0.7, 1.0] }}>
                      <rect x={-16} y={NODE_R + 4} width={32} height={14} rx={4}
                        className="tv-new-tag-bg"/>
                      <text x={0} y={NODE_R + 11} textAnchor="middle" dominantBaseline="central"
                        className="tv-new-tag-text">NEW</text>
                    </motion.g>
                  </motion.g>
                </g>
              );
            })}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
}
