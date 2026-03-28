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
      {/* Shine line */}
      <div className="hdr-shine" />

      {/* Brand */}
      <div className="hdr-brand">
        <div className="hdr-logo" onClick={() => window.location.reload()} title="Code-Viz — reload" style={{ cursor: 'pointer' }}>
          {/* Premium glass logo icon */}
          <svg className="logo-svg" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="glassBody" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.16)"/>
                <stop offset="100%" stopColor="rgba(255,255,255,0.03)"/>
              </linearGradient>
              <linearGradient id="topShine" x1="25%" y1="0%" x2="75%" y2="65%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.50)"/>
                <stop offset="100%" stopColor="rgba(255,255,255,0.00)"/>
              </linearGradient>
              <linearGradient id="bracketL" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="1"/>
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.65"/>
              </linearGradient>
              <linearGradient id="bracketR" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="1"/>
                <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.65"/>
              </linearGradient>
              <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Frosted glass body */}
            <rect x="2" y="2" width="34" height="34" rx="10"
                  fill="url(#glassBody)"
                  stroke="rgba(255,255,255,0.18)" strokeWidth="0.75"/>

            {/* Top-left surface reflection */}
            <rect x="2" y="2" width="34" height="16" rx="10"
                  fill="url(#topShine)" opacity="0.55"/>

            {/* Inner edge highlight (bottom) */}
            <rect x="3.5" y="32" width="31" height="1"
                  rx="0.5" fill="rgba(0,0,0,0.25)"/>

            {/* Left code bracket */}
            <path d="M14 12.5 L9 19 L14 25.5"
                  stroke="url(#bracketL)" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"
                  filter="url(#softGlow)"/>

            {/* Right code bracket */}
            <path d="M24 12.5 L29 19 L24 25.5"
                  stroke="url(#bracketR)" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"
                  filter="url(#softGlow)"/>

            {/* Centre dot — accent jewel */}
            <circle cx="19" cy="19" r="2.5" fill="var(--accent-4)" opacity="0.92"/>
            <circle cx="19" cy="18.2" r="1" fill="rgba(255,255,255,0.5)" opacity="0.8"/>
          </svg>

          <div className="logo-wordmark">
            <span className="logo-name">Code<span className="logo-sep">·</span>Viz</span>
          </div>
        </div>
        <span className="hdr-tagline">Algorithm Intelligence Studio</span>
      </div>

      {/* Controls */}
      <div className="hdr-controls">
        {/* Theme toggle */}
        <div className="toggle-group" title={theme === 'glass' ? 'Switch to Noir' : 'Switch to Glass'}>
          <button
            className={`theme-toggle-btn ${theme === 'glass' ? 'active' : ''}`}
            onClick={() => theme !== 'glass' && toggleTheme()}
          >
            <Sparkles size={11} />
            Glass
          </button>
          <button
            className={`theme-toggle-btn ${theme === 'noir' ? 'active' : ''}`}
            onClick={() => theme !== 'noir' && toggleTheme()}
          >
            <Film size={11} />
            Noir
          </button>
        </div>

        {/* Light / Dark */}
        <button className="mode-btn" onClick={toggleMode}
          title={mode === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
          {mode === 'dark'
            ? <><Sun size={13}/><span>Light</span></>
            : <><Moon size={13}/><span>Dark</span></>}
        </button>

        {/* Examples */}
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