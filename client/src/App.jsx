import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SingleUpload from './pages/SingleUpload.jsx';
import BulkUpload from './pages/BulkUpload.jsx';
import SingleUrl from './pages/SingleUrl.jsx';
import BulkUrl from './pages/BulkUrl.jsx';
import JobHistory from './pages/JobHistory.jsx';
import Output from './pages/Output.jsx';

/** Wraps routes that require an authenticated session. */
function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/upload/single" element={<Protected><SingleUpload /></Protected>} />
      <Route path="/upload/bulk" element={<Protected><BulkUpload /></Protected>} />
      <Route path="/url/single" element={<Protected><SingleUrl /></Protected>} />
      <Route path="/url/bulk" element={<Protected><BulkUrl /></Protected>} />
      <Route path="/jobs" element={<Protected><JobHistory /></Protected>} />
      <Route path="/output/:id" element={<Protected><Output /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
