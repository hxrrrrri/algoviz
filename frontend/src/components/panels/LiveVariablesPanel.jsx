import React, { useMemo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store';
import { displayValue } from '../../utils/vizMapper';
import './LiveVariablesPanel.css';

/* ── colour per type ── */
const TYPE_COLOR = {
  int:    { gem: '◆', color: '#4fc3f7', bg: 'rgba(79,195,247,0.08)'  },
  float:  { gem: '◆', color: '#4fc3f7', bg: 'rgba(79,195,247,0.08)'  },
  str:    { gem: '◇', color: '#4ade80', bg: 'rgba(74,222,128,0.08)'  },
  bool:   { gem: '●', color: '#c084fc', bg: 'rgba(192,132,252,0.08)' },
  list:   { gem: '▣', color: '#fb923c', bg: 'rgba(251,146,60,0.08)'  },
  tuple:  { gem: '▣', color: '#fb923c', bg: 'rgba(251,146,60,0.08)'  },
  dict:   { gem: '⬡', color: '#f5c842', bg: 'rgba(245,200,66,0.08)'  },
  none:   { gem: '○', color: '#7a7668', bg: 'rgba(122,118,104,0.06)' },
  object: { gem: '⬟', color: '#c084fc', bg: 'rgba(192,132,252,0.08)' },
  set:    { gem: '◉', color: '#fb923c', bg: 'rgba(251,146,60,0.08)'  },
};
const DEFAULT_TYPE = { gem: '◈', color: '#c8c4b8', bg: 'rgba(200,196,184,0.06)' };

function getTypeMeta(type) { return TYPE_COLOR[type] || DEFAULT_TYPE; }

/* shorten display value */
function shortVal(repr, maxLen = 32) {
  const v = displayValue(repr, maxLen);
  return v.length > maxLen ? v.slice(0, maxLen) + '…' : v;
}

/* build a history entry comparing current vs previous locals */
function diffLocals(curr, prev) {
  const keys = new Set([...Object.keys(curr), ...Object.keys(prev)]);
  const result = [];
  for (const k of keys) {
    if (k.startsWith('__')) continue;
    const cur = curr[k];
    const prv = prev[k];
    const curStr = cur ? displayValue(cur, 80) : undefined;
    const prvStr = prv ? displayValue(prv, 80) : undefined;
    const isNew     = !prv && !!cur;
    const isChanged = !!prv && !!cur && curStr !== prvStr;
    const isRemoved = !!prv && !cur;
    result.push({ name: k, repr: cur || prv, curStr, prvStr, isNew, isChanged, isRemoved });
  }
  return result.filter(r => r.repr);
}

/* single variable card */
function VarCard({ name, repr, isNew, isChanged, prvStr }) {
  const meta    = getTypeMeta(repr?.type);
  const [flash, setFlash] = useState(false);
  const prevChanged = useRef(false);

  useEffect(() => {
    if ((isNew || isChanged) && !prevChanged.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      prevChanged.current = true;
      return () => clearTimeout(t);
    }
    if (!isNew && !isChanged) prevChanged.current = false;
  }, [isNew, isChanged, repr]);

  const val = shortVal(repr, 36);
  const typeLabel = repr?.type || '?';

  return (
    <motion.div
      className={`var-card ${flash ? 'flash' : ''} ${isNew ? 'is-new' : ''}`}
      style={{ '--card-color': meta.color, '--card-bg': meta.bg }}
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
    >
      <div className="var-card-left">
        <span className="var-gem">{meta.gem}</span>
        <div className="var-info">
          <span className="var-name">{name}</span>
          <span className="var-type">{typeLabel}</span>
        </div>
      </div>

      <div className="var-card-right">
        {isChanged && prvStr && (
          <div className="var-prev">{shortVal({ type: 'str', value: prvStr }, 20)}</div>
        )}
        <motion.div
          className="var-value"
          key={val}
          initial={isChanged || isNew ? { scale: 1.1, color: '#f5c842' } : false}
          animate={{ scale: 1, color: meta.color }}
          transition={{ duration: 0.35 }}
        >
          {val}
        </motion.div>
      </div>

      {(isNew || isChanged) && <div className="var-change-dot" />}
    </motion.div>
  );
}

/* history timeline strip at bottom */
function HistoryStrip({ history, currentStep, onJump }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [history.length]);

  return (
    <div className="history-strip">
      <div className="history-label">TIMELINE</div>
      <div className="history-scroll" ref={scrollRef}>
        {history.map((h, i) => (
          <button
            key={i}
            className={`history-tick ${i === currentStep ? 'active' : ''} ${h.hasChange ? 'has-change' : ''} ${h.hasError ? 'has-error' : ''}`}
            onClick={() => onJump(i)}
            title={`Step ${i + 1} — line ${h.line}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function LiveVariablesPanel() {
  const trace       = useStore(s => s.trace);
  const currentStep = useStore(s => s.currentStep);
  const setCurrentStep = useStore(s => s.setCurrentStep);
  const setPlaying  = useStore(s => s.setPlaying);

  const stepData = trace[currentStep] || null;
  const prevStep = currentStep > 0 ? trace[currentStep - 1] : null;

  const locals  = stepData?.locals  || {};
  const prevLocals = prevStep?.locals || {};
  const hints   = stepData?.structure_hints || {};

  /* diff variables */
  const vars = useMemo(() => diffLocals(locals, prevLocals), [locals, prevLocals]);

  /* build timeline history */
  const history = useMemo(() => trace.map((s, i) => {
    const prev = i > 0 ? trace[i-1] : null;
    const hasChange = prev ? Object.keys(s.locals || {}).some(k => {
      const cv = displayValue(s.locals[k], 80);
      const pv = prev.locals?.[k] ? displayValue(prev.locals[k], 80) : null;
      return pv !== null && cv !== pv;
    }) : false;
    return { line: s.line, hasChange, hasError: s.event === 'error' };
  }), [trace]);

  const callStack  = stepData?.call_stack || [];
  const stdout     = stepData?.stdout || '';
  const isError    = stepData?.event === 'error';
  const errorInfo  = stepData?.error;
  const currentLine = stepData?.line;

  const hasVars = vars.length > 0;

  return (
    <div className="lvp">
      {/* Header */}
      <div className="lvp-header">
        <div className="lvp-title">
          <span className="lvp-gem">◈</span>
          Live Variables
        </div>
        {currentLine && (
          <div className="lvp-line-badge">line {currentLine}</div>
        )}
      </div>

      {/* Empty state */}
      {!trace.length && (
        <div className="lvp-empty">
          <div className="lvp-empty-icon">◈</div>
          <div>Run your code to<br/>inspect variables</div>
        </div>
      )}

      {/* Variable cards */}
      {trace.length > 0 && (
        <div className="lvp-vars-scroll">
          {!hasVars && (
            <div className="lvp-no-vars">No local variables yet</div>
          )}
          <AnimatePresence mode="popLayout">
            {vars.map(v => (
              <VarCard
                key={v.name}
                name={v.name}
                repr={v.repr}
                isNew={v.isNew}
                isChanged={v.isChanged}
                prvStr={v.prvStr}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Call stack section */}
      {callStack.length > 0 && (
        <div className="lvp-section">
          <div className="lvp-section-title">◇ Call Stack</div>
          {[...callStack].reverse().map((frame, i) => (
            <div key={i} className={`cs-frame ${i === 0 ? 'top' : ''}`}>
              <span className="cs-icon">{i === 0 ? '▶' : '·'}</span>
              <span className="cs-fn">{frame.function}</span>
              <span className="cs-line">:{frame.line}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {isError && errorInfo && (
        <div className="lvp-error">
          <div className="lvp-error-type">⚠ {errorInfo.type}</div>
          <div className="lvp-error-msg">{errorInfo.message}</div>
          {errorInfo.line && <div className="lvp-error-line">at line {errorInfo.line}</div>}
        </div>
      )}

      {/* Stdout */}
      {stdout && (
        <div className="lvp-section">
          <div className="lvp-section-title">◇ Output</div>
          <div className="lvp-stdout">
            {stdout.trim().split('\n').map((l, i) => (
              <div key={i} className="lvp-out-line">
                <span className="lvp-out-arrow">›</span>{l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline strip */}
      {trace.length > 0 && (
        <HistoryStrip
          history={history}
          currentStep={currentStep}
          onJump={(i) => { setPlaying(false); setCurrentStep(i); }}
        />
      )}
    </div>
  );
}
