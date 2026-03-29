import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getPrimaryArray, getPointers, getPointerStyle } from '../../utils/vizMapper';
import './ArrayVisualizer.css';

const CH = 54;

export default function ArrayVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const arrData = useMemo(() => getPrimaryArray(locals, hints), [locals, hints]);
  const ptrs    = useMemo(() => getPointers(locals), [locals]);
  if (!arrData?.values?.length) return null;

  const { name, values } = arrData;
  const n = values.length;

  /* ── Classify each index ── */
  const lp = ptrs['left'] ?? ptrs['l'] ?? ptrs['lo'] ?? ptrs['low'] ?? ptrs['start'] ?? null;
  const rp = ptrs['right'] ?? ptrs['r'] ?? ptrs['hi'] ?? ptrs['high'] ?? ptrs['end'] ?? null;
  const mp = ptrs['mid'] ?? ptrs['m'] ?? ptrs['middle'] ?? null;

  // byIdx: which named pointers sit at each index
  const byIdx = {};
  for (const [pname, v] of Object.entries(ptrs)) {
    if (typeof v === 'number' && v >= 0 && v < n)
      (byIdx[v] = byIdx[v] || []).push(pname);
  }

  const cellState = (i) => {
    if (i === mp) return 'st-mid';
    if (lp !== null && rp !== null && (i < lp || i > rp)) return 'st-eliminated';
    if (i === lp || i === rp) return 'st-boundary';
    if (byIdx[i]) return 'st-active';
    return 'st-normal';
  };

  /* ── Pointer pills summary ── */
  const sortedPtrs = Object.entries(ptrs)
    .sort((a, b) => (getPointerStyle(a[0]).priority || 99) - (getPointerStyle(b[0]).priority || 99));

  return (
    <div className="av">
      {/* Header */}
      <div className="av-header">
        <span className="av-name">{name}</span>
        <span className="av-len">[{n}]</span>
        {sortedPtrs.length > 0 && (
          <div className="av-ptr-pills">
            {sortedPtrs.map(([pname, v]) => (
              <span key={pname} className="ptr-pill" style={{ '--pc': getPointerStyle(pname).color }}>
                {pname} = {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Grid stage — each column = one array cell.
          Pointer row (row 1) and cell row (row 2) share the same column widths
          so they are perfectly aligned regardless of container size. */}
      <div className="av-stage">
        <div
          className="av-grid"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(44px, 64px))` }}
        >
          {/* Row 1 — pointer tags + arrows, one cell per column */}
          {values.map((_, i) => {
            const names = byIdx[i];
            if (!names) return <div key={`p${i}`} className="av-ptr-cell" />;
            const s = getPointerStyle(names[0]);
            return (
              <div key={`p${i}`} className="av-ptr-cell">
                <div className="av-ptr-tags">
                  {names.map(pname => (
                    <motion.div
                      key={pname}
                      className="av-ptr-tag"
                      style={{ '--pc': getPointerStyle(pname).color }}
                      layoutId={`ptr-${pname}`}
                      layout
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    >
                      {pname}
                    </motion.div>
                  ))}
                </div>
                <div className="av-ptr-arrow" style={{ '--pc': s.color }} />
              </div>
            );
          })}

          {/* Row 2 — array cells */}
          {values.map((val, i) => {
            const state = cellState(i);
            let d = val === null ? 'None' : String(val).slice(0, 6);
            if (typeof val === 'object' && val !== null) d = '{…}';
            return (
              <motion.div
                key={i}
                className={`av-cell ${state}`}
                style={{ height: CH }}
                layout
                layoutId={`cell-${name}-${i}`}
                animate={{
                  scale: state === 'st-mid' ? 1.12 : state === 'st-active' || state === 'st-boundary' ? 1.05 : 1,
                  y: state === 'st-mid' ? -4 : 0,
                }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              >
                <span className="av-cell-val">{d}</span>
                <span className="av-cell-idx">{i}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
