/**
 * Heuristic time/space complexity analyzer for Python code.
 * Uses pattern matching — not a formal AST analysis.
 */

// ── Named algorithm patterns ──────────────────────────────────────────────────
const NAMED_ALGORITHMS = [
  // Sorting
  { match: /\bbubble[_\s]?sort\b/i,     time: 'O(n²)',        space: 'O(1)',        label: 'Bubble Sort' },
  { match: /\bselection[_\s]?sort\b/i,  time: 'O(n²)',        space: 'O(1)',        label: 'Selection Sort' },
  { match: /\binsertion[_\s]?sort\b/i,  time: 'O(n²)',        space: 'O(1)',        label: 'Insertion Sort' },
  { match: /\bmerge[_\s]?sort\b/i,      time: 'O(n log n)',   space: 'O(n)',        label: 'Merge Sort' },
  { match: /\bquick[_\s]?sort\b/i,      time: 'O(n log n)',   space: 'O(log n)',    label: 'Quick Sort' },
  { match: /\bheap[_\s]?sort\b/i,       time: 'O(n log n)',   space: 'O(1)',        label: 'Heap Sort' },
  { match: /\btim[_\s]?sort\b/i,        time: 'O(n log n)',   space: 'O(n)',        label: 'Tim Sort' },
  { match: /\bcounting[_\s]?sort\b/i,   time: 'O(n + k)',     space: 'O(k)',        label: 'Counting Sort' },
  { match: /\bradix[_\s]?sort\b/i,      time: 'O(nk)',        space: 'O(n + k)',    label: 'Radix Sort' },
  { match: /\bbucket[_\s]?sort\b/i,     time: 'O(n)',         space: 'O(n)',        label: 'Bucket Sort' },
  // Search
  { match: /\bbinary[_\s]?search\b/i,   time: 'O(log n)',     space: 'O(1)',        label: 'Binary Search' },
  { match: /\bbisect\b/i,               time: 'O(log n)',     space: 'O(1)',        label: 'Binary Search' },
  { match: /\blinear[_\s]?search\b/i,   time: 'O(n)',         space: 'O(1)',        label: 'Linear Search' },
  // Graph
  { match: /\bbfs\b|\bbreadth[_\s]?first\b/i,  time: 'O(V + E)', space: 'O(V)',  label: 'BFS' },
  { match: /\bdfs\b|\bdepth[_\s]?first\b/i,    time: 'O(V + E)', space: 'O(V)',  label: 'DFS' },
  { match: /\bdijkstra\b/i,             time: 'O((V+E) log V)', space: 'O(V)',   label: "Dijkstra's" },
  { match: /\bbellman[_\s]?ford\b/i,    time: 'O(VE)',        space: 'O(V)',        label: 'Bellman–Ford' },
  { match: /\bfloyd[_\s]?warshall\b/i,  time: 'O(n³)',        space: 'O(n²)',       label: 'Floyd–Warshall' },
  { match: /\bkruskal\b/i,              time: 'O(E log V)',   space: 'O(V)',        label: "Kruskal's" },
  { match: /\bprim\b/i,                 time: 'O(E log V)',   space: 'O(V)',        label: "Prim's" },
  { match: /\btopological[_\s]?sort\b/i, time: 'O(V + E)',   space: 'O(V)',        label: 'Topological Sort' },
  // DP classics
  { match: /\bknapsack\b/i,             time: 'O(nW)',        space: 'O(nW)',       label: 'Knapsack' },
  { match: /\blis\b|longest[_\s]?increasing[_\s]?sub/i, time: 'O(n²)', space: 'O(n)', label: 'LIS' },
  { match: /\blcs\b|longest[_\s]?common[_\s]?sub/i,     time: 'O(nm)', space: 'O(nm)', label: 'LCS' },
  { match: /\bedit[_\s]?distance\b|\blevenshtein\b/i,   time: 'O(nm)', space: 'O(nm)', label: 'Edit Distance' },
  { match: /\bcoin[_\s]?change\b/i,     time: 'O(nk)',        space: 'O(n)',        label: 'Coin Change' },
  // Math / misc
  { match: /\bsieve[_\s]?(of[_\s]?eratosthenes)?\b/i, time: 'O(n log log n)', space: 'O(n)', label: 'Sieve of Eratosthenes' },
  { match: /\bgcd\b|\bgreatest[_\s]?common\b/i,        time: 'O(log n)',       space: 'O(1)', label: 'GCD (Euclidean)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count maximum nesting depth of for/while loops. */
function maxLoopDepth(code) {
  const lines = code.split('\n');
  let maxDepth = 0;
  const loopIndents = []; // stack of indentation levels

  for (const rawLine of lines) {
    const trimmed = rawLine.trimStart();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = rawLine.length - trimmed.length;

    // Pop any loops that were at this indent or deeper (we've exited them)
    while (loopIndents.length && indent <= loopIndents[loopIndents.length - 1]) {
      loopIndents.pop();
    }

    if (/^(for|while)\s/.test(trimmed)) {
      loopIndents.push(indent);
      maxDepth = Math.max(maxDepth, loopIndents.length);
    }
  }
  return maxDepth;
}

/** Detect recursion and its shape. Returns 'none'|'linear'|'halving'|'branching' */
function detectRecursion(code) {
  // Find all function definitions and their self-calls
  const fnDefRe = /^def\s+(\w+)\s*\(/gm;
  let match;
  const functions = [];
  while ((match = fnDefRe.exec(code)) !== null) {
    functions.push(match[1]);
  }

  for (const fn of functions) {
    // Count how many times fn calls itself in its body
    const selfCallRe = new RegExp(`\\b${fn}\\s*\\(`, 'g');
    // Find function body (lines with deeper indent after def)
    const defIdx = code.indexOf(`def ${fn}`);
    if (defIdx === -1) continue;
    const body = code.slice(defIdx);
    const calls = (body.match(selfCallRe) || []).length - 1; // -1 for the def itself (no, the def line doesn't have the call pattern)

    if (calls <= 0) continue; // not recursive

    // Check for divide-and-conquer (n//2, n/2, mid, len//2)
    const halvingPattern = /\bn\s*\/\/\s*2\b|\blen\(.*\)\s*\/\/\s*2\b|\bmid\b|\bright\s*-\s*left\b/i;
    if (halvingPattern.test(body) && calls === 1) return 'halving';

    // Multiple recursive calls without halving = branching
    if (calls >= 2) return 'branching';

    // Single linear recursion
    return 'linear';
  }
  return 'none';
}

/** Detect if memoization is used (lru_cache, cache, memo dict, visited set). */
function hasMemoization(code) {
  return /\blru_cache\b|\bcache\b|\bmemo\b|\b@cache\b|visited\s*=\s*(set|dict|\{)/i.test(code);
}

/** Space complexity from loop/data structure usage. */
function inferSpaceComplexity(code, loopDepth, recursion) {
  // Explicit large data structures
  if (/\[\s*\[\s*/.test(code) && loopDepth >= 2) return 'O(n²)'; // 2D DP / matrix
  if (/\[\s*None\s*\]\s*\*/.test(code) || /\[\s*0\s*\]\s*\*/.test(code)) return 'O(n)'; // dp array
  if (recursion === 'branching') return 'O(n)'; // call stack
  if (recursion === 'halving') return 'O(log n)'; // log n stack frames
  if (recursion === 'linear') return 'O(n)';
  if (loopDepth >= 2 && /\[\s*\[/.test(code)) return 'O(n²)';
  return 'O(1)';
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {string} code - Python source code
 * @returns {{ time: string, space: string, label: string, confidence: 'high'|'medium'|'low' } | null}
 */
export function analyzeComplexity(code) {
  if (!code || !code.trim()) return null;

  // 1. Named algorithm match (highest confidence)
  for (const algo of NAMED_ALGORITHMS) {
    if (algo.match.test(code)) {
      return { time: algo.time, space: algo.space, label: algo.label, confidence: 'high' };
    }
  }

  // 2. Fibonacci special case
  if (/\bfib(onacci)?\b/i.test(code)) {
    if (hasMemoization(code)) {
      return { time: 'O(n)', space: 'O(n)', label: 'Fibonacci (memoized)', confidence: 'high' };
    }
    const rec = detectRecursion(code);
    if (rec === 'branching') {
      return { time: 'O(2ⁿ)', space: 'O(n)', label: 'Fibonacci (naive)', confidence: 'high' };
    }
    return { time: 'O(n)', space: 'O(1)', label: 'Fibonacci (iterative)', confidence: 'high' };
  }

  // 3. Factorial
  if (/\bfactorial\b/i.test(code)) {
    return { time: 'O(n)', space: detectRecursion(code) !== 'none' ? 'O(n)' : 'O(1)', label: 'Factorial', confidence: 'high' };
  }

  // 4. Heuristic: loops + recursion
  const loopDepth = maxLoopDepth(code);
  const recursion = detectRecursion(code);

  // Recursion shapes
  if (recursion === 'branching' && !hasMemoization(code)) {
    const space = 'O(n)';
    return { time: 'O(2ⁿ)', space, label: 'Recursive (branching)', confidence: 'medium' };
  }
  if (recursion === 'branching' && hasMemoization(code)) {
    return { time: 'O(n)', space: 'O(n)', label: 'Memoized Recursion', confidence: 'medium' };
  }
  if (recursion === 'halving') {
    const space = loopDepth > 0 ? 'O(n)' : 'O(log n)';
    return { time: loopDepth > 0 ? 'O(n log n)' : 'O(log n)', space, label: loopDepth > 0 ? 'Divide & Conquer' : 'Divide & Conquer', confidence: 'medium' };
  }
  if (recursion === 'linear' && loopDepth >= 1) {
    const space = inferSpaceComplexity(code, loopDepth, recursion);
    return { time: 'O(n²)', space, label: 'Recursive + Loop', confidence: 'medium' };
  }
  if (recursion === 'linear') {
    return { time: 'O(n)', space: 'O(n)', label: 'Linear Recursion', confidence: 'medium' };
  }

  // Loop depth
  if (loopDepth === 0) {
    // Pure computation, no loops
    return { time: 'O(1)', space: 'O(1)', label: 'Constant', confidence: 'low' };
  }
  if (loopDepth === 1) {
    const space = inferSpaceComplexity(code, 1, 'none');
    return { time: 'O(n)', space, label: 'Linear', confidence: 'medium' };
  }
  if (loopDepth === 2) {
    const space = inferSpaceComplexity(code, 2, 'none');
    return { time: 'O(n²)', space, label: 'Quadratic', confidence: 'medium' };
  }
  if (loopDepth === 3) {
    return { time: 'O(n³)', space: 'O(1)', label: 'Cubic', confidence: 'low' };
  }

  return { time: `O(n^${loopDepth})`, space: 'O(1)', label: 'Polynomial', confidence: 'low' };
}

/** Color class for the complexity badge based on time complexity. */
export function complexityColor(time) {
  if (!time) return 'cx-unknown';
  if (time.includes('1'))           return 'cx-o1';
  if (time.includes('log n') && !time.includes('n log')) return 'cx-ologn';
  if (time === 'O(n)' || time.includes('n)'))            return 'cx-on';
  if (time.includes('n log n') || time.includes('E log')) return 'cx-onlogn';
  if (time.includes('n²') || time.includes('n^2') || time.includes('nm') || time.includes('nW')) return 'cx-on2';
  if (time.includes('n³') || time.includes('n^3'))       return 'cx-on3';
  if (time.includes('2ⁿ') || time.includes('2^n'))       return 'cx-exp';
  if (time.includes('V + E') || time.includes('V+E'))    return 'cx-graph';
  return 'cx-unknown';
}