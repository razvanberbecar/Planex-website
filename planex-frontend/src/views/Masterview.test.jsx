import { render, screen, fireEvent } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import MasterView from './MasterView'
import { TaskProvider } from '../context/TaskContext'
import { AuthContext } from '../context/AuthContext'

// ── Test data ──────────────────────────────────────────────
const MOCK_TASKS = [
  { id: 1, title: 'task 1', description: 'desc 1', dueDate: '2026-06-30', collaborators: ['user1'], isCompleted: false, priority: 'High' },
  { id: 2, title: 'task 2', description: 'desc 2', dueDate: '2026-07-15', collaborators: [], isCompleted: true, priority: 'Low' },
  { id: 3, title: 'task 3', description: 'desc 3', dueDate: '2027-01-01', collaborators: ['user1', 'user2'], isCompleted: false, priority: 'Medium' },
  { id: 4, title: 'task 4', description: 'desc 4', dueDate: '2027-02-01', collaborators: ['user5'], isCompleted: true, priority: 'Low' },
  { id: 5, title: 'task 5', description: 'desc 5', dueDate: '2026-12-01', collaborators: [], isCompleted: false, priority: 'Medium' },
]

const mockAuthValue = {
  user: {
    UserId: 1,
    Name: 'Razvan Berbecar',
    Email: 'razvan@test.com',
    RoleId: 1,
    role: { Name: 'user' },
  },
  loading: false,
  login:   async () => {},
  register: async () => {},
  logout:  () => {},
  isAdmin: false,
}

function mockFetchResponse(data, status = 200) {
  const body = JSON.stringify(data)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => body,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    statusText: status === 200 ? 'OK' : 'Error',
  }
}

function renderMasterView() {
  localStorage.setItem('planex_userId', '1')
  // Mock window.fetch so api.js calls go through our mock
  window.fetch = vi.fn().mockResolvedValue(
    mockFetchResponse({ data: MOCK_TASKS, totalPages: 2, total: 5 })
  )
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <AuthContext.Provider value={mockAuthValue}>
          <TaskProvider>
            <MasterView />
          </TaskProvider>
        </AuthContext.Provider>
      ),
    },
    { path: '/tasks/new', element: <div /> },
    { path: '/tasks/:id', element: <div /> },
    { path: '/statistics', element: <div /> },
  ], { initialEntries: ['/'] })

  render(<RouterProvider router={router} />)
  return router
}

describe('MasterView', () => {

  // ── RENDERS ───────────────────────────────────────────
  it('renders the Active Tasks heading by default', () => {
    renderMasterView()
    expect(screen.getByText('Active Tasks')).toBeInTheDocument()
  })

  it('renders the user name in the sidebar', () => {
    renderMasterView()
    expect(screen.getByText('Razvan Berbecar')).toBeInTheDocument()
  })

  it('renders Due Date column header', () => {
    renderMasterView()
    const headers = screen.getAllByText(/Due Date/i)
    expect(headers.length).toBeGreaterThan(0)
  })

  it('renders Collaborative column header in the table', () => {
    renderMasterView()
    const items = screen.getAllByText('Collaborative')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('renders tasks from context', async () => {
    renderMasterView()
    expect(await screen.findByText('task 1')).toBeInTheDocument()
  })

  it('renders pagination controls', async () => {
    renderMasterView()
    await screen.findByText('1 / 2')
    expect(screen.getByText('<')).toBeInTheDocument()
    expect(screen.getByText('>')).toBeInTheDocument()
  })

  it('renders page number', async () => {
    renderMasterView()
    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
  })

  // ── FILTERING ─────────────────────────────────────────
  it('switches to Completed Tasks when Completed is clicked', () => {
    renderMasterView()
    fireEvent.click(screen.getByText('Completed'))
    expect(screen.getByText('Completed Tasks')).toBeInTheDocument()
  })

  it('switches to Collaborative Tasks when Collaborative sidebar button is clicked', () => {
    renderMasterView()
    const buttons = screen.getAllByRole('button')
    const collabBtn = buttons.find(btn => btn.textContent.includes('Collaborative'))
    fireEvent.click(collabBtn)
    expect(screen.getByText('Collaborative Tasks')).toBeInTheDocument()
  })

  it('switches back to Active Tasks when Active is clicked', () => {
    renderMasterView()
    fireEvent.click(screen.getByText('Completed'))
    fireEvent.click(screen.getByText('Active'))
    expect(screen.getByText('Active Tasks')).toBeInTheDocument()
  })

  it('shows completed tasks when Completed filter is active', async () => {
    renderMasterView()
    fireEvent.click(screen.getByText('Completed'))
    expect(await screen.findByText('task 2')).toBeInTheDocument()
  })

  it('shows collaborative tasks when Collaborative filter is active', async () => {
    renderMasterView()
    const buttons = screen.getAllByRole('button')
    const collabBtn = buttons.find(btn => btn.textContent.includes('Collaborative'))
    fireEvent.click(collabBtn)
    expect(await screen.findByText('task 1')).toBeInTheDocument()
  })

  // ── NAVIGATION ────────────────────────────────────────
  it('navigates to /tasks/new when Add Task is clicked', () => {
    const router = renderMasterView()
    fireEvent.click(screen.getByText('Add Task'))
    expect(router.state.location.pathname).toBe('/tasks/new')
  })

  it('navigates to / when Logout is clicked', () => {
    const router = renderMasterView()
    const logoutBtn = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(logoutBtn)
    expect(router.state.location.pathname).toBe('/')
  })

  it('navigates to task detail when a row is clicked', async () => {
    const router = renderMasterView()
    await screen.findByText('task 1')
    fireEvent.click(screen.getByText('task 1'))
    expect(router.state.location.pathname).toMatch(/\/tasks\//)
  })

  // ── PAGINATION ────────────────────────────────────────
  it('prev button is disabled on first page', async () => {
    renderMasterView()
    await screen.findByText('1 / 2')
    const prevBtn = screen.getByText('<')
    expect(prevBtn).toBeDisabled()
  })

  it('resets to page 1 when filter changes', async () => {
    renderMasterView()
    await screen.findByText('1 / 2')
    fireEvent.click(screen.getByText('Completed'))
    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
  })
})
