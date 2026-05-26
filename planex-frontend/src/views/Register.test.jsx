// ──────────────────────────────────────────────────────────────
// Unit Tests — Register View
// Tests that the Register component renders correctly and shows
// the expected form elements with validation hints.
// ──────────────────────────────────────────────────────────────

import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import Register from './Register'

// Mock the api module
vi.mock('../services/api', () => ({
  registerUser: vi.fn(),
  fetchUser: vi.fn().mockResolvedValue(null),
}))

function renderRegister() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Register />
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('Register View', () => {
  it('renders the register heading', () => {
    renderRegister()
    expect(screen.getByText('Planex')).toBeInTheDocument()
  })

  it('renders the name input field', () => {
    renderRegister()
    const nameInput = screen.getByPlaceholderText(/name/i)
    expect(nameInput).toBeInTheDocument()
  })

  it('renders the email input field', () => {
    renderRegister()
    const emailInput = screen.getByPlaceholderText(/email/i)
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('renders the password input field', () => {
    renderRegister()
    const passwordInput = screen.getByPlaceholderText(/password/i)
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('renders a link to the login page', () => {
    renderRegister()
    const loginLink = screen.getByText(/login here/i)
    expect(loginLink).toBeInTheDocument()
    expect(loginLink.closest('a')).toHaveAttribute('href', '/')
  })

  it('renders the register button', () => {
    renderRegister()
    const registerButton = screen.getByRole('button', { name: /enter planex/i })
    expect(registerButton).toBeInTheDocument()
  })
})
