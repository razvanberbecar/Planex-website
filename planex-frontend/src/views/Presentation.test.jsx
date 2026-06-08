import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Presentation from '../views/Presentation'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderPresentation() {
  return render(
    <MemoryRouter>
      <Presentation />
    </MemoryRouter>
  )
}

describe('Presentation', () => {

  it('renders the app name PLANEX as a bold span', () => {
    renderPresentation()
    // PLANEX is in a <span> with font-weight 900 — getAllByText returns all matches,
    // we check at least one is the standalone span
    const matches = screen.getAllByText(/PLANEX/i)
    const spanMatch = matches.find(el => el.tagName === 'SPAN' && el.textContent === 'PLANEX')
    expect(spanMatch).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    renderPresentation()
    expect(screen.getByText(/"Plan Smart\. Do More\."/i)).toBeInTheDocument()
  })

  it('renders the description text', () => {
    renderPresentation()
    expect(screen.getByText(/simple and efficient task-planning app/i)).toBeInTheDocument()
  })

  it('renders the Enter Planex button', () => {
    renderPresentation()
    expect(screen.getByText(/Enter Planex/i)).toBeInTheDocument()
  })

  it('Enter Planex link points to /tasks', () => {
    renderPresentation()
    const link = screen.getByText(/Enter Planex/i).closest('a')
    expect(link).toHaveAttribute('href', '/tasks')
  })

  it('renders the From this label', () => {
    renderPresentation()
    expect(screen.getByText(/From this/i)).toBeInTheDocument()
  })

  it('renders the To this label', () => {
    renderPresentation()
    expect(screen.getByText(/To this/i)).toBeInTheDocument()
  })

  it('renders the clipboard icon', () => {
    renderPresentation()
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('renders Welcome to text', () => {
    renderPresentation()
    expect(screen.getByText(/Welcome to/i)).toBeInTheDocument()
  })
})