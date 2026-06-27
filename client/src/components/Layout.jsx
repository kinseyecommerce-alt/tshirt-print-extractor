// ============================================================
// App shell: sidebar navigation + top bar. Mobile-responsive.
// ============================================================
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/upload/single', label: 'Single Upload' },
  { to: '/upload/bulk', label: 'Bulk Upload' },
  { to: '/url/single', label: 'Single URL' },
  { to: '/url/bulk', label: 'Bulk URLs' },
  { to: '/jobs', label: 'Job History' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
    }`;

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r border-slate-800 bg-slate-900 p-4 transition-transform md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            AP
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">AI Print</p>
            <p className="text-xs text-slate-400">Extractor SaaS</p>
          </div>
        </div>
        <nav className="space-y-1" onClick={() => setOpen(false)}>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
          <button
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="text-sm text-slate-400">
              Signed in as <span className="text-slate-200">{user?.username}</span>
            </span>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
