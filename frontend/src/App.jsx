import React, { useEffect, useCallback } from 'react';
import Header from './components/Layout/Header';
import Controls from './components/Controls/Controls';
import CodeEditor from './components/Editor/CodeEditor';
import VisualizationPanel from './components/Visualizer/VisualizationPanel';
import LiveVariablesPanel from './components/panels/LiveVariablesPanel';
import useStore from './store';
import './styles/globals.css';
import './App.css';

export default function App() {
  const executeCode = useStore(s => s.executeCode);
  const isExecuting = useStore(s => s.isExecuting);

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
      <Header />
      <div className="app-body">
        <div className="panel-editor">
          <CodeEditor />
        </div>
        <div className="panel-right">
          <div className="panel-right-top">
            <div className="panel-viz">
              <VisualizationPanel />
            </div>
            <div className="panel-vars">
              <LiveVariablesPanel />
            </div>
          </div>
          <Controls />
        </div>
      </div>
    </div>
  );
}
