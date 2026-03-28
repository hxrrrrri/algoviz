import { useEffect, useCallback } from 'react';
import useStore from './store';
import Header from './components/Layout/Header';
import Controls from './components/Controls/Controls';
import CodeEditor from './components/Editor/CodeEditor';
import VisualizationPanel from './components/Visualizer/VisualizationPanel';
import LiveVariablesPanel from './components/panels/LiveVariablesPanel';
import TimelineFooter from './components/Timeline/TimelineFooter';
import './styles/globals.css';
import './App.css';

export default function App() {
  const executeCode = useStore(s => s.executeCode);
  const isExecuting = useStore(s => s.isExecuting);
  const theme = useStore(s => s.theme);
  const mode  = useStore(s => s.mode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode',  mode);
  }, [theme, mode]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isExecuting) executeCode();
    }
  }, [isExecuting, executeCode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app-root">
      {/* Ambient background orbs */}
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />
      <div className="ambient-orb orb-3" />

      <Header />

      <div className="app-body">
        {/* Editor */}
        <div className="panel-editor">
          <CodeEditor />
        </div>

        <div className="panel-divider" />

        {/* Right column */}
        <div className="panel-right">
          <div className="panel-right-top">
            <div className="panel-viz">
              <VisualizationPanel />
            </div>
            <div className="panel-vars-divider" />
            <div className="panel-vars">
              <LiveVariablesPanel />
            </div>
          </div>
          <Controls />
        </div>
      </div>

      {/* Full-width timeline footer */}
      <TimelineFooter />
    </div>
  );
}