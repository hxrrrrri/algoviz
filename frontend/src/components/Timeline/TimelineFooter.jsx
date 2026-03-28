import { useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import useStore from '../../store';
import { displayValue } from '../../utils/vizMapper';
import './TimelineFooter.css';

export default function TimelineFooter() {
  const trace        = useStore(s => s.trace);
  const currentStep  = useStore(s => s.currentStep);
  const setCurrentStep = useStore(s => s.setCurrentStep);
  const setPlaying   = useStore(s => s.setPlaying);
  const isPlaying    = useStore(s => s.isPlaying);

  const trackRef = useRef(null);

  const history = useMemo(() => trace.map((s, i) => {
    const p = i > 0 ? trace[i - 1] : null;
    const hasChange = p
      ? Object.keys(s.locals || {}).some(k => {
          const cv = displayValue(s.locals[k], 120);
          const pv = p.locals?.[k] ? displayValue(p.locals[k], 120) : null;
          return pv !== null && cv !== pv;
        })
      : false;
    return { line: s.line, hasChange, hasError: s.event === 'error', event: s.event };
  }), [trace]);

  /* auto-scroll active dot into view */
  useEffect(() => {
    if (!trackRef.current || !trace.length) return;
    const el = trackRef.current;
    const active = el.querySelector('.tlf-dot.tlf-active');
    if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [currentStep, trace.length]);

  const jump = useCallback((i) => {
    setPlaying(false);
    setCurrentStep(i);
  }, [setPlaying, setCurrentStep]);

  if (!trace.length) return null;

  const pct = trace.length > 1 ? (currentStep / (trace.length - 1)) * 100 : 100;

  return (
    <div className="tlf">
      {/* Left: label + step counter */}
      <div className="tlf-left">
        <span className="tlf-label">TIMELINE</span>
        <span className="tlf-count">
          <span className="tlf-count-cur">{currentStep + 1}</span>
          <span className="tlf-count-sep">/</span>
          <span className="tlf-count-tot">{trace.length}</span>
        </span>
        <span className="tlf-line-badge">ln {history[currentStep]?.line}</span>
      </div>

      {/* Centre: scrollable dot track */}
      <div className="tlf-track-wrap">
        {/* Progress bar under track */}
        <div className="tlf-progress-bar">
          <motion.div
            className="tlf-progress-fill"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          />
        </div>

        <div className="tlf-track" ref={trackRef}>
          {history.map((h, i) => (
            <button
              key={i}
              className={[
                'tlf-dot',
                i === currentStep ? 'tlf-active' : '',
                h.hasChange       ? 'tlf-change' : '',
                h.hasError        ? 'tlf-error'  : '',
                h.event === 'call'   ? 'tlf-call'   : '',
                h.event === 'return' ? 'tlf-ret'    : '',
              ].filter(Boolean).join(' ')}
              onClick={() => jump(i)}
              title={`Step ${i + 1} · line ${h.line}${h.hasChange ? ' · changed' : ''}${h.hasError ? ' · error' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Right: event badge */}
      <div className="tlf-right">
        <span className={`tlf-event-badge tlf-ev-${history[currentStep]?.event || 'line'}`}>
          {history[currentStep]?.event || 'line'}
        </span>
      </div>
    </div>
  );
}