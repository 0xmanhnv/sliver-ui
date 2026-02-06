import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Toaster } from '@/components/ui/toaster'

// Layouts (eagerly loaded — needed for every route)
import { MainLayout } from '@/components/layout/MainLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'

// Login is eagerly loaded (first thing users see)
import { Login } from '@/pages/Login'

// Lazy-loaded pages (code-split into separate chunks)
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Sessions = lazy(() => import('@/pages/Sessions').then(m => ({ default: m.Sessions })))
const Beacons = lazy(() => import('@/pages/Beacons').then(m => ({ default: m.Beacons })))
const Implants = lazy(() => import('@/pages/Implants').then(m => ({ default: m.Implants })))
const Listeners = lazy(() => import('@/pages/Listeners').then(m => ({ default: m.Listeners })))
const Armory = lazy(() => import('@/pages/Armory').then(m => ({ default: m.Armory })))
const Cleanup = lazy(() => import('@/pages/Cleanup').then(m => ({ default: m.Cleanup })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))
const Admin = lazy(() => import('@/pages/Admin').then(m => ({ default: m.Admin })))
const BrowserOps = lazy(() => import('@/pages/BrowserOps').then(m => ({ default: m.BrowserOps })))

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

function App() {
  return (
    <>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="/sessions" element={<Suspense fallback={<PageLoader />}><Sessions /></Suspense>} />
          <Route path="/beacons" element={<Suspense fallback={<PageLoader />}><Beacons /></Suspense>} />
          <Route path="/implants" element={<Suspense fallback={<PageLoader />}><Implants /></Suspense>} />
          <Route path="/listeners" element={<Suspense fallback={<PageLoader />}><Listeners /></Suspense>} />
          <Route path="/armory" element={<Suspense fallback={<PageLoader />}><Armory /></Suspense>} />
          <Route path="/cleanup" element={<Suspense fallback={<PageLoader />}><Cleanup /></Suspense>} />
          <Route path="/browser-ops" element={<Suspense fallback={<PageLoader />}><BrowserOps /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<PageLoader />}><Admin /></Suspense>} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
