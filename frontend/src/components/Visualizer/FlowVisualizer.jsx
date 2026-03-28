import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { displayValue, flattenValue } from '../../utils/vizMapper';
import './FlowVisualizer.css';

/* ── Type → display config ── */
const TYPE_CFG = {
  int:    { color: '#60a5fa', short: 'int'   },
  float:  { color: '#60a5fa', short: 'float' },
  str:    { color: '#f9a8d4', short: 'str'   },
  bool:   { color: '#a78bfa', short: 'bool'  },
  list:   { color: '#34d399', short: 'list'  },
  tuple:  { color: '#34d399', short: 'tuple' },
  dict:   { color: '#fbbf24', short: 'dict'  },
  set:    { color: '#fbbf24', short: 'set'   },
  none:   { color: '#6b7280', short: 'None'  },
  object: { color: '#a78bfa', short: 'obj'   },
};
const tc = t => TYPE_CFG[t] || { color: '#8b949e', short: t || '?' };

function shortVal(repr, max = 22) {
  const v = displayValue(repr, max);
  return v.length > max ? v.slice(0, max) + '…' : v;
}

/* ── Memory box: one variable ── */
function MemBox({ name, repr, isNew, isChanged }) {
  const t = tc(repr?.type);
  const val = shortVal(repr, 20);

  return (
    <motion.div
      className={`fv-box ${isNew ? 'fv-box-new' : ''} ${isChanged ? 'fv-box-changed' : ''}`}
      style={{ '--bc': t.color }}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1,    opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      layout
    >
      <div className="fv-box-type">{t.short}</div>
      <div className="fv-box-name">{name}</div>
      <div className="fv-box-val">{val}</div>
    </motion.div>
  );
}

/* ── Single call-stack frame ── */
function StackFrame({ frame, locals, prevLocals, isActive, depth, isTop }) {
  const vars = useMemo(() => {
    if (!locals) return [];
    return Object.entries(locals)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => {
        const pv = prevLocals?.[k];
        const cv = displayValue(v, 120);
        const pvStr = pv ? displayValue(pv, 120) : null;
        return {
          name: k,
          repr: v,
          isNew:     !pv,
          isChanged: !!pv && cv !== pvStr,
        };
      });
  }, [locals, prevLocals]);

  return (
    <motion.div
      className={`fv-frame ${isActive ? 'fv-frame-active' : ''} ${isTop ? 'fv-frame-top' : ''}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32, delay: depth * 0.04 }}
      layout
    >
      {/* Frame header */}
      <div className="fv-frame-hdr">
        <div className="fv-frame-hdr-l">
          <span className="fv-frame-depth">#{depth}</span>
          <span className="fv-frame-fn">{frame.function}</span>
        </div>
        <div className="fv-frame-hdr-r">
          <span className="fv-frame-ln">line {frame.line}</span>
          {isActive && <span className="fv-frame-badge">active</span>}
        </div>
      </div>

      {/* Variables grid — only for active frame */}
      {isActive && vars.length > 0 && (
        <div className="fv-frame-vars">
          <AnimatePresence mode="popLayout">
            {vars.slice(0, 10).map(v => (
              <MemBox key={v.name} name={v.name} repr={v.repr}
                isNew={v.isNew} isChanged={v.isChanged} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

/* ── Execution trace breadcrumb ── */
function ExecTrace({ trace, currentStep }) {
  const recent = trace.slice(Math.max(0, currentStep - 11), currentStep + 1);
  return (
    <div className="fv-trace">
      {recent.map((s, i) => {
        const isCur = i === recent.length - 1;
        const fn = s.call_stack?.[s.call_stack.length - 1]?.function || '<module>';
        return (
          <div key={i} className={`fv-trace-row ${isCur ? 'fv-trace-cur' : ''}`}>
            <span className="fv-trace-ln">:{String(s.line).padStart(3, ' ')}</span>
            <span className={`fv-trace-ev fv-ev-${s.event}`}>{s.event}</span>
            <span className="fv-trace-fn">{fn}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ══ Main FlowVisualizer ══ */
export default function FlowVisualizer({ step, prevStep, trace, currentStep }) {
  if (!step) return (
    <div className="fv fv-empty">
      <div className="fv-empty-icon">{ '{ }' }</div>
      <div className="fv-empty-text">Run code to see execution flow</div>
    </div>
  );

  const callStack  = step.call_stack  || [];
  const locals     = step.locals      || {};
  const prevLocals = prevStep?.locals || {};
  const event      = step.event       || 'line';
  const stdout     = step.stdout      || '';
  const isReturn   = event === 'return';
  const isError    = event === 'error';

  // Build frame list: callStack is innermost-last, so reverse for display
  const frames = callStack.length === 0
    ? [{ function: '<module>', line: step.line }]
    : [...callStack].reverse();

  return (
    <div className="fv">
      {/* ── Topbar: event + line ── */}
      <div className="fv-topbar">
        <span className={`fv-event-pill fv-ev-${event}`}>{event}</span>
        <span className="fv-topbar-line">line {step.line}</span>
        <span className="fv-topbar-depth">depth {callStack.length}</span>
        {isReturn && (
          <motion.span className="fv-return-pill"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
            ↩ return
          </motion.span>
        )}
      </div>

      <div className="fv-body">
        {/* ── Left col: memory / call stack ── */}
        <div className="fv-col fv-col-stack">
          <div className="fv-col-hdr">
            <span className="fv-col-title">Memory</span>
            <span className="fv-col-sub">{frames.length} frame{frames.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Stack depth indicator bar */}
          <div className="fv-depth-bar">
            {Array.from({ length: Math.min(frames.length, 12) }).map((_, i) => (
              <div key={i} className={`fv-depth-seg ${i === 0 ? 'fv-depth-seg-active' : ''}`} />
            ))}
          </div>

          <div className="fv-stack-list">
            <AnimatePresence mode="popLayout">
              {frames.map((fr, i) => (
                <StackFrame
                  key={`${fr.function}-${fr.line}-${i}`}
                  frame={fr}
                  locals={i === 0 ? locals : null}
                  prevLocals={i === 0 ? prevLocals : null}
                  isActive={i === 0}
                  isTop={i === 0}
                  depth={frames.length - 1 - i}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Error banner */}
          {isError && step.error && (
            <motion.div className="fv-error"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="fv-error-type">⚠ {step.error.type}</div>
              <div className="fv-error-msg">{step.error.message}</div>
            </motion.div>
          )}

          {/* Stdout */}
          {stdout && (
            <div className="fv-stdout-wrap">
              <div className="fv-col-hdr"><span className="fv-col-title">Output</span></div>
              <div className="fv-stdout">
                {stdout.trim().split('\n').slice(-8).map((l, i) => (
                  <div key={i} className="fv-stdout-row">
                    <span className="fv-stdout-arrow">›</span>{l}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right col: execution trace ── */}
        <div className="fv-col fv-col-trace">
          <div className="fv-col-hdr">
            <span className="fv-col-title">Execution Trace</span>
            <span className="fv-col-sub">recent {Math.min(currentStep + 1, 12)} steps</span>
          </div>
          <ExecTrace trace={trace} currentStep={currentStep} />
        </div>
      </div>
    </div>
  );
}