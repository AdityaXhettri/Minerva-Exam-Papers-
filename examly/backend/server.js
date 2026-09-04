import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import './db.js' // initializes DB and seeds admin

import authRoutes from './routes/auth.js'
import teacherRoutes from './routes/teachers.js'
import pdfRoutes from './routes/pdfs.js'
import requestRoutes from './routes/requests.js'
import paperRoutes from './routes/papers.js'
import aiRoutes from './routes/ai.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Examly', time: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/teachers', teacherRoutes)
app.use('/api/pdfs', pdfRoutes)
app.use('/api/requests', requestRoutes)
app.use('/api/papers', paperRoutes)
app.use('/api/ai', aiRoutes)

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Examly backend running on http://localhost:${PORT}`)
})
