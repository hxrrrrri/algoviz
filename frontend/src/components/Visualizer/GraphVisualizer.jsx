import { useMemo } from 'react';
import { getGraph } from '../../utils/vizMapper';
import './GraphVisualizer.css';

const NODE_R = 20;
const CANVAS = 320;
const CENTER = CANVAS / 2;

function circleLayout(nodes) {
  const n = nodes.length;
  if (n === 0) return {};
  if (n === 1) return { [nodes[0]]: { x: CENTER, y: CENTER } };
  const radius = Math.min(CENTER - NODE_R - 14, Math.max(70, n * 16));
  const pos = {};
  nodes.forEach((nd, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    pos[nd] = { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
  });
  return pos;
}

function arrowHead(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const ux = dx / len, uy = dy / len;
  // tip at node edge
  const tx = x2 - ux * (r + 2), ty = y2 - uy * (r + 2);
  const angle = Math.atan2(uy, ux);
  const spread = 0.35;
  const aLen = 9;
  const ax1 = tx - aLen * Math.cos(angle - spread);
  const ay1 = ty - aLen * Math.sin(angle - spread);
  const ax2 = tx - aLen * Math.cos(angle + spread);
  const ay2 = ty - aLen * Math.sin(angle + spread);
  return `M ${tx} ${ty} L ${ax1} ${ay1} M ${tx} ${ty} L ${ax2} ${ay2}`;
}

function edgePath(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return '';
  const ux = dx / len, uy = dy / len;
  return `M ${x1 + ux * r} ${y1 + uy * r} L ${x2 - ux * r} ${y2 - uy * r}`;
}

export default function GraphVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const data = useMemo(() => getGraph(locals, hints), [locals, hints]);
  const name = data?.name ?? 'graph';
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];
  const directed = !!data?.directed;
  const pos = useMemo(() => circleLayout(nodes), [nodes]);

  // Deduplicate undirected edges for display
  const displayEdges = useMemo(() => {
    if (directed) return edges;
    const seen = new Set();
    return edges.filter(([a, b]) => {
      const k = [a, b].sort().join('--');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [edges, directed]);

  if (!nodes.length) return null;

  const canvasH = nodes.length <= 2 ? 120 : CANVAS;

  return (
    <div className="gv">
      <div className="gv-header">
        <span className="gv-name">{name}</span>
        <span className="gv-type">{directed ? 'directed' : 'undirected'} graph</span>
        <span className="gv-stats">{nodes.length}V · {displayEdges.length}E</span>
      </div>

      <div className="gv-body">
        <svg width={CANVAS} height={canvasH} viewBox={`0 0 ${CANVAS} ${canvasH}`} className="gv-svg">
          {/* Edges */}
          {displayEdges.map(([a, b], i) => {
            const pa = pos[a], pb = pos[b];
            if (!pa || !pb) return null;
            const d = edgePath(pa.x, pa.y, pb.x, pb.y, NODE_R);
            const ah = directed ? arrowHead(pa.x, pa.y, pb.x, pb.y, NODE_R) : null;
            return (
              <g key={`e-${i}`}>
                <path d={d} className="gv-edge" />
                {ah && <path d={ah} className="gv-arrow" />}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((nd) => {
            const p = pos[nd];
            if (!p) return null;
            const label = String(nd).slice(0, 5);
            return (
              <g key={nd} className="gv-node-g">
                <circle cx={p.x} cy={p.y} r={NODE_R} className="gv-node" />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                  className="gv-node-label">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Adjacency list */}
        <div className="gv-adj">
          <div className="gv-adj-title">Adjacency</div>
          {Object.entries(
            edges.reduce((acc, [a, b]) => {
              if (!acc[a]) acc[a] = [];
              acc[a].push(b);
              return acc;
            }, {})
          ).map(([src, dsts]) => (
            <div key={src} className="gv-adj-row">
              <span className="gv-adj-node">{src}</span>
              <span className="gv-adj-arrow">→</span>
              <span className="gv-adj-dsts">{dsts.join(', ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
