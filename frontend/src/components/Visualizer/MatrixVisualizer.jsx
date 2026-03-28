import React from 'react';
import { motion } from 'framer-motion';
import { getMatrix, getPointers } from '../../utils/vizMapper';
import './MatrixVisualizer.css';

const CS = 42;

export default function MatrixVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const data = getMatrix(locals, hints);
  const ptrs = getPointers(locals);
  if (!data) return null;
  const { name, rows } = data;
  const nr = rows.length, nc = rows[0]?.length ?? 0;
  const ip = ptrs['i'] ?? null, jp = ptrs['j'] ?? null;

  return (
    <div className="mv">
      <div className="mv-label">
        <span className="mv-name">{name}</span>
        <span className="mv-dims">[{nr} × {nc}]</span>
      </div>
      <div className="mv-scroll">
        <div className="mv-grid" style={{ gridTemplateColumns: `repeat(${nc}, ${CS}px)` }}>
          {rows.map((row, ri) =>
            (Array.isArray(row) ? row : []).map((cell, ci) => {
              const active = ri === ip && ci === jp;
              const rowHL  = ri === ip && !active;
              const colHL  = ci === jp && !active;
              let v = cell;
              if (typeof v === 'object') v = '…';
              return (
                <motion.div key={`${ri}-${ci}`}
                  className={`mv-cell ${active ? 'mv-active' : ''} ${rowHL ? 'mv-row' : ''} ${colHL ? 'mv-col' : ''}`}
                  style={{ width: CS, height: CS }}
                  animate={{ scale: active ? 1.14 : 1, y: active ? -3 : 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                  <span className="mv-val">{v === null ? '·' : String(v)}</span>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
      {(ip !== null || jp !== null) && (
        <div className="mv-ptrs">
          {ip !== null && <span className="mv-ptr"><span style={{ color: 'var(--accent-5)' }}>i</span> = {ip}</span>}
          {jp !== null && <span className="mv-ptr"><span style={{ color: 'var(--accent-4)' }}>j</span> = {jp}</span>}
        </div>
      )}
    </div>
  );
}
