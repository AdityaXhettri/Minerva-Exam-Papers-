import { useAuth } from '../../lib/useAuth.jsx'

export default function TeacherDashboard() {
  const { user } = useAuth()

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Hello, {user?.full_name || user?.username}</h1>
        <p className="text-slate-500 mt-1">Upload chapter PDFs and request exam papers.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-brand-500 transition cursor-pointer">
          <div className="text-sm text-slate-500 mb-1">Step 1</div>
          <div className="text-lg font-semibold">Upload chapter PDFs</div>
          <p className="text-sm text-slate-500 mt-1">
            Upload the chapter content you'll be examined on. The AI reads these to generate questions.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-brand-500 transition cursor-pointer">
          <div className="text-sm text-slate-500 mb-1">Step 2</div>
          <div className="text-lg font-semibold">Request a paper</div>
          <p className="text-sm text-slate-500 mt-1">
            Tell us the structure — sections, marks, difficulty — and admin will generate the paper.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          E
        </div>
        <h2 className="text-xl font-semibold mb-2">No chapter PDFs uploaded yet</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Start by uploading the chapter PDFs you teach. Once uploaded, you can request papers anytime.
        </p>
      </div>
    </div>
  )
}
