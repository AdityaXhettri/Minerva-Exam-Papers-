import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/useAuth.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import TeacherLayout from './layouts/TeacherLayout.jsx'
import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminRequests from './pages/admin/AdminRequests.jsx'
import GeneratePaper from './pages/admin/GeneratePaper.jsx'
import PaperHistory from './pages/admin/PaperHistory.jsx'
import ViewPaper from './pages/admin/ViewPaper.jsx'
import TeacherManagement from './pages/admin/TeacherManagement.jsx'
import ChapterLibrary from './pages/admin/ChapterLibrary.jsx'
import TeacherDashboard from './pages/teacher/Dashboard.jsx'
import TeacherPDFs from './pages/teacher/PDFs.jsx'
import NewRequest from './pages/teacher/NewRequest.jsx'
import MyRequests from './pages/teacher/MyRequests.jsx'

function Protected({ role, roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-8">Loading…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  const allowed = roles ? roles.includes(user.role) : user.role === role
  if (!allowed) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <Protected role="admin">
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="generate/:id" element={<GeneratePaper />} />
        <Route path="papers" element={<PaperHistory />} />
        <Route path="papers/:id" element={<ViewPaper />} />
        <Route path="teachers" element={<TeacherManagement />} />
        <Route path="library" element={<ChapterLibrary />} />
        <Route path="new-request" element={<NewRequest />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="pdfs" element={<TeacherPDFs />} />
      </Route>

      <Route
        path="/teacher"
        element={
          <Protected roles={['teacher', 'admin']}>
            <TeacherLayout />
          </Protected>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="pdfs" element={<TeacherPDFs />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="requests/new" element={<NewRequest />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
