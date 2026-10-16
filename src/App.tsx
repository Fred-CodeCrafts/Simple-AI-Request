import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider, ToastViewport } from '@/components/ui/toast'
import RequestFormPage from '@/pages/public/RequestFormPage'
import ConfirmationPage from '@/pages/public/ConfirmationPage'
import NotFoundPage from '@/pages/public/NotFoundPage'
import AdminLoginPage from '@/pages/admin/AdminLoginPage'
import AdminLayout from '@/components/admin/AdminLayout'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import BatchListPage from '@/pages/admin/BatchListPage'
import BatchDetailPage from '@/pages/admin/BatchDetailPage'
import DepartmentsPage from '@/pages/admin/DepartmentsPage'
import AIToolsPage from '@/pages/admin/AIToolsPage'
import AccountPage from '@/pages/admin/AccountPage'
import ProtectedRoute from '@/components/admin/ProtectedRoute'

// The secret slug is baked in at build time.
// Anyone without /submit/<slug> gets a 404.
const FORM_SLUG = import.meta.env.VITE_FORM_SLUG as string

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Root redirects to 404 — the form is only at /submit/<slug> */}
          <Route path="/" element={<NotFoundPage />} />

          {/* Public form — only accessible with the correct slug */}
          <Route path={`/submit/${FORM_SLUG}`} element={<RequestFormPage />} />
          <Route path={`/submit/${FORM_SLUG}/confirmation`} element={<ConfirmationPage />} />

          {/* Catch-all /submit/* without the correct slug → 404 */}
          <Route path="/submit/*" element={<NotFoundPage />} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="batches" element={<BatchListPage />} />
            <Route path="batches/:id" element={<BatchDetailPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="ai-tools" element={<AIToolsPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Everything else → 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <ToastViewport />
    </ToastProvider>
  )
}
