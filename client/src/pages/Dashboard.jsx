// ============================================================
// Main dashboard: quick links + recent jobs summary.
// ============================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJobs } from '../api.js';
import JobList from '../components/JobList.jsx';

const ACTIONS = [
  { to: '/upload/single', title: 'Single Upload', desc: 'Upload one garment image.' },
  { to: '/upload/bulk', title: 'Bulk Upload', desc: 'Upload many images or a ZIP.' },
  { to: '/url/single', title: 'Single URL', desc: 'Extract from one product URL.' },
  { to: '/url/bulk', title: 'Bulk URLs', desc: 'Paste URLs or upload a CSV/Excel.' },
];

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);

  const load = () => fetchJobs().then((d) => setJobs(d.jobs)).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // refresh to reflect queue progress
    return () => clearInterval(t);
  }, []);

  const stats = {
    total: jobs.length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    processing: jobs.filter((j) => j.status === 'processing' || j.status === 'pending').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Extract printed artwork from garments and export DTF-ready transparent PNGs.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Total jobs', stats.total],
          ['Completed', stats.completed],
          ['In progress', stats.processing],
          ['Failed', stats.failed],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="card transition hover:border-brand-500 hover:bg-brand-600/5"
          >
            <p className="font-medium text-slate-100">{a.title}</p>
            <p className="mt-1 text-sm text-slate-400">{a.desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent jobs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent jobs</h2>
          <Link to="/jobs" className="text-sm text-brand-400 hover:text-brand-300">
            View all →
          </Link>
        </div>
        <JobList jobs={jobs.slice(0, 6)} onChange={load} />
      </div>
    </div>
  );
}
