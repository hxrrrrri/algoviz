import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './CallStackVisualizer.css';
export default function CallStackVisualizer({ stepData }) {
  const cs = stepData?.call_stack || [];
  const frames = [...cs].reverse();
  if (!frames.length) return null;
  return (
    <div className="csv">
      {frames.map((f,i) => (
        <motion.div key={`${f.function}-${i}`} className={`csv-frame ${i===0?'top':''}`}
          initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0}}
          transition={{delay:i*0.04}}>
          <span className="csv-icon">{i===0?'▶':'·'}</span>
          <span className="csv-fn">{f.function}</span>
          <span className="csv-ln">:{f.line}</span>
        </motion.div>
      ))}
    </div>
  );
}
