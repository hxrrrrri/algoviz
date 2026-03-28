import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store';
import ArrayVisualizer from './ArrayVisualizer';
import MatrixVisualizer from './MatrixVisualizer';
import { getPrimaryArray, getMatrix, flattenValue } from '../../utils/vizMapper';
import './VisualizationPanel.css';

/* ── Helper: deep-equality string for a flat value ── */
function cellKey(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/* ── Build change-map between two flat values ── */
function buildChangedSet(curr, prev) {
  if (!prev || !curr) return new Set();
  const changed = new Set();
  if (Array.isArray(curr) && Array.isArray(prev)) {
    curr.forEach((row, ri) => {
      if (Array.isArray(row) && Array.isArray(prev[ri])) {
        row.forEach((cell, ci) => {
          if (cellKey(cell) !== cellKey(prev[ri]?.[ci])) changed.add(`${ri}-${ci}`);
        });
      } else if (!Array.isArray(row)) {
        if (cellKey(row) !== cellKey(prev[ri])) changed.add(`${ri}`);
      }
    });
  } else if (curr && typeof curr === 'object' && !Array.isArray(curr)) {
    Object.keys(curr).forEach(k => {
      if (cellKey(curr[k]) !== cellKey(prev[k])) changed.add(k);
    });
  }
  return changed;
}

/* ── Pinned variable renderer ── */
function PinnedVarView({ name, repr, prevRepr, onUnpin }) {
  const flat     = repr     ? flattenValue(repr)     : null;
  const prevFlat = prevRepr ? flattenValue(prevRepr) : null;
  const type     = repr?.type;

  const changed = useMemo(() => buildChangedSet(flat, prevFlat), [flat, prevFlat]);

  const is2D    = type === 'list'  && Array.isArray(flat) && flat.length > 0 && Array.isArray(flat[0]);
  const is1D    = type === 'list'  && Array.isArray(flat) && !is2D;
  const isDict  = type === 'dict'  && flat && typeof flat === 'object' && !Array.isArray(flat);
  const isTuple = type === 'tuple' && Array.isArray(flat);

  const accentColor = type === 'list' ? 'var(--accent)' : type === 'dict' ? 'var(--accent-4)' : 'var(--accent-2)';

  return (
    <motion.div className="pv"
      initial={{ opacity:0, y:14, scale:0.97 }}
      animate={{ opacity:1, y:0, scale:1 }}
      exit={{ opacity:0, y:-8, scale:0.96 }}
      transition={{ type:'spring', stiffness:380, damping:30 }}
    >
      {/* Card top shine */}
      <div className="pv-shine" />

      <div className="pv-header">
        <div className="pv-title-wrap">
          <span className="pv-type-dot" style={{ background: accentColor }}/>
          <span className="pv-name">{name}</span>
          <span className="pv-type">{type}</span>
          {is2D   && <span className="pv-dims">{flat.length} × {flat[0]?.length ?? 0}</span>}
          {(is1D || isTuple) && <span className="pv-dims">len {flat.length}</span>}
          {isDict && <span className="pv-dims">{Object.keys(flat).length} keys</span>}
          {changed.size > 0 && (
            <motion.span className="pv-changed-badge"
              key={changed.size}
              initial={{ scale:1.4 }} animate={{ scale:1 }}
              transition={{ type:'spring', stiffness:500, damping:22 }}>
              {changed.size} changed
            </motion.span>
          )}
        </div>
        <button className="pv-unpin" onClick={() => onUnpin(name)} title="Remove">✕</button>
      </div>

      <div className="pv-body">
        {/* 2D Matrix / DP Table */}
        {is2D && (
          <div className="pv-matrix-wrap">
            <table className="pv-matrix">
              <thead>
                <tr>
                  <th className="pv-rc-label" />
                  {flat[0].map((_, ci) => (
                    <th key={ci} className="pv-col-label">{ci}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flat.map((row, ri) => (
                  <tr key={ri}>
                    <td className="pv-row-label">{ri}</td>
                    {Array.isArray(row)
                      ? row.map((cell, ci) => {
                          const isChanged = changed.has(`${ri}-${ci}`);
                          return (
                            <td key={ci} className={`pv-cell ${isChanged ? 'pv-cell-changed' : ''}`}>
                              {isChanged && <span className="pv-cell-glow" />}
                              {cell === null ? <span className="pv-null">∅</span> : String(cell)}
                            </td>
                          );
                        })
                      : <td className="pv-cell pv-cell-scalar">{String(row)}</td>
                    }
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 1D list / tuple */}
        {(is1D || isTuple) && (
          <div className="pv-list-wrap">
            {flat.map((item, i) => {
              const isChanged = changed.has(`${i}`);
              return (
                <div key={i} className={`pv-list-item ${isChanged ? 'pv-item-changed' : ''}`}>
                  <span className="pv-list-idx">{i}</span>
                  <span className="pv-list-val">
                    {item === null ? '∅' : typeof item === 'object' ? JSON.stringify(item) : String(item)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Dict */}
        {isDict && (
          <div className="pv-dict-wrap">
            {Object.entries(flat).map(([k, v]) => {
              const isChanged = changed.has(k);
              return (
                <div key={k} className={`pv-dict-row ${isChanged ? 'pv-item-changed' : ''}`}>
                  <span className="pv-dict-key">{k}</span>
                  <span className="pv-dict-sep">:</span>
                  <span className="pv-dict-val">
                    {v === null ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Fallback */}
        {!is2D && !is1D && !isDict && !isTuple && (
          <pre className="pv-raw">{JSON.stringify(flat, null, 2)}</pre>
        )}
      </div>
    </motion.div>
  );
}

/* ── Main Panel ── */
export default function VisualizationPanel() {
  const trace       = useStore(s => s.trace);
  const currentStep = useStore(s => s.currentStep);
  const pinnedVars  = useStore(s => s.pinnedVars);
  const pinVar      = useStore(s => s.pinVar);
  const unpinVar    = useStore(s => s.unpinVar);

  const step     = trace[currentStep] || null;
  const prevStep = currentStep > 0 ? trace[currentStep - 1] : null;
  const isError  = step?.event === 'error';
  const hasTrace = trace.length > 0;

  const [dragOver, setDragOver] = useState(false);

  const hasArray  = useMemo(() => step ? !!getPrimaryArray(step.locals, step.structure_hints) : false, [step]);
  const hasMatrix = useMemo(() => step ? !!getMatrix(step.locals, step.structure_hints) : false, [step]);

  const handleDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes('application/codeviz-var')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const name = e.dataTransfer.getData('application/codeviz-var');
    if (name) pinVar(name);
  }, [pinVar]);

  /* Build current + previous repr for each pinned var */
  const pinnedData = useMemo(() => {
    const locals     = step?.locals     || {};
    const prevLocals = prevStep?.locals || {};
    return pinnedVars.map(name => ({
      name,
      repr:     locals[name]     || null,
      prevRepr: prevLocals[name] || null,
    }));
  }, [pinnedVars, step, prevStep]);

  return (
    <div
      className={`vp ${dragOver ? 'vp-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="vp-grid" />

      {/* Drag-over overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div className="vp-drop-overlay"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.12 }}
          >
            <div className="vp-drop-icon">◎</div>
            <div className="vp-drop-text">Drop to visualize</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="vp-topbar">
        <div className="vp-topbar-l">
          <div className="vp-title-dot" />
          <span className="vp-title">Visualization</span>
          {pinnedVars.length > 0 && (
            <span className="vp-pinned-count">{pinnedVars.length} pinned</span>
          )}
        </div>
        {hasTrace && (
          <div className="vp-step-info">
            <span className="vp-step-n">{currentStep + 1}</span>
            <span className="vp-step-of">/ {trace.length}</span>
            {step?.line && <span className="vp-step-line">· ln {step.line}</span>}
          </div>
        )}
      </div>

      <div className="vp-content">
        {/* Empty state */}
        {!hasTrace && pinnedVars.length === 0 && (
          <div className="vp-empty">
            <div className="vp-empty-ring">
              <div className="vp-empty-logo">⟨/⟩</div>
            </div>
            <div className="vp-empty-title">Code-Viz</div>
            <div className="vp-empty-sub">Write an algorithm and run it<br/>to see live visualization</div>
            <div className="vp-empty-hint">Drag any list or matrix from Variables →</div>
            <div className="vp-empty-kbd">Ctrl + Enter to run</div>
          </div>
        )}

        {/* Error banner */}
        {hasTrace && isError && step?.error && (
          <motion.div className="vp-err-banner"
            initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}>
            <div className="vp-err-icon">⚠</div>
            <div>
              <div className="vp-err-type">{step.error.type}</div>
              <div className="vp-err-msg">{step.error.message}{step.error.line ? ` — line ${step.error.line}` : ''}</div>
            </div>
          </motion.div>
        )}

        {/* Auto-detected array */}
        {hasTrace && hasArray && (
          <AnimatePresence>
            <motion.div key="arr" className="vp-section"
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}>
              <ArrayVisualizer stepData={step} />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Auto-detected matrix */}
        {hasTrace && hasMatrix && !hasArray && (
          <AnimatePresence>
            <motion.div key="mat" className="vp-section"
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}>
              <MatrixVisualizer stepData={step} />
            </motion.div>
          </AnimatePresence>
        )}

        {/* No structure hint */}
        {hasTrace && !hasArray && !hasMatrix && !isError && pinnedVars.length === 0 && (
          <div className="vp-no-struct">
            <div className="vp-no-struct-icon">◇</div>
            <div>No structure detected yet</div>
            <div className="vp-no-struct-hint">Drag variables from the Variables panel →</div>
          </div>
        )}

        {/* Pinned variables */}
        {pinnedData.length > 0 && (
          <div className="vp-pinned-section">
            {(hasArray || hasMatrix) && <div className="vp-pinned-divider">Pinned Variables</div>}
            <AnimatePresence>
              {pinnedData.map(({ name, repr, prevRepr }) =>
                repr && (
                  <PinnedVarView
                    key={name}
                    name={name}
                    repr={repr}
                    prevRepr={prevRepr}
                    onUnpin={unpinVar}
                  />
                )
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}