import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Accounts from './pages/Accounts'
import Analytics from './pages/Analytics'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import Limits from './pages/Limits'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Register from './pages/Register'
import Reports from './pages/Reports'
import ResetPassword from './pages/ResetPassword'
import Transactions from './pages/Transactions'

function App() {
  return (
    <Routes>
      <Route element={<Navigate to="/dashboard" replace />} path="/" />
      <Route element={<Login />} path="/login" />
      <Route element={<Register />} path="/register" />
      <Route element={<ForgotPassword />} path="/forgot-password" />
      <Route element={<ResetPassword />} path="/reset-password/:token" />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<Dashboard />} path="/dashboard" />
          <Route element={<Analytics />} path="/analytics" />
          <Route element={<Accounts />} path="/accounts" />
          <Route element={<Transactions />} path="/transactions" />
          <Route element={<Limits />} path="/limits" />
          <Route element={<Reports />} path="/reports" />
          <Route element={<Profile />} path="/profile" />
        </Route>
      </Route>
      <Route element={<Navigate to="/dashboard" replace />} path="*" />
    </Routes>
  )
}

export default App
