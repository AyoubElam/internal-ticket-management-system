import type { Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import pool from '../config/database'
import type { AuthRequest } from '../types'
import mysql from 'mysql2/promise'

/* ── Constants ─────────────────────────────────────────────── */
const MAX_FILES_PER_TICKET = 3
const MAX_FILE_SIZE_BYTES  = 10 * 1024 * 1024  // 10 MB
const ALLOWED_MIME_TYPES   = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]

/* ── Uploads directory (backend root /uploads) ─────────────── */
const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

/* ── Multer storage: uuid filename → /uploads/ ─────────────── */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file,  cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

export const uploadMiddleware = multer({
  storage,
  limits:      { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter:  (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`))
    }
  },
}).single('file')    // field name must be "file"

/* ── Permission helper (same rule as comments) ──────────────── */
async function assertCanAccessTicket(
  req: AuthRequest, ticketId: string
): Promise<{ ok: true; ticket: mysql.RowDataPacket } | { ok: false; status: number; error: string }> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, created_by_id, assigned_to_id, status FROM tickets WHERE id = ?`,
    [ticketId]
  )
  const ticket = rows[0]
  if (!ticket) return { ok: false, status: 404, error: 'Ticket not found.' }

  const role = req.user!.role
  if (role === 'employee'   && ticket.created_by_id  !== req.user!.userId)
    return { ok: false, status: 403, error: 'Forbidden.' }
  if (role === 'technician' && ticket.assigned_to_id !== req.user!.userId)
    return { ok: false, status: 403, error: 'Forbidden.' }

  return { ok: true, ticket }
}

/* ── GET /tickets/:id/attachments ───────────────────────────── */
export async function listAttachments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const access = await assertCanAccessTicket(req, req.params.id)
    if (!access.ok) { res.status(access.status).json({ error: access.error }); return }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         a.id, a.file_name, a.stored_name, a.file_size, a.mime_type, a.created_at,
         CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
       FROM ticket_attachments a
       JOIN users u ON u.id = a.uploaded_by
       WHERE a.ticket_id = ?
       ORDER BY a.created_at ASC`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) { next(err) }
}

/* ── POST /tickets/:id/attachments ──────────────────────────── */
export async function uploadAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // Run multer inline so we can reply with proper JSON errors
  uploadMiddleware(req as any, res as any, async (multerErr) => {
    try {
      if (multerErr) {
        res.status(400).json({ error: multerErr.message })
        return
      }

      const file = (req as any).file as Express.Multer.File | undefined
      if (!file) { res.status(400).json({ error: 'No file uploaded.' }); return }

      const access = await assertCanAccessTicket(req, req.params.id)
      if (!access.ok) {
        // Remove the uploaded file since the request is rejected
        fs.unlink(file.path, () => {})
        res.status(access.status).json({ error: access.error })
        return
      }

      // Only employee (creator) and technician (assigned) may upload
      const role = req.user!.role
      if (!['employee', 'technician', 'admin', 'support_agent'].includes(role)) {
        fs.unlink(file.path, () => {})
        res.status(403).json({ error: 'Forbidden.' })
        return
      }

      // Enforce 3-file cap per ticket
      const [[{ count }]] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM ticket_attachments WHERE ticket_id = ?`,
        [req.params.id]
      )
      if (Number(count) >= MAX_FILES_PER_TICKET) {
        fs.unlink(file.path, () => {})
        res.status(400).json({ error: `Maximum ${MAX_FILES_PER_TICKET} attachments per ticket.` })
        return
      }

      const relativePath = path.join('uploads', file.filename)

      const [result] = await pool.query<mysql.ResultSetHeader>(
        `INSERT INTO ticket_attachments
           (ticket_id, uploaded_by, file_name, stored_name, file_path, file_size, mime_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          req.user!.userId,
          file.originalname,
          file.filename,
          relativePath,
          file.size,
          file.mimetype,
        ]
      )

      res.status(201).json({
        id:        result.insertId,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        message:   'File uploaded.',
      })
    } catch (err) { next(err) }
  })
}

/* ── GET /tickets/:id/attachments/:attId/download ───────────── */
export async function downloadAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const access = await assertCanAccessTicket(req, req.params.id)
    if (!access.ok) { res.status(access.status).json({ error: access.error }); return }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?`,
      [req.params.attId, req.params.id]
    )
    const att = rows[0]
    if (!att) { res.status(404).json({ error: 'Attachment not found.' }); return }

    const fullPath = path.join(process.cwd(), att.file_path)
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'File not found on disk.' }); return
    }

    res.setHeader('Content-Disposition', `attachment; filename="${att.file_name}"`)
    res.setHeader('Content-Type', att.mime_type)
    res.sendFile(fullPath)
  } catch (err) { next(err) }
}

/* ── DELETE /tickets/:id/attachments/:attId ─────────────────── */
export async function deleteAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const access = await assertCanAccessTicket(req, req.params.id)
    if (!access.ok) { res.status(access.status).json({ error: access.error }); return }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?`,
      [req.params.attId, req.params.id]
    )
    const att = rows[0]
    if (!att) { res.status(404).json({ error: 'Attachment not found.' }); return }

    // Only uploader, admin or support_agent can delete
    const role = req.user!.role
    const isOwner = att.uploaded_by === req.user!.userId
    const isStaff = role === 'admin' || role === 'support_agent'
    if (!isOwner && !isStaff) {
      res.status(403).json({ error: 'You cannot delete this attachment.' }); return
    }

    // Delete from disk
    const fullPath = path.join(process.cwd(), att.file_path)
    if (fs.existsSync(fullPath)) fs.unlink(fullPath, () => {})

    await pool.query(`DELETE FROM ticket_attachments WHERE id = ?`, [att.id])
    res.json({ message: 'Attachment deleted.' })
  } catch (err) { next(err) }
}
