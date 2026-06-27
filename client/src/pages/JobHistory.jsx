// ============================================================
// Job history: all jobs with status filter, polling, and retry.
// ============================================================
import { useEffect, useState } from 'react';
import JobList from '../components/JobList.jsx';
import { fetchJobs } from '../api.js';

const FILTERS = ['all', 'pending', 'processing', 'completed', 'failed'];

export default function JobHistory() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');

  const load = () => fetchJobs().then((d) => setJobs(d.jobs)).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const visible = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Job History</h1>
          <p className="text-sm text-slate-400">{jobs.length} total jobs</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`badge capitalize ${
                filter === f ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <JobList jobs={visible} onChange={load} />
    </div>
  );
}
