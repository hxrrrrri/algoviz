import React, { useState } from 'react';
import { Sun, Moon, Sparkles, Film } from 'lucide-react';
import useStore from '../../store';
import './Header.css';

const SAMPLES = [
  { label:'Binary Search', code:`def binary_search(arr, target):
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
print(f"Found at index: {result}")` },
  { label:'Bubble Sort', code:`def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

arr = [64, 34, 25, 12, 22, 11, 90]
result = bubble_sort(arr)
print("Sorted:", result)` },
  { label:'Two Pointers', code:`def two_sum(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:
        s = arr[left] + arr[right]
        if s == target:
            return (left, right)
        elif s < target:
            left += 1
        else:
            right -= 1
    return (-1, -1)

arr = [1, 2, 3, 4, 6, 8, 9, 14, 15]
result = two_sum(arr, 13)
print(f"Indices: {result}")` },
  { label:'Fibonacci', code:`def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

for i in range(8):
    result = fib(i)
    print(f"fib({i}) = {result}")` },
  { label:'Selection Sort', code:`def selection_sort(arr):
    n = len(arr)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr

arr = [29, 10, 14, 37, 13]
print(selection_sort(arr))` },
  { label:'Merge Sort', code:`def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    result.extend(left[i:]); result.extend(right[j:])
    return result

arr = [38, 27, 43, 3, 9, 82, 10]
print(merge_sort(arr))` },
  { label:'Linear Search', code:`def linear_search(arr, target):
    for i in range(len(arr)):
        if arr[i] == target:
            return i
    return -1

arr = [4, 2, 7, 1, 9, 3, 8, 5]
result = linear_search(arr, 9)
print(f"Found at index: {result}")` },
  { label:'DP: LCS', code:`def lcs(s1, s2):
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i-1] == s2[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]

s1 = "ABCBDAB"
s2 = "BDCAB"
print(f"LCS length: {lcs(s1, s2)}")` },
];

export default function Header() {
  const [samplesOpen, setSamplesOpen] = useState(false);
  const setCode        = useStore(s => s.setCode);
  const resetExecution = useStore(s => s.resetExecution);
  const theme          = useStore(s => s.theme);
  const mode           = useStore(s => s.mode);
  const toggleMode     = useStore(s => s.toggleMode);
  const toggleTheme    = useStore(s => s.toggleTheme);

  const load = (sample) => { setCode(sample.code); resetExecution(); setSamplesOpen(false); };

  return (
    <header className="hdr">
      {/* Brand */}
      <div className="hdr-brand">
        <div className="hdr-logo">
          <svg className="logo-svg" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)"/>
                <stop offset="100%" stopColor="var(--accent-2)"/>
              </linearGradient>
            </defs>
            <path d="M18 2 L32 10 L32 26 L18 34 L4 26 L4 10 Z"
                  stroke="url(#lg1)" strokeWidth="1.5" fill="var(--accent-dim)"/>
            <path d="M12 14 L7 18 L12 22" stroke="var(--accent)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 14 L29 18 L24 22" stroke="var(--accent-2)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="18" cy="18" r="2" fill="var(--accent-4)"/>
          </svg>
          <span className="logo-name">Code-Viz</span>
        </div>
        <span className="hdr-tagline">Algorithm Intelligence Studio</span>
      </div>

      {/* Controls */}
      <div className="hdr-controls">
        {/* Theme toggle: Glass ↔ Noir */}
        <div className="toggle-group" title={theme === 'glass' ? 'Switch to Noir theme' : 'Switch to Glass theme'}>
          <button
            className={`theme-toggle-btn ${theme === 'glass' ? 'active' : ''}`}
            onClick={() => theme !== 'glass' && toggleTheme()}
          >
            <Sparkles size={12} />
            Glass
          </button>
          <button
            className={`theme-toggle-btn ${theme === 'noir' ? 'active' : ''}`}
            onClick={() => theme !== 'noir' && toggleTheme()}
          >
            <Film size={12} />
            Noir
          </button>
        </div>

        {/* Mode toggle: Dark ↔ Light */}
        <button className="mode-btn" onClick={toggleMode}
          title={mode === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}>
          {mode === 'dark'
            ? <><Sun size={14}/><span>Light</span></>
            : <><Moon size={14}/><span>Dark</span></>}
        </button>

        {/* Samples */}
        <div className="samples-wrap">
          <button className="samples-btn" onClick={() => setSamplesOpen(v => !v)}>
            Examples
            <span className="caret">{samplesOpen ? '▴' : '▾'}</span>
          </button>
          {samplesOpen && (
            <>
              <div className="samples-overlay" onClick={() => setSamplesOpen(false)} />
              <div className="samples-menu">
                <div className="samples-head">Choose an Algorithm</div>
                {SAMPLES.map(s => (
                  <button key={s.label} className="sample-row" onClick={() => load(s)}>
                    <span className="sample-dot" />
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="hdr-badge">Python 3</div>
      </div>
    </header>
  );
}
