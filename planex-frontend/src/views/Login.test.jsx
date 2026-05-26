// ──────────────────────────────────────────────────────────────
// Unit Tests — Login View
// Tests that the Login component renders correctly and shows
// the expected form elements.
// ──────────────────────────────────────────────────────────────

import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import Login from './Login'

// Mock the api module so tests don't make real HTTP calls
vi.mock('../services/api', () => ({
  loginUser: vi.fn(),
  fetchUser: vi.fn().mockResolvedValue(null),
}))

function renderLogin() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('Login View', () => {
  it('renders the login heading', () => {
    renderLogin()
    expect(screen.getByText('Planex')).toBeInTheDocument()
  })

  it('renders email input field', () => {
    renderLogin()
    const emailInput = screen.getByPlaceholderText(/email/i)
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('renders password input field', () => {
    renderLogin()
    const passwordInput = screen.getByPlaceholderText(/password/i)
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('renders the login button', () => {
    renderLogin()
    const loginButton = screen.getByRole('button', { name: /enter planex/i })
    expect(loginButton).toBeInTheDocument()
  })

  it('renders a link to the register page', () => {
    renderLogin()
    const registerLink = screen.getByText(/click here/i)
    expect(registerLink).toBeInTheDocument()
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register')
  })

  it('renders a link to the forgot-password page', () => {
    renderLogin()
    const forgotLink = screen.getByText(/forgot password/i)
    expect(forgotLink).toBeInTheDocument()
    expect(forgotLink.closest('a')).toHaveAttribute('href', '/forgot-password')
  })
})
