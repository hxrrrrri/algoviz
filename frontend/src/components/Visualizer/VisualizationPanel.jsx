import { useMemo, useState, useCallback, useRef, useEffect, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Error boundary — prevents one broken visualizer from crashing the page ── */
class VizErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-3)',
          border: '1px solid var(--border-2)', borderRadius: 6, background: 'var(--bg-base)' }}>
          ⚠ Visualizer error: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
import useStore from '../../store';
import LiveVariablesPanel from '../panels/LiveVariablesPanel';
import ArrayVisualizer from './ArrayVisualizer';
import MatrixVisualizer from './MatrixVisualizer';
import TreeVisualizer from './TreeVisualizer';
import FlowVisualizer from './FlowVisualizer';
import LinkedListVisualizer from './LinkedListVisualizer';
import StackQueueVisualizer from './StackQueueVisualizer';
import HeapVisualizer from './HeapVisualizer';
import GraphVisualizer from './GraphVisualizer';
import TrainingCurveVisualizer from './TrainingCurveVisualizer';
import MLModelVisualizer from './MLModelVisualizer';
import RecursionTreeVisualizer from './RecursionTreeVisualizer';
import { getPrimaryArray, getMatrix, getTreeNode, getStrings, flattenValue,
         getLinkedList, getStackOrQueue, getHeap, getGraph } from '../../utils/vizMapper';
import { getTrainingHistory } from './TrainingCurveVisualizer';
import { getMLModels } from './MLModelVisualizer';
import { analyzeComplexity, complexityColor } from '../../utils/complexityAnalyzer';
import './VisualizationPanel.css';

/* ── Console output ── */
function ConsoleOutput({ stdout }) {
  const lines = stdout.trim().split('\n').slice(-20);
  return (
    <div className="vp-console">
      <div className="vp-console-hdr">
        <span className="vp-console-dot" />
        <span className="vp-console-title">Output</span>
        <span className="vp-console-count">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="vp-console-body">
        {lines.map((l, i) => (
          <div key={i} className="vp-console-row">
            <span className="vp-console-arrow">›</span>
            <span className="vp-console-text">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── String row visualizer ── */
function StringBar({ name, value }) {
  const chars = Array.from(value);
  return (
    <div className="sb">
      <div className="sb-label">
        <span className="sb-name">{name}</span>
        <span className="sb-type">&quot;str&quot;</span>
        <span className="sb-len">len {chars.length}</span>
      </div>
      <div className="sb-cells">
        {chars.map((ch, i) => (
          <div key={i} className="sb-cell">
            <span className="sb-char">{ch === ' ' ? '·' : ch}</span>
            <span className="sb-idx">{i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Cell-change diffing for pinned vars ── */
function cellKey(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function buildChangedSet(curr, prev) {
  if (!prev || !curr) return new Set();
  const changed = new Set();
  if (Array.isArray(curr) && Array.isArray(prev)) {
    curr.forEach((row, ri) => {
      if (Array.isArray(row) && Array.isArray(prev[ri])) {
        row.forEach((cell, ci) => {
          if (cellKey(cell) !== cellKey(prev[ri]?.[ci])) changed.add(`${ri}-${ci}`);
        });
      } else if (!Array.isArray(row)) {
        if (cellKey(row) !== cellKey(prev[ri])) changed.add(`${ri}`);
      }
    });
  } else if (curr && typeof curr === 'object' && !Array.isArray(curr)) {
    Object.keys(curr).forEach(k => {
      if (cellKey(curr[k]) !== cellKey(prev[k])) changed.add(k);
    });
  }
  return changed;
}

/* ── Pinned variable renderer ── */
function PinnedVarView({ name, repr, prevRepr, onUnpin }) {
  const flat     = repr     ? flattenValue(repr)     : null;
  const prevFlat = prevRepr ? flattenValue(prevRepr) : null;
  const type     = repr?.type;

  const changed = useMemo(() => buildChangedSet(flat, prevFlat), [flat, prevFlat]);

  const is2D    = type === 'list'  && Array.isArray(flat) && flat.length > 0 && Array.isArray(flat[0]);
  const is1D    = type === 'list'  && Array.isArray(flat) && !is2D;
  const isDict  = type === 'dict'  && flat && typeof flat === 'object' && !Array.isArray(flat);
  const isTuple = type === 'tuple' && Array.isArray(flat);

  const accentColor = type === 'list' ? 'var(--accent)' : type === 'dict' ? 'var(--accent-4)' : 'var(--accent-2)';

  return (
    <motion.div className="pv"
      initial={{ opacity:0, y:14, scale:0.97 }}
      animate={{ opacity:1, y:0, scale:1 }}
      exit={{ opacity:0, y:-8, scale:0.96 }}
      transition={{ type:'spring', stiffness:380, damping:30 }}
    >
      <div className="pv-shine" />
      <div className="pv-header">
        <div className="pv-title-wrap">
          <span className="pv-type-dot" style={{ background: accentColor }}/>
          <span className="pv-name">{name}</span>
          <span className="pv-type">{type}</span>
          {is2D   && <span className="pv-dims">{flat.length} × {flat[0]?.length ?? 0}</span>}
          {(is1D || isTuple) && <span className="pv-dims">len {flat.length}</span>}
          {isDict && <span className="pv-dims">{Object.keys(flat).length} keys</span>}
          {changed.size > 0 && (
            <motion.span className="pv-changed-badge"
              key={changed.size}
              initial={{ scale:1.4 }} animate={{ scale:1 }}
              transition={{ type:'spring', stiffness:500, damping:22 }}>
              {changed.size} changed
            </motion.span>
          )}
        </div>
        <button className="pv-unpin" onClick={() => onUnpin(name)} title="Remove">✕</button>
      </div>

      <div className="pv-body">
        {is2D && (
          <div className="pv-matrix-wrap">
            <table className="pv-matrix">
              <thead>
                <tr>
                  <th className="pv-rc-label" />
                  {flat[0].map((_, ci) => <th key={ci} className="pv-col-label">{ci}</th>)}
                </tr>
              </thead>
              <tbody>
                {flat.map((row, ri) => (
                  <tr key={ri}>
                    <td className="pv-row-label">{ri}</td>
                    {Array.isArray(row)
                      ? row.map((cell, ci) => {
                          const isChanged = changed.has(`${ri}-${ci}`);
                          return (
                            <td key={ci} className={`pv-cell ${isChanged ? 'pv-cell-changed' : ''}`}>
                              {isChanged && <span className="pv-cell-glow" />}
                              {cell === null ? <span className="pv-null">∅</span> : String(cell)}
                            </td>
                          );
                        })
                      : <td className="pv-cell pv-cell-scalar">{String(row)}</td>
                    }
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(is1D || isTuple) && (
          <div className="pv-list-wrap">
            {flat.map((item, i) => {
              const isChanged = changed.has(`${i}`);
              return (
                <div key={i} className={`pv-list-item ${isChanged ? 'pv-item-changed' : ''}`}>
                  <span className="pv-list-idx">{i}</span>
                  <span className="pv-list-val">
                    {item === null ? '∅' : typeof item === 'object' ? JSON.stringify(item) : String(item)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isDict && (
          <div className="pv-dict-wrap">
            {Object.entries(flat).map(([k, v]) => {
              const isChanged = changed.has(k);
              return (
                <div key={k} className={`pv-dict-row ${isChanged ? 'pv-item-changed' : ''}`}>
                  <span className="pv-dict-key">{k}</span>
                  <span className="pv-dict-sep">:</span>
                  <span className="pv-dict-val">
                    {v === null ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!is2D && !is1D && !isDict && !isTuple && (
          <pre className="pv-raw">{JSON.stringify(flat, null, 2)}</pre>
        )}
      </div>
    </motion.div>
  );
}

/* ══ Draggable + Windows-style resizable block ══
   - Title bar: drag to move
   - 8 resize handles (all edges + corners): resize like a browser window  ══ */
const EDGES = ['n','ne','e','se','s','sw','w','nw'];

function DraggableBlock({ initialX, initialY, initialW, title, children }) {
  const [rect, setRect] = useState({ x: initialX, y: initialY, w: initialW, h: 420 });
  const dragRef  = useRef(null); // tracks active drag/resize operation
  const MIN_W = 220, MIN_H = 140;

  const startOp = useCallback((e, type, edge = null) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { type, edge, mx: e.clientX, my: e.clientY, rect: { ...rect } };

    const onMove = (ev) => {
      const op = dragRef.current;
      if (!op) return;
      const dx = ev.clientX - op.mx;
      const dy = ev.clientY - op.my;
      const r  = { ...op.rect };

      if (op.type === 'move') {
        setRect(prev => ({ ...prev, x: r.x + dx, y: r.y + dy }));
        return;
      }
      // resize — each edge/corner adjusts different sides
      const ed = op.edge;
      let { x, y, w, h } = r;
      if (ed.includes('e'))  { w = Math.max(MIN_W, r.w + dx); }
      if (ed.includes('s'))  { h = Math.max(MIN_H, r.h + dy); }
      if (ed.includes('w'))  { const nw = Math.max(MIN_W, r.w - dx); x = r.x + (r.w - nw); w = nw; }
      if (ed.includes('n'))  { const nh = Math.max(MIN_H, r.h - dy); y = r.y + (r.h - nh); h = nh; }
      setRect({ x, y, w, h });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rect]);

  return (
    <div
      className="vp-drag-block"
      style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      {/* 8 resize handles */}
      {EDGES.map(edge => (
        <div key={edge} className={`vp-resize-handle vp-rh-${edge}`}
          onMouseDown={(e) => startOp(e, 'resize', edge)} />
      ))}

      {/* Title bar — drag to move */}
      <div className="vp-drag-handle" onMouseDown={(e) => startOp(e, 'move')}>
        <span className="vp-drag-grip">⠿</span>
        <span className="vp-drag-label">{title}</span>
      </div>

      {/* Scrollable content */}
      <div className="vp-drag-content" style={{ height: rect.h - 36 }}>
        {children}
      </div>
    </div>
  );
}

/* ══ Main Panel ══ */
export default function VisualizationPanel() {
  const trace          = useStore(s => s.trace);
  const currentStep    = useStore(s => s.currentStep);
  const pinnedVars     = useStore(s => s.pinnedVars);
  const pinVar         = useStore(s => s.pinVar);
  const unpinVar       = useStore(s => s.unpinVar);
  const resetExecution = useStore(s => s.resetExecution);
  const code           = useStore(s => s.code);
  const executeCode    = useStore(s => s.executeCode);
  const isExecuting    = useStore(s => s.isExecuting);

  const step     = trace[currentStep] || null;
  const prevStep = currentStep > 0 ? trace[currentStep - 1] : null;
  const isError  = step?.event === 'error';
  const hasTrace = trace.length > 0;

  const [dragOver, setDragOver]         = useState(false);
  const [vizMode, setVizMode]           = useState('structure');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [showOverlay, setShowOverlay]   = useState(false);
  const panelRef  = useRef(null);
  const canvasRef = useRef(null);   // drag constraints target for fullscreen canvas

  // Only show the running overlay after 400 ms — fast code never triggers it
  useEffect(() => {
    if (!isExecuting) { setShowOverlay(false); return; }
    const t = setTimeout(() => setShowOverlay(true), 400);
    return () => clearTimeout(t);
  }, [isExecuting]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      panelRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) setSidebarOpen(true);   // auto-open sidebar when entering fullscreen
      else    setSidebarOpen(false);  // close when exiting
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const locals  = step?.locals  || {};
  const hints   = step?.structure_hints || {};
  const prevLocals = prevStep?.locals || {};
  const prevHints  = prevStep?.structure_hints || {};

  const hasArray   = useMemo(() => step ? !!getPrimaryArray(locals, hints)  : false, [step, locals, hints]);
  const hasMatrix  = useMemo(() => step ? !!getMatrix(locals, hints)        : false, [step, locals, hints]);
  const treeData   = useMemo(() => step ? getTreeNode(locals, hints)        : null,  [step, locals, hints]);
  const strings    = useMemo(() => step ? getStrings(locals)                : [],    [step, locals]);
  const hasLL      = useMemo(() => step ? !!getLinkedList(locals, hints)    : false, [step, locals, hints]);
  const hasSQ      = useMemo(() => step ? !!getStackOrQueue(locals, hints)  : false, [step, locals, hints]);
  // Heap: check entire trace, not just current step (so it stays visible end-to-end)
  const hasHeap    = useMemo(() => trace.some(s => !!getHeap(s.locals, s.structure_hints)), [trace]);
  const hasGraph   = useMemo(() => step ? !!getGraph(locals, hints)               : false, [step, locals, hints]);
  const hasML      = useMemo(() => step ? !!getTrainingHistory(locals, hints) || getMLModels(locals, hints).length > 0 : false, [step, locals, hints]);

  // Previous step tree for new-node diffing
  const prevTreeData = useMemo(() => prevStep ? getTreeNode(prevLocals, prevHints) : null, [prevStep, prevLocals, prevHints]);

  /* ── Complexity analysis ── */
  const complexity = useMemo(() => analyzeComplexity(code), [code]);

  /* ── Persistence: remember last valid structure content ── */
  const lastStructRef = useRef({ locals: {}, hints: {}, strings: [], stepData: null });

  /* ── Pinned variable cache: last known repr per variable name ── */
  const pinnedCacheRef = useRef({});  // { [varName]: { repr, prevRepr } }

  // Reset persisted content when trace is cleared (e.g. user hits refresh)
  useEffect(() => {
    if (trace.length === 0) {
      lastStructRef.current = { locals: {}, hints: {}, strings: [], stepData: null };
      pinnedCacheRef.current = {};
    }
  }, [trace.length]);

  const hasStructContent = hasArray || hasMatrix || !!treeData || strings.length > 0
    || hasLL || hasSQ || hasHeap || hasGraph || hasML;

  if (step && hasStructContent) {
    lastStructRef.current = { locals, hints, strings, stepData: step };
  }

  // Use last known content when current step has no structure
  const dispLocals   = hasStructContent ? locals  : lastStructRef.current.locals;
  const dispHints    = hasStructContent ? hints   : lastStructRef.current.hints;
  const dispStrings  = hasStructContent ? strings : lastStructRef.current.strings;
  const dispStep     = hasStructContent ? step    : lastStructRef.current.stepData;
  const isStale      = !hasStructContent && !!lastStructRef.current.stepData;

  const dispHasArray  = useMemo(() => dispStep ? !!getPrimaryArray(dispLocals, dispHints) : false, [dispStep, dispLocals, dispHints]);
  const dispHasMatrix = useMemo(() => dispStep ? !!getMatrix(dispLocals, dispHints)       : false, [dispStep, dispLocals, dispHints]);
  const dispTreeData  = useMemo(() => dispStep ? getTreeNode(dispLocals, dispHints)       : null,  [dispStep, dispLocals, dispHints]);
  const dispHasLL     = useMemo(() => dispStep ? !!getLinkedList(dispLocals, dispHints)   : false, [dispStep, dispLocals, dispHints]);
  const dispHasSQ     = useMemo(() => dispStep ? !!getStackOrQueue(dispLocals, dispHints) : false, [dispStep, dispLocals, dispHints]);
  const dispHasHeap   = hasHeap; // trace-wide — managed by hasHeap above
  const dispHasGraph  = useMemo(() => dispStep ? !!getGraph(dispLocals, dispHints)        : false, [dispStep, dispLocals, dispHints]);
  const dispHasML     = useMemo(() => dispStep ? (!!getTrainingHistory(dispLocals, dispHints) || getMLModels(dispLocals, dispHints).length > 0) : false, [dispStep, dispLocals, dispHints]);

  const hasAnyContent = dispHasArray || dispHasMatrix || !!dispTreeData || dispStrings.length > 0
    || dispHasLL || dispHasSQ || dispHasHeap || dispHasGraph || dispHasML || pinnedVars.length > 0;

  /* ── Recursion detection ──
     Only show the recursion tree when a function genuinely calls itself.
     We check every trace step's call_stack for duplicate function names.
     Iterative algorithms (binary search, two-pointer, DP loops) never
     produce a repeated function name — only real recursive calls do. ── */
  const hasRecursion = useMemo(() => {
    for (const s of trace) {
      const cs = s.call_stack;
      if (!cs || cs.length < 2) continue;
      const fns = cs.map(f => f.function);
      // A function name appearing more than once = it called itself
      if (new Set(fns).size < fns.length) return true;
    }
    return false;
  }, [trace]);

  /* ── Drag-and-drop ── */
  const handleDragOver  = useCallback((e) => {
    if (e.dataTransfer.types.includes('application/codeviz-var')) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true);
    }
  }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop      = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const name = e.dataTransfer.getData('application/codeviz-var');
    if (name) pinVar(name);
  }, [pinVar]);

  // Update pinned cache with any currently-visible values (all vars, not just already-pinned)
  if (step) {
    for (const name of Object.keys(locals)) {
      const cur = locals[name];
      const prv = prevLocals[name];
      if (cur) {
        pinnedCacheRef.current[name] = {
          repr:     cur,
          prevRepr: prv || pinnedCacheRef.current[name]?.repr || null,
        };
      }
    }
  }

  const pinnedData = useMemo(() => {
    return pinnedVars.map(name => {
      // live value at current step
      const live    = locals[name] || prevLocals[name];
      const livePrv = prevLocals[name];
      if (live) return { name, repr: live, prevRepr: livePrv || null };
      // Fall back to last cached value so the card stays visible after scope ends
      const cached = pinnedCacheRef.current[name];
      return { name, repr: cached?.repr || null, prevRepr: cached?.prevRepr || null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedVars, locals, prevLocals]);

  return (
    <div
      ref={panelRef}
      className={`vp ${dragOver ? 'vp-drag-over' : ''} ${isFullscreen ? 'vp-is-fullscreen' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="vp-grid" />


      {/* Drop overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div className="vp-drop-overlay"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.12 }}>
            <div className="vp-drop-icon">◎</div>
            <div className="vp-drop-text">Drop to pin & visualize</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topbar */}
      <div className="vp-topbar">
        <div className="vp-topbar-l">
          <div className="vp-title-dot" />
          <span className="vp-title">Visualization</span>
          {pinnedVars.length > 0 && (
            <span className="vp-pinned-count">{pinnedVars.length} pinned</span>
          )}
          {isStale && (
            <span className="vp-stale-badge">frozen</span>
          )}
        </div>

        <div className="vp-topbar-r">
          {/* Run button — only shown in fullscreen mode */}
          {isFullscreen && (
            <button
              className={`vp-run-btn ${isExecuting ? 'vp-run-running' : ''}`}
              onClick={executeCode}
              disabled={isExecuting}
              title="Run code (Ctrl+Enter)"
            >
              {isExecuting
                ? <><span className="vp-run-spinner" />Running…</>
                : <>▶ Run</>}
            </button>
          )}

          {/* Variables sidebar toggle — only in fullscreen */}
          {isFullscreen && (
            <button
              className={`vp-sidebar-toggle-btn ${sidebarOpen ? 'vp-sidebar-open' : ''}`}
              onClick={() => setSidebarOpen(v => !v)}
              title={sidebarOpen ? 'Close variables sidebar' : 'Open variables sidebar'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
              </svg>
              Variables
            </button>
          )}

          {/* Complexity badge */}
          {complexity && (
            <div className={`vp-complexity ${complexityColor(complexity.time)}`} title={`${complexity.label} — Time: ${complexity.time} · Space: ${complexity.space}`}>
              <span className="vp-cx-label">{complexity.label}</span>
              <span className="vp-cx-time">{complexity.time}</span>
              <span className="vp-cx-sep">·</span>
              <span className="vp-cx-space">{complexity.space}</span>
            </div>
          )}

          {hasTrace && (
            <div className="vp-step-info">
              <span className="vp-step-n">{currentStep + 1}</span>
              <span className="vp-step-of">/ {trace.length}</span>
              {step?.line && <span className="vp-step-line">· ln {step.line}</span>}
            </div>
          )}

          {/* Refresh button */}
          {hasTrace && (
            <button
              className="vp-refresh-btn"
              onClick={resetExecution}
              title="Clear visualization"
            >
              ⟳
            </button>
          )}

          {/* Fullscreen toggle */}
          <button
            className={`vp-fs-btn ${isFullscreen ? 'vp-fs-active' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {isFullscreen
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            }
          </button>

          {/* Structure / Flow toggle */}
          {hasTrace && (
            <div className="vp-mode-toggle">
              <button
                className={`vp-mode-btn ${vizMode === 'structure' ? 'vp-mode-active' : ''}`}
                onClick={() => setVizMode('structure')}
                title="Structure view — arrays, trees, matrices"
              >
                ⬡ Structure
              </button>
              <button
                className={`vp-mode-btn ${vizMode === 'flow' ? 'vp-mode-active' : ''}`}
                onClick={() => setVizMode('flow')}
                title="Flow view — call stack, variables, execution trace"
              >
                ⟳ Flow
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body: content + right sidebar */}
      <div className="vp-body">

      {/* Content */}
      <div
        className={`vp-content ${isFullscreen ? 'vp-content-fs' : ''} ${isFullscreen && vizMode === 'structure' && hasTrace ? 'vp-content-canvas' : ''}`}
        ref={canvasRef}
      >

        {/* ── Flow mode ── */}
        {vizMode === 'flow' && hasTrace && (
          <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <FlowVisualizer
              step={step}
              prevStep={prevStep}
              trace={trace}
              currentStep={currentStep}
            />
          </div>
        )}

        {/* ── Structure mode ── */}
        {vizMode === 'structure' && (
          <>
            {/* Loading state */}
            <AnimatePresence>
              {showOverlay && !hasTrace && (
                <motion.div className="vp-exec-loading"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  transition={{ duration:0.25 }}>
                  <div className="vp-exec-spinner-wrap">
                    <div className="vp-exec-spinner" />
                  </div>
                  <div className="vp-exec-loading-title">Running…</div>
                  <div className="vp-exec-loading-sub">Building trace</div>
                  <div className="vp-exec-loading-hint">ML models may take up to a minute</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!hasTrace && !isExecuting && pinnedVars.length === 0 && (
              <div className="vp-empty">
                <div className="vp-empty-ring">
                  <div className="vp-empty-logo">⟨/⟩</div>
                </div>
                <div className="vp-empty-title">Code-Viz</div>
                <div className="vp-empty-sub">Write an algorithm and run it<br/>to see live visualization</div>
                <div className="vp-empty-hint">Drag any list, tree or matrix from Variables →</div>
                <div className="vp-empty-kbd">Ctrl + Enter to run</div>
              </div>
            )}

            {/* ── FULLSCREEN CANVAS: draggable blocks ── */}
            {isFullscreen && hasTrace && (() => {
              const blocks = [];
              // Two-column grid. col1 = left, col2 = right (starts at 50% of canvas)
              const W = canvasRef.current?.offsetWidth || 1200;
              const col1x = 20, col2x = Math.floor(W / 2) + 10;
              let col1y = 16, col2y = 16;

              // Compute natural width for array-based blocks
              const arrValues = dispStep ? (() => {
                const loc = dispStep.locals || {};
                for (const v of Object.values(loc)) {
                  if (v?.type === 'list' && Array.isArray(v.value)) return v.value;
                }
                return [];
              })() : [];
              const arrW = Math.max(380, Math.min(W / 2 - 30, arrValues.length * 62 + 80));

              const push = (key, title, col, node, w) => {
                const blockW = w || Math.floor(W / 2) - 30;
                const x = col === 1 ? col1x : col2x;
                const y = col === 1 ? col1y : col2y;
                const gap = 420;
                if (col === 1) col1y += gap; else col2y += gap;
                blocks.push({ key, title, x, y, w: blockW, node });
              };

              if (step?.stdout?.trim()) push('con', 'Output', 1, <ConsoleOutput stdout={step.stdout} />, 360);
              if (isError && step?.error) push('err', 'Error', 1,
                <div className="vp-err-banner" style={{ position:'static', margin:0 }}>
                  <div className="vp-err-icon">⚠</div>
                  <div><div className="vp-err-type">{step.error.type}</div>
                  <div className="vp-err-msg">{step.error.message}</div></div>
                </div>, 400);
              if (dispStrings.length > 0) push('str', 'Strings', 1,
                <div>{dispStrings.map(s => <StringBar key={s.name} name={s.name} value={s.value} />)}</div>);
              if (dispHasArray)  push('arr',  'Array',          1, <ArrayVisualizer stepData={dispStep} />, arrW);
              if (dispHasArray && hasRecursion) push('rtv', 'Recursion Tree', 1,
                <VizErrorBoundary><RecursionTreeVisualizer trace={trace} currentStep={currentStep} /></VizErrorBoundary>,
                Math.max(520, arrW));
              if (dispHasMatrix) push('mat',  'Matrix',         2, <MatrixVisualizer stepData={dispStep} />);
              if (dispTreeData)  push('tree', 'Tree',           2, <TreeVisualizer name={dispTreeData.name} repr={dispTreeData.repr} prevRepr={prevTreeData?.repr||null} />);
              if (dispHasLL)     push('ll',   'Linked List',    1, <LinkedListVisualizer stepData={dispStep} />);
              if (dispHasSQ)     push('sq',   'Stack / Queue',  1, <StackQueueVisualizer stepData={dispStep} />);
              if (dispHasHeap)   push('heap', 'Heap',           2, <HeapVisualizer trace={trace} currentStep={currentStep} />);
              if (dispHasGraph)  push('graph','Graph',          2, <GraphVisualizer stepData={dispStep} />);
              if (dispHasML) {
                push('tc',  'Training Curve', 1, <TrainingCurveVisualizer stepData={dispStep} />);
                push('mlm', 'Model',          2, <MLModelVisualizer stepData={dispStep} currentStep={currentStep} traceLength={trace.length} isExecuting={isExecuting} />);
              }
              pinnedData.forEach(({ name, repr, prevRepr }) => {
                if (repr) push(`pin-${name}`, `📌 ${name}`, 2,
                  <PinnedVarView name={name} repr={repr} prevRepr={prevRepr} onUnpin={unpinVar} />, 340);
              });
              return blocks.map(({ key, title, x, y, w, node }) => (
                <DraggableBlock key={key} initialX={x} initialY={y} initialW={w} title={title}>
                  {node}
                </DraggableBlock>
              ));
            })()}

            {/* ── NORMAL MODE: scrollable column ── */}
            {!isFullscreen && (
              <>
                {hasTrace && step?.stdout?.trim() && <ConsoleOutput stdout={step.stdout} />}
                {hasTrace && isError && step?.error && (
                  <motion.div className="vp-err-banner" initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}>
                    <div className="vp-err-icon">⚠</div>
                    <div><div className="vp-err-type">{step.error.type}</div>
                    <div className="vp-err-msg">{step.error.message}{step.error.line ? ` — line ${step.error.line}` : ''}</div></div>
                  </motion.div>
                )}
                {hasTrace && dispStrings.length > 0 && (
                  <div className="vp-section">{dispStrings.map(s => <StringBar key={s.name} name={s.name} value={s.value} />)}</div>
                )}
                {hasTrace && dispHasArray && (
                  <AnimatePresence><motion.div key="arr" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><ArrayVisualizer stepData={dispStep} /></motion.div></AnimatePresence>
                )}
                {/* Recursion tree — only when recursion/DP detected, no AnimatePresence to prevent blinking */}
                {hasTrace && dispHasArray && hasRecursion && (
                  <div className="vp-section">
                    <VizErrorBoundary>
                      <RecursionTreeVisualizer trace={trace} currentStep={currentStep} />
                    </VizErrorBoundary>
                  </div>
                )}
                {hasTrace && dispHasMatrix && (
                  <AnimatePresence><motion.div key="mat" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><MatrixVisualizer stepData={dispStep} /></motion.div></AnimatePresence>
                )}
                {hasTrace && dispTreeData && (
                  <AnimatePresence><motion.div key="tree" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><TreeVisualizer name={dispTreeData.name} repr={dispTreeData.repr} prevRepr={prevTreeData?.repr||null} /></motion.div></AnimatePresence>
                )}
                {hasTrace && dispHasLL && (
                  <AnimatePresence><motion.div key="ll" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><LinkedListVisualizer stepData={dispStep} /></motion.div></AnimatePresence>
                )}
                {hasTrace && dispHasSQ && (
                  <AnimatePresence><motion.div key="sq" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><StackQueueVisualizer stepData={dispStep} /></motion.div></AnimatePresence>
                )}
                {hasTrace && dispHasHeap && (
                  <AnimatePresence><motion.div key="heap" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><HeapVisualizer trace={trace} currentStep={currentStep} /></motion.div></AnimatePresence>
                )}
                {hasTrace && dispHasGraph && (
                  <AnimatePresence><motion.div key="graph" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><GraphVisualizer stepData={dispStep} /></motion.div></AnimatePresence>
                )}
                {hasTrace && dispHasML && (
                  <AnimatePresence>
                    <motion.div key="tc" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><TrainingCurveVisualizer stepData={dispStep} /></motion.div>
                    <motion.div key="mlm" className="vp-section" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><MLModelVisualizer stepData={dispStep} currentStep={currentStep} traceLength={trace.length} isExecuting={isExecuting} /></motion.div>
                  </AnimatePresence>
                )}
                {hasTrace && !hasAnyContent && !isError && (
                  <div className="vp-no-struct">
                    <div className="vp-no-struct-icon">◇</div>
                    <div>No structure detected</div>
                    <div className="vp-no-struct-hint">Switch to Flow view to see execution →</div>
                  </div>
                )}
                {pinnedData.length > 0 && (
                  <div className="vp-pinned-section">
                    {hasAnyContent && <div className="vp-pinned-divider">Pinned Variables</div>}
                    <AnimatePresence>
                      {pinnedData.map(({ name, repr, prevRepr }) =>
                        repr && <PinnedVarView key={name} name={name} repr={repr} prevRepr={prevRepr} onUnpin={unpinVar} />
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>{/* /vp-content */}

      {/* Fullscreen variables sidebar — right side */}
      <AnimatePresence>
        {isFullscreen && sidebarOpen && (
          <motion.div className="vp-fs-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 270, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            style={{ overflow: 'hidden', flexShrink: 0, height: '100%' }}
          >
            <div className="vp-fs-sidebar-inner">
              <LiveVariablesPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>{/* /vp-body */}
    </div>
  );
}