import { render, screen, act } from '@testing-library/react'
import { TaskProvider, useTasks } from '../context/TaskContext'

// Helper component that exposes context values for testing
function TaskInspector({ onRender }) {
  const ctx = useTasks()
  onRender(ctx)
  return null
}

function renderWithProvider(onRender) {
  render(
    <TaskProvider>
      <TaskInspector onRender={onRender} />
    </TaskProvider>
  )
}

describe('TaskContext', () => {

  // ── INITIAL STATE ─────────────────────────────────────
  it('provides initial tasks', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    expect(ctx.tasks).toBeDefined()
    expect(Array.isArray(ctx.tasks)).toBe(true)
    expect(ctx.tasks.length).toBeGreaterThan(0)
  })

  it('initial tasks have required fields', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    ctx.tasks.forEach(task => {
      expect(task).toHaveProperty('id')
      expect(task).toHaveProperty('title')
      expect(task).toHaveProperty('description')
      expect(task).toHaveProperty('dueDate')
      expect(task).toHaveProperty('collaborators')
      expect(task).toHaveProperty('isCompleted')
    })
  })

  // ── addTask ───────────────────────────────────────────
  it('addTask adds a new task', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const before = ctx.tasks.length
    act(() => {
      ctx.addTask({ title: 'New Task', description: 'desc', dueDate: '2026-08-01', collaborators: [] })
    })
    expect(ctx.tasks.length).toBe(before + 1)
  })

  it('addTask sets isCompleted to false', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    act(() => {
      ctx.addTask({ title: 'Test', description: '', dueDate: '2026-08-01', collaborators: [] })
    })
    const added = ctx.tasks.find(t => t.title === 'Test')
    expect(added.isCompleted).toBe(false)
  })

  it('addTask assigns a unique id', async () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    act(() => {
        ctx.addTask({ title: 'Task A', description: '', dueDate: '2026-08-01', collaborators: [] })
    })
    await new Promise(r => setTimeout(r, 2))
    act(() => {
        ctx.addTask({ title: 'Task B', description: '', dueDate: '2026-08-02', collaborators: [] })
    })
    const ids = ctx.tasks.map(t => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
})

  it('addTask preserves collaborators', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    act(() => {
      ctx.addTask({ title: 'Collab Task', description: '', dueDate: '2026-08-01', collaborators: ['Alice', 'Bob'] })
    })
    const added = ctx.tasks.find(t => t.title === 'Collab Task')
    expect(added.collaborators).toEqual(['Alice', 'Bob'])
  })

  // ── updateTask ────────────────────────────────────────
  it('updateTask changes the title of a task', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const target = ctx.tasks[0]
    act(() => {
      ctx.updateTask(target.id, { title: 'Updated Title' })
    })
    const updated = ctx.tasks.find(t => t.id === target.id)
    expect(updated.title).toBe('Updated Title')
  })

  it('updateTask does not affect other tasks', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const target = ctx.tasks[0]
    const other  = ctx.tasks[1]
    act(() => {
      ctx.updateTask(target.id, { title: 'Changed' })
    })
    const otherAfter = ctx.tasks.find(t => t.id === other.id)
    expect(otherAfter.title).toBe(other.title)
  })

  it('updateTask can update multiple fields at once', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const target = ctx.tasks[0]
    act(() => {
      ctx.updateTask(target.id, { title: 'Multi', dueDate: '2099-01-01' })
    })
    const updated = ctx.tasks.find(t => t.id === target.id)
    expect(updated.title).toBe('Multi')
    expect(updated.dueDate).toBe('2099-01-01')
  })

  it('updateTask with unknown id does not change task count', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const before = ctx.tasks.length
    act(() => {
      ctx.updateTask(999999, { title: 'Ghost' })
    })
    expect(ctx.tasks.length).toBe(before)
  })

  // ── deleteTask ────────────────────────────────────────
  it('deleteTask removes the task', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const target = ctx.tasks[0]
    act(() => {
      ctx.deleteTask(target.id)
    })
    expect(ctx.tasks.find(t => t.id === target.id)).toBeUndefined()
  })

  it('deleteTask reduces task count by 1', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const before = ctx.tasks.length
    act(() => {
      ctx.deleteTask(ctx.tasks[0].id)
    })
    expect(ctx.tasks.length).toBe(before - 1)
  })

  it('deleteTask with unknown id does not change tasks', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const before = ctx.tasks.length
    act(() => {
      ctx.deleteTask(999999)
    })
    expect(ctx.tasks.length).toBe(before)
  })

  // ── toggleTaskCompletion ──────────────────────────────
  it('toggleTaskCompletion flips isCompleted from false to true', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const target = ctx.tasks.find(t => !t.isCompleted)
    act(() => {
      ctx.toggleTaskCompletion(target.id)
    })
    expect(ctx.tasks.find(t => t.id === target.id).isCompleted).toBe(true)
  })

  it('toggleTaskCompletion flips isCompleted from true to false', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const target = ctx.tasks.find(t => t.isCompleted)
    act(() => {
      ctx.toggleTaskCompletion(target.id)
    })
    expect(ctx.tasks.find(t => t.id === target.id).isCompleted).toBe(false)
  })

  it('toggleTaskCompletion does not affect other tasks', () => {
    let ctx
    renderWithProvider(c => { ctx = c })
    const target = ctx.tasks[0]
    const other  = ctx.tasks[1]
    const otherBefore = other.isCompleted
    act(() => {
      ctx.toggleTaskCompletion(target.id)
    })
    expect(ctx.tasks.find(t => t.id === other.id).isCompleted).toBe(otherBefore)
  })

  // ── useTasks error ────────────────────────────────────
  it('useTasks throws when used outside TaskProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TaskInspector onRender={() => {}} />)).toThrow()
    spy.mockRestore()
  })
})