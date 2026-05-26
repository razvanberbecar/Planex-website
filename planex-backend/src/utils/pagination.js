
/**
 * Paginate an array.
 * @param {Array}  items  – full list
 * @param {number} page   – 1-indexed page number
 * @param {number} limit  – items per page (capped at 100)
 * @returns {{ data: Array, meta: object }}
 */
export function paginate(items, page = 1, limit = 5) {
  const safePage  = Math.max(1, Math.floor(Number(page) || 1))
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 5)))

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit))
  const currentPage = Math.min(safePage, totalPages)

  const start = (currentPage - 1) * safeLimit
  const data  = items.slice(start, start + safeLimit)

  return {
    data,
    meta: {
      currentPage,
      totalPages,
      totalItems,
      limit: safeLimit,
    },
  }
}
