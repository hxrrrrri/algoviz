import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store';
import ArrayVisualizer from './ArrayVisualizer';
import MatrixVisualizer from './MatrixVisualizer';
import { getPrimaryArray, getMatrix } from '../../utils/vizMapper';
import './VisualizationPanel.css';

export default function VisualizationPanel() {
  const trace = useStore(s => s.trace);
  const currentStep = useStore(s => s.currentStep);
  const stepData = trace[currentStep] || null;
  const isError = stepData?.event === 'error';
  const hasTrace = trace.length > 0;

  const hasArray = useMemo(() =>
    stepData ? !!getPrimaryArray(stepData.locals, stepData.structure_hints) : false,
    [stepData]);
  const hasMatrix = useMemo(() =>
    stepData ? !!getMatrix(stepData.locals, stepData.structure_hints) : false,
    [stepData]);

  return (
    <div className="vp">
      {/* Decorative grid */}
      <div className="vp-grid" />

      {/* Top bar */}
      <div className="vp-topbar">
        <div className="vp-topbar-left">
          <span className="vp-title-gem">◈</span>
          <span className="vp-title">Visualization</span>
        </div>
        {hasTrace && (
          <div className="vp-step-info">
            <span className="vp-step-label">STEP</span>
            <span className="vp-step-num">{currentStep + 1}</span>
            <span className="vp-step-of">/ {trace.length}</span>
            {stepData?.line && <span className="vp-step-line">· line {stepData.line}</span>}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="vp-content">
        {!hasTrace && (
          <div className="vp-empty">
            <div className="vp-empty-orb" />
            <div className="vp-empty-gem">◈</div>
            <div className="vp-empty-title">Ready to Visualize</div>
            <div className="vp-empty-sub">Write an algorithm and press Run<br/>to see it come alive</div>
            <div className="vp-empty-hint">Ctrl + Enter</div>
          </div>
        )}

        {hasTrace && isError && stepData?.error && (
          <motion.div className="vp-error-banner"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="vp-err-icon">⚠</div>
            <div>
              <div className="vp-err-type">{stepData.error.type}</div>
              <div className="vp-err-msg">{stepData.error.message}
                {stepData.error.line && ` — line ${stepData.error.line}`}
              </div>
            </div>
          </motion.div>
        )}

        {hasTrace && hasArray && (
          <AnimatePresence>
            <motion.div key="arr"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="vp-section">
              <ArrayVisualizer stepData={stepData} />
            </motion.div>
          </AnimatePresence>
        )}

        {hasTrace && hasMatrix && !hasArray && (
          <AnimatePresence>
            <motion.div key="mat"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="vp-section">
              <MatrixVisualizer stepData={stepData} />
            </motion.div>
          </AnimatePresence>
        )}

        {hasTrace && !hasArray && !hasMatrix && !isError && (
          <div className="vp-no-struct">
            <div className="vp-no-struct-gem">◇</div>
            <div>No visual structure detected yet.</div>
            <div className="vp-no-struct-hint">Check the Variables panel →</div>
          </div>
        )}
      </div>
    </div>
  );
}
