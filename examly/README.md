# Examly

A modern, on-demand exam paper generator for schools. Teachers upload chapter PDFs, request papers with custom structure, and admin generates fresh, timestamped papers at exam time.

## Why Examly
Exam papers don't exist until you click "Generate." Nothing to leak, nothing to sell. Every request, generation, and print is logged with timestamp + user.

## Stack
- **Frontend:** React + Vite + Tailwind CSS + jsPDF
- **Backend:** Node.js + Express + SQLite (better-sqlite3)
- **Auth:** JWT + bcrypt
- **AI:** Pluggable — OpenAI (`gpt-4o-mini`) or Google Gemini (`gemini-1.5-flash`). Falls back to a placeholder generator if no key is set.

## Quick start

### 1. Backend
```bash
cd backend
npm install
npm run dev        # runs on http://localhost:5000
```

The first run creates `backend/database/examly.db` and seeds:
- **Admin login:** `admin` / `changeme123` (change in `backend/.env`)

### 2. Frontend
```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

Open http://localhost:5173, log in as admin, then add teacher accounts from the **Teachers** page.

### 3. (Optional) Enable real AI generation
Edit `backend/.env` and uncomment one of:
```env
OPENAI_API_KEY=sk-...
# or
GEMINI_API_KEY=...     # https://aistudio.google.com/app/apikey (free tier)
```
Restart the backend. The "Generate paper" page will detect the provider and call it.

## Full flow
1. **Teacher** logs in → goes to **Chapter PDFs** → uploads chapter PDFs (text is auto-extracted)
2. **Teacher** → **New request** → picks chapters, configure sections (A/B/C with marks), difficulty mix, exam date → submit
3. **Admin** → **Requests** → sees pending request → clicks **Generate**
4. **Admin** reviews the AI-generated paper, edits if needed, clicks **Save**
5. **Admin** clicks **Download PDF** → ready-to-print paper (saved to history with timestamp)

## Project structure
```
examly/
├── frontend/                  React app
│   └── src/
│       ├── pages/             Landing, Login, admin/, teacher/
│       ├── layouts/           AdminLayout, TeacherLayout
│       └── lib/               api.js (axios), useAuth.jsx (auth context)
├── backend/
│   ├── server.js              Express bootstrap
│   ├── db.js                  SQLite schema + admin seeding
│   ├── middleware/auth.js     JWT helpers
│   ├── routes/                auth, teachers, pdfs, requests, papers, ai
│   ├── services/ai.js         OpenAI + Gemini integration
│   ├── uploads/               Stored chapter PDFs
│   └── database/examly.db     SQLite file
└── README.md
```

## API endpoints (summary)

### Auth
- `POST /api/auth/login` — `{ username, password }` → `{ token, user }`
- `GET /api/auth/me` — current user (Bearer token)
- `POST /api/auth/logout`

### Teachers (admin)
- `GET /api/teachers`
- `POST /api/teachers` — `{ username, password, full_name, assigned_class }`
- `DELETE /api/teachers/:id`

### PDFs (teacher)
- `POST /api/pdfs` — multipart form (`file`, `subject`, `class_level`, `chapter_label`)
- `GET /api/pdfs` — teacher sees own, admin sees all
- `GET /api/pdfs/:id/text` — extracted text
- `DELETE /api/pdfs/:id`

### Requests
- `POST /api/requests` (teacher) — full request payload
- `GET /api/requests` — teacher: own / admin: all
- `GET /api/requests/:id`
- `PATCH /api/requests/:id/status` (admin)

### Papers (admin)
- `POST /api/papers/generate` — `{ request_id, paper, answer_key }`
- `GET /api/papers`
- `GET /api/papers/:id`
- `POST /api/papers/:id/printed`

### AI
- `GET /api/ai/provider` — which provider is configured
- `POST /api/ai/generate` — `{ request_id }` → returns generated paper JSON
