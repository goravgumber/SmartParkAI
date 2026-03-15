import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/auth'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const AppShell = lazy(() => import('./components/layout/AppShell'))
const MapOverviewPage = lazy(() => import('./pages/MapOverviewPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const EnvironmentPage = lazy(() => import('./pages/EnvironmentPage'))
const RevenuePage = lazy(() => import('./pages/RevenuePage'))
const AIPredictionsPage = lazy(() => import('./pages/AIPredictionsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'))

function ProtectedRoute() {
  const token = localStorage.getItem('smartpark_token')
  const { loading } = useAuth()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-base">
        <div className="glass-card px-6 py-4 font-mono text-brand-cyan">Verifying command token...</div>
      </div>
    )
  }

  return <Outlet />
}

function HomeRedirect() {
  const token = localStorage.getItem('smartpark_token')
  return <Navigate to={token ? '/dashboard/map' : '/login'} replace />
}

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-base">
      <div className="glass-card px-6 py-4 font-mono text-brand-cyan">Loading module...</div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<AppShell />}>
              <Route index element={<Navigate to="map" replace />} />
              <Route path="map" element={<MapOverviewPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="environment" element={<EnvironmentPage />} />
              <Route path="reservations" element={<ReservationsPage />} />
              <Route path="revenue" element={<RevenuePage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="ai" element={<AIPredictionsPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
