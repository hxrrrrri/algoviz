import sys
import copy
import traceback
import threading
import time
import ast
import math
import builtins
import warnings
from typing import Any, Dict, List, Optional
import io
import contextlib

# Suppress CPython-internal RuntimeWarning about unbound locals in comprehensions
warnings.filterwarnings("ignore", category=RuntimeWarning, message=".*unbound local.*")


BLOCKED_BUILTINS = {
    'open', 'exec', 'compile', 'breakpoint',
    'input',  # handled separately via mock
    # __import__ is replaced with safe_import below
}

BLOCKED_MODULES = {
    'os', 'sys', 'subprocess', 'socket', 'shutil', 'pathlib',
    'importlib', 'ctypes', 'multiprocessing', 'threading',
    'requests', 'urllib', 'http', 'ftplib', 'smtplib',
    'pickle', 'shelve', 'marshal', 'pty', 'signal',
}

# Modules explicitly allowed (common algorithm / DS / typing / ML modules)
ALLOWED_MODULES = {
    'typing', 'typing_extensions',
    'collections', 'collections.abc',
    'functools', 'itertools', 'operator',
    'math', 'cmath', 'decimal', 'fractions', 'random', 'statistics', 'numbers',
    'heapq', 'bisect', 'array', 'queue',
    'string', 're', 'copy', 'pprint',
    'enum', 'dataclasses', 'abc',
    'io', 'json',
    'sortedcontainers',
    # ML / scientific
    'numpy', 'np',
    'pandas', 'pd',
    'sklearn', 'scikit_learn',
    'scipy',
    'keras',
    'tensorflow', 'tf',
    'torch',
    'matplotlib',
    'seaborn',
    'xgboost', 'lightgbm', 'catboost',
}


def _make_safe_import():
    """Return a restricted __import__ that blocks dangerous modules."""
    _real_import = builtins.__import__

    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        base = name.split('.')[0] if name else ''
        if base in BLOCKED_MODULES:
            raise ImportError(f"Import of '{base}' is not allowed for security reasons.")
        # Allow anything in our explicit allow-list or the standard library
        try:
            return _real_import(name, globals, locals, fromlist, level)
        except ImportError:
            raise
    return safe_import


def safe_builtins():
    safe = {}
    for name in dir(builtins):
        if name not in BLOCKED_BUILTINS:
            safe[name] = getattr(builtins, name)
    safe['__builtins__'] = safe
    safe['input'] = lambda prompt='': ''
    safe['__import__'] = _make_safe_import()
    return safe


def safe_repr(obj, depth=0, max_depth=4):
    """Serialize any Python object to a JSON-serializable structure."""
    if depth > max_depth:
        return {"type": "ellipsis", "value": "..."}

    if obj is None:
        return {"type": "none", "value": None}
    elif isinstance(obj, bool):
        return {"type": "bool", "value": obj}
    elif isinstance(obj, int):
        return {"type": "int", "value": obj}
    elif isinstance(obj, float):
        if math.isinf(obj):
            return {"type": "float", "value": "∞" if obj > 0 else "-∞", "display": True}
        if math.isnan(obj):
            return {"type": "float", "value": "NaN", "display": True}
        return {"type": "float", "value": obj}
    elif isinstance(obj, str):
        return {"type": "str", "value": obj[:200]}
    elif isinstance(obj, (list, tuple)):
        kind = "list" if isinstance(obj, list) else "tuple"
        if len(obj) > 100:
            items = [safe_repr(x, depth+1) for x in obj[:100]]
            items.append({"type": "ellipsis", "value": f"...{len(obj)-100} more"})
        else:
            items = [safe_repr(x, depth+1) for x in obj]
        return {"type": kind, "value": items, "length": len(obj)}
    elif isinstance(obj, dict):
        if len(obj) > 50:
            pairs = {str(k): safe_repr(v, depth+1) for k, v in list(obj.items())[:50]}
        else:
            pairs = {str(k): safe_repr(v, depth+1) for k, v in obj.items()}
        return {"type": "dict", "value": pairs, "length": len(obj)}
    elif isinstance(obj, set):
        items = [safe_repr(x, depth+1) for x in list(obj)[:50]]
        return {"type": "set", "value": items, "length": len(obj)}

    # ── numpy ndarray ──────────────────────────────────────────────
    try:
        import numpy as np
        if isinstance(obj, np.ndarray):
            shape = list(obj.shape)
            dtype = str(obj.dtype)
            flat  = obj.flatten().tolist()[:200]
            # 2-D → list of rows; 1-D → flat list
            if obj.ndim == 2:
                rows = obj.tolist()
                rows = [r[:50] for r in rows[:50]]
                return {"type": "ndarray", "shape": shape, "dtype": dtype,
                        "value": rows, "ndim": obj.ndim}
            else:
                return {"type": "ndarray", "shape": shape, "dtype": dtype,
                        "value": flat, "ndim": obj.ndim}
    except ImportError:
        pass

    # ── pandas DataFrame / Series ──────────────────────────────────
    try:
        import pandas as pd
        if isinstance(obj, pd.DataFrame):
            cols   = list(obj.columns[:20])
            rows   = obj.head(30).values.tolist()
            return {"type": "dataframe", "columns": cols, "rows": rows,
                    "shape": list(obj.shape)}
        if isinstance(obj, pd.Series):
            return {"type": "series", "name": str(obj.name),
                    "value": obj.head(100).tolist(), "length": len(obj)}
    except ImportError:
        pass

    # ── Keras History ──────────────────────────────────────────────
    try:
        # keras.callbacks.History has a .history dict attr
        if hasattr(obj, 'history') and hasattr(obj, 'epoch') and isinstance(getattr(obj, 'history', None), dict):
            hist = obj.history
            serialised = {k: [float(x) for x in v] for k, v in hist.items()}
            return {"type": "keras_history", "history": serialised,
                    "epochs": len(obj.epoch)}
    except Exception:
        pass

    # ── sklearn / generic ML model ─────────────────────────────────
    if hasattr(obj, '__dict__'):
        cls_name = type(obj).__name__
        module   = type(obj).__module__ or ''
        is_ml    = any(m in module for m in ('sklearn', 'keras', 'torch', 'xgboost', 'lightgbm'))
        attrs    = {}
        for k, v in list(vars(obj).items())[:25]:
            if not k.startswith('__'):
                try:
                    attrs[k] = safe_repr(v, depth+1)
                except Exception:
                    attrs[k] = {"type": "unknown", "value": "?"}
        result = {"type": "object", "class": cls_name, "id": id(obj), "attrs": attrs}
        if is_ml:
            result["ml_module"] = module.split('.')[0]
            # capture get_params() for sklearn estimators
            try:
                if hasattr(obj, 'get_params'):
                    result["params"] = {k: safe_repr(v, depth+1)
                                        for k, v in obj.get_params().items()}
            except Exception:
                pass
        return result

    return {"type": "unknown", "value": repr(obj)[:100]}


def detect_structure_hints(locals_repr: Dict) -> Dict[str, str]:
    """Heuristically infer data structure types from variable names/shapes."""
    hints = {}
    for name, obj in locals_repr.items():
        if obj is None:
            continue
        t = obj.get("type", "")
        val = obj.get("value")

        # ── ML / numpy types ──────────────────────────────────────
        if t == "keras_history":
            hints[name] = "training_history"
            continue

        if t == "ndarray":
            ndim = obj.get("ndim", 1)
            hints[name] = "matrix" if ndim == 2 else "array"
            continue

        if t == "dataframe":
            hints[name] = "dataframe"
            continue

        if t == "series":
            hints[name] = "array"
            continue

        if t == "object" and obj.get("ml_module"):
            ml_mod = obj.get("ml_module", "")
            cls    = obj.get("class", "").lower()
            if any(x in cls for x in ("sequential", "model", "network")):
                hints[name] = "nn_model"
            elif any(x in cls for x in ("history",)):
                hints[name] = "training_history"
            else:
                hints[name] = "ml_model"
            continue

        # Training history dict: has 'loss' key with a list value
        if t == "dict" and val:
            keys = set(val.keys())
            ml_keys = {"loss", "val_loss", "accuracy", "val_accuracy",
                       "acc", "val_acc", "mae", "mse", "auc"}
            if keys & ml_keys and any(
                isinstance(val.get(k), dict) and val[k].get("type") == "list"
                for k in keys & ml_keys
            ):
                hints[name] = "training_history"
                continue
        
        # Array-like patterns
        if t in ("list", "tuple") and isinstance(val, list):
            inner_types = {v.get("type") for v in val if isinstance(v, dict)}
            if inner_types <= {"int", "float", "str", "none"}:
                hints[name] = "array"
            elif all(v.get("type") == "list" for v in val if isinstance(v, dict)):
                hints[name] = "matrix"
            else:
                hints[name] = "array"
        
        elif t == "dict":
            v = obj.get("value", {})
            keys = set(v.keys())
            # Linked list node
            if "next" in keys and ("val" in keys or "value" in keys or "data" in keys):
                hints[name] = "linked_list"
            # Binary tree node
            elif "left" in keys and "right" in keys:
                hints[name] = "tree_node"
            # Graph adjacency list (by name or by structure: dict of lists)
            elif name.lower() in ("graph", "adj", "adjacency", "edges", "neighbors", "g"):
                hints[name] = "graph"
            elif v and all(
                isinstance(vv, dict) and vv.get("type") in ("list", "set")
                for vv in list(v.values())[:5]
            ):
                hints[name] = "graph"
            else:
                hints[name] = "hashmap"

        elif t == "object":
            cls = obj.get("class", "").lower()
            attrs = set(obj.get("attrs", {}).keys())
            if "next" in attrs:
                hints[name] = "linked_list"
            elif "left" in attrs and "right" in attrs:
                hints[name] = "tree_node"
            elif cls in ("stack", "queue", "deque"):
                hints[name] = cls
            elif cls in ("defaultdict", "ordereddict", "counter"):
                hints[name] = "hashmap"
            # collections.deque — has _data/_maxlen or similar internals
            elif cls == "deque":
                hints[name] = "deque"
            else:
                hints[name] = "object"

        # Name-based fallbacks
        n = name.lower()
        if n in ("stack", "stk") and t == "list":
            hints[name] = "stack"
        elif n in ("queue", "q", "bfs") and t == "list":
            hints[name] = "queue"
        elif n in ("deque", "dq") and t == "list":
            hints[name] = "deque"
        elif n in ("heap", "h", "min_heap", "max_heap", "pq") and t == "list":
            hints[name] = "heap"
        elif n in ("graph", "adj", "adjacency", "neighbors", "g", "edges") and t == "dict":
            hints[name] = "graph"
        elif n in ("hashmap", "hmap", "freq", "count", "counts",
                   "frequency", "memo", "cache") and t == "dict":
            hints.setdefault(name, "hashmap")
        elif n in (
            "dp", "memo", "cache", "table", "tab",
            "dp_table", "dp_mat", "dp_matrix",
            "cost", "dist", "f", "g", "h",
            "lcs", "lis", "knap", "sol", "res",
        ) and t in ("list", "dict"):
            # Only promote to dp_table if it is a 2-D list (list of lists)
            if t == "list" and isinstance(val, list) and val and isinstance(val[0], dict) and val[0].get("type") == "list":
                hints[name] = "dp_table"
            elif t == "list":
                # 1-D list with a DP name — keep as array so it renders as array bar
                hints.setdefault(name, "array")
            else:
                hints[name] = "memo"
    
    return hints


def sanitize_code(code: str) -> str:
    """Block dangerous imports via AST pre-scan."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return code  # let the executor surface the syntax error
    
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = []
            if isinstance(node, ast.Import):
                names = [alias.name.split('.')[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    names = [node.module.split('.')[0]]
            for name in names:
                if name in BLOCKED_MODULES:
                    raise ValueError(f"Import of '{name}' is not allowed for security reasons.")
    return code


ML_MODULES = frozenset({
    'sklearn', 'tensorflow', 'keras', 'torch', 'xgboost',
    'lightgbm', 'catboost', 'scipy', 'numpy', 'pandas',
})

def _is_ml_code(code: str) -> bool:
    """Quick heuristic — does the code import any heavy ML library?"""
    import re
    for mod in ML_MODULES:
        if re.search(rf'\b(import|from)\s+{mod}\b', code):
            return True
    return False


class PythonExecutor:
    def __init__(self, max_steps: int = 5000, timeout: float = 8.0):
        self.max_steps = max_steps
        self.timeout = timeout
        self._trace: List[Dict] = []
        self._step_count = 0
        self._call_stack: List[Dict] = []
        self._error = None
        self._stdout_buffer = []
        self._user_code_file = "<user_code>"

    def execute(self, code: str, inputs: List[Any] = []) -> List[Dict]:
        self._trace = []
        self._step_count = 0
        self._call_stack = []
        self._error = None
        self._stdout_buffer = []

        # Auto-raise limits for ML/scientific code — it has many more internal steps
        # and legitimately takes longer to run.
        if _is_ml_code(code):
            self.max_steps = max(self.max_steps, 50_000)
            self.timeout   = max(self.timeout,   60.0)

        try:
            code = sanitize_code(code)
        except ValueError as e:
            return [{
                "step": 0, "line": 0, "event": "error",
                "error": {"type": "SecurityError", "message": str(e), "line": 0},
                "locals": {}, "globals": {}, "call_stack": [],
                "stdout": "", "structure_hints": {}
            }]

        # Compile to check for syntax errors first
        try:
            compiled = compile(code, self._user_code_file, 'exec')
        except SyntaxError as e:
            return [{
                "step": 0, "line": e.lineno or 0, "event": "error",
                "error": {"type": "SyntaxError", "message": str(e.msg), "line": e.lineno or 0},
                "locals": {}, "globals": {}, "call_stack": [],
                "stdout": "", "structure_hints": {}
            }]

        result_container = {"done": False, "exception": None}
        stdout_capture = io.StringIO()

        def run_target():
            safe_globals = safe_builtins()
            safe_globals['__name__'] = '__main__'
            safe_globals['__file__'] = self._user_code_file

            # Inject mock input queue
            input_queue = list(inputs)
            def mock_input(prompt=''):
                if input_queue:
                    val = str(input_queue.pop(0))
                    self._stdout_buffer.append(str(prompt) + val)
                    return val
                return ''
            safe_globals['input'] = mock_input

            # Build the safe-keys set once — NOT inside the hot tracer callback.
            _safe_keys = set(safe_builtins().keys())

            def _is_user_var(k, v):
                if k.startswith('__'):
                    return False
                if k in _safe_keys:
                    return False
                if isinstance(v, type):
                    return False
                return True

            def tracer(frame, event, arg):
                # Return None (not tracer) for non-user-code frames.
                # Returning tracer here caused every line inside sklearn/numpy/etc.
                # to fire this callback, making ML code 50-100× slower.
                if frame.f_code.co_filename != self._user_code_file:
                    return None

                if self._step_count >= self.max_steps:
                    raise RuntimeError(f"Step limit ({self.max_steps}) reached. Possible infinite loop.")

                line = frame.f_lineno

                if event == 'call':
                    self._call_stack.append({
                        "function": frame.f_code.co_name,
                        "line": line,
                        "file": frame.f_code.co_filename
                    })
                elif event == 'return':
                    if self._call_stack:
                        self._call_stack.pop()

                if event in ('line', 'call', 'return', 'exception'):
                    try:
                        local_vars = {}
                        for k, v in frame.f_locals.items():
                            if _is_user_var(k, v):
                                local_vars[k] = safe_repr(v)

                        global_vars = {}
                        if frame.f_locals is not frame.f_globals:
                            for k, v in frame.f_globals.items():
                                if _is_user_var(k, v):
                                    global_vars[k] = safe_repr(v)

                        error_info = None
                        if event == 'exception':
                            exc_type, exc_val, exc_tb = arg
                            error_info = {
                                "type": exc_type.__name__,
                                "message": str(exc_val),
                                "line": line
                            }

                        stdout_val = stdout_capture.getvalue()
                        hints = detect_structure_hints(local_vars) if local_vars else {}

                        step_data = {
                            "step": self._step_count,
                            "line": line,
                            "event": event,
                            "locals": local_vars,
                            "globals": global_vars,
                            "call_stack": copy.deepcopy(self._call_stack),
                            "stdout": stdout_val,
                            "error": error_info,
                            "structure_hints": hints,
                            "return_value": safe_repr(arg) if event == 'return' and arg is not None else None
                        }
                        self._trace.append(step_data)
                        self._step_count += 1
                    except Exception:
                        pass

                return tracer

            try:
                with contextlib.redirect_stdout(stdout_capture):
                    sys.settrace(tracer)
                    exec(compiled, safe_globals)
                    sys.settrace(None)
            except Exception as e:
                sys.settrace(None)
                result_container["exception"] = e
                # Try to extract the line number from traceback
                import re as _re
                tb_str = traceback.format_exc()
                err_line = None
                for match in _re.finditer(r'File "<user_code>", line (\d+)', tb_str):
                    err_line = int(match.group(1))
                # Add final error step
                err_step = {
                    "step": self._step_count,
                    "line": err_line or 0,
                    "event": "error",
                    "locals": {},
                    "globals": {},
                    "call_stack": copy.deepcopy(self._call_stack),
                    "stdout": stdout_capture.getvalue(),
                    "error": {
                        "type": type(e).__name__,
                        "message": str(e),
                        "line": err_line,
                        "traceback": tb_str
                    },
                    "structure_hints": {}
                }
                self._trace.append(err_step)
            finally:
                sys.settrace(None)
                result_container["done"] = True

        thread = threading.Thread(target=run_target, daemon=True)
        thread.start()
        thread.join(timeout=self.timeout)

        if thread.is_alive():
            # Timeout - add a timeout error step
            self._trace.append({
                "step": self._step_count,
                "line": 0,
                "event": "error",
                "locals": {},
                "globals": {},
                "call_stack": [],
                "stdout": "",
                "error": {
                    "type": "TimeoutError",
                    "message": f"Execution timed out after {self.timeout}s. Check for infinite loops.",
                    "line": None
                },
                "structure_hints": {}
            })

        return self._trace
