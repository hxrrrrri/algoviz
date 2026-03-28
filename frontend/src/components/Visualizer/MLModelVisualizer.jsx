import { useMemo, useState } from 'react';
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
  return /sequential|functional|model|dense|conv|lstm|gru|transformer/i.test(cls);
}

/* ── Layer config ── */
const LAYER_CFG = {
  dense:      { color: '#7c84f0', icon: '⬡', desc: 'Fully Connected' },
  conv2d:     { color: '#f59e0b', icon: '⊞', desc: 'Convolution 2D' },
  conv1d:     { color: '#fbbf24', icon: '⊟', desc: 'Convolution 1D' },
  lstm:       { color: '#34d399', icon: '↻', desc: 'Long Short-Term Memory' },
  gru:        { color: '#60a5fa', icon: '↺', desc: 'Gated Recurrent Unit' },
  dropout:    { color: '#f87171', icon: '%', desc: 'Regularization' },
  batchnorm:  { color: '#a78bfa', icon: '≈', desc: 'Batch Normalization' },
  flatten:    { color: '#94a3b8', icon: '⟄', desc: 'Flatten to 1D' },
  embedding:  { color: '#fb923c', icon: '↦', desc: 'Embedding Layer' },
  maxpool:    { color: '#22d3ee', icon: '↓', desc: 'Max Pooling' },
  avgpool:    { color: '#67e8f9', icon: '↓', desc: 'Avg Pooling' },
  attention:  { color: '#e879f9', icon: '◈', desc: 'Self-Attention' },
  default:    { color: '#64748b', icon: '○', desc: 'Layer' },
};

function layerCfg(cls) {
  const lc = cls?.toLowerCase() ?? '';
  for (const [k, v] of Object.entries(LAYER_CFG)) {
    if (k !== 'default' && lc.includes(k)) return { ...v, key: k };
  }
  return { ...LAYER_CFG.default, key: 'default' };
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
function LayerCard({ layer, idx }) {
  const { cls, name, units, activation, rate, kernelSize, paramCount, outShape, cfg } = layer;
  const shortCls = cls.replace(/layer/i, '').replace(/2d|1d/i, m => m.toUpperCase()) || cls;

  return (
    <motion.div
      className="mlm-layer-card"
      style={{ '--lc': cfg.color }}
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.07, type: 'spring', stiffness: 340, damping: 28 }}
    >
      {/* Left color bar */}
      <div className="mlm-layer-bar" />

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
function NNCard({ name, repr }) {
  const cls          = repr?.class ?? '?';
  const layers       = extractLayers(repr);
  const totalParams  = repr?.total_params ?? null;
  const trainParams  = repr?.trainable_params ?? null;

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
          <span className="mlm-nn-badge">Neural Network</span>
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
            <span key={i} style={{ color: l.cfg.color }}
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
              {/* Connector */}
              <div className="mlm-connector">
                <div className="mlm-connector-line" style={{ background: layer.cfg.color + '80' }} />
                <div className="mlm-connector-arrow" style={{ borderTopColor: layer.cfg.color + '80' }} />
              </div>
              <LayerCard layer={layer} idx={i} totalLayers={layers.length} />
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
  if (!locals || !hints) return [];
  const result = [];
  for (const [name, hint] of Object.entries(hints)) {
    if ((hint === 'ml_model' || hint === 'nn_model') && locals[name]) {
      result.push({ name, repr: locals[name], hint });
    }
  }
  return result;
}

/* ── Main ── */
export default function MLModelVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const models = useMemo(() => getMLModels(locals, hints), [locals, hints]);
  if (!models.length) return null;

  return (
    <div className="mlm">
      {models.map(({ name, repr, hint }) =>
        hint === 'nn_model' || isNNClass(repr?.class ?? '')
          ? <NNCard    key={name} name={name} repr={repr} />
          : <SklearnCard key={name} name={name} repr={repr} />
      )}
    </div>
  );
}
