import React, { useState } from 'react';
import useStore from '../../store';
import './Header.css';

const SAMPLES = [
  { label: 'Binary Search', code: `def binary_search(arr, target):
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
  { label: 'Bubble Sort', code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

arr = [64, 34, 25, 12, 22, 11, 90]
result = bubble_sort(arr)
print("Sorted:", result)` },
  { label: 'Two Pointers', code: `def two_sum(arr, target):
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
  { label: 'Fibonacci', code: `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

for i in range(8):
    result = fib(i)
    print(f"fib({i}) = {result}")` },
  { label: 'Selection Sort', code: `def selection_sort(arr):
    n = len(arr)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr

arr = [29, 10, 14, 37, 13]
result = selection_sort(arr)
print("Sorted:", result)` },
  { label: 'Linear Search', code: `def linear_search(arr, target):
    for i in range(len(arr)):
        if arr[i] == target:
            return i
    return -1

arr = [4, 2, 7, 1, 9, 3, 8, 5]
result = linear_search(arr, 9)
print(f"Found at index: {result}")` },
  { label: 'Merge Sort', code: `def merge_sort(arr):
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
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result

arr = [38, 27, 43, 3, 9, 82, 10]
sorted_arr = merge_sort(arr)
print("Sorted:", sorted_arr)` },
  { label: 'DP: LCS', code: `def lcs(s1, s2):
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
result = lcs(s1, s2)
print(f"LCS length: {result}")` },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const setCode = useStore(s => s.setCode);
  const resetExecution = useStore(s => s.resetExecution);

  return (
    <header className="hdr">
      <div className="hdr-brand">
        <div className="hdr-logo">
          <div className="logo-gem">◈</div>
          <span className="logo-text">AlgoViz</span>
        </div>
        <span className="hdr-sub">Algorithm Intelligence Studio</span>
      </div>

      <div className="hdr-right">
        <div className="samples-wrap">
          <button className="btn-samples" onClick={() => setOpen(v => !v)}>
            <span>Examples</span>
            <span className="caret">{open ? '▴' : '▾'}</span>
          </button>
          {open && (
            <div className="samples-menu">
              <div className="samples-title">Select Algorithm</div>
              {SAMPLES.map(s => (
                <button key={s.label} className="sample-row"
                  onClick={() => { setCode(s.code); resetExecution(); setOpen(false); }}>
                  <span className="sample-gem">◆</span>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="hdr-badge">Python 3.x</div>
      </div>
    </header>
  );
}
