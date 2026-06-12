import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ChatProvider } from './context/ChatContext'
import Login from './views/Login'
import Register from './views/Register'
import ForgotPassword from './views/ForgotPassword'
import ResetPassword from './views/ResetPassword'
import Presentation from './views/Presentation'
import MasterView from './views/MasterView'
import DetailView from './views/DetailView'
import Statistics from './views/Statistics'
import AdminView from './views/AdminView'
import KanbanView from './views/KanbanView'
import CalendarView from './views/CalendarView'
import ProfileView from './views/ProfileView'
import ChatPanel from './components/ChatPanel'
import InactivityWarning from './components/InactivityWarning'
import ProtectedRoute from './components/ProtectedRoute'

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes — accessible without authentication */}
      <Route path="/"                  element={<Login />} />
      <Route path="/register"          element={<Register />} />
      <Route path="/forgot-password"   element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/welcome"           element={<Presentation />} />

      {/* Protected routes — redirect to / if not authenticated */}
      <Route path="/tasks"       element={<ProtectedRoute><MasterView /></ProtectedRoute>} />
      <Route path="/tasks/:id"   element={<ProtectedRoute><DetailView /></ProtectedRoute>} />
      <Route path="/statistics"  element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
      <Route path="/admin"       element={<ProtectedRoute><AdminView /></ProtectedRoute>} />
      <Route path="/kanban"      element={<ProtectedRoute><KanbanView /></ProtectedRoute>} />
      <Route path="/calendar"    element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
      <Route path="/profile"     element={<ProtectedRoute><ProfileView /></ProtectedRoute>} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ChatProvider>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <AppRoutes />
            </div>
            <ChatPanel />
            <InactivityWarning />
          </div>
        </ChatProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
