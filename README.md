# Code-Viz — Algorithm Intelligence Studio

> Step-by-step algorithm visualization with live variable tracking, 4 visual themes, and real-time execution insight.

![Code-Viz](https://img.shields.io/badge/Code--Viz-Algorithm%20Studio-34d399?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzNiAzNiI+PHBhdGggZD0iTTE4IDIgTDMyIDEwIEwzMiAyNiBMMTggMzQgTDQgMjYgTDQgMTBaIiBzdHJva2U9IiMzNGQzOTkiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTEyIDE0IEw3IDE4IEwxMiAyMiIgc3Ryb2tlPSIjMzRkMzk5IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yNCAxNCBMMjkgMTggTDI0IDIyIiBzdHJva2U9IiM4MjhjZjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iMTgiIGN5PSIxOCIgcj0iMiIgZmlsbD0iI2ZiYmYyNCIvPjwvc3ZnPg==)

---

## Features

### Execution Engine
- **Python `sys.settrace`** — captures every line, call, return and exception event natively
- Step limit (5000) + 8s timeout — infinite loops are safely caught
- Security sandbox — `os`, `sys`, `socket`, `subprocess` and all dangerous builtins blocked
- Precise error line numbers extracted from traceback

### Live Variable Tracking
- Every local variable gets a **typed card** that updates at each execution step
- **4-layer change indication** — impossible to miss:
  1. `CHANGED` / `NEW` pill badge animates in with a spring
  2. Entire card flashes amber for 1.2 seconds
  3. New value pops to 1.22× scale with colour burst
  4. Previous value appears crossed out above new value
- Type-coded icons: `#` int, `"` str, `[` list, `{` dict, `?` bool, `∅` None
- Timeline strip — every step is a dot; blue = variable changed, red = error

### Visualization
- **Arrays** — indexed blocks with animated pointer arrows (left/right/mid/i/j/k)
- **Binary search zone** — eliminated regions dim out as search space collapses
- **DP/2D matrix** — grid with active cell highlight, row/col crosshairs
- **Call stack** — live frame tracking with depth

### Themes — 4 Combinations
| | Dark | Light |
|---|---|---|
| **Glass** | Apple-style frosted panels, emerald accent | White frosted, teal accent |
| **Noir** | Pure black, orange-red accent | Off-white, burnt orange |

Toggle between Glass ↔ Noir and Dark ↔ Light from the header — **preference is persisted** across sessions via localStorage.

### Editor
- CodeMirror 6 with full Python syntax highlighting
- Active execution line highlighted in gold
- `Ctrl+Enter` shortcut to run
- 8 built-in examples (Binary Search, Bubble Sort, Merge Sort, Two Pointers, DP LCS…)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Zustand (with persist), Framer Motion |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Icons | Lucide React |
| Backend | FastAPI, Uvicorn |
| Execution | Python `sys.settrace` |
| Styling | Pure CSS with 4-theme design system |

---

## Project Structure

```
algoviz/                          ← root (rename to code-viz if you like)
├── backend/
│   ├── main.py                   ← FastAPI app
│   ├── executor.py               ← sys.settrace engine + security sandbox
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx               ← root layout + theme attribute injection
│   │   ├── App.css               ← layout + ambient orbs
│   │   ├── store/index.js        ← Zustand store with theme persistence
│   │   ├── hooks/usePlayback.js  ← auto-step interval hook
│   │   ├── utils/vizMapper.js    ← trace → visual data mappers
│   │   ├── styles/globals.css    ← 4-theme CSS variable system
│   │   └── components/
│   │       ├── Layout/Header.jsx          ← Code-Viz brand + theme toggles
│   │       ├── Editor/CodeEditor.jsx      ← CodeMirror + line highlight
│   │       ├── Controls/Controls.jsx      ← playback bar
│   │       ├── Visualizer/
│   │       │   ├── VisualizationPanel.jsx
│   │       │   ├── ArrayVisualizer.jsx    ← array + pointers + elimination
│   │       │   └── MatrixVisualizer.jsx   ← 2D DP table
│   │       └── panels/
│   │           └── LiveVariablesPanel.jsx ← live var cards + timeline
│   ├── public/favicon.svg        ← Code-Viz hexagon logo
│   ├── index.html
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Quick Start (Windows PowerShell)

### Backend
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (new terminal)
```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### Keyboard shortcut
`Ctrl + Enter` — run the code in the editor

---

## API

### `POST /execute`
```json
{
  "code": "arr = [1,3,5]\nfor i,v in enumerate(arr):\n    print(i,v)",
  "language": "python",
  "max_steps": 5000
}
```
Returns `{ "trace": [...], "total_steps": N }`.

Each trace step:
```json
{
  "step": 4,
  "line": 2,
  "event": "line",
  "locals": { "arr": {"type":"list","value":[...],"length":3}, "i": {"type":"int","value":1} },
  "call_stack": [{"function":"<module>","line":2}],
  "stdout": "",
  "error": null,
  "structure_hints": { "arr": "array" }
}
```

### `GET /health`
Returns `{ "status": "ok" }`.

---

## Security Model

| Threat | Mitigation |
|---|---|
| `import os/sys/socket/subprocess` | AST pre-scan raises `SecurityError` before execution |
| Infinite loops | Step limit 5000 + 8s thread timeout |
| `open()`, `exec()`, `__import__` | Removed from custom `__builtins__` |
| Resource exhaustion | 8s wall-clock timeout kills the thread |

---

## Extending

### Add a new algorithm sample
Edit the `SAMPLES` array in `src/components/Layout/Header.jsx`.

### Add a new visualizer
1. Add detection in `backend/executor.py → detect_structure_hints()`
2. Create `src/components/Visualizer/YourVisualizer.jsx`
3. Import and render it in `VisualizationPanel.jsx`

### Change accent colour
Override `--accent` in `src/styles/globals.css` for the relevant `[data-theme][data-mode]` selector.

---

## Roadmap

- [ ] JavaScript support (Babel instrumentation + isolated-vm)
- [ ] Linked list node + pointer arrow visualization
- [ ] Binary tree / graph visualization (React Flow)
- [ ] Recursion tree with collapse/expand
- [ ] LLM-powered "why did this fail" explanation
- [ ] Shareable trace URLs
- [ ] Docker one-command startup

---

## License

MIT
