import sys
import copy
import traceback
import threading
import time
import ast
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

# Modules explicitly allowed (common algorithm / DS / typing modules)
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
        return {"type": "float", "value": obj}
    elif isinstance(obj, str):
        return {"type": "str", "value": obj[:200]}  # truncate long strings
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
    elif hasattr(obj, '__dict__'):
        # Custom object - capture its attributes
        obj_id = id(obj)
        cls_name = type(obj).__name__
        attrs = {}
        for k, v in list(vars(obj).items())[:20]:
            if not k.startswith('__'):
                attrs[k] = safe_repr(v, depth+1)
        return {"type": "object", "class": cls_name, "id": obj_id, "attrs": attrs}
    else:
        return {"type": "unknown", "value": repr(obj)[:100]}


def detect_structure_hints(locals_repr: Dict) -> Dict[str, str]:
    """Heuristically infer data structure types from variable names/shapes."""
    hints = {}
    for name, obj in locals_repr.items():
        if obj is None:
            continue
        t = obj.get("type", "")
        val = obj.get("value")
        
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
            # Graph adjacency list
            elif name.lower() in ("graph", "adj", "adjacency", "edges"):
                hints[name] = "graph"
            else:
                hints[name] = "dict"
        
        elif t == "object":
            cls = obj.get("class", "").lower()
            attrs = set(obj.get("attrs", {}).keys())
            if "next" in attrs:
                hints[name] = "linked_list"
            elif "left" in attrs and "right" in attrs:
                hints[name] = "tree_node"
            elif cls in ("stack", "queue", "deque"):
                hints[name] = cls
            else:
                hints[name] = "object"
        
        # Name-based fallbacks
        n = name.lower()
        if n in ("stack",) and t == "list":
            hints[name] = "stack"
        elif n in ("queue", "q") and t == "list":
            hints[name] = "queue"
        elif n in ("heap", "h") and t == "list":
            hints[name] = "heap"
        elif n in ("graph", "adj", "adjacency") and t == "dict":
            hints[name] = "graph"
        elif n in ("dp", "memo", "cache") and t in ("list", "dict"):
            hints[name] = "dp_table" if t == "list" else "memo"
    
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

            def tracer(frame, event, arg):
                if frame.f_code.co_filename != self._user_code_file:
                    return tracer  # skip stdlib frames
                
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
                        _safe_keys = set(safe_builtins().keys())
                        # Filter out built-in types and functions so only user-defined
                        # names appear. Module-level locals == globals in CPython.
                        def _is_user_var(k, v):
                            if k.startswith('__'):
                                return False
                            if k in _safe_keys:
                                return False
                            # skip built-in exception/type classes
                            if isinstance(v, type):
                                return False
                            return True

                        local_vars = {}
                        for k, v in frame.f_locals.items():
                            if _is_user_var(k, v):
                                local_vars[k] = safe_repr(v)

                        global_vars = {}
                        # Only report globals that differ from locals (i.e. in outer scope)
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
                        
                        # Only detect structures in user locals, not globals polluted with builtins
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
