import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  // Still initializing auth (checking cookies) — show nothing to avoid flash redirect
  if (loading) {
    return null
  }

  // Not authenticated — redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Authenticated — render the protected content
  return children
}
