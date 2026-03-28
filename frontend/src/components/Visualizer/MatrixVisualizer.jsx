import React from 'react';
import { motion } from 'framer-motion';
import { getMatrix, getPointers } from '../../utils/vizMapper';
import './MatrixVisualizer.css';

const CS = 40;

export default function MatrixVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const matrixData = getMatrix(locals, hints);
  const pointers   = getPointers(locals);
  if (!matrixData) return null;
  const { name, rows } = matrixData;
  const nr = rows.length, nc = rows[0]?.length ?? 0;
  const ip = pointers['i'] ?? null, jp = pointers['j'] ?? null;

  return (
    <div className="mv">
      <div className="mv-label">
        <span className="mv-name">{name}</span>
        <span className="mv-dims">[{nr} × {nc}]</span>
      </div>
      <div className="mv-scroll">
        <div className="mv-grid" style={{ gridTemplateColumns: `repeat(${nc}, ${CS}px)` }}>
          {rows.map((row, ri) => (Array.isArray(row) ? row : []).map((cell, ci) => {
            const active = ri===ip && ci===jp;
            const rowHL  = ri===ip && !active;
            const colHL  = ci===jp && !active;
            let v = cell;
            if (typeof v==='object') v='…';
            return (
              <motion.div key={`${ri}-${ci}`}
                className={`mv-cell ${active?'active':''} ${rowHL?'row-hl':''} ${colHL?'col-hl':''}`}
                style={{ width: CS, height: CS }}
                animate={{ scale: active ? 1.15 : 1, y: active ? -3 : 0 }}
                transition={{ type:'spring', stiffness:380, damping:26 }}>
                <div className="mv-shine"/>
                <span className="mv-val">{v===null?'·':String(v)}</span>
              </motion.div>
            );
          }))}
        </div>
      </div>
      {(ip!==null||jp!==null) && (
        <div className="mv-ptrs">
          {ip!==null && <span className="mv-ptr"><span style={{color:'#4fc3f7'}}>i</span> = {ip}</span>}
          {jp!==null && <span className="mv-ptr"><span style={{color:'#fb923c'}}>j</span> = {jp}</span>}
        </div>
      )}
    </div>
  );
}
