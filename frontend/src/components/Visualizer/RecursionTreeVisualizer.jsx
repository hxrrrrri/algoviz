import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import './RecursionTreeVisualizer.css';

/* ── Config ── */
const MAX_INTERVALS = 48;   // hard cap — prevents runaway collection
const CELL_W = 26;
const CELL_H = 26;
const CELL_GAP = 2;
const LEVEL_H = 110;        // vertical distance between levels
const SIBLING_GAP = 20;     // horizontal gap between siblings

const LO_NAMES = ['left','l','lo','low','start'];
const HI_NAMES = ['right','r','hi','high','end'];

/* ── 1. Collect unique (lo,hi) intervals from the whole trace ── */
function collectIntervals(trace) {
  const seen = new Set();
  const result = [];
  for (const step of trace) {
    const loc = step?.locals || {};
    let lo = null, hi = null;
    for (const n of LO_NAMES) {
      const v = loc[n];
      if (v?.type === 'int' && typeof v.value === 'number' && v.value >= 0) { lo = v.value; break; }
    }
    for (const n of HI_NAMES) {
      const v = loc[n];
      if (v?.type === 'int' && typeof v.value === 'number' && v.value >= 0) { hi = v.value; break; }
    }
    if (lo !== null && hi !== null && lo <= hi && (hi - lo) < 500) {
      const key = `${lo},${hi}`;
      if (!seen.has(key)) { seen.add(key); result.push({ lo, hi }); }
    }
    if (result.length >= MAX_INTERVALS) break;
  }
  return result;
}

/* ── 2. Build tree ITERATIVELY — no recursion, no stack overflow ──
   Strategy: sort intervals by size desc. For each interval, find its
   parent = the smallest interval that strictly contains it. O(n²). ── */
function buildTree(intervals) {
  if (!intervals.length) return null;
  const sorted = [...intervals].sort(
    (a, b) => (b.hi - b.lo) - (a.hi - a.lo) || a.lo - b.lo
  );
  // Create node objects
  const nodes = sorted.map(({ lo, hi }) => ({ lo, hi, children: [] }));

  // Assign parents iteratively
  for (let i = 1; i < nodes.length; i++) {
    const { lo, hi } = nodes[i];
    let parentIdx = -1, parentSize = Infinity;
    for (let j = 0; j < i; j++) {
      const { lo: plo, hi: phi } = nodes[j];
      // strictly contains: plo <= lo && phi >= hi but not identical
      if (plo <= lo && phi >= hi && !(plo === lo && phi === hi)) {
        const sz = phi - plo;
        if (sz < parentSize) { parentSize = sz; parentIdx = j; }
      }
    }
    if (parentIdx >= 0) nodes[parentIdx].children.push(nodes[i]);
  }

  // Sort children by lo at each node
  for (const node of nodes) node.children.sort((a, b) => a.lo - b.lo);

  return nodes[0] || null;
}

/* ── 3. Compute widths ITERATIVELY (post-order via DFS pre-order reversed) ── */
function nodeBoxW(node) {
  const count = node.hi - node.lo + 1;
  return Math.max(72, count * (CELL_W + CELL_GAP) - CELL_GAP + 16);
}
const NODE_H = CELL_H + 32; // cells + label

function computeWidths(root) {
  const widths = new Map();
  // pre-order DFS
  const preOrder = [];
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    preOrder.push(n);
    for (const c of [...n.children].reverse()) stack.push(c);
  }
  // process in reverse = post-order
  for (let i = preOrder.length - 1; i >= 0; i--) {
    const n = preOrder[i];
    if (n.children.length === 0) {
      widths.set(n, nodeBoxW(n));
    } else {
      const childSum = n.children.reduce((s, c) => s + widths.get(c), 0)
        + SIBLING_GAP * (n.children.length - 1);
      widths.set(n, Math.max(nodeBoxW(n), childSum));
    }
  }
  return widths;
}

/* ── 4. Assign positions ITERATIVELY (BFS) ── */
function layoutTree(root) {
  const widths = computeWidths(root);
  const positions = [];
  const queue = [{ node: root, level: 0, x: 0 }];
  let maxLevel = 0;
  while (queue.length) {
    const { node, level, x } = queue.shift();
    const totalW = widths.get(node);
    const selfW  = nodeBoxW(node);
    const nodeX  = x + (totalW - selfW) / 2;
    positions.push({ node, x: nodeX, y: level * LEVEL_H, selfW });
    maxLevel = Math.max(maxLevel, level);
    let cx = x;
    for (const child of node.children) {
      queue.push({ node: child, level: level + 1, x: cx });
      cx += widths.get(child) + SIBLING_GAP;
    }
  }
  return { positions, totalW: widths.get(root), totalH: (maxLevel + 1) * LEVEL_H };
}

/* ── 5. Get array values from trace ── */
function getValues(trace, currentStep) {
  for (let i = currentStep; i >= 0; i--) {
    const loc = trace[i]?.locals || {};
    for (const v of Object.values(loc)) {
      if (v?.type === 'list' && Array.isArray(v.value) && v.value.length > 1) {
        return v.value.map(x =>
          x !== null && typeof x === 'object' ? (x.value ?? '?') : x
        );
      }
    }
  }
  return [];
}

/* ── 6. Get current active lo/hi ── */
function getCurrent(trace, currentStep) {
  for (let i = currentStep; i >= 0; i--) {
    const loc = trace[i]?.locals || {};
    let lo = null, hi = null;
    for (const n of LO_NAMES) { const v = loc[n]; if (v?.type === 'int') { lo = v.value; break; } }
    for (const n of HI_NAMES) { const v = loc[n]; if (v?.type === 'int') { hi = v.value; break; } }
    if (lo !== null && hi !== null && lo <= hi) return { lo, hi };
  }
  return { lo: null, hi: null };
}

/* ── Tree node box ── */
function NodeBox({ node, values, isActive }) {
  const slice = values.slice(node.lo, node.hi + 1);
  return (
    <div className={`rtv-node ${isActive ? 'rtv-node-active' : ''}`} style={{ width: nodeBoxW(node) }}>
      <div className="rtv-node-label">
        {node.lo === node.hi ? `[${node.lo}]` : `[${node.lo} … ${node.hi}]`}
      </div>
      <div className="rtv-node-cells">
        {slice.map((v, i) => (
          <div key={i} className={`rtv-node-cell ${isActive ? 'rtv-nc-active' : ''}`}>
            {v === null || v === undefined ? '·'
              : typeof v === 'object' ? '…'
              : String(v).slice(0, 3)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Error boundary wrapper ── */
class RTV_ErrorBoundary extends Error {}

/* ── Main export ── */
export default function RecursionTreeVisualizer({ trace, currentStep }) {
  const [collapsed, setCollapsed] = useState(false);

  // Only recompute intervals / tree when the trace changes, NOT on every step
  const intervals = useMemo(() => collectIntervals(trace), [trace]);
  const tree      = useMemo(() => buildTree(intervals),    [intervals]);
  const layout    = useMemo(() => tree ? layoutTree(tree) : null, [tree]);
  const values    = useMemo(() => getValues(trace, trace.length - 1), [trace]); // use last step for stable values
  const { lo: curLo, hi: curHi } = useMemo(() => getCurrent(trace, currentStep), [trace, currentStep]);

  // Need ≥2 intervals and actual recursion (more than 1 depth level)
  if (!layout || layout.positions.length < 2 || !values.length) return null;
  const hasDepth = layout.positions.some(p => p.y > 0);
  if (!hasDepth) return null;

  const { positions, totalW, totalH } = layout;
  const svgW = Math.max(totalW, 100);
  const svgH = totalH + NODE_H + 10;

  // Build SVG connectors
  const posMap = new Map(positions.map(p => [`${p.node.lo},${p.node.hi}`, p]));
  const connectors = [];
  for (const pos of positions) {
    const px = pos.x + pos.selfW / 2;
    const py = pos.y + NODE_H;
    const isFromActive = pos.node.lo === curLo && pos.node.hi === curHi;
    for (const child of pos.node.children) {
      const cp = posMap.get(`${child.lo},${child.hi}`);
      if (!cp) continue;
      const cx = cp.x + cp.selfW / 2;
      const cy = cp.y;
      const my = (py + cy) / 2;
      connectors.push({ px, py, cx, cy, my, active: isFromActive, key: `${pos.node.lo}-${pos.node.hi}--${child.lo}-${child.hi}` });
    }
  }

  return (
    <div className="rtv">
      <div className="rtv-header">
        <span className="rtv-title">Recursion Tree</span>
        <span className="rtv-badge">{positions.length} subproblems</span>
        <span className="rtv-badge">{Math.round(totalH / LEVEL_H)} levels deep</span>
        <button className="rtv-toggle" onClick={() => setCollapsed(v => !v)}>
          {collapsed ? '▾ Show' : '▴ Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="rtv-scroll">
          <div style={{ position: 'relative', width: svgW, height: svgH }}>
            {/* SVG edges */}
            <svg
              style={{ position: 'absolute', inset: 0, width: svgW, height: svgH, overflow: 'visible', pointerEvents: 'none' }}
              viewBox={`0 0 ${svgW} ${svgH}`}
            >
              {connectors.map(({ px, py, cx, cy, my, active, key }) => (
                <path key={key}
                  d={`M${px},${py} C${px},${my} ${cx},${my} ${cx},${cy}`}
                  fill="none"
                  stroke={active ? 'var(--accent)' : 'var(--border-1)'}
                  strokeWidth={active ? 2 : 1.5}
                  opacity={active ? 1 : 0.55}
                  strokeDasharray={active ? undefined : '5 3'}
                />
              ))}
              {/* Arrowhead at child end */}
              {connectors.map(({ cx, cy, active, key }) => (
                <polygon key={`arr-${key}`}
                  points={`${cx},${cy} ${cx - 4},${cy - 7} ${cx + 4},${cy - 7}`}
                  fill={active ? 'var(--accent)' : 'var(--border-1)'}
                  opacity={active ? 1 : 0.55}
                />
              ))}
            </svg>

            {/* Node boxes */}
            {positions.map(({ node, x, y }) => (
              <motion.div
                key={`${node.lo}-${node.hi}`}
                style={{ position: 'absolute', left: x, top: y }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 26, delay: Math.min((node.lo + node.hi) * 0.01, 0.4) }}
              >
                <NodeBox node={node} values={values} isActive={node.lo === curLo && node.hi === curHi} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
