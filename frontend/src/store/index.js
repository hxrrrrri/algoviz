import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const useStore = create((set, get) => ({
  // Code editor state
  code: `# Binary Search — try editing me!
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1

arr = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
result = binary_search(arr, 7)
print(f"Found at index: {result}")`,
  
  language: 'python',
  
  // Execution state
  trace: [],
  currentStep: 0,
  isExecuting: false,
  isPlaying: false,
  playSpeed: 1, // steps per second multiplier
  executionError: null,
  
  // UI state
  activePanel: 'visualizer', // 'visualizer' | 'variables' | 'callstack' | 'output'
  highlightedLine: null,

  // Actions
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  
  setCurrentStep: (step) => {
    const { trace } = get();
    const clampedStep = Math.max(0, Math.min(step, trace.length - 1));
    const currentTrace = trace[clampedStep];
    set({
      currentStep: clampedStep,
      highlightedLine: currentTrace?.line || null,
    });
  },
  
  stepForward: () => {
    const { currentStep, trace } = get();
    if (currentStep < trace.length - 1) {
      get().setCurrentStep(currentStep + 1);
    } else {
      set({ isPlaying: false });
    }
  },
  
  stepBackward: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      get().setCurrentStep(currentStep - 1);
    }
  },
  
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  
  executeCode: async () => {
    const { code, language } = get();
    set({
      isExecuting: true,
      trace: [],
      currentStep: 0,
      executionError: null,
      isPlaying: false,
      highlightedLine: null,
    });
    
    try {
      const response = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, max_steps: 5000 }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Execution failed');
      }
      
      const data = await response.json();
      const trace = data.trace || [];
      
      set({
        trace,
        currentStep: 0,
        isExecuting: false,
        highlightedLine: trace[0]?.line || null,
      });
      
      // Auto-play after execution
      setTimeout(() => set({ isPlaying: true }), 300);
      
    } catch (err) {
      set({
        isExecuting: false,
        executionError: err.message,
        trace: [],
      });
    }
  },
  
  resetExecution: () => set({
    trace: [],
    currentStep: 0,
    isPlaying: false,
    executionError: null,
    highlightedLine: null,
  }),
  
  // Derived getters
  getCurrentStepData: () => {
    const { trace, currentStep } = get();
    return trace[currentStep] || null;
  },
  
  getTotalSteps: () => get().trace.length,
  
  hasError: () => {
    const { trace, currentStep } = get();
    return trace[currentStep]?.event === 'error';
  },
}));

export default useStore;
