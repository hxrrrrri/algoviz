import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStackOrQueue } from '../../utils/vizMapper';
import './StackQueueVisualizer.css';

export default function StackQueueVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const data = useMemo(() => getStackOrQueue(locals, hints), [locals, hints]);
  if (!data?.values) return null;

  const { name, values, type } = data;
  const isStack = type === 'stack';
  const isDeque = type === 'deque';

  // Stack: show top-to-bottom, last element = top
  // Queue/Deque: show left-to-right, index 0 = front
  const displayVals = isStack ? [...values].reverse() : values;

  return (
    <div className="sq">
      <div className="sq-header">
        <span className="sq-name">{name}</span>
        <span className={`sq-type sq-type-${type}`}>{type}</span>
        <span className="sq-len">[{values.length}]</span>
      </div>

      {isStack ? (
        <div className="sq-stack">
          <div className="sq-top-label">TOP</div>
          <div className="sq-stack-body">
            <AnimatePresence>
              {displayVals.map((val, i) => (
                <motion.div key={`${i}-${val}`}
                  className={`sq-cell sq-cell-stack ${i === 0 ? 'sq-cell-top' : ''}`}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28 }}>
                  <span className="sq-val">{String(val ?? 'null').slice(0, 8)}</span>
                  {i === 0 && <span className="sq-indicator">← top</span>}
                </motion.div>
              ))}
            </AnimatePresence>
            {values.length === 0 && <div className="sq-empty">empty</div>}
          </div>
          <div className="sq-bottom-label">BOTTOM</div>
        </div>
      ) : (
        <div className="sq-queue">
          <div className="sq-queue-label">{isDeque ? 'FRONT ←' : 'FRONT'}</div>
          <div className="sq-queue-body">
            <AnimatePresence>
              {displayVals.map((val, i) => (
                <motion.div key={`${i}-${val}`}
                  className={`sq-cell sq-cell-queue ${i === 0 ? 'sq-cell-front' : ''} ${i === displayVals.length - 1 ? 'sq-cell-rear' : ''}`}
                  initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28 }}>
                  <span className="sq-val">{String(val ?? 'null').slice(0, 8)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {values.length === 0 && <div className="sq-empty">empty</div>}
          </div>
          <div className="sq-queue-label">{isDeque ? '→ REAR' : 'REAR'}</div>
        </div>
      )}
    </div>
  );
}
