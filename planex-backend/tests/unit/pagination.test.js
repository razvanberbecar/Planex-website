// ──────────────────────────────────────────────────────────────
// Unit Tests — Pagination Utility
// ──────────────────────────────────────────────────────────────

// Vitest globals (describe, it, expect) are injected via vitest.config.js globals:true
import { paginate } from '../../src/utils/pagination.js'

const items = Array.from({ length: 10 }, (_, i) => i + 1) // [1..10]

describe('paginate', () => {
  it('defaults to page 1 with limit 5', () => {
    const result = paginate(items)
    expect(result.data).toEqual([1, 2, 3, 4, 5])
    expect(result.meta.currentPage).toBe(1)
    expect(result.meta.totalPages).toBe(2)
    expect(result.meta.totalItems).toBe(10)
    expect(result.meta.limit).toBe(5)
  })

  it('returns page 2', () => {
    const result = paginate(items, 2, 5)
    expect(result.data).toEqual([6, 7, 8, 9, 10])
  })

  it('clamps page below 1 to 1', () => {
    const result = paginate(items, -5, 5)
    expect(result.meta.currentPage).toBe(1)
  })

  it('clamps page above total to last page', () => {
    const result = paginate(items, 999, 5)
    expect(result.meta.currentPage).toBe(2)
  })

  it('clamps limit below 1 to 1', () => {
    const result = paginate(items, 1, -10)
    expect(result.meta.limit).toBe(1)
    expect(result.data).toHaveLength(1)
  })

  it('clamps limit above 100 to 100', () => {
    const result = paginate(items, 1, 999)
    expect(result.meta.limit).toBe(100)
  })

  it('handles NaN page gracefully', () => {
    const result = paginate(items, 'abc', 5)
    expect(result.meta.currentPage).toBe(1)
  })

  it('handles NaN limit gracefully', () => {
    const result = paginate(items, 1, 'abc')
    expect(result.meta.limit).toBe(5)
  })

  it('handles empty array', () => {
    const result = paginate([], 1, 5)
    expect(result.data).toEqual([])
    expect(result.meta.totalPages).toBe(1)
    expect(result.meta.currentPage).toBe(1)
  })
})
