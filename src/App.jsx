import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import AdminDashboard from './pages/AdminDashboard'
import BookManagement from './pages/BookManagement'
import CheckerHistory from './pages/CheckerHistory'
import ForgotPassword from './pages/ForgotPassword'
import GoogleAuthSuccess from './pages/GoogleAuthSuccess'
import Login from './pages/Login'
import Notifications from './pages/Notifications'
import Register from './pages/Register'
import RecorderUpload from './pages/RecorderUpload'
import RecorderFeedback from './pages/RecorderFeedback'
import RecorderHistory from './pages/RecorderHistory'
import ResetPassword from './pages/ResetPassword'
import Statistics from './pages/Statistics'
import TeamMembers from './pages/TeamMembers'
import MyClaims from './pages/MyClaims'
import TranslatorFeedback from './pages/TranslatorFeedback'
import TranslatorHistory from './pages/TranslatorHistory'
import TranslatorUpload from './pages/TranslatorUpload'
import Unauthorized from './pages/Unauthorized'
import UserManagement from './pages/UserManagement'
import WorkQueue from './pages/WorkQueue'

function App() {
  const { isAuthenticated, user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/google/success" element={<GoogleAuthSuccess />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={user?.role === 'translator' ? <Navigate to="/statistics" replace /> : <AdminDashboard />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/users" element={<UserManagement />} />
        <Route path="/book-management" element={<BookManagement />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['spoc', 'translator', 'checker', 'audio_checker', 'recorder', 'regional_team']} />}>
        <Route path="/work" element={<WorkQueue />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['recorder']} />}>
        <Route path="/audio-upload" element={<RecorderUpload />} />
        <Route path="/recorder-feedback" element={<RecorderFeedback />} />
        <Route path="/recorder-history" element={<RecorderHistory />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['checker']} />}>
        <Route path="/checker-history" element={<CheckerHistory />} />
        <Route path="/my-claims" element={<MyClaims />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['spoc']} />}>
        <Route path="/team-members" element={<TeamMembers />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['translator']} />}>
        <Route path="/translator-history" element={<TranslatorHistory />} />
        <Route path="/translator-feedback" element={<TranslatorFeedback />} />
        <Route path="/translator-upload" element={<TranslatorUpload />} />
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export default App
