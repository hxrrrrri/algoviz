import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { flattenValue } from '../../utils/vizMapper';
import './MLModelVisualizer.css';

/* ── Helpers ── */
function displayVal(repr) {
  if (!repr) return '—';
  const v = flattenValue(repr);
  if (v === null) return 'None';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 50);
  return String(v).slice(0, 50);
}

function isNNClass(cls) {
  return /sequential|functional|model|dense|conv|lstm|gru|transformer|resnet|residual/i.test(cls);
}

/* ── Layer config ── */
const LAYER_CFG = {
  dense:      { color: '#7c84f0', icon: '⬡', desc: 'Fully Connected' },
  conv2d:     { color: '#f59e0b', icon: '⊞', desc: 'Convolution 2D' },
  conv1d:     { color: '#fbbf24', icon: '⊟', desc: 'Convolution 1D' },
  add:        { color: '#22c55e', icon: '⊕', desc: 'Residual Skip Merge' },
  lstm:       { color: '#34d399', icon: '↻', desc: 'Long Short-Term Memory' },
  gru:        { color: '#60a5fa', icon: '↺', desc: 'Gated Recurrent Unit' },
  dropout:    { color: '#f87171', icon: '%', desc: 'Regularization' },
  batchnorm:  { color: '#a78bfa', icon: '≈', desc: 'Batch Normalization' },
  globalavg:  { color: '#14b8a6', icon: '◎', desc: 'Global Average Pooling' },
  flatten:    { color: '#94a3b8', icon: '⟄', desc: 'Flatten to 1D' },
  embedding:  { color: '#fb923c', icon: '↦', desc: 'Embedding Layer' },
  maxpool:    { color: '#22d3ee', icon: '↓', desc: 'Max Pooling' },
  avgpool:    { color: '#67e8f9', icon: '↓', desc: 'Avg Pooling' },
  attention:  { color: '#e879f9', icon: '◈', desc: 'Self-Attention' },
  default:    { color: '#64748b', icon: '○', desc: 'Layer' },
};

function layerCfg(cls) {
  const lc = cls?.toLowerCase() ?? '';
  if (lc.includes('conv2d')) return { ...LAYER_CFG.conv2d, key: 'conv2d' };
  if (lc.includes('conv1d')) return { ...LAYER_CFG.conv1d, key: 'conv1d' };
  if (lc === 'add' || lc.endsWith('add')) return { ...LAYER_CFG.add, key: 'add' };
  if (lc.includes('batchnormalization') || lc.includes('batchnorm')) {
    return { ...LAYER_CFG.batchnorm, key: 'batchnorm' };
  }
  if (lc.includes('globalaveragepooling')) return { ...LAYER_CFG.globalavg, key: 'globalavg' };
  if (lc.includes('maxpool')) return { ...LAYER_CFG.maxpool, key: 'maxpool' };
  if (lc.includes('avgpool') || lc.includes('averagepooling')) return { ...LAYER_CFG.avgpool, key: 'avgpool' };
  if (lc.includes('dense')) return { ...LAYER_CFG.dense, key: 'dense' };
  if (lc.includes('lstm')) return { ...LAYER_CFG.lstm, key: 'lstm' };
  if (lc.includes('gru')) return { ...LAYER_CFG.gru, key: 'gru' };
  if (lc.includes('dropout')) return { ...LAYER_CFG.dropout, key: 'dropout' };
  if (lc.includes('flatten')) return { ...LAYER_CFG.flatten, key: 'flatten' };
  if (lc.includes('embedding')) return { ...LAYER_CFG.embedding, key: 'embedding' };
  if (lc.includes('attention')) return { ...LAYER_CFG.attention, key: 'attention' };
  return { ...LAYER_CFG.default, key: 'default' };
}

function inferNNFamily(cls, layers) {
  const lc = (cls || '').toLowerCase();
  const names = (layers || []).map(l => (l.cls || '').toLowerCase());
  const hasConv = names.some(n => n.includes('conv'));
  const hasAdd = names.some(n => n === 'add' || n.endsWith('add'));
  const hasRnn = names.some(n => n.includes('lstm') || n.includes('gru'));
  const hasAttn = names.some(n => n.includes('attention') || n.includes('transformer'));

  if (hasConv && hasAdd) return 'ResNet-style';
  if (hasAttn || lc.includes('transformer')) return 'Transformer';
  if (hasRnn || lc.includes('lstm') || lc.includes('gru')) return 'Sequence Model';
  if (hasConv || lc.includes('cnn')) return 'CNN';
  return 'Neural Network';
}

function looksLikeMLModel(repr) {
  if (!repr || repr.type !== 'object') return false;
  const mlModule = String(repr.ml_module || '').toLowerCase();
  const cls = String(repr.class || '').toLowerCase();
  if (/keras|tensorflow|torch|sklearn|xgboost|lightgbm/.test(mlModule)) return true;
  if (isNNClass(cls)) return true;
  if (repr.params && typeof repr.params === 'object') return true;
  if (repr.attrs?.layers?.type === 'list') return true;
  return false;
}

/* ── Extract layers from Keras repr ── */
function extractLayers(repr) {
  const attrs = repr?.attrs || {};
  const layerRepr = attrs._layers ?? attrs.layers ?? null;
  if (!layerRepr || layerRepr.type !== 'list') return null;
  return (layerRepr.value || []).map((lr, idx) => {
    const la = lr?.attrs || {};
    const cls        = lr?.class ?? 'Layer';
    const name       = la.name?.value ?? `layer_${idx}`;
    const units      = la.units?.value ?? la.filters?.value ?? la.output_dim?.value ?? la.embed_dim?.value ?? null;
    const activation = la.activation?.value ?? la.activation?.attrs?.name?.value ?? null;
    const rate       = la.rate?.value ?? null;
    const kernelSize = la.kernel_size?.value ?? null;
    const paramCount = la.param_count?.value ?? null;
    const outShape   = la.output_shape?.value ?? null;
    const cfg        = layerCfg(cls);
    return { cls, name, units, activation, rate, kernelSize, paramCount, outShape, cfg, idx };
  });
}

function fmtParams(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return String(n);
}

/* ── Activation badge ── */
const ACT_COLORS = {
  relu:    { bg: 'rgba(52,211,153,0.12)', text: '#34d399',  border: 'rgba(52,211,153,0.3)' },
  softmax: { bg: 'rgba(124,132,240,0.12)', text: '#7c84f0', border: 'rgba(124,132,240,0.3)' },
  sigmoid: { bg: 'rgba(251,146,60,0.12)', text: '#fb923c',  border: 'rgba(251,146,60,0.3)' },
  tanh:    { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa',  border: 'rgba(96,165,250,0.3)' },
  linear:  { bg: 'rgba(100,116,139,0.10)', text: '#94a3b8', border: 'rgba(100,116,139,0.2)' },
};
function ActivationBadge({ name }) {
  if (!name || name === 'linear') return null;
  const s = ACT_COLORS[name.toLowerCase()] || { bg: 'rgba(255,255,255,0.06)', text: 'var(--text-2)', border: 'var(--border-2)' };
  return (
    <span className="mlm-act-badge" style={{ background: s.bg, color: s.text, borderColor: s.border }}>
      ƒ({name})
    </span>
  );
}

/* ── Single layer card ── */
function LayerCard({ layer, idx, isActive, isExecuting }) {
  const { cls, name, units, activation, rate, kernelSize, paramCount, outShape, cfg } = layer;
  const shortCls = cls.replace(/layer/i, '').replace(/2d|1d/i, m => m.toUpperCase()) || cls;

  return (
    <motion.div
      className={`mlm-layer-card ${isActive ? 'mlm-layer-active' : ''}`}
      style={{ '--lc': cfg.color }}
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.07, type: 'spring', stiffness: 340, damping: 28 }}
    >
      {/* Left color bar */}
      <div className="mlm-layer-bar" />

      {/* Active signal dot */}
      <AnimatePresence>
        {isActive && (
          <motion.div className="mlm-layer-signal"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      <div className="mlm-layer-icon">{cfg.icon}</div>

      {/* Info */}
      <div className="mlm-layer-info">
        <div className="mlm-layer-top">
          <span className="mlm-layer-type">{shortCls}</span>
          {units != null && <span className="mlm-layer-units">{units} units</span>}
          {rate != null && <span className="mlm-layer-units">{(rate * 100).toFixed(0)}% drop</span>}
          {kernelSize != null && <span className="mlm-layer-units">k={JSON.stringify(kernelSize)}</span>}
          <ActivationBadge name={activation} />
          {isActive && isExecuting && <span className="mlm-layer-active-tag">● processing</span>}
          {isActive && !isExecuting && <span className="mlm-layer-active-tag mlm-layer-active-tag--step">◆ active</span>}
        </div>
        <div className="mlm-layer-bot">
          <span className="mlm-layer-name">{name}</span>
          <span className="mlm-layer-desc">{cfg.desc}</span>
          {outShape != null && (
            <span className="mlm-layer-shape">→ {JSON.stringify(outShape)}</span>
          )}
        </div>
      </div>

      {/* Param count */}
      {paramCount != null && (
        <div className="mlm-layer-params">
          <span className="mlm-layer-params-n">{fmtParams(paramCount)}</span>
          <span className="mlm-layer-params-lbl">params</span>
        </div>
      )}

      {/* Layer index */}
      <div className="mlm-layer-idx">[{idx}]</div>
    </motion.div>
  );
}

/* ── NN card ── */
function NNCard({ name, repr, currentStep, traceLength, isExecuting }) {
  const cls          = repr?.class ?? '?';
  const layers       = extractLayers(repr);
  const totalParams  = repr?.total_params ?? null;
  const trainParams  = repr?.trainable_params ?? null;
  const nnFamily     = useMemo(() => inferNNFamily(cls, layers), [cls, layers]);

  // Which layer index is "active" right now
  const [cycleIdx, setCycleIdx] = useState(0);

  // While executing: cycle through layers automatically
  useEffect(() => {
    if (!isExecuting || !layers?.length) return;
    const id = setInterval(() => setCycleIdx(i => (i + 1) % layers.length), 600);
    return () => clearInterval(id);
  }, [isExecuting, layers?.length]);

  // While stepping through trace: map step progress → layer index
  const activeLayerIdx = useMemo(() => {
    if (!layers?.length) return null;
    if (isExecuting) return cycleIdx;
    if (!traceLength || traceLength <= 1) return null;
    // Clamp to layers.length - 1, but return null at the very last step (done)
    const progress = currentStep / (traceLength - 1);
    if (progress >= 1) return null;
    return Math.min(
      Math.floor(progress * layers.length),
      layers.length - 1
    );
  }, [isExecuting, cycleIdx, currentStep, traceLength, layers?.length]);

  // Fallback estimate if backend didn't provide count
  const paramInfo = useMemo(() => {
    if (totalParams != null) return totalParams;
    if (!layers) return null;
    let total = 0, prevUnits = null;
    for (const l of layers) {
      if (l.paramCount != null) { total += l.paramCount; continue; }
      if (l.cls.toLowerCase().includes('dense') && l.units && prevUnits) {
        total += (prevUnits + 1) * l.units;
      }
      if (l.units) prevUnits = l.units;
    }
    return total > 0 ? total : null;
  }, [layers, totalParams]);

  return (
    <motion.div className="mlm-nn-card"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}>

      {/* Header */}
      <div className="mlm-nn-header">
        <div className="mlm-nn-header-l">
          <div className="mlm-nn-dot" />
          <span className="mlm-nn-cls">{cls}</span>
          <span className="mlm-nn-varname">{name}</span>
          <span className="mlm-nn-badge">{nnFamily}</span>
        </div>
        <div className="mlm-nn-header-r">
          {layers && <span className="mlm-nn-stat">{layers.length} layers</span>}
          {paramInfo != null && (
            <span className="mlm-nn-stat">{fmtParams(paramInfo)} params</span>
          )}
          {trainParams != null && trainParams !== paramInfo && (
            <span className="mlm-nn-stat" style={{ color: 'var(--accent)' }}>
              {fmtParams(trainParams)} trainable
            </span>
          )}
        </div>
      </div>

      {/* Architecture key */}
      {layers && (
        <div className="mlm-nn-arch-key">
          {layers.map((l, i) => (
            <span key={i}
              style={{ color: l.cfg.color, filter: i === activeLayerIdx ? `drop-shadow(0 0 6px ${l.cfg.color})` : 'none' }}
              className={i === activeLayerIdx ? 'mlm-arch-active-icon' : ''}
              title={`${l.cls}${l.units ? ` (${l.units})` : ''}`}>
              {l.cfg.icon}
              {i < layers.length - 1 && <span className="mlm-arch-arrow">→</span>}
            </span>
          ))}
        </div>
      )}

      {/* Layer pipeline */}
      {layers ? (
        <div className="mlm-layer-pipeline">
          {/* Input pill */}
          <motion.div className="mlm-io-pill mlm-input-pill"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <span className="mlm-io-label">INPUT</span>
          </motion.div>

          {layers.map((layer, i) => (
            <div key={i} className="mlm-layer-step">
              {/* Connector — glow when data flows into active layer */}
              <div className="mlm-connector">
                <div className="mlm-connector-line"
                  style={{ background: i === activeLayerIdx ? layer.cfg.color : layer.cfg.color + '50' }} />
                <div className="mlm-connector-arrow"
                  style={{ borderTopColor: i === activeLayerIdx ? layer.cfg.color : layer.cfg.color + '50' }} />
              </div>
              <LayerCard layer={layer} idx={i} isActive={i === activeLayerIdx} isExecuting={isExecuting} />
            </div>
          ))}

          {/* Connector before output */}
          <div className="mlm-connector">
            <div className="mlm-connector-line" />
            <div className="mlm-connector-arrow" />
          </div>

          {/* Output pill */}
          <motion.div className="mlm-io-pill mlm-output-pill"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: layers.length * 0.07 + 0.2 }}>
            <span className="mlm-io-label">OUTPUT</span>
            {layers[layers.length - 1]?.units != null && (
              <span className="mlm-io-units">{layers[layers.length - 1].units} classes</span>
            )}
          </motion.div>
        </div>
      ) : (
        // Fallback: show attrs
        <div className="mlm-section">
          <div className="mlm-section-title">Model attributes</div>
          <div className="mlm-params">
            {Object.entries(repr?.attrs || {}).slice(0, 10).map(([k, v]) => (
              <div key={k} className="mlm-param-row">
                <span className="mlm-param-key">{k}</span>
                <span className="mlm-param-val">{displayVal(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ── Sklearn feature importance bar ── */
function FeatureImportanceBar({ importances }) {
  const flat = flattenValue(importances);
  if (!Array.isArray(flat) || flat.length === 0) return null;
  const vals = flat.map(v => (typeof v === 'object' ? v?.value ?? 0 : +v));
  const max  = Math.max(...vals);
  return (
    <div className="mlm-section">
      <div className="mlm-section-title">Feature Importances</div>
      <div className="mlm-feat-bars">
        {vals.slice(0, 20).map((v, i) => (
          <div key={i} className="mlm-feat-row">
            <span className="mlm-feat-idx">f{i}</span>
            <div className="mlm-feat-track">
              <motion.div className="mlm-feat-fill"
                initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }}
                transition={{ delay: i * 0.03, duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="mlm-feat-val">{v.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sklearn card ── */
function SklearnCard({ name, repr }) {
  const cls    = repr?.class ?? '?';
  const params = repr?.params ?? {};
  const attrs  = repr?.attrs  ?? {};

  const fitted = Object.entries(attrs)
    .filter(([k]) => k.endsWith('_') && !k.startsWith('_'))
    .slice(0, 12);

  const featureImportances = attrs.feature_importances_ ?? null;
  const paramEntries = Object.entries(params).slice(0, 16);

  return (
    <motion.div className="mlm-sk-card"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}>

      {/* Header */}
      <div className="mlm-sk-header">
        <div className="mlm-sk-header-l">
          <div className="mlm-sk-icon">sklearn</div>
          <div>
            <div className="mlm-sk-cls">{cls}</div>
            <div className="mlm-sk-varname">{name}</div>
          </div>
        </div>
        <span className="mlm-sk-badge">
          {fitted.length > 0 ? '✓ Fitted' : 'Not fitted'}
        </span>
      </div>

      {/* Hyperparameters */}
      {paramEntries.length > 0 && (
        <div className="mlm-section">
          <div className="mlm-section-title">Hyperparameters</div>
          <div className="mlm-param-grid">
            {paramEntries.map(([k, v]) => (
              <div key={k} className="mlm-param-cell">
                <div className="mlm-param-key">{k}</div>
                <div className="mlm-param-val">{displayVal(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature importances chart */}
      {featureImportances && <FeatureImportanceBar importances={featureImportances} />}

      {/* Fitted attributes */}
      {fitted.length > 0 && (
        <div className="mlm-section">
          <div className="mlm-section-title">Fitted Attributes</div>
          <div className="mlm-params">
            {fitted.map(([k, v]) => (
              <div key={k} className="mlm-param-row mlm-fitted-row">
                <span className="mlm-param-key">{k}</span>
                <span className="mlm-param-val mlm-fitted-val">{displayVal(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ── Extract all ML models ── */
export function getMLModels(locals, hints) {
  if (!locals) return [];
  const result = [];
  const seen = new Set();

  // Preferred path: backend-provided hints.
  if (hints) {
    for (const [name, hint] of Object.entries(hints)) {
      if ((hint === 'ml_model' || hint === 'nn_model') && locals[name]) {
        result.push({ name, repr: locals[name], hint });
        seen.add(name);
      }
    }
  }

  // Fallback path: infer from locals to handle hint misses.
  for (const [name, repr] of Object.entries(locals)) {
    if (seen.has(name) || !looksLikeMLModel(repr)) continue;
    const hint = isNNClass(repr?.class ?? '') || repr?.attrs?.layers?.type === 'list'
      ? 'nn_model'
      : 'ml_model';
    result.push({ name, repr, hint });
    seen.add(name);
  }

  return result;
}

/* ── Main ── */
export default function MLModelVisualizer({ stepData, currentStep, traceLength, isExecuting }) {
  const { locals, structure_hints: hints } = stepData || {};
  const models = useMemo(() => getMLModels(locals, hints), [locals, hints]);
  if (!models.length) return null;

  return (
    <div className="mlm">
      {models.map(({ name, repr, hint }) =>
        hint === 'nn_model' || isNNClass(repr?.class ?? '')
          ? <NNCard key={name} name={name} repr={repr}
              currentStep={currentStep} traceLength={traceLength} isExecuting={isExecuting} />
          : <SklearnCard key={name} name={name} repr={repr} />
      )}
    </div>
  );
}
