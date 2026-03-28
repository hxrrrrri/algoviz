import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { displayValue } from '../../utils/vizMapper';
import './FlowVisualizer.css';

/* ── Type badge colours ── */
const TYPE_COLOR = {
  int: '#60a5fa', float: '#60a5fa', bool: '#a78bfa',
  str: '#f9a8d4', list: '#34d399', tuple: '#34d399',
  dict: '#fbbf24', set: '#fbbf24', none: '#6b7280', object: '#a78bfa',
};
const tc = t => TYPE_COLOR[t] || '#8b949e';

function shortVal(repr, max = 30) {
  const v = displayValue(repr, max);
  return v.length > max ? v.slice(0, max) + '…' : v;
}

/* ══ Main FlowVisualizer ══ */
export default function FlowVisualizer({ step, prevStep, trace, currentStep }) {

  /* ── Variables with change detection ── */
  const vars = useMemo(() => {
    const locals = step?.locals || {};
    const prevLocals = prevStep?.locals || {};
    return Object.entries(locals)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => {
        const prev = prevLocals[k];
        const curStr  = displayValue(v, 120);
        const prevStr = prev ? displayValue(prev, 120) : null;
        return {
          name: k,
          type: v?.type || 'none',
          val:  shortVal(v, 28),
          isNew:     !prev,
          isChanged: !!prev && curStr !== prevStr,
        };
      });
  }, [step, prevStep]);

  if (!step) {
    return (
      <div className="fv fv-empty">
        <div className="fv-empty-icon">{ '{ }' }</div>
        <div className="fv-empty-text">Run code to see execution flow</div>
      </div>
    );
  }

  const callStack = step.call_stack || [];
  const event     = step.event || 'line';
  const stdout    = step.stdout || '';
  const isError   = event === 'error';

  // Current function name
  const currentFn = callStack.length > 0
    ? callStack[callStack.length - 1]?.function
    : '<module>';

  // Build full frame list for call stack display (innermost first)
  const frames = [...callStack].reverse();

  return (
    <div className="fv">

      {/* ── Status bar ── */}
      <div className="fv-status">
        <span className={`fv-chip fv-ev-${event}`}>{event}</span>
        <span className="fv-status-fn">
          <span className="fv-status-fn-label">in</span>
          <span className="fv-status-fn-name">{currentFn}()</span>
        </span>
        <span className="fv-status-line">line <strong>{step.line}</strong></span>
        <span className="fv-status-sep">·</span>
        <span className="fv-status-step">step {currentStep + 1} / {trace.length}</span>
      </div>

      {/* ── Main grid: Variables + Call Stack ── */}
      <div className="fv-grid">

        {/* Variables panel */}
        <div className="fv-panel">
          <div className="fv-panel-hdr">
            <span className="fv-panel-title">Variables</span>
            {vars.length > 0 && (
              <span className="fv-panel-count">{vars.length}</span>
            )}
          </div>

          <div className="fv-var-list">
            {vars.length === 0 && (
              <div className="fv-panel-empty">No variables in scope</div>
            )}
            <AnimatePresence mode="popLayout">
              {vars.map((v, i) => (
                <motion.div
                  key={v.name}
                  className={`fv-var-row ${v.isNew ? 'fv-var-new' : ''} ${v.isChanged ? 'fv-var-changed' : ''}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32, delay: i * 0.02 }}
                  layout
                >
                  {/* Change indicator bar */}
                  <div className="fv-var-bar" style={{ background: v.isNew ? 'var(--accent)' : v.isChanged ? 'var(--change-text)' : 'transparent' }} />

                  <span className="fv-var-name">{v.name}</span>

                  <span className="fv-var-type" style={{ color: tc(v.type) }}>
                    {v.type}
                  </span>

                  <span className="fv-var-eq">=</span>

                  <span className="fv-var-val" style={{ color: tc(v.type) }}>
                    {v.val}
                  </span>

                  {(v.isNew || v.isChanged) && (
                    <span className="fv-var-badge">
                      {v.isNew ? 'NEW' : 'CHG'}
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Call Stack panel */}
        <div className="fv-panel fv-panel-right">
          <div className="fv-panel-hdr">
            <span className="fv-panel-title">Call Stack</span>
            <span className="fv-panel-count">{frames.length + 1}</span>
          </div>

          <div className="fv-stack-list">
            {/* Active frames (innermost first) */}
            {frames.map((fr, i) => (
              <div key={i} className={`fv-stack-row ${i === 0 ? 'fv-stack-active' : ''}`}>
                <span className="fv-stack-num">{frames.length - i}</span>
                <div className="fv-stack-info">
                  <span className="fv-stack-fn">{fr.function}()</span>
                  <span className="fv-stack-line">line {fr.line}</span>
                </div>
                {i === 0 && <span className="fv-stack-cur-dot" />}
              </div>
            ))}

            {/* Module level (always at bottom) */}
            <div className="fv-stack-row fv-stack-module">
              <span className="fv-stack-num">0</span>
              <div className="fv-stack-info">
                <span className="fv-stack-fn">{'<module>'}</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {isError && step.error && (
            <div className="fv-error">
              <span className="fv-error-type">⚠ {step.error.type}</span>
              <span className="fv-error-msg">{step.error.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Output ── */}
      {stdout && (
        <div className="fv-output">
          <div className="fv-output-hdr">Output</div>
          <div className="fv-output-body">
            {stdout.trim().split('\n').slice(-10).map((l, i) => (
              <div key={i} className="fv-output-row">
                <span className="fv-output-arrow">›</span>
                <span className="fv-output-text">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}