import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { DashboardLayout } from './layouts/DashboardLayout'
import { DashboardHome } from './pages/DashboardHome'
import { PartnersPage } from './pages/PartnersPage'
import { CouponsPage } from './pages/CouponsPage'
import { MerchantsPage } from './pages/MerchantsPage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="merchants" element={<MerchantsPage />} />
            <Route path="coupons" element={<CouponsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
