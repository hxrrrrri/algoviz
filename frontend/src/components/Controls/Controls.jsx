import React from 'react';
import useStore from '../../store';
import { usePlayback } from '../../hooks/usePlayback';
import './Controls.css';

const SPEEDS = [0.5, 1, 2, 4];

export default function Controls() {
  const executeCode    = useStore(s => s.executeCode);
  const resetExecution = useStore(s => s.resetExecution);
  const isExecuting    = useStore(s => s.isExecuting);
  const isPlaying      = useStore(s => s.isPlaying);
  const setPlaying     = useStore(s => s.setPlaying);
  const playSpeed      = useStore(s => s.playSpeed);
  const setPlaySpeed   = useStore(s => s.setPlaySpeed);
  const currentStep    = useStore(s => s.currentStep);
  const trace          = useStore(s => s.trace);
  const stepForward    = useStore(s => s.stepForward);
  const stepBackward   = useStore(s => s.stepBackward);
  const setCurrentStep = useStore(s => s.setCurrentStep);

  usePlayback();

  const total   = trace.length;
  const hasTrace = total > 0;
  const atEnd   = currentStep >= total - 1;
  const atStart = currentStep === 0;
  const progress = hasTrace ? ((currentStep) / Math.max(total - 1, 1)) * 100 : 0;

  const handleScrub = (e) => {
    if (!hasTrace) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentStep(Math.round(ratio * (total - 1)));
    setPlaying(false);
  };

  return (
    <div className="ctrl">
      <div className="ctrl-inner">
        {/* Run */}
        <button className={`ctrl-run ${isExecuting ? 'running' : ''}`}
          onClick={executeCode} disabled={isExecuting}>
          {isExecuting
            ? <><span className="ctrl-spinner"/><span>Running…</span></>
            : <><span className="ctrl-run-gem">◆</span><span>Run</span></>}
        </button>

        <div className="ctrl-sep" />

        {/* Transport */}
        <div className={`ctrl-transport ${!hasTrace ? 'dim' : ''}`}>
          <button className="ctrl-btn" onClick={() => setCurrentStep(0)} disabled={!hasTrace||atStart} title="Start">⏮</button>
          <button className="ctrl-btn" onClick={stepBackward} disabled={!hasTrace||atStart} title="Step back">⏪</button>
          <button className="ctrl-btn play" title={isPlaying?'Pause':'Play'}
            disabled={!hasTrace}
            onClick={() => {
              if (atEnd) { setCurrentStep(0); setPlaying(true); }
              else setPlaying(!isPlaying);
            }}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="ctrl-btn" onClick={stepForward} disabled={!hasTrace||atEnd} title="Step forward">⏩</button>
          <button className="ctrl-btn" onClick={() => setCurrentStep(total-1)} disabled={!hasTrace||atEnd} title="End">⏭</button>
        </div>

        {/* Scrubber */}
        <div className={`ctrl-scrubber ${!hasTrace?'dim':''}`} onClick={handleScrub}>
          <div className="ctrl-track">
            <div className="ctrl-fill" style={{width:`${progress}%`}}/>
            <div className="ctrl-thumb" style={{left:`${progress}%`}}/>
          </div>
          {hasTrace && (
            <span className="ctrl-pos">{currentStep+1} / {total}</span>
          )}
        </div>

        {/* Speed */}
        <div className="ctrl-speeds">
          {SPEEDS.map(s => (
            <button key={s} className={`ctrl-speed ${playSpeed===s?'on':''}`}
              onClick={() => setPlaySpeed(s)}>{s}×</button>
          ))}
        </div>

        <div className="ctrl-sep" />

        {/* Reset */}
        <button className="ctrl-btn reset" onClick={resetExecution}
          disabled={!hasTrace&&!isExecuting} title="Clear">✕</button>
      </div>
    </div>
  );
}
