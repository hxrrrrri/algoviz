/**
 * Visualization mapping utilities.
 * Takes a trace step and returns structured visualization data.
 */

/**
 * Flatten a safe_repr object to a primitive JS value for display.
 */
export function flattenValue(repr) {
  if (!repr || typeof repr !== 'object') return repr;
  const { type, value } = repr;
  
  if (type === 'none') return null;
  if (type === 'bool') return value;
  if (type === 'int' || type === 'float') return value;
  if (type === 'str') return value;
  if (type === 'list' || type === 'tuple') {
    return Array.isArray(value) ? value.map(flattenValue) : [];
  }
  if (type === 'dict') {
    if (!value || typeof value !== 'object') return {};
    const obj = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = flattenValue(v);
    }
    return obj;
  }
  if (type === 'object') {
    const obj = { __class__: repr.class, __id__: repr.id };
    if (repr.attrs) {
      for (const [k, v] of Object.entries(repr.attrs)) {
        obj[k] = flattenValue(v);
      }
    }
    return obj;
  }
  if (type === 'ellipsis') return '...';
  return repr.value ?? repr;
}

/**
 * Display a repr value as a short string.
 */
export function displayValue(repr, maxLen = 40) {
  if (!repr) return 'None';
  const flat = flattenValue(repr);
  if (flat === null) return 'None';
  if (flat === undefined) return 'undefined';
  const str = JSON.stringify(flat);
  if (str.length > maxLen) return str.slice(0, maxLen) + '…';
  return str;
}

/**
 * Get the primary array variable from locals for array visualization.
 * Returns { name, values, length } or null.
 */
export function getPrimaryArray(locals, hints) {
  if (!locals || !hints) return null;
  
  // Find all array-typed variables
  const arrays = [];
  for (const [name, hint] of Object.entries(hints)) {
    if (hint === 'array' && locals[name]) {
      const flat = flattenValue(locals[name]);
      if (Array.isArray(flat)) {
        arrays.push({ name, values: flat, length: flat.length });
      }
    }
  }
  
  if (arrays.length === 0) return null;
  
  // Prefer longer arrays, or ones with common algorithm names
  const preferred = ['arr', 'array', 'nums', 'numbers', 'a', 'data', 'items'];
  for (const pref of preferred) {
    const found = arrays.find(a => a.name === pref);
    if (found) return found;
  }
  return arrays.sort((a, b) => b.length - a.length)[0];
}

/**
 * Get pointer variables (left, right, mid, i, j, k, start, end, etc.)
 * Returns { name: index } map.
 */
export function getPointers(locals) {
  if (!locals) return {};
  
  const POINTER_NAMES = new Set([
    'left', 'right', 'mid', 'middle',
    'i', 'j', 'k', 'l', 'r', 'm',
    'start', 'end', 'low', 'high',
    'slow', 'fast', 'prev', 'curr', 'current', 'next',
    'p', 'q', 'ptr', 'pointer',
    'head', 'tail',
  ]);
  
  const pointers = {};
  for (const [name, repr] of Object.entries(locals)) {
    if (!POINTER_NAMES.has(name)) continue;
    if (!repr) continue;
    if (repr.type === 'int') {
      pointers[name] = repr.value;
    } else if (repr.type === 'float' && Number.isInteger(repr.value)) {
      pointers[name] = repr.value;
    }
  }
  return pointers;
}

/**
 * Pointer display config: color, label, priority.
 */
export const POINTER_STYLES = {
  left:    { color: '#00e5ff', label: 'L', priority: 1 },
  l:       { color: '#00e5ff', label: 'L', priority: 1 },
  low:     { color: '#00e5ff', label: 'lo', priority: 1 },
  start:   { color: '#00e5ff', label: 'S', priority: 1 },
  slow:    { color: '#00e5ff', label: 'slow', priority: 1 },
  right:   { color: '#ff9500', label: 'R', priority: 2 },
  r:       { color: '#ff9500', label: 'R', priority: 2 },
  high:    { color: '#ff9500', label: 'hi', priority: 2 },
  end:     { color: '#ff9500', label: 'E', priority: 2 },
  fast:    { color: '#ff9500', label: 'fast', priority: 2 },
  mid:     { color: '#39d353', label: 'M', priority: 3 },
  middle:  { color: '#39d353', label: 'mid', priority: 3 },
  m:       { color: '#39d353', label: 'M', priority: 3 },
  i:       { color: '#bc8cff', label: 'i', priority: 4 },
  j:       { color: '#e3b341', label: 'j', priority: 5 },
  k:       { color: '#f85149', label: 'k', priority: 6 },
  curr:    { color: '#bc8cff', label: 'curr', priority: 4 },
  current: { color: '#bc8cff', label: 'cur', priority: 4 },
  prev:    { color: '#e3b341', label: 'prev', priority: 5 },
  head:    { color: '#00e5ff', label: 'head', priority: 1 },
  tail:    { color: '#ff9500', label: 'tail', priority: 2 },
  p:       { color: '#bc8cff', label: 'p', priority: 4 },
  q:       { color: '#e3b341', label: 'q', priority: 5 },
};

export function getPointerStyle(name) {
  return POINTER_STYLES[name] || {
    color: '#8b949e',
    label: name.slice(0, 4),
    priority: 99,
  };
}

/**
 * Extract matrix/2D array data for DP visualization.
 * Accepts 'matrix' and 'dp_table' hints (backend uses dp_table for vars named dp/memo/cache).
 */
export function getMatrix(locals, hints) {
  if (!locals || !hints) return null;

  for (const [name, hint] of Object.entries(hints)) {
    if ((hint === 'matrix' || hint === 'dp_table') && locals[name]) {
      const flat = flattenValue(locals[name]);
      if (Array.isArray(flat) && flat.length > 0 && Array.isArray(flat[0])) {
        return { name, rows: flat };
      }
    }
  }
  return null;
}

/**
 * Find tree node variables (hint === 'tree_node').
 * Returns { name, repr } of the first tree found.
 */
export function getTreeNode(locals, hints) {
  if (!locals || !hints) return null;
  for (const [name, hint] of Object.entries(hints)) {
    if (hint === 'tree_node' && locals[name]) {
      return { name, repr: locals[name] };
    }
  }
  return null;
}

/**
 * Get all string variables from locals.
 * Returns [{ name, value }] for non-empty strings.
 */
export function getStrings(locals) {
  if (!locals) return [];
  return Object.entries(locals)
    .filter(([, repr]) => repr?.type === 'str' && typeof repr?.value === 'string' && repr.value.length > 0)
    .map(([name, repr]) => ({ name, value: repr.value }));
}

/**
 * Build call stack display from trace step.
 */
export function formatCallStack(callStack) {
  if (!callStack || !Array.isArray(callStack)) return [];
  return [...callStack].reverse().map((frame, i) => ({
    ...frame,
    depth: callStack.length - 1 - i,
    isTop: i === 0,
  }));
}

/**
 * Get stdout lines from trace step.
 */
export function getStdout(stepData) {
  return stepData?.stdout || '';
}
