import React, { useEffect, useRef } from 'react';
import './OutputPanel.css';

export default function OutputPanel({ stepData, error }) {
  const scrollRef = useRef(null);
  const stdout = stepData?.stdout || '';
  const lines = stdout ? stdout.split('\n').filter(Boolean) : [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [stdout]);

  return (
    <div className="output-panel" ref={scrollRef}>
      {error && (
        <div className="output-error">
          <div className="error-header">
            <span className="error-icon">✕</span>
            <span className="error-type">{error.type}</span>
            {error.line && <span className="error-line">line {error.line}</span>}
          </div>
          <div className="error-message">{error.message}</div>
          {error.traceback && (
            <pre className="error-traceback">{error.traceback}</pre>
          )}
        </div>
      )}

      {lines.length === 0 && !error && (
        <div className="output-empty">
          <span>No output yet. Use print() to see results here.</span>
        </div>
      )}

      {lines.map((line, i) => (
        <div key={i} className="output-line">
          <span className="output-prefix">›</span>
          <span className="output-text">{line}</span>
        </div>
      ))}
    </div>
  );
}
