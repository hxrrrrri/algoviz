import { useMemo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TrainingCurveVisualizer.css';

/* ── Colour map ── */
const METRIC_COLORS = {
  loss:         '#f87171', val_loss:      '#fca5a5',
  accuracy:     '#34d399', val_accuracy:  '#6ee7b7',
  acc:          '#34d399', val_acc:       '#6ee7b7',
  mae:          '#60a5fa', val_mae:       '#93c5fd',
  mse:          '#a78bfa', val_mse:       '#c4b5fd',
  auc:          '#f59e0b', val_auc:       '#fcd34d',
  precision:    '#fb923c', val_precision: '#fdba74',
  recall:       '#e879f9', val_recall:    '#f0abfc',
};
const FALLBACK = ['#00e5ff','#ff9500','#bc8cff','#e3b341','#f85149','#39d353'];

/* ── Helpers ── */
function niceStep(range, ticks = 5) {
  const raw = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return [1, 2, 2.5, 5, 10].find(n => n * mag >= raw) * mag;
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
function smoothPath(xs, ys) {
  if (!xs.length) return '';
  if (xs.length === 1) return `M ${xs[0]} ${ys[0]}`;
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const t  = 0.35;
    const cpx1 = xs[i-1] + (xs[i] - xs[i-1]) * t;
    const cpx2 = xs[i]   - (xs[i] - xs[i-1]) * t;
    d += ` C ${cpx1} ${ys[i-1]}, ${cpx2} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  return d;
}
function fmtVal(v) {
  if (v == null || !isFinite(v)) return '—';
  return v < 0.01 ? v.toExponential(2) : v < 1 ? v.toFixed(4) : v.toFixed(3);
}
function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : '—'; }

function normaliseHistoryObject(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const src = Array.isArray(v)
      ? v
      : (v?.type === 'list' && Array.isArray(v.value) ? v.value : null);
    if (!src) continue;
    const vals = src
      .map(x => {
        if (typeof x === 'number') return x;
        if (x && typeof x === 'object') return parseFloat(x.value ?? x);
        return parseFloat(x);
      })
      .filter(n => Number.isFinite(n));
    if (vals.length > 0) out[k] = vals;
  }
  return Object.keys(out).length ? out : null;
}

/* ── Extract history from repr ── */
function extractHistory(repr) {
  if (!repr) return null;
  // Backend may attach compact history directly on serialized model objects.
  if (repr.type === 'object' && repr.history && typeof repr.history === 'object') {
    const parsed = normaliseHistoryObject(repr.history);
    if (parsed) return parsed;
  }
  // Also support object attrs.history stored in safe_repr-style dict/list format.
  if (repr.type === 'object' && repr.attrs?.history) {
    const nested = extractHistory(repr.attrs.history);
    if (nested) return nested;
  }
  if (repr.type === 'keras_history') {
    return normaliseHistoryObject(repr.history) || null;
  }
  if (repr.type === 'dict' && repr.value) {
    const ML_KEYS = new Set(['loss','val_loss','accuracy','val_accuracy','acc','val_acc',
                             'mae','val_mae','mse','val_mse','auc','val_auc','precision',
                             'val_precision','recall','val_recall']);
    const result = {};
    for (const [k, v] of Object.entries(repr.value)) {
      if (ML_KEYS.has(k) && v?.type === 'list' && Array.isArray(v.value)) {
        result[k] = v.value.map(x => (x?.type === 'float' || x?.type === 'int')
          ? x.value : parseFloat(x?.value ?? x));
      }
    }
    if (Object.keys(result).length) return result;
  }
  return null;
}

export function getTrainingHistory(locals, hints) {
  if (!locals) return null;
  const seen = new Set();

  // Preferred path: backend-provided hints.
  if (hints) {
    for (const [name, hint] of Object.entries(hints)) {
      if (hint === 'training_history' && locals[name]) {
        const hist = extractHistory(locals[name]);
        if (hist) return { name, history: hist };
        seen.add(name);
      }
    }
  }

  // Fallback path: infer from locals so fit-history still shows without explicit hints.
  for (const [name, repr] of Object.entries(locals)) {
    if (seen.has(name)) continue;
    if (!/history|metric|log/i.test(name) && repr?.type !== 'keras_history' && !repr?.history && !repr?.attrs?.history) {
      continue;
    }
    const hist = extractHistory(repr);
    if (hist) return { name, history: hist };
  }

  return null;
}

/* ── Metric chart with hover ── */
const PAD = { top: 24, right: 72, bottom: 40, left: 52 };

function MetricChart({ label, series, isLoss }) {
  const svgRef   = useRef(null);
  const [hover, setHover] = useState(null);

  const epochs   = Math.max(...series.map(s => s.values.length));
  const allVals  = series.flatMap(s => s.values).filter(v => isFinite(v));
  const minV     = Math.min(...allVals);
  const maxV     = Math.max(...allVals);
  const ticks    = yTicks(minV, maxV);
  const lo       = ticks[0] ?? minV;
  const hi       = ticks[ticks.length - 1] ?? maxV;
  const range    = hi - lo || 1;

  // Best epoch (per primary val_ series or train series)
  const valSeries  = series.find(s => s.key.startsWith('val_'));
  const mainSeries = valSeries || series[0];
  const bestIdx    = useMemo(() => {
    if (!mainSeries) return 0;
    const vs = mainSeries.values;
    return isLoss
      ? vs.indexOf(Math.min(...vs))
      : vs.indexOf(Math.max(...vs));
  }, [mainSeries, isLoss]);

  const W  = 480;
  const H  = 200;
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top  - PAD.bottom;

  const toX = i => PAD.left + (i / Math.max(epochs - 1, 1)) * PW;
  const toY = v => PAD.top  + (1 - (v - lo) / range) * PH;

  const xTicks = useMemo(() => {
    const count = Math.min(epochs, 8);
    return Array.from({ length: count }, (_, i) =>
      Math.round(i * (epochs - 1) / Math.max(count - 1, 1)));
  }, [epochs]);

  const handleMouseMove = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX  = (e.clientX - rect.left) * (W / rect.width);
    const relX  = svgX - PAD.left;
    const idx   = Math.round(relX / PW * (epochs - 1));
    if (idx >= 0 && idx < epochs) setHover(idx);
  }, [epochs]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  const gradId = `grad-${label}`;

  return (
    <div className="tc-chart-wrap">
      <div className="tc-chart-title">
        <span className="tc-chart-name">{label.toUpperCase()}</span>
        {/* Best value badge */}
        {mainSeries && (
          <span className="tc-best-badge" style={{ color: mainSeries.color, borderColor: mainSeries.color + '55', background: mainSeries.color + '15' }}>
            {isLoss ? '↓ best ' : '↑ best '}
            {fmtVal(mainSeries.values[bestIdx])} @ epoch {bestIdx + 1}
          </span>
        )}
      </div>

      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
        className="tc-svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'crosshair' }}>

        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`${gradId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.22"/>
              <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
            </linearGradient>
          ))}
        </defs>

        {/* Y grid + ticks */}
        {ticks.map(t => {
          const y = toY(t);
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="var(--border-2)" strokeWidth={0.8} strokeDasharray="3 4" opacity={0.5}/>
              <text x={PAD.left - 6} y={y} textAnchor="end" dominantBaseline="middle" className="tc-tick">
                {fmtVal(t)}
              </text>
            </g>
          );
        })}

        {/* X ticks */}
        {xTicks.map(i => (
          <g key={i}>
            <line x1={toX(i)} y1={PAD.top} x2={toX(i)} y2={H - PAD.bottom}
              stroke="var(--border-2)" strokeWidth={0.8} strokeDasharray="3 4" opacity={0.3}/>
            <text x={toX(i)} y={H - PAD.bottom + 14} textAnchor="middle" className="tc-tick">
              {i + 1}
            </text>
          </g>
        ))}

        {/* Best epoch marker */}
        {bestIdx != null && (
          <line
            x1={toX(bestIdx)} y1={PAD.top - 4}
            x2={toX(bestIdx)} y2={H - PAD.bottom}
            stroke={mainSeries?.color || '#888'} strokeWidth={1.2}
            strokeDasharray="4 3" opacity={0.5}
          />
        )}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
          stroke="var(--border-1)" strokeWidth={1.5}/>
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
          stroke="var(--border-1)" strokeWidth={1.5}/>

        {/* Axis labels */}
        <text x={PAD.left + PW / 2} y={H - 4} textAnchor="middle" className="tc-axis-lbl">Epoch</text>
        <text x={12} y={PAD.top + PH / 2} textAnchor="middle" className="tc-axis-lbl"
          transform={`rotate(-90, 12, ${PAD.top + PH / 2})`}>{label}</text>

        {/* Area fills + lines */}
        {series.map(s => {
          const xs = s.values.map((_, i) => toX(i));
          const ys = s.values.map(v => toY(v));
          const path = smoothPath(xs, ys);
          const isVal = s.key.startsWith('val_');
          const areaPath = path + ` L ${xs[xs.length-1]} ${H - PAD.bottom} L ${xs[0]} ${H - PAD.bottom} Z`;
          return (
            <g key={s.key}>
              {/* Area */}
              {!isVal && (
                <motion.path d={areaPath} fill={`url(#${gradId}-${s.key})`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6 }}/>
              )}
              {/* Line */}
              <motion.path d={path} fill="none"
                stroke={s.color} strokeWidth={isVal ? 1.8 : 2.4}
                strokeDasharray={isVal ? '6 3' : 'none'}
                strokeLinecap="round" strokeLinejoin="round"
                opacity={isVal ? 0.7 : 1}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: isVal ? 0.7 : 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
              {/* End dot */}
              <motion.circle
                cx={xs[xs.length-1]} cy={ys[ys.length-1]}
                r={4} fill={s.color} stroke="var(--bg-card)" strokeWidth={1.5}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 1.1, type: 'spring', stiffness: 400 }}
              />
              {/* End label */}
              <text x={xs[xs.length-1] + 8} y={ys[ys.length-1]}
                dominantBaseline="middle" className="tc-end-lbl" style={{ fill: s.color }}>
                {fmtVal(s.values[s.values.length - 1])}
              </text>
            </g>
          );
        })}

        {/* Hover crosshair */}
        {hover != null && (
          <g>
            <line x1={toX(hover)} y1={PAD.top} x2={toX(hover)} y2={H - PAD.bottom}
              stroke="var(--text-3)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6}/>
            {series.map(s => {
              const v = s.values[hover];
              if (v == null || !isFinite(v)) return null;
              return (
                <circle key={s.key} cx={toX(hover)} cy={toY(v)}
                  r={5} fill={s.color} stroke="var(--bg-base)" strokeWidth={2}/>
              );
            })}
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hover != null && (
          <motion.div className="tc-tooltip"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
            <div className="tc-tt-epoch">Epoch {hover + 1}</div>
            {series.map(s => (
              <div key={s.key} className="tc-tt-row">
                <span className="tc-tt-dot" style={{ background: s.color }}/>
                <span className="tc-tt-key">{s.key}</span>
                <span className="tc-tt-val" style={{ color: s.color }}>
                  {fmtVal(s.values[hover])}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Summary stats strip ── */
function SummaryStrip({ history, keys }) {
  const stats = useMemo(() => {
    const out = [];
    const done = new Set();
    for (const k of keys) {
      const family = k.replace(/^val_/, '');
      if (done.has(family)) continue;
      done.add(family);
      const isLoss = family.includes('loss') || family === 'mae' || family === 'mse';
      const trainVals = history[family]      || [];
      const valVals   = history[`val_${family}`] || [];
      const trainFinal = trainVals[trainVals.length - 1];
      const valFinal   = valVals[valVals.length - 1];
      const trainBest  = isLoss ? Math.min(...trainVals) : Math.max(...trainVals);
      const valBest    = valVals.length ? (isLoss ? Math.min(...valVals) : Math.max(...valVals)) : null;
      const isAcc = family.includes('acc') || family === 'auc' || family === 'precision' || family === 'recall';
      out.push({ family, isLoss, isAcc, trainFinal, valFinal, trainBest, valBest,
                 color: METRIC_COLORS[family] || '#888' });
    }
    return out;
  }, [history, keys]);

  return (
    <div className="tc-summary">
      {stats.map(s => (
        <div key={s.family} className="tc-stat-card" style={{ '--sc': s.color }}>
          <div className="tc-stat-name">{s.family}</div>
          <div className="tc-stat-vals">
            <div className="tc-stat-item">
              <span className="tc-stat-lbl">Train</span>
              <span className="tc-stat-num">{s.isAcc ? pct(s.trainFinal) : fmtVal(s.trainFinal)}</span>
            </div>
            {s.valFinal != null && (
              <div className="tc-stat-item tc-stat-val">
                <span className="tc-stat-lbl">Val</span>
                <span className="tc-stat-num">{s.isAcc ? pct(s.valFinal) : fmtVal(s.valFinal)}</span>
              </div>
            )}
          </div>
          {/* Overfit warning */}
          {s.valFinal != null && !s.isLoss && (s.trainFinal - s.valFinal) > 0.05 && (
            <div className="tc-overfit-warn">⚠ Overfitting</div>
          )}
          {s.valFinal != null && s.isLoss && (s.valFinal - s.trainFinal) > 0.1 && (
            <div className="tc-overfit-warn">⚠ Overfitting</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Main ── */
export default function TrainingCurveVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const data = useMemo(() => {
    try {
      return getTrainingHistory(locals, hints);
    } catch {
      return null;
    }
  }, [locals, hints]);
  const name = data?.name ?? '';
  const history = data?.history ?? null;
  const keys = history ? Object.keys(history) : [];
  const epochs = keys.length ? (history[keys[0]]?.length ?? 0) : 0;

  // Group into families
  const families = useMemo(() => {
    if (!history) return [];
    const map = {};
    let ci = 0;
    for (const key of keys) {
      const family = key.replace(/^val_/, '');
      if (!map[family]) map[family] = [];
      const color = METRIC_COLORS[key] || FALLBACK[ci++ % FALLBACK.length];
      map[family].push({ key, values: history[key] ?? [], color });
    }
    return Object.entries(map);
  }, [history, keys]);

  if (!data) return null;

  return (
    <motion.div className="tc"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}>

      {/* Header */}
      <div className="tc-header">
        <div className="tc-header-l">
          <div className="tc-indicator" />
          <span className="tc-varname">{name}</span>
          <span className="tc-badge-hist">Training History</span>
        </div>
        <div className="tc-header-r">
          <span className="tc-epoch-count">
            <span className="tc-epoch-n">{epochs}</span> epoch{epochs !== 1 ? 's' : ''}
          </span>
          {/* Legend */}
          <div className="tc-legend">
            {keys.map(k => (
              <span key={k} className="tc-leg-item">
                <span className="tc-leg-line"
                  style={{ background: METRIC_COLORS[k] || '#888',
                           opacity: k.startsWith('val_') ? 0.65 : 1 }}
                  data-dashed={k.startsWith('val_') ? 'true' : 'false'}
                />
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <SummaryStrip history={history} keys={keys} />

      {/* Charts */}
      <div className="tc-charts">
        {families.map(([family, series]) => (
          <MetricChart
            key={family}
            label={family}
            series={series}
            isLoss={family.includes('loss') || family === 'mae' || family === 'mse'}
          />
        ))}
      </div>

    </motion.div>
  );
}
