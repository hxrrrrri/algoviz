import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { flattenValue } from '../../utils/vizMapper';
import './MLModelVisualizer.css';

/* ── Helpers ── */
function displayVal(repr) {
  if (!repr) return '—';
  const v = flattenValue(repr);
  if (v === null) return 'None';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 40);
  return String(v).slice(0, 40);
}

function isNNClass(cls) {
  return /sequential|functional|model|dense|conv|lstm|gru|transformer/i.test(cls);
}

/* ── Extract layers from a Keras Sequential/Functional model repr ── */
function extractLayers(repr) {
  const attrs = repr?.attrs || {};
  // keras stores layers in _layers or layers attr
  const layerRepr = attrs._layers ?? attrs.layers ?? null;
  if (!layerRepr || layerRepr.type !== 'list') return null;
  return (layerRepr.value || []).map(lr => {
    const la = lr?.attrs || {};
    const name  = la.name?.value ?? lr?.class ?? '?';
    const units = la.units?.value ?? la.filters?.value ?? la.output_dim?.value ?? null;
    const activation = la.activation?.attrs?.name?.value ?? la.activation?.value ?? null;
    return { name, units, activation, cls: lr?.class ?? '' };
  });
}

/* ── NN Architecture diagram ── */
function NNArchDiagram({ layers }) {
  if (!layers?.length) return null;
  const LW = 88, LH = 38, GAP = 32;
  const totalW = layers.length * (LW + GAP) - GAP + 32;
  const totalH = LH + 40;

  const LAYER_COLORS = {
    dense: '#7c84f0', conv: '#f59e0b', lstm: '#34d399',
    gru: '#60a5fa', dropout: '#f87171', batchnorm: '#a78bfa',
    flatten: '#94a3b8', embedding: '#fb923c', default: '#64748b',
  };
  const colorFor = cls => {
    const lc = cls.toLowerCase();
    for (const [k, c] of Object.entries(LAYER_COLORS))
      if (lc.includes(k)) return c;
    return LAYER_COLORS.default;
  };

  return (
    <div className="mlm-nn">
      <div className="mlm-section-title">Architecture</div>
      <div className="mlm-nn-scroll">
        <svg width={totalW} height={totalH} className="mlm-nn-svg">
          {layers.map((l, i) => {
            const x   = 16 + i * (LW + GAP);
            const y   = 16;
            const col = colorFor(l.cls);
            const isLast = i === layers.length - 1;
            return (
              <g key={i}>
                {/* Connector arrow */}
                {!isLast && (
                  <g>
                    <line x1={x + LW} y1={y + LH / 2} x2={x + LW + GAP} y2={y + LH / 2}
                      stroke="var(--border-1)" strokeWidth={1.5}/>
                    <polygon
                      points={`${x + LW + GAP - 1},${y + LH / 2 - 4} ${x + LW + GAP + 7},${y + LH / 2} ${x + LW + GAP - 1},${y + LH / 2 + 4}`}
                      fill="var(--border-1)"
                    />
                  </g>
                )}
                {/* Layer box */}
                <motion.rect x={x} y={y} width={LW} height={LH} rx={6}
                  fill={`color-mix(in srgb, ${col} 14%, var(--bg-card))`}
                  stroke={col} strokeWidth={1.5}
                  initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 380, damping: 28 }}
                />
                {/* Layer name */}
                <text x={x + LW / 2} y={y + 14} textAnchor="middle" className="mlm-nn-lname"
                  style={{ fill: col }}>
                  {l.cls.replace(/layer/i, '').slice(0, 12) || l.name}
                </text>
                {/* Units */}
                {l.units != null && (
                  <text x={x + LW / 2} y={y + 26} textAnchor="middle" className="mlm-nn-lunits">
                    {l.units} units
                  </text>
                )}
                {/* Activation */}
                {l.activation && (
                  <text x={x + LW / 2} y={y + 35} textAnchor="middle" className="mlm-nn-lact">
                    {l.activation}
                  </text>
                )}
                {/* Index */}
                <text x={x + LW / 2} y={y + LH + 13} textAnchor="middle" className="mlm-nn-lidx">
                  [{i}]
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Sklearn model param card ── */
function SklearnCard({ name, repr }) {
  const cls    = repr?.class ?? '?';
  const params = repr?.params ?? {};
  const attrs  = repr?.attrs  ?? {};

  // Fitted attributes (those ending with _)
  const fitted = Object.entries(attrs)
    .filter(([k]) => k.endsWith('_') && !k.startsWith('_'))
    .slice(0, 12);

  const paramEntries = Object.entries(params).slice(0, 16);

  return (
    <motion.div className="mlm-card"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}>
      <div className="mlm-card-header">
        <span className="mlm-cls">{cls}</span>
        <span className="mlm-var">{name}</span>
        <span className="mlm-badge">sklearn</span>
      </div>

      {paramEntries.length > 0 && (
        <div className="mlm-section">
          <div className="mlm-section-title">Hyperparameters</div>
          <div className="mlm-params">
            {paramEntries.map(([k, v]) => (
              <div key={k} className="mlm-param-row">
                <span className="mlm-param-key">{k}</span>
                <span className="mlm-param-val">{displayVal(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {fitted.length > 0 && (
        <div className="mlm-section">
          <div className="mlm-section-title">Fitted attributes</div>
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

/* ── Keras / generic NN card ── */
function NNCard({ name, repr }) {
  const cls    = repr?.class ?? '?';
  const attrs  = repr?.attrs  ?? {};
  const layers = extractLayers(repr);

  // Summary stats
  const trainable    = attrs.trainable_variables  ?? attrs._trainable_variables ?? null;
  const nonTrainable = attrs.non_trainable_weights ?? null;

  return (
    <motion.div className="mlm-card mlm-card-nn"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}>
      <div className="mlm-card-header">
        <span className="mlm-cls">{cls}</span>
        <span className="mlm-var">{name}</span>
        <span className="mlm-badge mlm-badge-nn">neural net</span>
      </div>

      {layers ? (
        <NNArchDiagram layers={layers} />
      ) : (
        <div className="mlm-section">
          <div className="mlm-section-title">Model attributes</div>
          <div className="mlm-params">
            {Object.entries(attrs).slice(0, 10).map(([k, v]) => (
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

/* ── Extract all ML models from locals ── */
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

/* ── Main export ── */
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
