import { useMemo } from 'react';
import './TrainingCurveVisualizer.css';

const W = 420, H = 220, PAD = { top: 18, right: 20, bottom: 36, left: 48 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top  - PAD.bottom;

const METRIC_COLORS = {
  loss:          '#f87171',
  val_loss:      '#fca5a5',
  accuracy:      '#34d399',
  val_accuracy:  '#6ee7b7',
  acc:           '#34d399',
  val_acc:       '#6ee7b7',
  mae:           '#60a5fa',
  val_mae:       '#93c5fd',
  mse:           '#a78bfa',
  val_mse:       '#c4b5fd',
  auc:           '#f59e0b',
  val_auc:       '#fcd34d',
};
const DEFAULT_COLORS = ['#00e5ff','#ff9500','#bc8cff','#e3b341','#f85149','#39d353'];

function polyline(xs, ys) {
  return xs.map((x, i) => `${x},${ys[i]}`).join(' ');
}

function niceStep(range, ticks = 5) {
  const raw  = range / ticks;
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].find(n => n * mag >= raw) * mag;
  return nice;
}

function yTicks(min, max) {
  const step  = niceStep(max - min || 1);
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.01; v = +(v + step).toFixed(10)) {
    ticks.push(+v.toPrecision(4));
    if (ticks.length > 8) break;
  }
  return ticks;
}

/* ── Extract history from a locals repr ── */
function extractHistory(repr) {
  if (!repr) return null;
  // keras_history type
  if (repr.type === 'keras_history') return repr.history;
  // plain dict with loss/accuracy keys
  if (repr.type === 'dict' && repr.value) {
    const ML_KEYS = new Set(['loss','val_loss','accuracy','val_accuracy',
                             'acc','val_acc','mae','val_mae','mse','val_mse','auc','val_auc']);
    const result  = {};
    for (const [k, v] of Object.entries(repr.value)) {
      if (ML_KEYS.has(k) && v?.type === 'list' && Array.isArray(v.value)) {
        result[k] = v.value.map(x => (x?.type === 'float' || x?.type === 'int') ? x.value : parseFloat(x?.value ?? x));
      }
    }
    if (Object.keys(result).length) return result;
  }
  return null;
}

export function getTrainingHistory(locals, hints) {
  if (!locals || !hints) return null;
  for (const [name, hint] of Object.entries(hints)) {
    if (hint === 'training_history' && locals[name]) {
      const hist = extractHistory(locals[name]);
      if (hist) return { name, history: hist };
    }
  }
  return null;
}

/* ── Single metric chart ── */
function MetricChart({ label, series }) {
  // series: [{key, values, color}]
  const epochs = Math.max(...series.map(s => s.values.length));
  if (!epochs) return null;

  const allVals = series.flatMap(s => s.values).filter(v => isFinite(v));
  const minV    = Math.min(...allVals);
  const maxV    = Math.max(...allVals);
  const ticks   = yTicks(minV, maxV);
  const lo      = ticks[0];
  const hi      = ticks[ticks.length - 1];
  const range   = hi - lo || 1;

  const toX = i  => PAD.left + (i / (epochs - 1 || 1)) * PW;
  const toY = v  => PAD.top  + (1 - (v - lo) / range) * PH;

  const xTickCount = Math.min(epochs, 6);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round(i * (epochs - 1) / (xTickCount - 1 || 1))
  );

  return (
    <div className="tc-chart">
      <div className="tc-chart-label">{label}</div>
      <svg width={W} height={H} className="tc-svg">
        {/* Grid */}
        {ticks.map(t => {
          const y = toY(t);
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="var(--border-2)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6}/>
              <text x={PAD.left - 5} y={y} textAnchor="end" dominantBaseline="middle"
                className="tc-tick-label">
                {t < 1 ? t.toFixed(3) : t.toFixed(2)}
              </text>
            </g>
          );
        })}
        {xTicks.map(i => (
          <g key={i}>
            <line x1={toX(i)} y1={PAD.top} x2={toX(i)} y2={H - PAD.bottom}
              stroke="var(--border-2)" strokeWidth={1} strokeDasharray="3 3" opacity={0.4}/>
            <text x={toX(i)} y={H - PAD.bottom + 14} textAnchor="middle"
              className="tc-tick-label">{i + 1}</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
          stroke="var(--border-1)" strokeWidth={1.5}/>
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
          stroke="var(--border-1)" strokeWidth={1.5}/>

        {/* Lines */}
        {series.map(s => {
          const xs = s.values.map((_, i) => toX(i));
          const ys = s.values.map(v     => toY(v));
          const isVal = s.key.startsWith('val_');
          return (
            <g key={s.key}>
              <polyline
                points={polyline(xs, ys)} fill="none"
                stroke={s.color} strokeWidth={isVal ? 1.5 : 2.2}
                strokeDasharray={isVal ? '5 3' : 'none'}
                strokeLinecap="round" strokeLinejoin="round"
                opacity={isVal ? 0.75 : 1}
              />
              {/* Dots at each epoch */}
              {s.values.map((v, i) => (
                <circle key={i} cx={toX(i)} cy={toY(v)} r={epochs > 20 ? 0 : 3}
                  fill={s.color} opacity={0.9}/>
              ))}
              {/* Final value label */}
              <text
                x={toX(s.values.length - 1) + 5}
                y={toY(s.values[s.values.length - 1])}
                dominantBaseline="middle" className="tc-end-label"
                style={{ fill: s.color }}>
                {s.values[s.values.length - 1]?.toFixed(3)}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={PAD.left + PW / 2} y={H - 2} textAnchor="middle"
          className="tc-axis-label">Epoch</text>
        <text x={10} y={PAD.top + PH / 2} textAnchor="middle"
          className="tc-axis-label"
          transform={`rotate(-90, 10, ${PAD.top + PH / 2})`}>
          {label}
        </text>
      </svg>
    </div>
  );
}

/* ── Main component ── */
export default function TrainingCurveVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const data = useMemo(() => getTrainingHistory(locals, hints), [locals, hints]);
  if (!data) return null;

  const { name, history } = data;
  const keys = Object.keys(history);

  // Group by metric family: loss, accuracy, mae, etc.
  const families = useMemo(() => {
    const map = {};
    let colorIdx = 0;
    for (const key of keys) {
      const family = key.replace(/^val_/, '');
      if (!map[family]) map[family] = [];
      const color = METRIC_COLORS[key] || DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length];
      map[family].push({ key, values: history[key], color });
    }
    return Object.entries(map);
  }, [history, keys]);

  const epochs = history[keys[0]]?.length ?? 0;

  return (
    <div className="tc">
      {/* Header */}
      <div className="tc-header">
        <span className="tc-name">{name}</span>
        <span className="tc-badge">Training History</span>
        <span className="tc-epochs">{epochs} epoch{epochs !== 1 ? 's' : ''}</span>
      </div>

      {/* Legend */}
      <div className="tc-legend">
        {keys.map(k => (
          <span key={k} className="tc-leg-item">
            <span className="tc-leg-swatch"
              style={{ background: METRIC_COLORS[k] || '#888',
                       borderStyle: k.startsWith('val_') ? 'dashed' : 'solid' }}/>
            {k}
          </span>
        ))}
      </div>

      {/* Charts — one per metric family */}
      <div className="tc-charts">
        {families.map(([family, series]) => (
          <MetricChart key={family} label={family} series={series} />
        ))}
      </div>
    </div>
  );
}
