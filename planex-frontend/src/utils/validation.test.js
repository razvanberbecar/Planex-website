import { validateTask } from './validation'

describe('validateTask', () => {

  it('returns no errors for valid input', () => {
    const errors = validateTask({ title: 'Buy milk', dueDate: '2026-06-01' })
    expect(errors).toEqual({})
  })

  it('accepts extra fields without errors', () => {
    const errors = validateTask({
      title: 'Buy milk',
      dueDate: '2026-06-01',
      description: 'some text',
      collaborators: 'Alice',
    })
    expect(errors).toEqual({})
  })

  // ── TITLE VALIDATION ──────────────────────────────────
  it('errors when title is missing', () => {
    const errors = validateTask({ title: '', dueDate: '2026-06-01' })
    expect(errors.title).toBe('Task name is required.')
  })

  it('errors when title is only whitespace', () => {
    const errors = validateTask({ title: '   ', dueDate: '2026-06-01' })
    expect(errors.title).toBe('Task name is required.')
  })

  it('errors when title is undefined', () => {
    const errors = validateTask({ dueDate: '2026-06-01' })
    expect(errors.title).toBe('Task name is required.')
  })

  // ── DUE DATE VALIDATION ───────────────────────────────
  it('errors when dueDate is missing', () => {
    const errors = validateTask({ title: 'Buy milk', dueDate: '' })
    expect(errors.dueDate).toBe('Due date is required.')
  })

  it('errors when dueDate is undefined', () => {
    const errors = validateTask({ title: 'Buy milk' })
    expect(errors.dueDate).toBe('Due date is required.')
  })

  it('errors when dueDate is not a valid date', () => {
    const errors = validateTask({ title: 'Buy milk', dueDate: 'not-a-date' })
    expect(errors.dueDate).toBe('Due date must be a valid date (YYYY-MM-DD).')
  })

  it('errors when dueDate is a random string', () => {
    const errors = validateTask({ title: 'Buy milk', dueDate: 'hello world' })
    expect(errors.dueDate).toBe('Due date must be a valid date (YYYY-MM-DD).')
  })

  // ── MULTIPLE ERRORS ───────────────────────────────────
  it('returns both errors when both fields are missing', () => {
    const errors = validateTask({ title: '', dueDate: '' })
    expect(errors.title).toBeDefined()
    expect(errors.dueDate).toBeDefined()
  })

  // ── NO EXTRA ERRORS ───────────────────────────────────
  it('does not add unexpected error keys', () => {
    const errors = validateTask({ title: 'Task', dueDate: '2026-01-01' })
    expect(Object.keys(errors)).toHaveLength(0)
  })
})