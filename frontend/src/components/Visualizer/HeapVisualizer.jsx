import { useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getHeap } from '../../utils/vizMapper';
import './HeapVisualizer.css';

const NODE_R  = 18;   // compact node radius for stage view
const LY      = 58;   // vertical gap per level
const PAD_X   = 10;

/* ── Build a positioned tree from a flat heap array ── */
function buildTree(values) {
  if (!values.length) return { nodes: [], edges: [], width: 0, height: 0 };
  const n         = values.length;
  const maxLevel  = Math.floor(Math.log2(n));
  const width     = Math.pow(2, maxLevel) * NODE_R * 3.6;
  const height    = (maxLevel + 1) * LY + NODE_R * 2 + 6;

  const nodes = values.map((val, i) => {
    const level      = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (Math.pow(2, level) - 1);
    const totalInLevel = Math.pow(2, level);
    const x = ((posInLevel + 0.5) / totalInLevel) * width;
    const y = level * LY + NODE_R + 6;
    return { val, i, level, x, y };
  });

  const edges = [];
  for (let i = 1; i < n; i++) {
    edges.push({ from: Math.floor((i - 1) / 2), to: i });
  }

  return { nodes, edges, width: Math.max(width, NODE_R * 4), height };
}

function detectHeapType(values) {
  for (let i = 0; i < values.length; i++) {
    const l = 2 * i + 1, r = 2 * i + 2;
    if (l < values.length && values[l] < values[i]) return 'max';
    if (r < values.length && values[r] < values[i]) return 'max';
  }
  return 'min';
}

/* ── Collect unique heap stages from the full trace ── */
function collectStages(trace) {
  const stages = [];
  let prevKey = null;

  for (let si = 0; si < trace.length; si++) {
    const step = trace[si];
    const data = getHeap(step.locals, step.structure_hints);
    if (!data?.values?.length) continue;

    const key = data.values.join(',');
    if (key === prevKey) continue;         // no change — skip
    prevKey = key;

    stages.push({
      values:   data.values,
      name:     data.name,
      stepIndex: si,
      key,
    });
  }
  return stages;
}

/* ── Single compact heap stage ── */
function HeapStage({ stage, isActive, isFinal }) {
  const { nodes, edges, width, height } = useMemo(
    () => buildTree(stage.values), [stage.values]
  );
  const heapType = useMemo(() => detectHeapType(stage.values), [stage.values]);
  const typeColor = heapType === 'min' ? '#00e5ff' : '#f85149';

  return (
    <div className={`hvs-stage ${isActive ? 'hvs-stage-active' : ''} ${isFinal ? 'hvs-stage-final' : ''}`}>
      {/* Stage label */}
      <div className="hvs-stage-header">
        <span className={`hvs-type hvs-type-${heapType}`}>{heapType}</span>
        <span className="hvs-len">[{stage.values.length}]</span>
        {isFinal && <span className="hvs-final-tag">final</span>}
      </div>

      {/* Tree SVG */}
      <svg
        width={width + PAD_X * 2}
        height={height}
        className="hvs-svg"
        style={{ '--htype-color': typeColor }}
      >
        {/* Edges */}
        {edges.map(({ from, to }) => {
          const f = nodes[from], t = nodes[to];
          return (
            <line key={`e-${from}-${to}`}
              x1={f.x + PAD_X} y1={f.y}
              x2={t.x + PAD_X} y2={t.y}
              className="hvs-edge"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(nd => {
          const isRoot = nd.i === 0;
          return (
            <g key={nd.i}>
              <circle
                cx={nd.x + PAD_X} cy={nd.y} r={NODE_R}
                className={`hvs-node ${isRoot ? 'hvs-node-root' : ''}`}
              />
              <text
                x={nd.x + PAD_X} y={nd.y}
                textAnchor="middle" dominantBaseline="central"
                className={`hvs-node-val ${isRoot ? 'hvs-node-val-root' : ''}`}
              >
                {String(nd.val ?? '').slice(0, 4)}
              </text>
              <text
                x={nd.x + PAD_X + NODE_R - 2} y={nd.y - NODE_R + 5}
                textAnchor="end" className="hvs-node-idx"
              >
                {nd.i}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Array strip */}
      <div className="hvs-arr">
        {stage.values.map((v, i) => (
          <div key={i} className={`hvs-arr-cell ${i === 0 ? 'hvs-arr-root' : ''}`}>
            <span className="hvs-arr-val">{String(v ?? '').slice(0, 5)}</span>
            <span className="hvs-arr-idx">{i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function HeapVisualizer({ trace, currentStep }) {
  const stages = useMemo(() => collectStages(trace || []), [trace]);
  const scrollRef = useRef(null);

  /* Find which stage is "current" — last stage whose stepIndex <= currentStep */
  const activeIdx = useMemo(() => {
    if (!stages.length) return -1;
    let best = 0;
    for (let i = 0; i < stages.length; i++) {
      if (stages[i].stepIndex <= currentStep) best = i;
      else break;
    }
    return best;
  }, [stages, currentStep]);

  /* Auto-scroll active stage into view during playback */
  useEffect(() => {
    if (!scrollRef.current) return;
    const active = scrollRef.current.querySelector('.hvs-stage-active');
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIdx]);

  if (!stages.length) return null;

  const heapName  = stages[0].name;
  const finalType = detectHeapType(stages[stages.length - 1].values);

  return (
    <div className="hv">
      {/* Header */}
      <div className="hv-header">
        <span className="hv-name">{heapName}</span>
        <span className={`hv-type hv-type-${finalType}`}>{finalType}-heap</span>
        <span className="hv-stages-count">{stages.length} stage{stages.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Stage timeline */}
      <div className="hvs-timeline" ref={scrollRef}>
        {stages.map((stage, idx) => {
          const isActive = idx === activeIdx;
          const isFinal  = idx === stages.length - 1;
          return (
            <div key={stage.key + idx} className="hvs-stage-wrap">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, type: 'spring', stiffness: 320, damping: 28 }}
              >
                <HeapStage stage={stage} isActive={isActive} isFinal={isFinal} />
              </motion.div>

              {/* Arrow to next stage */}
              {idx < stages.length - 1 && (
                <div className="hvs-arrow">
                  <div className="hvs-arrow-line" />
                  <div className="hvs-arrow-head" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
