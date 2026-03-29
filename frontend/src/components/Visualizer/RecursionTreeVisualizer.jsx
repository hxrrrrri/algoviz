import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import './RecursionTreeVisualizer.css';

/* ── Constants ── */
const MAX_NODES  = 127;   // cap — prevents runaway for fib(30) etc.
const NODE_W_BASE = 80;   // minimum node box width
const NODE_H     = 52;    // fixed node height
const LEVEL_H    = 90;    // vertical spacing between levels
const SIBLING_GAP = 14;   // horizontal gap between sibling subtrees

/* ── 1. Find which function names are actually recursive ── */
function findRecursiveFns(trace) {
  const fns = new Set();
  for (const s of trace) {
    const cs = s.call_stack || [];
    if (cs.length < 2) continue;
    const names = cs.map(f => f.function);
    const seen = new Set();
    for (const n of names) {
      if (seen.has(n)) fns.add(n);
      seen.add(n);
    }
  }
  return fns;
}

/* ── 2. Build call tree from trace call/return events ── */
function buildCallTree(trace, recursiveFns) {
  if (!recursiveFns.size) return null;

  let idCounter = 0;
  const makeNode = (fn, args, depth, startStep) => ({
    id: idCounter++,
    fn, args, depth, startStep,
    endStep: Infinity,   // filled in when we see the matching return
    returnVal: null,
    children: [],
    truncated: false,
  });

  // Artificial root to hold top-level calls
  const root = makeNode('__root__', {}, -1, -1);
  const pathStack = [root];   // nodes on the current DFS path
  let totalNodes  = 0;

  for (let i = 0; i < trace.length; i++) {
    const step = trace[i];
    const cs   = step.call_stack || [];

    if (step.event === 'call') {
      const fn = cs[cs.length - 1]?.function || '?';
      if (!recursiveFns.has(fn)) continue;

      const depth = cs.length - 1;   // depth of this call in the stack

      // Pop path back to the correct parent depth
      while (pathStack.length > 1 && pathStack[pathStack.length - 1].depth >= depth) {
        pathStack.pop();
      }
      const parent = pathStack[pathStack.length - 1];

      if (totalNodes >= MAX_NODES) {
        parent.truncated = true;
        continue;
      }

      // Collect scalar args (exclude self, dunder, large objects)
      const args = {};
      for (const [k, v] of Object.entries(step.locals || {})) {
        if (k === 'self' || k.startsWith('__')) continue;
        if (v?.type === 'int' || v?.type === 'float' || v?.type === 'bool') {
          args[k] = v.value;
        } else if (v?.type === 'str' && String(v.value).length <= 8) {
          args[k] = `"${v.value}"`;
        }
      }

      const node = makeNode(fn, args, depth, i);
      parent.children.push(node);
      pathStack.push(node);
      totalNodes++;
    }

    if (step.event === 'return') {
      const fn = cs[cs.length - 1]?.function || '?';
      if (!recursiveFns.has(fn)) continue;
      // Mark the top of path as ended
      const top = pathStack[pathStack.length - 1];
      if (top.fn === fn && top.endStep === Infinity) {
        top.endStep = i;
        // Try to capture return value from locals if there's a simple result var
        const loc = step.locals || {};
        for (const k of ['result', 'res', 'ret', 'ans', 'output', 'val']) {
          const v = loc[k];
          if (v?.type === 'int' || v?.type === 'float' || v?.type === 'bool') {
            top.returnVal = v.value; break;
          }
        }
        pathStack.pop();
      }
    }
  }

  if (root.children.length === 0) return null;
  return root.children.length === 1 ? root.children[0] : root;
}

/* ── 3. Compute subtree widths (post-order, iterative) ── */
function nodeLabel(node) {
  const argStr = Object.entries(node.args)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return `${node.fn}(${argStr})`;
}

function nodeBoxW(node) {
  return Math.max(NODE_W_BASE, nodeLabel(node).length * 7 + 20);
}

function computeWidths(root) {
  const w = new Map();
  // iterative post-order via reverse pre-order
  const pre = [];
  const stk = [root];
  while (stk.length) {
    const n = stk.pop();
    pre.push(n);
    for (const c of [...n.children].reverse()) stk.push(c);
  }
  for (let i = pre.length - 1; i >= 0; i--) {
    const n = pre[i];
    if (n.children.length === 0) {
      w.set(n, nodeBoxW(n));
    } else {
      const childSum = n.children.reduce((s, c) => s + w.get(c), 0)
        + SIBLING_GAP * (n.children.length - 1);
      w.set(n, Math.max(nodeBoxW(n), childSum));
    }
  }
  return w;
}

/* ── 4. Layout tree (BFS) ── */
function layoutTree(root) {
  const widths = computeWidths(root);
  const positions = [];
  const queue = [{ node: root, level: 0, x: 0 }];
  let maxLevel = 0;

  while (queue.length) {
    const { node, level, x } = queue.shift();
    const totalW = widths.get(node);
    const selfW  = nodeBoxW(node);
    const nx     = x + (totalW - selfW) / 2;
    positions.push({ node, x: nx, y: level * LEVEL_H, selfW });
    maxLevel = Math.max(maxLevel, level);
    let cx = x;
    for (const child of node.children) {
      queue.push({ node: child, level: level + 1, x: cx });
      cx += widths.get(child) + SIBLING_GAP;
    }
  }

  return {
    positions,
    totalW: widths.get(root),
    totalH: (maxLevel + 1) * LEVEL_H + NODE_H,
    maxLevel,
  };
}

/* ── 5. Find active node at currentStep ── */
function findActiveNode(positions, currentStep) {
  // Active = started but not yet returned, with the latest startStep
  let best = null;
  for (const p of positions) {
    const { startStep, endStep } = p.node;
    if (startStep <= currentStep && endStep >= currentStep) {
      if (!best || startStep > best.node.startStep) best = p;
    }
  }
  return best;
}

/* ── Node box component ── */
function NodeBox({ node, selfW, isActive }) {
  const label   = nodeLabel(node);
  const retLabel = node.returnVal !== null ? `→ ${node.returnVal}` : null;
  return (
    <div
      className={`rtv-node ${isActive ? 'rtv-node-active' : ''} ${node.truncated ? 'rtv-node-truncated' : ''}`}
      style={{ width: selfW }}
    >
      <div className="rtv-node-fn">{label}</div>
      {retLabel && <div className="rtv-node-ret">{retLabel}</div>}
      {node.truncated && <div className="rtv-node-trunc">…</div>}
    </div>
  );
}

/* ── Main export ── */
export default function RecursionTreeVisualizer({ trace, currentStep }) {
  const [collapsed, setCollapsed] = useState(false);

  // Build tree once from the full trace — stable, no per-step rebuilding
  const { tree, recursiveFns } = useMemo(() => {
    const fns  = findRecursiveFns(trace);
    const tree = fns.size ? buildCallTree(trace, fns) : null;
    return { tree, recursiveFns: fns };
  }, [trace]);

  const layout = useMemo(() => tree ? layoutTree(tree) : null, [tree]);

  const activePos = useMemo(
    () => layout ? findActiveNode(layout.positions, currentStep) : null,
    [layout, currentStep]
  );

  if (!layout || layout.positions.length < 2) return null;

  const { positions, totalW, totalH, maxLevel } = layout;
  const svgW = Math.max(totalW, 100);
  const svgH = totalH + 10;

  // Build connector map for fast lookup
  const posMap = new Map(positions.map(p => [p.node.id, p]));

  // Connector lines
  const connectors = [];
  for (const pos of positions) {
    const px = pos.x + pos.selfW / 2;
    const py = pos.y + NODE_H;
    const isFromActive = activePos && pos.node.id === activePos.node.id;
    for (const child of pos.node.children) {
      const cp = posMap.get(child.id);
      if (!cp) continue;
      const cx = cp.x + cp.selfW / 2;
      const cy = cp.y;
      const my = (py + cy) / 2;
      connectors.push({ px, py, cx, cy, my, active: isFromActive, key: `${pos.node.id}-${child.id}` });
    }
  }

  const fnNames = [...recursiveFns].join(', ');

  return (
    <div className="rtv">
      <div className="rtv-header">
        <span className="rtv-title">Recursion Tree</span>
        <span className="rtv-badge">{fnNames}</span>
        <span className="rtv-badge">{positions.length} calls</span>
        <span className="rtv-badge">{maxLevel + 1} levels</span>
        {positions.length >= MAX_NODES && (
          <span className="rtv-badge rtv-badge-warn">capped at {MAX_NODES}</span>
        )}
        <button className="rtv-toggle" onClick={() => setCollapsed(v => !v)}>
          {collapsed ? '▾ Show' : '▴ Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="rtv-scroll">
          <div style={{ position: 'relative', width: svgW, height: svgH, minWidth: '100%' }}>
            {/* SVG edges */}
            <svg
              style={{ position: 'absolute', inset: 0, width: svgW, height: svgH, overflow: 'visible', pointerEvents: 'none' }}
            >
              <defs>
                <marker id="rtv-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="var(--border-1)" />
                </marker>
                <marker id="rtv-arrow-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="var(--accent)" />
                </marker>
              </defs>
              {connectors.map(({ px, py, cx, cy, my, active, key }) => (
                <path key={key}
                  d={`M${px},${py} C${px},${my} ${cx},${my} ${cx},${cy}`}
                  fill="none"
                  stroke={active ? 'var(--accent)' : 'var(--border-1)'}
                  strokeWidth={active ? 2 : 1.2}
                  opacity={active ? 1 : 0.45}
                  markerEnd={active ? 'url(#rtv-arrow-active)' : 'url(#rtv-arrow)'}
                />
              ))}
            </svg>

            {/* Node boxes */}
            {positions.map(({ node, x, y, selfW }) => (
              <motion.div
                key={node.id}
                style={{ position: 'absolute', left: x, top: y }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28, delay: Math.min(node.startStep * 0.002, 0.5) }}
              >
                <NodeBox
                  node={node}
                  selfW={selfW}
                  isActive={activePos?.node.id === node.id}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
