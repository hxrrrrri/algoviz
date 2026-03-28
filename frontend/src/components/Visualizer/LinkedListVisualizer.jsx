import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getLinkedList, getPointerStyle } from '../../utils/vizMapper';
import './LinkedListVisualizer.css';

const NW = 58, NH = 52, GAP = 44;

export default function LinkedListVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const data = useMemo(() => getLinkedList(locals, hints), [locals, hints]);
  if (!data?.nodes?.length) return null;

  const { name, nodes, pointers } = data;

  return (
    <div className="ll">
      <div className="ll-header">
        <span className="ll-name">{name}</span>
        <span className="ll-type">LinkedList</span>
        <span className="ll-len">[{nodes.length} node{nodes.length !== 1 ? 's' : ''}]</span>
      </div>

      <div className="ll-stage">
        {/* Pointer labels row */}
        <div className="ll-ptr-row">
          {nodes.map((node, i) => {
            const ptrs = node.id != null ? (pointers[node.id] || []) : [];
            if (!ptrs.length) return <div key={i} className="ll-ptr-slot" style={{ width: NW + GAP }} />;
            const s = getPointerStyle(ptrs[0]);
            return (
              <div key={i} className="ll-ptr-slot" style={{ width: NW + GAP }}>
                <div className="ll-ptr-tags">
                  {ptrs.map(p => (
                    <motion.span key={p} className="ll-ptr-tag"
                      style={{ '--pc': getPointerStyle(p).color }}
                      layoutId={`ll-ptr-${p}`}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}>
                      {p}
                    </motion.span>
                  ))}
                </div>
                <div className="ll-ptr-arrow" style={{ '--pc': s.color }} />
              </div>
            );
          })}
        </div>

        {/* Nodes row */}
        <div className="ll-nodes-row">
          {nodes.map((node, i) => {
            const ptrs = node.id != null ? (pointers[node.id] || []) : [];
            const isActive = ptrs.length > 0;
            const isCurr = ptrs.some(p => ['curr', 'current', 'p', 'node', 'temp', 't'].includes(p));
            const isHead = ptrs.some(p => ['head', 'slow'].includes(p));
            const stateClass = isCurr ? 'll-node-curr' : isHead ? 'll-node-head' : isActive ? 'll-node-active' : '';

            return (
              <div key={i} className="ll-node-wrap">
                <motion.div
                  className={`ll-node ${stateClass}`}
                  style={{ width: NW, height: NH }}
                  layoutId={node.id != null ? `ll-node-${node.id}` : undefined}
                  animate={{ scale: isCurr ? 1.08 : 1, y: isCurr ? -4 : 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                >
                  <span className="ll-val">{node.cycle ? '…' : String(node.val ?? 'null').slice(0, 6)}</span>
                  <div className="ll-next-field">
                    <span className="ll-next-dot" />
                  </div>
                </motion.div>

                {/* Arrow to next */}
                {i < nodes.length - 1 && (
                  <div className="ll-connector">
                    <div className="ll-conn-line" />
                    <div className="ll-conn-head" />
                  </div>
                )}

                {/* NULL at end */}
                {i === nodes.length - 1 && !node.cycle && (
                  <div className="ll-null-end">
                    <div className="ll-conn-line ll-conn-short" />
                    <div className="ll-null-box">null</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
