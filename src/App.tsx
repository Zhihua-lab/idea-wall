import { Navigate, Route, Routes } from 'react-router-dom'
import { DeleteConfirmPage } from './pages/DeleteConfirmPage'
import { HomePage } from './pages/HomePage'
import { InspirationDetailPage } from './pages/InspirationDetailPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { WriteInspirationPage } from './pages/WriteInspirationPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/profile/:userId" element={<ProfilePage />} />
      <Route path="/inspiration/:id/edit" element={<WriteInspirationPage />} />
      <Route path="/inspiration/:id" element={<InspirationDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/new" element={<WriteInspirationPage />} />
      <Route path="/delete-confirm" element={<DeleteConfirmPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
