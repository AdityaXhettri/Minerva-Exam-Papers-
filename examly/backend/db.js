import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, 'database', 'examly.db')
export const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','teacher')),
    full_name TEXT,
    assigned_class TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS chapter_pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    class_level TEXT NOT NULL,
    chapter_label TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    extracted_text TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS paper_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    class_level TEXT NOT NULL,
    subject TEXT NOT NULL,
    pdf_ids TEXT NOT NULL,
    total_marks INTEGER NOT NULL,
    sections_json TEXT NOT NULL,
    difficulty_json TEXT NOT NULL,
    exam_date TEXT,
    instructions TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','generated','rejected')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    generated_by INTEGER NOT NULL,
    subject TEXT NOT NULL,
    class_level TEXT NOT NULL,
    total_marks INTEGER NOT NULL,
    paper_json TEXT NOT NULL,
    answer_key_json TEXT,
    generated_at TEXT DEFAULT (datetime('now')),
    printed_at TEXT,
    FOREIGN KEY (request_id) REFERENCES paper_requests(id),
    FOREIGN KEY (generated_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS question_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    class_level TEXT NOT NULL,
    chapter TEXT,
    paper_id INTEGER,
    question_text TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    content_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_question_history_lookup
    ON question_history(subject, class_level, fingerprint);
  CREATE INDEX IF NOT EXISTS idx_question_history_chapter
    ON question_history(subject, class_level, chapter);
`)

// Seed default admin if no admin exists
const adminExists = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get()
if (!adminExists) {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'changeme123'
  const hash = bcrypt.hashSync(password, 10)
  db.prepare(
    `INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, 'admin', 'Administrator')`
  ).run(username, hash)
  console.log(`✅ Seeded admin: ${username} / ${password}`)
}

export function logAction(userId, action, details = null) {
  db.prepare(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`).run(
    userId,
    action,
    details ? JSON.stringify(details) : null
  )
}
