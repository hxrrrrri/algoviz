import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ML_HINTS = new Set(['training_history', 'nn_model', 'ml_model']);

function isMLStep(step) {
  if (!step) return false;
  const locals = step.locals || {};
  const hints = step.structure_hints || {};

  for (const [name, hint] of Object.entries(hints)) {
    if (ML_HINTS.has(hint) && locals[name]) return true;
  }

  for (const repr of Object.values(locals)) {
    if (!repr || repr.type !== 'object') continue;
    const cls = String(repr.class || '').toLowerCase();
    const mlMod = String(repr.ml_module || '').toLowerCase();
    if (/keras|tensorflow|torch|sklearn|xgboost|lightgbm/.test(mlMod)) return true;
    if (/sequential|functional|model|network|conv|cnn|ann|gan|generator|discriminator|autoencoder|vae|lstm|gru|transformer|resnet|residual/.test(cls)) return true;
    if (repr.attrs?.layers?.type === 'list' || repr.attrs?._layers?.type === 'list') return true;
    if (repr.history && typeof repr.history === 'object') return true;
  }

  return false;
}

const DEFAULT_CODE = `def binary_search(arr, target):
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
print(f"Found at index: {result}")`;

const useStore = create(
  persist(
    (set, get) => ({
      // ── Code ──
      code: DEFAULT_CODE,
      language: 'python',

      // ── Theme ──
      theme: 'glass',   // 'glass' | 'noir'
      mode:  'dark',    // 'dark'  | 'light'

      // ── Execution ──
      trace: [],
      currentStep: 0,
      isExecuting: false,
      isPlaying: false,
      playSpeed: 1,
      executionError: null,
      highlightedLine: null,

      // ── Pinned variables (dragged to visualization panel) ──
      pinnedVars: [],

      // ── Actions ──
      setCode: (code) => set({ code }),
      setTheme: (theme) => set({ theme }),
      setMode:  (mode)  => set({ mode }),
      toggleMode:  () => set(s => ({ mode:  s.mode  === 'dark'  ? 'light' : 'dark'  })),
      toggleTheme: () => set(s => ({ theme: s.theme === 'glass' ? 'noir'  : 'glass' })),

      setCurrentStep: (step) => {
        const { trace } = get();
        const s = Math.max(0, Math.min(step, trace.length - 1));
        set({ currentStep: s, highlightedLine: trace[s]?.line ?? null });
      },
      stepForward: () => {
        const { currentStep, trace } = get();
        if (currentStep < trace.length - 1) get().setCurrentStep(currentStep + 1);
        else set({ isPlaying: false });
      },
      stepBackward: () => {
        const { currentStep } = get();
        if (currentStep > 0) get().setCurrentStep(currentStep - 1);
      },
      setPlaying:   (v) => set({ isPlaying: v }),
      setPlaySpeed: (v) => set({ playSpeed: v }),

      executeCode: async () => {
        const { code, language } = get();
        set({ isExecuting:true, trace:[], currentStep:0, executionError:null, isPlaying:false, highlightedLine:null });

        const appendStep = (step) => {
          set((s) => {
            const nextTrace = [...s.trace, step];
            const idx = nextTrace.length - 1;
            return {
              trace: nextTrace,
              currentStep: idx,
              highlightedLine: step?.line ?? null,
            };
          });
        };

        const finalizePlayback = () => {
          const { trace } = get();
          if (!trace.length) {
            set({ isExecuting:false, executionError: 'Execution returned no trace.' });
            return;
          }
          const firstMLStep = trace.findIndex(isMLStep);
          const startStep = firstMLStep >= 0 ? firstMLStep : 0;
          set({
            currentStep: startStep,
            highlightedLine: trace[startStep]?.line ?? null,
            isExecuting:false,
          });
          setTimeout(() => set({ isPlaying: true }), 300);
        };

        try {
          // Prefer streaming endpoint for live visualization updates.
          const streamRes = await fetch(`${API_BASE}/execute/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, language, max_steps: 5000 }),
          });

          if (streamRes.ok && streamRes.body) {
            const reader = streamRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            const handleLine = (line) => {
              if (!line) return;
              let msg;
              try {
                msg = JSON.parse(line);
              } catch {
                return;
              }
              if (msg.type === 'step' && msg.step) {
                appendStep(msg.step);
              } else if (msg.type === 'error') {
                throw new Error(msg.message || 'Execution stream failed');
              }
            };

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let nl = buffer.indexOf('\n');
              while (nl >= 0) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                handleLine(line);
                nl = buffer.indexOf('\n');
              }
            }

            if (buffer.trim()) {
              handleLine(buffer.trim());
            }

            finalizePlayback();
            return;
          }

          // Fallback to non-streaming API for older backends.
          const res = await fetch(`${API_BASE}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, language, max_steps: 5000 }),
          });
          if (!res.ok) {
            const e = await res.json();
            throw new Error(e.detail || 'Execution failed');
          }
          const data = await res.json();
          set({ trace: data.trace || [] });
          finalizePlayback();
        } catch (err) {
          set({ isExecuting:false, executionError: err.message, trace:[] });
        }
      },

      resetExecution: () => set({ trace:[], currentStep:0, isPlaying:false, executionError:null, highlightedLine:null, pinnedVars:[] }),

      pinVar:   (name) => set(s => ({ pinnedVars: s.pinnedVars.includes(name) ? s.pinnedVars : [...s.pinnedVars, name] })),
      unpinVar: (name) => set(s => ({ pinnedVars: s.pinnedVars.filter(n => n !== name) })),
      clearPinnedVars: () => set({ pinnedVars: [] }),
    }),
    {
      name: 'codeviz-prefs',
      partialize: (s) => ({ theme: s.theme, mode: s.mode, code: s.code }),
    }
  )
);

export default useStore;
