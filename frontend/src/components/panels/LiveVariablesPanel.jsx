import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store';
import { displayValue } from '../../utils/vizMapper';
import './LiveVariablesPanel.css';

/* ── Per-type config ── */
const TYPE_CFG = {
  int:    { icon:'#', label:'int',   color:'var(--accent-5)' },
  float:  { icon:'#', label:'float', color:'var(--accent-5)' },
  str:    { icon:'"', label:'str',   color:'var(--accent-3)' },
  bool:   { icon:'?', label:'bool',  color:'var(--accent-2)' },
  list:   { icon:'[', label:'list',  color:'var(--accent)'   },
  tuple:  { icon:'(', label:'tuple', color:'var(--accent)'   },
  dict:   { icon:'{', label:'dict',  color:'var(--accent-4)' },
  set:    { icon:'{', label:'set',   color:'var(--accent-4)' },
  none:   { icon:'∅', label:'None',  color:'var(--text-3)'   },
  object: { icon:'⬡', label:'obj',   color:'var(--accent-2)' },
};
const defaultCfg = { icon:'~', label:'?', color:'var(--text-2)' };
const cfg = (type) => TYPE_CFG[type] || defaultCfg;

function shortVal(repr, max = 30) {
  const v = displayValue(repr, max);
  return v.length > max ? v.slice(0, max) + '…' : v;
}

/* ── Diff engine ── */
function diffLocals(curr, prev) {
  const keys = new Set([...Object.keys(curr||{}), ...Object.keys(prev||{})]);
  const out = [];
  for (const k of keys) {
    if (k.startsWith('__')) continue;
    const c = curr?.[k], p = prev?.[k];
    const cv = c ? displayValue(c, 120) : undefined;
    const pv = p ? displayValue(p, 120) : undefined;
    out.push({
      name: k,
      repr: c || p,
      curStr: cv,
      prvStr: pv,
      isNew:     !p && !!c,
      isChanged: !!p && !!c && cv !== pv,
      isRemoved: !!p && !c,
    });
  }
  return out.filter(r => r.repr);
}

/* ── Variable Row ── */
function VarRow({ name, repr, isNew, isChanged, prvStr, stepKey }) {
  const c         = cfg(repr?.type);
  const [flash, setFlash] = useState(false);
  const [popVal, setPopVal] = useState(false);
  const mountedRef = useRef(false);
  const prevKey    = useRef(stepKey);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (stepKey !== prevKey.current && (isNew || isChanged)) {
      prevKey.current = stepKey;
      setFlash(true);
      setPopVal(true);
      const t1 = setTimeout(() => setFlash(false), 1200);
      const t2 = setTimeout(() => setPopVal(false), 500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    prevKey.current = stepKey;
  }, [stepKey, isNew, isChanged]);

  const val = shortVal(repr, 28);

  return (
    <motion.div
      className={`vr ${flash ? 'vr-flash' : ''} ${isNew ? 'vr-new' : ''}`}
      style={{ '--vc': c.color }}
      layout
      initial={{ opacity:0, x:16, scale:0.96 }}
      animate={{ opacity:1, x:0, scale:1 }}
      exit={{ opacity:0, x:-10, height:0, marginBottom:0, padding:0 }}
      transition={{ type:'spring', stiffness:400, damping:32 }}
    >
      {/* Left accent bar */}
      <div className="vr-bar" />

      {/* Type badge */}
      <div className="vr-type-badge">{c.icon}</div>

      {/* Name + type label */}
      <div className="vr-meta">
        <span className="vr-name">{name}</span>
        <span className="vr-type-label">{c.label}</span>
      </div>

      {/* Value */}
      <div className="vr-val-wrap">
        {isChanged && prvStr && (
          <motion.div className="vr-prev"
            initial={{ opacity:1 }} animate={{ opacity:0.5 }}
            transition={{ duration:0.6 }}>
            {shortVal({ type:'str', value: prvStr }, 18)}
          </motion.div>
        )}
        <motion.div
          key={val}
          className={`vr-val ${popVal ? 'vr-val-pop' : ''}`}
          animate={popVal ? { scale:[1.22,1], color:['var(--change-text)','var(--vc)'] } : {}}
          transition={{ duration:0.4 }}
        >
          {val}
        </motion.div>
      </div>

      {/* Change indicator — the big visual attention grab */}
      <AnimatePresence>
        {flash && (
          <motion.div className="vr-changed-tag"
            initial={{ opacity:0, scale:0.6, x:6 }}
            animate={{ opacity:1, scale:1, x:0 }}
            exit={{ opacity:0, scale:0.7 }}
            transition={{ type:'spring', stiffness:500, damping:28 }}>
            {isNew ? 'NEW' : 'CHANGED'}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Timeline dots ── */
function Timeline({ history, current, onJump }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [history.length]);

  return (
    <div className="tl">
      <span className="tl-label">TIMELINE</span>
      <div className="tl-track" ref={ref}>
        {history.map((h, i) => (
          <button key={i}
            className={`tl-dot ${i===current?'tl-active':''} ${h.hasChange?'tl-change':''} ${h.hasError?'tl-error':''}`}
            onClick={() => onJump(i)}
            title={`Step ${i+1} · line ${h.line}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main Panel ── */
export default function LiveVariablesPanel() {
  const trace          = useStore(s => s.trace);
  const currentStep    = useStore(s => s.currentStep);
  const setCurrentStep = useStore(s => s.setCurrentStep);
  const setPlaying     = useStore(s => s.setPlaying);

  const step     = trace[currentStep]  || null;
  const prevStep = currentStep > 0 ? trace[currentStep-1] : null;

  const locals     = step?.locals  || {};
  const prevLocals = prevStep?.locals || {};
  const vars       = useMemo(() => diffLocals(locals, prevLocals), [locals, prevLocals]);

  const history = useMemo(() => trace.map((s, i) => {
    const p = i > 0 ? trace[i-1] : null;
    const hasChange = p ? Object.keys(s.locals||{}).some(k => {
      const cv = displayValue(s.locals[k], 120);
      const pv = p.locals?.[k] ? displayValue(p.locals[k], 120) : null;
      return pv !== null && cv !== pv;
    }) : false;
    return { line: s.line, hasChange, hasError: s.event === 'error' };
  }), [trace]);

  const jump = useCallback((i) => { setPlaying(false); setCurrentStep(i); }, []);

  const callStack = step?.call_stack || [];
  const stdout    = step?.stdout || '';
  const isError   = step?.event === 'error';
  const errorInfo = step?.error;
  const hasVars   = vars.length > 0;

  const changedCount = vars.filter(v => v.isNew || v.isChanged).length;

  return (
    <div className="lvp">
      {/* Header */}
      <div className="lvp-hdr">
        <div className="lvp-title">
          <span className="lvp-title-icon">⟨/⟩</span>
          Variables
        </div>
        <div className="lvp-meta">
          {step?.line && <span className="lvp-line">line {step.line}</span>}
          {changedCount > 0 && (
            <motion.span className="lvp-changed-count"
              key={`${currentStep}-${changedCount}`}
              initial={{ scale:1.4 }} animate={{ scale:1 }}
              transition={{ type:'spring', stiffness:500, damping:25 }}>
              {changedCount} changed
            </motion.span>
          )}
        </div>
      </div>

      {/* Empty */}
      {!trace.length && (
        <div className="lvp-empty">
          <div className="lvp-empty-icon">⟨/⟩</div>
          <p>Run code to track<br/>live variable state</p>
        </div>
      )}

      {/* Variables */}
      {trace.length > 0 && (
        <div className="lvp-vars">
          {!hasVars && <div className="lvp-no-vars">No variables in scope</div>}
          <AnimatePresence mode="popLayout">
            {vars.map(v => (
              <VarRow key={v.name}
                name={v.name} repr={v.repr}
                isNew={v.isNew} isChanged={v.isChanged}
                prvStr={v.prvStr}
                stepKey={currentStep}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Call Stack */}
      {callStack.length > 0 && (
        <div className="lvp-section">
          <div className="lvp-section-hdr">Call Stack</div>
          {[...callStack].reverse().map((f, i) => (
            <div key={i} className={`lvp-frame ${i===0?'lvp-frame-top':''}`}>
              <span className="lvp-frame-arrow">{i===0?'▶':'·'}</span>
              <span className="lvp-frame-fn">{f.function}</span>
              <span className="lvp-frame-ln">:{f.line}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && errorInfo && (
        <div className="lvp-error">
          <div className="lvp-error-hdr">⚠ {errorInfo.type}</div>
          <div className="lvp-error-msg">{errorInfo.message}</div>
          {errorInfo.line && <div className="lvp-error-ln">line {errorInfo.line}</div>}
        </div>
      )}

      {/* Stdout */}
      {stdout && (
        <div className="lvp-section">
          <div className="lvp-section-hdr">Output</div>
          <div className="lvp-out">
            {stdout.trim().split('\n').slice(-6).map((l,i) => (
              <div key={i} className="lvp-out-row">
                <span className="lvp-out-arrow">›</span>{l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {trace.length > 0 && (
        <Timeline history={history} current={currentStep} onJump={jump} />
      )}
    </div>
  );
}
