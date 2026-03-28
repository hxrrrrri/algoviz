import React, { useMemo, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { EditorView, Decoration } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import useStore from '../../store';
import './Editor.css';

const setHL = StateEffect.define();
const hlField = StateField.define({
  create() { return Decoration.none; },
  update(v, tr) {
    v = v.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setHL)) {
        if (!e.value) { v = Decoration.none; continue; }
        try {
          const ln = tr.state.doc.line(e.value);
          v = Decoration.set([Decoration.line({ class: 'cm-exec-line' }).range(ln.from)]);
        } catch { v = Decoration.none; }
      }
    }
    return v;
  },
  provide: f => EditorView.decorations.from(f),
});

const luxTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: '#c8c4b8', height: '100%' },
  '.cm-content': { padding: '16px 0', fontFamily: "'DM Mono', monospace", fontSize: '13px', lineHeight: '1.75', caretColor: '#f5c842' },
  '.cm-line': { padding: '0 16px 0 12px' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid rgba(246,200,66,0.1)', color: '#3a3832', paddingRight: '4px' },
  '.cm-gutter': { minWidth: '40px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 4px', fontFamily: "'DM Mono', monospace", fontSize: '11px' },
  '.cm-cursor': { borderLeftColor: '#f5c842', borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(246,200,66,0.1) !important' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(246,200,66,0.1) !important' },
  '.cm-exec-line': { backgroundColor: 'rgba(246,200,66,0.06) !important', borderLeft: '3px solid rgba(246,200,66,0.6)', paddingLeft: '9px !important' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.015)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.02)', color: '#7a7668' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(246,200,66,0.12)', color: '#f5c842 !important' },
  '.tok-keyword': { color: '#f87171' },
  '.tok-string': { color: '#86efac' },
  '.tok-comment': { color: '#3a3832', fontStyle: 'italic' },
  '.tok-number': { color: '#7dd3fc' },
  '.tok-operator': { color: '#fb923c' },
  '.tok-variableName': { color: '#c8c4b8' },
  '.tok-typeName': { color: '#fbbf24' },
  '.tok-definition(.tok-variableName)': { color: '#4ade80' },
  '.tok-bool': { color: '#a78bfa' },
  '.tok-null': { color: '#a78bfa' },
  '.tok-punctuation': { color: '#7a7668' },
}, { dark: true });

let viewRef = null;

export default function CodeEditor() {
  const code = useStore(s => s.code);
  const setCode = useStore(s => s.setCode);
  const highlightedLine = useStore(s => s.highlightedLine);
  const isExecuting = useStore(s => s.isExecuting);

  const extensions = useMemo(() => [
    python(), luxTheme, hlField,
    EditorView.updateListener.of(u => { if (u.view) viewRef = u.view; }),
    EditorView.lineWrapping,
  ], []);

  useEffect(() => {
    if (!viewRef) return;
    try { viewRef.dispatch({ effects: setHL.of(highlightedLine) }); } catch {}
  }, [highlightedLine]);

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <div className="editor-lang-badge"><span className="lang-dot"/>Python</div>
        <div className="editor-status">
          {isExecuting
            ? <span className="exec-text"><span className="exec-spinner"/>Executing…</span>
            : <span className="hint-text">Ctrl + Enter to run</span>}
        </div>
      </div>
      <div className="editor-scroll-area">
        <CodeMirror value={code} extensions={extensions} onChange={setCode}
          basicSetup={{ lineNumbers:true, highlightActiveLineGutter:true, highlightSpecialChars:true, history:true, foldGutter:false, drawSelection:true, allowMultipleSelections:false, indentOnInput:true, syntaxHighlighting:true, bracketMatching:true, closeBrackets:true, autocompletion:false, highlightActiveLine:true, tabSize:4 }}
          style={{ height: '100%' }} />
      </div>
    </div>
  );
}
