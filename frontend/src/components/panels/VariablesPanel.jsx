import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { displayValue } from '../../utils/vizMapper';
import './VariablesPanel.css';

function VarRow({ name, repr, prevRepr, hint }) {
  const val = displayValue(repr);
  const prevVal = prevRepr ? displayValue(prevRepr) : null;
  const changed = prevVal !== null && prevVal !== val;

  const typeColor = {
    int: 'var(--accent-cyan)',
    float: 'var(--accent-cyan)',
    str: 'var(--accent-green)',
    bool: 'var(--accent-purple)',
    list: 'var(--accent-orange)',
    tuple: 'var(--accent-orange)',
    dict: 'var(--accent-yellow)',
    none: 'var(--text-muted)',
    object: 'var(--accent-purple)',
  }[repr?.type] || 'var(--text-secondary)';

  return (
    <motion.div
      className={`var-row ${changed ? 'changed' : ''}`}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="var-name-col">
        <span className="var-name">{name}</span>
        {hint && <span className="var-hint">{hint}</span>}
      </div>
      <div className="var-type-col">
        <span className="var-type" style={{ color: typeColor }}>
          {repr?.type || '?'}
        </span>
      </div>
      <div className="var-value-col">
        <span className={`var-value ${changed ? 'highlight-change' : ''}`}>
          {val}
        </span>
      </div>
    </motion.div>
  );
}

export default function VariablesPanel({ stepData, prevStepData }) {
  const [showGlobals, setShowGlobals] = useState(false);
  const locals = stepData?.locals || {};
  const globals = stepData?.globals || {};
  const hints = stepData?.structure_hints || {};
  const prevLocals = prevStepData?.locals || {};

  const localEntries = Object.entries(locals).filter(([k]) => !k.startsWith('__'));
  const globalEntries = Object.entries(globals).filter(([k]) => !k.startsWith('__'));

  return (
    <div className="variables-panel">
      {localEntries.length === 0 && (
        <div className="vars-empty">No variables in scope yet</div>
      )}

      {localEntries.length > 0 && (
        <div className="var-section">
          <div className="var-section-header">
            <span>locals</span>
            <span className="var-count">{localEntries.length}</span>
          </div>
          <div className="var-table-header">
            <span>name</span>
            <span>type</span>
            <span>value</span>
          </div>
          <AnimatePresence>
            {localEntries.map(([name, repr]) => (
              <VarRow
                key={name}
                name={name}
                repr={repr}
                prevRepr={prevLocals[name]}
                hint={hints[name]}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {globalEntries.length > 0 && (
        <div className="var-section">
          <button
            className="var-section-header toggle"
            onClick={() => setShowGlobals(v => !v)}
          >
            <span>globals</span>
            <span className="var-count">{globalEntries.length}</span>
            <span className="toggle-icon">{showGlobals ? '▾' : '▸'}</span>
          </button>
          {showGlobals && (
            <AnimatePresence>
              {globalEntries.map(([name, repr]) => (
                <VarRow key={name} name={name} repr={repr} prevRepr={null} />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}
