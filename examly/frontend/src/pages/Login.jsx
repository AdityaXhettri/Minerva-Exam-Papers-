import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.jsx'

export default function Login() {
  const [role, setRole] = useState('admin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(username, password, role)
      navigate(user.role === 'admin' ? '/admin' : '/teacher')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">← Back</Link>
        <div className="flex items-center gap-2 mt-4 mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold">E</div>
          <span className="text-xl font-semibold tracking-tight">Examly</span>
        </div>

        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-slate-500 mb-6">Choose your role to continue.</p>

        <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
          {['admin', 'teacher'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setRole(r); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                role === r ? 'bg-white shadow text-brand-700' : 'text-slate-600'
              }`}
            >
              {r === 'admin' ? 'Admin' : 'Teacher'}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder={role === 'admin' ? 'admin' : 'teacher username'}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition disabled:opacity-60"
          >
            {loading ? 'Signing in…' : `Sign in as ${role === 'admin' ? 'Admin' : 'Teacher'}`}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-6 text-center">
          Default admin: <span className="font-mono">admin / changeme123</span>
        </p>
      </div>
    </div>
  )
}
