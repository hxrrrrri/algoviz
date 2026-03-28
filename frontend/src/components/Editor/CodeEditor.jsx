import React, { useMemo, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { EditorView, Decoration } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import useStore from '../../store';
import './Editor.css';

const setHL = StateEffect.define();
const hlField = StateField.define({
  create(){ return Decoration.none; },
  update(v,tr){
    v=v.map(tr.changes);
    for(const e of tr.effects) if(e.is(setHL)){
      if(!e.value){v=Decoration.none;continue;}
      try{const l=tr.state.doc.line(e.value);v=Decoration.set([Decoration.line({class:'cm-exec-line'}).range(l.from)]);}
      catch{v=Decoration.none;}
    }
    return v;
  },
  provide:f=>EditorView.decorations.from(f),
});

const makeTheme=(mode)=>EditorView.theme({
  '&':{backgroundColor:'transparent',color:mode==='light'?'#1a1a2e':'#e0e0f0',height:'100%'},
  '.cm-content':{padding:'16px 0',fontFamily:"'JetBrains Mono',monospace",fontSize:'13px',lineHeight:'1.75',caretColor:'var(--accent)'},
  '.cm-line':{padding:'0 16px 0 12px'},
  '.cm-gutters':{backgroundColor:'transparent',borderRight:'1px solid var(--border-1)',color:'var(--text-3)',paddingRight:'4px'},
  '.cm-gutter':{minWidth:'40px'},
  '.cm-lineNumbers .cm-gutterElement':{padding:'0 8px 0 4px',fontFamily:"'JetBrains Mono',monospace",fontSize:'11px'},
  '.cm-cursor':{borderLeftColor:'var(--accent)',borderLeftWidth:'2px'},
  '.cm-selectionBackground':{backgroundColor:'var(--accent-dim) !important'},
  '.cm-focused .cm-selectionBackground':{backgroundColor:'var(--accent-dim) !important'},
  '.cm-exec-line':{backgroundColor:'var(--accent-dim) !important',borderLeft:'3px solid var(--accent)',paddingLeft:'9px !important'},
  '.cm-activeLine':{backgroundColor:'var(--bg-card)'},
  '.cm-activeLineGutter':{backgroundColor:'var(--bg-card)',color:'var(--text-2)'},
  '.cm-matchingBracket':{backgroundColor:'var(--accent-dim)',color:'var(--accent) !important'},
  '.tok-keyword':{color:'#f87171'},
  '.tok-string':{color:'var(--accent)'},
  '.tok-comment':{color:'var(--text-3)',fontStyle:'italic'},
  '.tok-number':{color:'var(--accent-5)'},
  '.tok-operator':{color:'var(--accent-4)'},
  '.tok-variableName':{color:mode==='light'?'#1a1a2e':'#e0e0f0'},
  '.tok-definition(.tok-variableName)':{color:'var(--accent)'},
  '.tok-bool':{color:'var(--accent-2)'},
  '.tok-null':{color:'var(--accent-2)'},
  '.tok-punctuation':{color:'var(--text-3)'},
},{ dark: mode==='dark' });

let viewRef=null;

export default function CodeEditor(){
  const code=useStore(s=>s.code);
  const setCode=useStore(s=>s.setCode);
  const hl=useStore(s=>s.highlightedLine);
  const isExec=useStore(s=>s.isExecuting);
  const mode=useStore(s=>s.mode);

  const exts=useMemo(()=>[
    python(), makeTheme(mode), hlField,
    EditorView.updateListener.of(u=>{if(u.view)viewRef=u.view;}),
    EditorView.lineWrapping,
  ],[mode]);

  useEffect(()=>{
    if(!viewRef)return;
    try{viewRef.dispatch({effects:setHL.of(hl)});}catch{}
  },[hl]);

  return(
    <div className="ew">
      <div className="ew-hdr">
        <div className="ew-lang"><span className="ew-dot"/>Python</div>
        <div className="ew-status">
          {isExec
            ? <span className="ew-exec"><span className="ew-spin"/>Executing…</span>
            : <span className="ew-hint">Ctrl+Enter to run</span>}
        </div>
      </div>
      <div className="ew-scroll">
        <CodeMirror value={code} extensions={exts} onChange={setCode}
          basicSetup={{lineNumbers:true,highlightActiveLineGutter:true,highlightSpecialChars:true,
            history:true,foldGutter:false,drawSelection:true,allowMultipleSelections:false,
            indentOnInput:true,syntaxHighlighting:true,bracketMatching:true,closeBrackets:true,
            autocompletion:false,highlightActiveLine:true,tabSize:4}}
          style={{height:'100%'}}/>
      </div>
    </div>
  );
}
