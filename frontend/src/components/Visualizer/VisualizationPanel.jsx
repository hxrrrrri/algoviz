import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store';
import ArrayVisualizer from './ArrayVisualizer';
import MatrixVisualizer from './MatrixVisualizer';
import { getPrimaryArray, getMatrix } from '../../utils/vizMapper';
import './VisualizationPanel.css';

export default function VisualizationPanel() {
  const trace       = useStore(s => s.trace);
  const currentStep = useStore(s => s.currentStep);
  const step        = trace[currentStep] || null;
  const isError     = step?.event === 'error';
  const hasTrace    = trace.length > 0;

  const hasArray  = useMemo(() => step ? !!getPrimaryArray(step.locals, step.structure_hints) : false, [step]);
  const hasMatrix = useMemo(() => step ? !!getMatrix(step.locals, step.structure_hints) : false, [step]);

  return (
    <div className="vp">
      <div className="vp-grid" />
      <div className="vp-topbar">
        <div className="vp-topbar-l">
          <div className="vp-title-dot" />
          <span className="vp-title">Visualization</span>
        </div>
        {hasTrace && (
          <div className="vp-step-info">
            <span className="vp-step-n">{currentStep + 1}</span>
            <span className="vp-step-of">/ {trace.length}</span>
            {step?.line && <span className="vp-step-line">· line {step.line}</span>}
          </div>
        )}
      </div>

      <div className="vp-content">
        {!hasTrace && (
          <div className="vp-empty">
            <div className="vp-empty-ring">
              <div className="vp-empty-logo">⟨/⟩</div>
            </div>
            <div className="vp-empty-title">Code-Viz</div>
            <div className="vp-empty-sub">Write an algorithm and run it<br/>to see live visualization</div>
            <div className="vp-empty-kbd">Ctrl + Enter</div>
          </div>
        )}

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

        {hasTrace && hasArray && (
          <AnimatePresence>
            <motion.div key="arr" className="vp-section"
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}>
              <ArrayVisualizer stepData={step} />
            </motion.div>
          </AnimatePresence>
        )}

        {hasTrace && hasMatrix && !hasArray && (
          <AnimatePresence>
            <motion.div key="mat" className="vp-section"
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}>
              <MatrixVisualizer stepData={step} />
            </motion.div>
          </AnimatePresence>
        )}

        {hasTrace && !hasArray && !hasMatrix && !isError && (
          <div className="vp-no-struct">
            <div className="vp-no-struct-icon">◇</div>
            <div>No structure detected yet</div>
            <div className="vp-no-struct-hint">Check the Variables panel →</div>
          </div>
        )}
      </div>
    </div>
  );
}
