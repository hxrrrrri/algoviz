# AlgoViz — Step-by-Step Algorithm Visualizer

> Write Python algorithms. Watch them execute. Understand them deeply.

AlgoViz is a high-performance web platform that interprets your Python code and generates real-time, step-by-step visualizations tied directly to execution. It automatically detects data structures (arrays, matrices, stacks, queues), renders pointer positions dynamically, and highlights errors exactly where they occur.

---

## Features

- **Live execution tracing** — `sys.settrace` captures every line, call, and return event
- **Array visualization** — indexed blocks with animated pointer arrows (left/right/mid/i/j/k)
- **Binary search zone** — eliminated regions grey out as the search space narrows
- **Matrix/DP table** — 2D arrays rendered as grids with active cell highlighting
- **Variable inspector** — all locals/globals with type-colored values and change detection
- **Call stack panel** — live frame tracking with depth visualization
- **Output/error panel** — stdout streaming + rich error display with line numbers
- **Scrubber timeline** — drag to any step, full playback controls, adjustable speed
- **8 built-in examples** — binary search, bubble sort, merge sort, two-pointers, DP LCS, and more
- **Security sandbox** — blocked system imports, step limits, timeout enforcement

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Zustand, Framer Motion |
| Code Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Backend | Python FastAPI, Uvicorn |
| Execution | `sys.settrace` (CPython native tracer) |
| Styling | Pure CSS with custom design system |

---

## Project Structure

```
algoviz/
├── backend/
│   ├── main.py          # FastAPI app — /execute, /execute/stream, /health
│   ├── executor.py      # Python tracer engine (sys.settrace + sandboxing)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx                        # Root layout
│   │   ├── store/index.js                 # Zustand global state
│   │   ├── hooks/usePlayback.js           # Auto-step interval hook
│   │   ├── utils/vizMapper.js             # Trace → visualization data mappers
│   │   ├── styles/globals.css             # Design system (CSS variables)
│   │   ├── components/
│   │   │   ├── Editor/CodeEditor.jsx      # CodeMirror with live line highlight
│   │   │   ├── Visualizer/
│   │   │   │   ├── VisualizationPanel.jsx # Tab orchestrator
│   │   │   │   ├── ArrayVisualizer.jsx    # Animated array + pointers
│   │   │   │   ├── MatrixVisualizer.jsx   # 2D DP table renderer
│   │   │   │   └── CallStackVisualizer.jsx
│   │   │   ├── Controls/Controls.jsx      # Run, play/pause, scrubber, speed
│   │   │   ├── Layout/Header.jsx          # Brand + example selector
│   │   │   └── panels/
│   │   │       ├── VariablesPanel.jsx     # Locals/globals inspector
│   │   │       └── OutputPanel.jsx        # stdout + error display
│   │   └── main.jsx
│   ├── public/favicon.svg
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**

---

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy env config
cp .env.example .env

# Start the server
uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`.  
Swagger docs available at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy env config
cp .env.example .env

# Start dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

### 3. Quick Test

Once both servers are running:

1. The editor loads with a binary search example
2. Press **Run** (or `Ctrl+Enter`)
3. Watch the array render with animated `left`, `right`, `mid` pointers
4. Use the scrubber or arrow buttons to step through execution
5. Switch tabs to inspect Variables, Call Stack, or Output

---

## API Reference

### `POST /execute`

Execute Python code and return the full trace.

**Request:**
```json
{
  "code": "arr = [1,3,5]\nfor i in range(len(arr)):\n    print(arr[i])",
  "language": "python",
  "inputs": [],
  "max_steps": 5000
}
```

**Response:**
```json
{
  "trace": [
    {
      "step": 0,
      "line": 1,
      "event": "line",
      "locals": { "arr": { "type": "list", "value": [...], "length": 3 } },
      "globals": {},
      "call_stack": [{ "function": "<module>", "line": 1 }],
      "stdout": "",
      "error": null,
      "structure_hints": { "arr": "array" },
      "return_value": null
    }
  ],
  "total_steps": 42
}
```

### `GET /health`

Returns `{ "status": "ok" }`.

---

## Security Model

| Threat | Mitigation |
|---|---|
| Dangerous imports (`os`, `sys`, `socket`…) | AST pre-scan blocks before execution |
| Infinite loops | Hard step limit (5000) + 8s timeout |
| File system access | `open()` removed from builtins |
| Network calls | `socket`, `requests`, `urllib` blocked |
| `exec`/`eval` abuse | `exec`, `compile`, `__import__` blocked |
| Resource exhaustion | Timeout thread kills hung execution |

> **Note:** For production deployment, wrap the backend in Docker with no-network and read-only filesystem constraints. See the architecture doc for details.

---

## Extending AlgoViz

### Adding a New Data Structure Visualizer

1. Add detection logic in `frontend/src/utils/vizMapper.js` — the `detect_structure_hints()` function on the backend and `getPrimaryArray()`/`getMatrix()` on the frontend show the pattern.
2. Create a new `YourVisualizer.jsx` component in `src/components/Visualizer/`.
3. Import and render it inside `VisualizationPanel.jsx`.

### Adding a New Sample Algorithm

Add an entry to the `SAMPLE_ALGORITHMS` array in `src/components/Layout/Header.jsx`.

---

## Roadmap

- [ ] JavaScript execution support (Babel instrumentation + isolated-vm)
- [ ] Linked list node visualization
- [ ] Binary tree / graph visualization (React Flow)
- [ ] Recursion tree with collapse/expand
- [ ] LLM-powered "why did this fail" explanations
- [ ] Shareable trace URLs
- [ ] User accounts + saved snippets
- [ ] Docker Compose for one-command startup

---

## License

MIT — build whatever you want on top of this.
