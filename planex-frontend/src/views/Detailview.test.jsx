import { render, screen, fireEvent } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import DetailView from './DetailView'
import { TaskProvider } from '../context/TaskContext'
import { AuthContext } from '../context/AuthContext'

// ── Test data ──────────────────────────────────────────────
const MOCK_TASK = {
  id: 1,
  title: 'task 1',
  description: 'description for task 1',
  dueDate: '2026-06-30',
  collaborators: ['user1'],
  isCompleted: false,
  priority: 'High',
  createdBy: 1,
  subtasks: [],
}

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

function renderDetail(id) {
  localStorage.setItem('planex_userId', '1')
  const router = createMemoryRouter([
    {
      path: '/tasks/:id',
      element: (
        <AuthContext.Provider value={mockAuthValue}>
          <TaskProvider>
            <DetailView />
          </TaskProvider>
        </AuthContext.Provider>
      ),
    },
    { path: '/tasks',     element: <div /> },
    { path: '/',          element: <div /> },
    { path: '/statistics', element: <div /> },
  ], { initialEntries: [`/tasks/${id}`] })

  render(<RouterProvider router={router} />)
  return router
}

function getSubmitButton() {
  const buttons = screen.getAllByRole('button')
  return buttons[buttons.length - 1]
}

function getLogoutButton() {
  return screen.getByRole('button', { name: /logout/i })
}

describe('DetailView — View mode', () => {

  beforeEach(() => {
    window.fetch = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(MOCK_TASK))  // fetchTask(id)
      .mockResolvedValue(mockFetchResponse([]))              // SubtaskPanel apiFetch
  })

  it('renders the task title', async () => {
    renderDetail(1)
    expect(await screen.findByText('task 1')).toBeInTheDocument()
  })

  it('renders the due date', async () => {
    renderDetail(1)
    expect(await screen.findByText(/2026-06-30/)).toBeInTheDocument()
  })

  it('renders the description', async () => {
    renderDetail(1)
    expect(await screen.findByText(/description for task 1/i)).toBeInTheDocument()
  })

  it('renders the Collaborators section heading', async () => {
    renderDetail(1)
    expect(await screen.findByText('Collaborators')).toBeInTheDocument()
  })

  it('renders Edit Task button', async () => {
    renderDetail(1)
    expect(await screen.findByRole('button', { name: /edit task/i })).toBeInTheDocument()
  })

  it('renders Remove Task button', async () => {
    renderDetail(1)
    expect(await screen.findByRole('button', { name: /remove task/i })).toBeInTheDocument()
  })

  it('shows Not found message for unknown id', async () => {
    window.fetch = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse({ error: 'Not found' }, 404))  // fetchTask fails
      .mockResolvedValue(mockFetchResponse([]))                                // SubtaskPanel apiFetch
    renderDetail(99999)
    expect(await screen.findByText(/Task not found/i)).toBeInTheDocument()
  })

  it('navigates to / when logout is clicked', async () => {
    const router = renderDetail(1)
    await screen.findByText('task 1')
    fireEvent.click(getLogoutButton())
    // Flush microtasks so the async onLogout handler completes and calls navigate('/')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(router.state.location.pathname).toBe('/')
  })

  it('switches to edit mode when Edit Task is clicked', async () => {
    renderDetail(1)
    await screen.findByRole('button', { name: /edit task/i })
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }))
    expect(screen.getByRole('heading', { name: /edit task/i })).toBeInTheDocument()
  })

  it('removes task and navigates to /tasks when Remove Task is clicked', async () => {
    window.fetch = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(MOCK_TASK))       // fetchTask
      .mockResolvedValueOnce(mockFetchResponse([]))               // SubtaskPanel apiFetch (mounts before click)
      .mockResolvedValueOnce(mockFetchResponse(null, 204))        // deleteTask → 204
      .mockResolvedValue(mockFetchResponse([]))                   // fallback
    const router = renderDetail(1)
    await screen.findByRole('button', { name: /remove task/i })
    fireEvent.click(screen.getByRole('button', { name: /remove task/i }))
    // handleDelete is async; flush microtasks so navigate('/tasks') runs
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(router.state.location.pathname).toBe('/tasks')
  })

  it('toggles task completion when checkbox is clicked', async () => {
    window.fetch = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(MOCK_TASK))       // fetchTask
      .mockResolvedValueOnce(mockFetchResponse([]))               // SubtaskPanel apiFetch (mounts before click)
      .mockResolvedValueOnce(mockFetchResponse({ ...MOCK_TASK, isCompleted: true })) // updateTask
      .mockResolvedValue(mockFetchResponse([]))                   // fallback
    renderDetail(1)
    await screen.findByTitle('Toggle completion')
    const checkbox = screen.getByTitle('Toggle completion')
    fireEvent.click(checkbox)
    // handleToggle is async; findByText polls until React re-renders with ✓
    expect(await screen.findByText('✓')).toBeInTheDocument()
  })

  it('renders sidebar navigation buttons', async () => {
    renderDetail(1)
    expect(await screen.findByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })
})

describe('DetailView — Add mode', () => {

  it('renders New Task heading', () => {
    renderDetail('new')
    expect(screen.getByRole('heading', { name: /new task/i })).toBeInTheDocument()
  })

  it('renders Name input', () => {
    renderDetail('new')
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
  })

  it('renders Description textarea', () => {
    renderDetail('new')
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument()
  })

  it('renders Due Date input', () => {
    renderDetail('new')
    expect(screen.getByPlaceholderText('Due Date (YYYY-MM-DD)')).toBeInTheDocument()
  })

  it('renders Collaborators input', () => {
    renderDetail('new')
    const input = screen.getByPlaceholderText(/Search collaborators by name/i)
    expect(input).toBeInTheDocument()
  })

  it('renders the Add Task submit button', () => {
    renderDetail('new')
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it('shows validation error when title is empty on submit', () => {
    renderDetail('new')
    fireEvent.click(getSubmitButton())
    expect(screen.getByText('Task name is required.')).toBeInTheDocument()
  })

  it('shows validation error when date is empty on submit', () => {
    renderDetail('new')
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Test' } })
    fireEvent.click(getSubmitButton())
    expect(screen.getByText('Due date is required.')).toBeInTheDocument()
  })

  it('shows validation error when date is invalid', () => {
    renderDetail('new')
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('Due Date (YYYY-MM-DD)'), { target: { value: 'bad-date' } })
    fireEvent.click(getSubmitButton())
    expect(screen.getByText('Due date must be a valid date (YYYY-MM-DD).')).toBeInTheDocument()
  })

  it('navigates to /tasks after successful add', async () => {
    window.fetch = vi.fn().mockResolvedValue(mockFetchResponse({ id: 99 }))
    const router = renderDetail('new')
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'New Task' } })
    fireEvent.change(screen.getByPlaceholderText('Due Date (YYYY-MM-DD)'), { target: { value: '2026-09-01' } })
    fireEvent.click(getSubmitButton())
    // handleSubmit is async; flush microtasks so navigate('/tasks') runs
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(router.state.location.pathname).toBe('/tasks')
  })

  it('clears title error when user starts typing', () => {
    renderDetail('new')
    fireEvent.click(getSubmitButton())
    expect(screen.getByText('Task name is required.')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'T' } })
    expect(screen.queryByText('Task name is required.')).not.toBeInTheDocument()
  })

  it('navigates to / when logout clicked in add mode', async () => {
    const router = renderDetail('new')
    fireEvent.click(getLogoutButton())
    // Flush microtasks so the async onLogout handler completes and calls navigate('/')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('DetailView — Edit mode', () => {

  beforeEach(() => {
    window.fetch = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(MOCK_TASK))  // fetchTask(id)
      .mockResolvedValue(mockFetchResponse([]))              // SubtaskPanel apiFetch
  })

  it('pre-fills the title field with existing task data', async () => {
    renderDetail(1)
    await screen.findByText('task 1')
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }))
    expect(screen.getByPlaceholderText('Name').value).toBe('task 1')
  })

  it('pre-fills the due date field', async () => {
    renderDetail(1)
    await screen.findByText('task 1')
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }))
    expect(screen.getByPlaceholderText('Due Date (YYYY-MM-DD)').value).toBe('2026-06-30')
  })

  it('shows Save Changes as submit button text in edit mode', async () => {
    renderDetail(1)
    await screen.findByText('task 1')
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }))
    expect(getSubmitButton()).toHaveTextContent('Save Changes')
  })

  it('saves changes and returns to view mode', async () => {
    window.fetch = vi.fn()
      .mockResolvedValueOnce(mockFetchResponse(MOCK_TASK))                     // fetchTask
      .mockResolvedValueOnce(mockFetchResponse([]))                             // SubtaskPanel apiFetch (mounts before click)
      .mockResolvedValueOnce(mockFetchResponse({ ...MOCK_TASK, title: 'Updated Name' })) // updateTask
      .mockResolvedValue(mockFetchResponse([]))                                 // fallback
    renderDetail(1)
    await screen.findByText('task 1')
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Updated Name' } })
    fireEvent.click(getSubmitButton())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(screen.getByText('Updated Name')).toBeInTheDocument()
  })

  it('shows validation error in edit mode if title is cleared', async () => {
    renderDetail(1)
    await screen.findByText('task 1')
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: '' } })
    fireEvent.click(getSubmitButton())
    expect(screen.getByText('Task name is required.')).toBeInTheDocument()
  })

  it('pre-fills collaborators field', async () => {
    renderDetail(1)
    await screen.findByText('task 1')
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }))
    expect(screen.getByText('user1')).toBeInTheDocument()
  })
})
