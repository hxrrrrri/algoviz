import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPrimaryArray, getPointers, getPointerStyle } from '../../utils/vizMapper';
import './ArrayVisualizer.css';

const CELL_W = 56, CELL_H = 56, GAP = 8;

export default function ArrayVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const arrayData = useMemo(() => getPrimaryArray(locals, hints), [locals, hints]);
  const pointers  = useMemo(() => getPointers(locals), [locals]);

  if (!arrayData || !arrayData.values.length) return null;
  const { name, values } = arrayData;

  const leftPtr  = pointers['left']  ?? pointers['l']   ?? pointers['low']   ?? pointers['start'] ?? null;
  const rightPtr = pointers['right'] ?? pointers['r']   ?? pointers['high']  ?? pointers['end']   ?? null;
  const midPtr   = pointers['mid']   ?? pointers['m']   ?? pointers['middle'] ?? null;

  const pointersByIdx = {};
  for (const [pName, pIdx] of Object.entries(pointers)) {
    if (typeof pIdx === 'number' && pIdx >= 0 && pIdx < values.length) {
      (pointersByIdx[pIdx] = pointersByIdx[pIdx] || []).push(pName);
    }
  }

  const getCellState = (i) => {
    if (i === midPtr) return 'mid';
    if (leftPtr !== null && rightPtr !== null && (i < leftPtr || i > rightPtr)) return 'eliminated';
    if (i === leftPtr || i === rightPtr) return 'boundary';
    if (pointersByIdx[i]) return 'active';
    return 'normal';
  };

  return (
    <div className="av">
      <div className="av-label">
        <span className="av-name">{name}</span>
        <span className="av-len">[{values.length}]</span>
        {Object.keys(pointers).length > 0 && (
          <div className="av-ptr-pills">
            {Object.entries(pointers)
              .sort((a,b) => (getPointerStyle(a[0]).priority||99)-(getPointerStyle(b[0]).priority||99))
              .map(([n,v]) => {
                const s = getPointerStyle(n);
                return (
                  <span key={n} className="ptr-pill" style={{'--pc': s.color}}>
                    {n} = {v}
                  </span>
                );
              })}
          </div>
        )}
      </div>

      <div className="av-stage">
        {/* Pointer arrows above cells */}
        <div className="av-ptr-row" style={{ width: values.length*(CELL_W+GAP)-GAP }}>
          {Object.entries(pointersByIdx).map(([idx, ptrs]) => {
            const x = parseInt(idx)*(CELL_W+GAP) + CELL_W/2;
            return (
              <div key={idx} className="av-ptr-col" style={{ left: x-28, width: 56 }}>
                {ptrs.map(p => {
                  const s = getPointerStyle(p);
                  return (
                    <motion.div key={p} className="av-ptr-tag"
                      style={{'--pc': s.color}}
                      layoutId={`ptr-${p}`}
                      layout
                      transition={{ type:'spring', stiffness:380, damping:28 }}>
                      {p}
                    </motion.div>
                  );
                })}
                <div className="av-ptr-arrow" style={{'--pc': getPointerStyle(ptrs[0]).color}} />
              </div>
            );
          })}
        </div>

        {/* Cells */}
        <div className="av-cells">
          {values.map((val, i) => {
            const state = getCellState(i);
            let disp = val === null ? 'None' : String(val).slice(0,6);
            if (typeof val === 'object' && val !== null) disp = '{…}';

            return (
              <motion.div key={i}
                className={`av-cell state-${state}`}
                style={{ width: CELL_W, height: CELL_H }}
                layout
                layoutId={`cell-${name}-${i}`}
                animate={{
                  scale:   state==='mid' ? 1.14 : state==='active'||state==='boundary' ? 1.06 : 1,
                  opacity: state==='eliminated' ? 0.22 : 1,
                  y:       state==='mid' ? -4 : 0,
                }}
                transition={{ type:'spring', stiffness:340, damping:26 }}>
                {/* 3D face shine */}
                <div className="av-cell-shine" />
                <span className="av-cell-val">{disp}</span>
                <span className="av-cell-idx">{i}</span>
                {(state==='mid') && <div className="av-cell-glow" />}
              </motion.div>
            );
          })}
        </div>

        {/* Elimination overlay bars */}
        {leftPtr !== null && rightPtr !== null && (
          <>
            {leftPtr > 0 && (
              <div className="av-elim-bar left" style={{
                width: leftPtr*(CELL_W+GAP)-GAP/2,
                left: 0
              }}/>
            )}
            {rightPtr < values.length-1 && (
              <div className="av-elim-bar right" style={{
                width: (values.length-1-rightPtr)*(CELL_W+GAP)-GAP/2,
                right: 0
              }}/>
            )}
          </>
        )}
      </div>
    </div>
  );
}
