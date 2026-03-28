import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getHeap } from '../../utils/vizMapper';
import './HeapVisualizer.css';

const NODE_R = 22;   // node circle radius
const LX     = 60;   // horizontal spacing multiplier per level
const LY     = 72;   // vertical spacing per level

function buildTree(values) {
  const n = values.length;
  const nodes = values.map((val, i) => {
    const level = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (Math.pow(2, level) - 1);
    const totalInLevel = Math.pow(2, level);
    // x in [0,1] range, will be scaled later
    const xFrac = (posInLevel + 0.5) / totalInLevel;
    return { val, i, level, xFrac };
  });

  // max level
  const maxLevel = nodes.length > 0 ? nodes[nodes.length - 1].level : 0;
  const width = Math.pow(2, maxLevel) * LX * 2;
  const height = (maxLevel + 1) * LY + NODE_R * 2 + 10;

  const positioned = nodes.map(nd => ({
    ...nd,
    x: nd.xFrac * width,
    y: nd.level * LY + NODE_R + 10,
  }));

  const edges = [];
  for (let i = 1; i < n; i++) {
    const parent = Math.floor((i - 1) / 2);
    edges.push({ from: parent, to: i });
  }

  return { nodes: positioned, edges, width, height };
}

// Detect if it's a min-heap: root <= children
function detectHeapType(values) {
  for (let i = 0; i < values.length; i++) {
    const l = 2 * i + 1, r = 2 * i + 2;
    if (l < values.length && values[l] < values[i]) return 'max';
    if (r < values.length && values[r] < values[i]) return 'max';
  }
  return 'min';
}

export default function HeapVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const data = useMemo(() => getHeap(locals, hints), [locals, hints]);
  if (!data?.values?.length) return null;

  const { name, values } = data;
  const { nodes, edges, width, height } = useMemo(() => buildTree(values), [values]);
  const heapType = useMemo(() => detectHeapType(values), [values]);

  return (
    <div className="hv">
      <div className="hv-header">
        <span className="hv-name">{name}</span>
        <span className={`hv-type hv-type-${heapType}`}>{heapType}-heap</span>
        <span className="hv-len">[{values.length}]</span>
      </div>

      <div className="hv-body">
        <svg width={Math.max(width, 120)} height={height} className="hv-svg">
          {/* Edges */}
          {edges.map(({ from, to }) => {
            const f = nodes[from], t = nodes[to];
            return (
              <line key={`e-${from}-${to}`}
                x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                className="hv-edge" />
            );
          })}

          {/* Nodes */}
          {nodes.map((nd) => {
            const isRoot = nd.i === 0;
            return (
              <g key={nd.i}>
                <motion.circle
                  cx={nd.x} cy={nd.y} r={NODE_R}
                  className={`hv-node ${isRoot ? 'hv-node-root' : ''}`}
                  layoutId={`hv-n-${nd.i}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28, delay: nd.i * 0.02 }}
                />
                <text x={nd.x} y={nd.y + 1} className="hv-node-val" textAnchor="middle" dominantBaseline="middle">
                  {String(nd.val ?? '').slice(0, 4)}
                </text>
                <text x={nd.x + NODE_R - 4} y={nd.y - NODE_R + 6} className="hv-node-idx" textAnchor="end">
                  {nd.i}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Array view at bottom */}
        <div className="hv-arr">
          {values.map((v, i) => (
            <div key={i} className={`hv-arr-cell ${i === 0 ? 'hv-arr-root' : ''}`}>
              <span className="hv-arr-val">{String(v ?? '').slice(0, 5)}</span>
              <span className="hv-arr-idx">{i}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
