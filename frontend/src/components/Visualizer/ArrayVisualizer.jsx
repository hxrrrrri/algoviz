import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getPrimaryArray, getPointers, getPointerStyle } from '../../utils/vizMapper';
import './ArrayVisualizer.css';

const CW=54, CH=54, GAP=6;

export default function ArrayVisualizer({ stepData }) {
  const { locals, structure_hints: hints } = stepData || {};
  const arrData = useMemo(() => getPrimaryArray(locals, hints), [locals, hints]);
  const ptrs    = useMemo(() => getPointers(locals), [locals]);
  if (!arrData?.values?.length) return null;

  const { name, values } = arrData;
  const lp = ptrs['left']??ptrs['l']??ptrs['low']??ptrs['start']??null;
  const rp = ptrs['right']??ptrs['r']??ptrs['high']??ptrs['end']??null;
  const mp = ptrs['mid']??ptrs['m']??ptrs['middle']??null;

  const byIdx = {};
  for (const [n,v] of Object.entries(ptrs))
    if (typeof v==='number' && v>=0 && v<values.length)
      (byIdx[v]=byIdx[v]||[]).push(n);

  const st = (i) => {
    if (i===mp) return 'st-mid';
    if (lp!==null&&rp!==null&&(i<lp||i>rp)) return 'st-eliminated';
    if (i===lp||i===rp) return 'st-boundary';
    if (byIdx[i]) return 'st-active';
    return 'st-normal';
  };

  return (
    <div className="av">
      <div className="av-header">
        <span className="av-name">{name}</span>
        <span className="av-len">[{values.length}]</span>
        {Object.keys(ptrs).length>0 && (
          <div className="av-ptr-pills">
            {Object.entries(ptrs)
              .sort((a,b)=>(getPointerStyle(a[0]).priority||99)-(getPointerStyle(b[0]).priority||99))
              .map(([n,v])=>(
                <span key={n} className="ptr-pill" style={{'--pc':getPointerStyle(n).color}}>
                  {n} = {v}
                </span>
              ))}
          </div>
        )}
      </div>

      <div className="av-stage">
        {/* Pointer arrows */}
        <div className="av-ptr-row" style={{width:values.length*(CW+GAP)-GAP}}>
          {Object.entries(byIdx).map(([idx,names])=>{
            const x=parseInt(idx)*(CW+GAP)+CW/2;
            const s=getPointerStyle(names[0]);
            return (
              <div key={idx} className="av-ptr-col" style={{left:x-28,width:56}}>
                {names.map(n=>(
                  <motion.div key={n} className="av-ptr-tag"
                    style={{'--pc':getPointerStyle(n).color}}
                    layoutId={`ptr-${n}`} layout
                    transition={{type:'spring',stiffness:380,damping:28}}>
                    {n}
                  </motion.div>
                ))}
                <div className="av-ptr-arrow" style={{'--pc':s.color}}/>
              </div>
            );
          })}
        </div>

        {/* Cells */}
        <div className="av-cells">
          {values.map((val,i)=>{
            const state=st(i);
            let d=val===null?'None':String(val).slice(0,6);
            if(typeof val==='object'&&val!==null)d='{…}';
            return (
              <motion.div key={i} className={`av-cell ${state}`}
                style={{width:CW,height:CH}}
                layout layoutId={`cell-${name}-${i}`}
                animate={{
                  scale:state==='st-mid'?1.14:state==='st-active'||state==='st-boundary'?1.06:1,
                  y:state==='st-mid'?-5:0,
                }}
                transition={{type:'spring',stiffness:340,damping:26}}>
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
