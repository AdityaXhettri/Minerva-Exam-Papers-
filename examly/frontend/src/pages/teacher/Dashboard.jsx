import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/useAuth.jsx'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">
          {isAdmin ? 'Teacher Portal' : `Hello, ${user?.full_name || user?.username}`}
        </h1>
        <p className="text-slate-500 mt-1">
          {isAdmin
            ? 'Request and generate papers directly — same flow as a teacher.'
            : 'Upload chapter PDFs and request exam papers.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link to="/teacher/pdfs" className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-brand-500 transition">
          <div className="text-sm text-slate-500 mb-1">Step 1</div>
          <div className="text-lg font-semibold">Upload chapter PDFs</div>
          <p className="text-sm text-slate-500 mt-1">Upload chapters. AI reads them to generate questions.</p>
        </Link>
        <Link to="/teacher/requests/new" className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-brand-500 transition">
          <div className="text-sm text-slate-500 mb-1">Step 2</div>
          <div className="text-lg font-semibold">Request a paper</div>
          <p className="text-sm text-slate-500 mt-1">Pick sections, marks, difficulty, and chapters.</p>
        </Link>
        <Link to="/teacher/requests" className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-brand-500 transition">
          <div className="text-sm text-slate-500 mb-1">Step 3</div>
          <div className="text-lg font-semibold">{isAdmin ? 'View all requests' : 'My requests'}</div>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin ? 'See every paper request and generate them yourself.' : 'Track your requests and download generated PDFs.'}
          </p>
        </Link>
      </div>
    </div>
  )
}
