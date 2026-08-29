import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold">
            E
          </div>
          <span className="text-xl font-semibold tracking-tight">Examly</span>
        </div>
        <Link
          to="/login"
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-brand-50 text-brand-700 mb-6">
            Built for modern schools
          </span>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6">
            Exam papers, <span className="text-brand-500">generated fresh</span> the moment you need them.
          </h1>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            Examly turns your chapter PDFs into ready-to-print exam papers — generated on demand, fully customizable, and timestamped for trust.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/login"
              className="px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition"
            >
              Open dashboard
            </Link>
            <a
              href="#how"
              className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-white transition"
            >
              How it works
            </a>
          </div>
        </div>
      </main>

      {/* How it works */}
      <section id="how" className="px-6 py-16 bg-white border-t border-slate-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: '01', t: 'Teacher uploads chapters', d: 'Teachers add the chapters they taught as PDF files.' },
              { n: '02', t: 'Request a paper', d: 'Pick subject, chapters, paper structure, marks and difficulty.' },
              { n: '03', t: 'Admin generates', d: 'You click generate. A fresh paper appears, ready to print.' },
            ].map((s) => (
              <div key={s.n} className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-brand-500 font-semibold mb-2">{s.n}</div>
                <div className="text-lg font-semibold mb-1">{s.t}</div>
                <div className="text-slate-600 text-sm">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="text-center text-sm text-slate-500 py-6 border-t border-slate-200 bg-white">
        © {new Date().getFullYear()} Examly
      </footer>
    </div>
  )
}
