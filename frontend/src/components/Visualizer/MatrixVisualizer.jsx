import { motion } from 'framer-motion';
import { getMatrix } from '../../utils/vizMapper';
import './MatrixVisualizer.css';

const CS = 42;

/* All variable names that can serve as row index (first dim) */
const ROW_NAMES = ['i', 'row', 'r', 'x', 'i1', 'ri', 'row_idx'];
/* All variable names that can serve as col index (second dim) */
const COL_NAMES = ['j', 'col', 'c', 'y', 'j1', 'ci', 'col_idx'];

function resolvePointers(locals) {
  const getInt = (name) => {
    const v = locals?.[name];
    if (!v) return null;
    if (v.type === 'int') return v.value;
    if (v.type === 'float' && Number.isInteger(v.value)) return v.value;
    return null;
  };

  let row = null, rowName = null;
  for (const n of ROW_NAMES) {
    const v = getInt(n);
    if (v !== null) { row = v; rowName = n; break; }
  }

  let col = null, colName = null;
  for (const n of COL_NAMES) {
    const v = getInt(n);
    if (v !== null) { col = v; colName = n; break; }
  }

  return { row, col, rowName, colName };
}

export default function MatrixVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const data = getMatrix(locals, hints);
  if (!data) return null;
  const { name, rows } = data;
  const nr = rows.length, nc = rows[0]?.length ?? 0;

  const { row: ip, col: jp, rowName, colName } = resolvePointers(locals);

  /* Colour scheme: dp_table uses accent palette, plain matrix uses neutral */
  const isDp = hints?.[name] === 'dp_table';

  return (
    <div className="mv">
      <div className="mv-label">
        <span className="mv-name">{name}</span>
        <span className="mv-badge">{isDp ? 'DP Table' : 'Matrix'}</span>
        <span className="mv-dims">{nr} × {nc}</span>
      </div>

      <div className="mv-scroll">
        {/* Column index header */}
        {jp !== null && (
          <div className="mv-col-header" style={{ gridTemplateColumns: `repeat(${nc}, ${CS}px)`, display: 'grid' }}>
            {Array.from({ length: nc }, (_, ci) => (
              <div key={ci} className={`mv-col-idx ${ci === jp ? 'mv-col-idx-active' : ''}`}>{ci}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex' }}>
          {/* Row index sidebar */}
          {ip !== null && (
            <div className="mv-row-header">
              {rows.map((_, ri) => (
                <div key={ri} className={`mv-row-idx ${ri === ip ? 'mv-row-idx-active' : ''}`}
                  style={{ height: CS }}>{ri}</div>
              ))}
            </div>
          )}

          <div className="mv-grid" style={{ gridTemplateColumns: `repeat(${nc}, ${CS}px)` }}>
            {rows.map((row, ri) =>
              (Array.isArray(row) ? row : []).map((cell, ci) => {
                const active = ri === ip && ci === jp;
                const rowHL  = ri === ip && !active;
                const colHL  = ci === jp && !active;
                let v = cell;
                if (v !== null && typeof v === 'object') v = '…';
                return (
                  <motion.div key={`${ri}-${ci}`}
                    className={`mv-cell ${active ? 'mv-active' : ''} ${rowHL ? 'mv-row' : ''} ${colHL ? 'mv-col' : ''}`}
                    style={{ width: CS, height: CS }}
                    animate={{ scale: active ? 1.14 : 1, y: active ? -3 : 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                    <span className="mv-val">{v === null || v === undefined ? '·' : String(v)}</span>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {(ip !== null || jp !== null) && (
        <div className="mv-ptrs">
          {ip !== null && <span className="mv-ptr"><span className="mv-ptr-name">{rowName}</span><span className="mv-ptr-eq">=</span>{ip}</span>}
          {jp !== null && <span className="mv-ptr"><span className="mv-ptr-name">{colName}</span><span className="mv-ptr-eq">=</span>{jp}</span>}
        </div>
      )}
    </div>
  );
}
