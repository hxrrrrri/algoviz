import React from 'react';
import useStore from '../../store';
import { usePlayback } from '../../hooks/usePlayback';
import './Controls.css';

const SPEEDS = [0.5,1,2,4];

export default function Controls() {
  const executeCode    = useStore(s=>s.executeCode);
  const resetExecution = useStore(s=>s.resetExecution);
  const isExecuting    = useStore(s=>s.isExecuting);
  const isPlaying      = useStore(s=>s.isPlaying);
  const setPlaying     = useStore(s=>s.setPlaying);
  const playSpeed      = useStore(s=>s.playSpeed);
  const setPlaySpeed   = useStore(s=>s.setPlaySpeed);
  const currentStep    = useStore(s=>s.currentStep);
  const trace          = useStore(s=>s.trace);
  const stepForward    = useStore(s=>s.stepForward);
  const stepBackward   = useStore(s=>s.stepBackward);
  const setCurrentStep = useStore(s=>s.setCurrentStep);
  usePlayback();

  const total=trace.length, has=total>0;
  const atEnd=currentStep>=total-1, atStart=currentStep===0;
  const pct=has?(currentStep/Math.max(total-1,1))*100:0;

  const scrub=(e)=>{
    if(!has)return;
    const r=e.currentTarget.getBoundingClientRect();
    setCurrentStep(Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*(total-1)));
    setPlaying(false);
  };

  return (
    <div className="ctrl">
      <div className="ctrl-inner">
        <button className={`ctrl-run ${isExecuting?'running':''}`}
          onClick={executeCode} disabled={isExecuting}>
          {isExecuting
            ? <><span className="ctrl-spinner"/>Running…</>
            : <>▶ Run</>}
        </button>

        <div className="ctrl-sep"/>

        <div className={`ctrl-transport ${!has?'dim':''}`}>
          <button className="ctrl-btn" onClick={()=>setCurrentStep(0)} disabled={!has||atStart}>⏮</button>
          <button className="ctrl-btn" onClick={stepBackward} disabled={!has||atStart}>⏪</button>
          <button className="ctrl-btn play" disabled={!has}
            onClick={()=>{ if(atEnd){setCurrentStep(0);setPlaying(true);}else setPlaying(!isPlaying); }}>
            {isPlaying?'⏸':'▶'}
          </button>
          <button className="ctrl-btn" onClick={stepForward} disabled={!has||atEnd}>⏩</button>
          <button className="ctrl-btn" onClick={()=>setCurrentStep(total-1)} disabled={!has||atEnd}>⏭</button>
        </div>

        <div className={`ctrl-scrubber ${!has?'dim':''}`} onClick={scrub}>
          <div className="ctrl-track">
            <div className="ctrl-fill" style={{width:`${pct}%`}}/>
            <div className="ctrl-thumb" style={{left:`${pct}%`}}/>
          </div>
          {has&&<span className="ctrl-pos">{currentStep+1}/{total}</span>}
        </div>

        <div className="ctrl-speeds">
          {SPEEDS.map(s=>(
            <button key={s} className={`ctrl-spd ${playSpeed===s?'on':''}`} onClick={()=>setPlaySpeed(s)}>{s}×</button>
          ))}
        </div>

        <div className="ctrl-sep"/>
        <button className="ctrl-btn rst" onClick={resetExecution} disabled={!has&&!isExecuting}>✕</button>
      </div>
    </div>
  );
}
