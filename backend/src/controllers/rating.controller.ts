import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest } from '../types'
import mysql from 'mysql2/promise'

async function notifyUsers(userIds: number[], message: string): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (!unique.length) return
  const values = unique.map((id) => [id, message, 0])
  await pool.query(`INSERT INTO notifications (user_id, message, is_read) VALUES ?`, [values])
}

/* ── POST /ratings ── */
/* Employee rates the technician on their own ticket, once it's finished. */
export async function createRating(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ticket_id, rating, comment } = req.body as {
      ticket_id: number; rating: number; comment?: string
    }

    if (!ticket_id || !rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      res.status(400).json({ error: 'rating must be an integer between 1 and 5.' })
      return
    }

    const [ticketRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, status, created_by_id, assigned_to_id FROM tickets WHERE id = ?`,
      [ticket_id]
    )
    const ticket = ticketRows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }

    if (ticket.created_by_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only rate your own tickets.' })
      return
    }
    if (!['resolved', 'closed'].includes(ticket.status)) {
      res.status(400).json({ error: 'You can only rate a ticket once the work is finished.' })
      return
    }
    if (!ticket.assigned_to_id) {
      res.status(400).json({ error: 'This ticket has no technician to rate.' })
      return
    }

    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id FROM ticket_ratings WHERE ticket_id = ?`,
      [ticket_id]
    )
    if (existing[0]) {
      res.status(409).json({ error: 'This ticket has already been rated.' })
      return
    }

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO ticket_ratings (ticket_id, technician_id, employee_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [ticket_id, ticket.assigned_to_id, req.user!.userId, rating, comment?.trim() || null]
    )

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'RATE_TICKET', 'ticket', ?, ?)`,
      [req.user!.userId, ticket_id, `Rated ${rating}/5`]
    )

    await notifyUsers(
      [ticket.assigned_to_id],
      `You received a ${rating}-star rating on ticket #${ticket_id}.`
    )

    res.status(201).json({ id: result.insertId, message: 'Rating submitted.' })
  } catch (err: any) {
    // Race-condition fallback: two near-simultaneous submits would both
    // pass the existence check above, but the UNIQUE constraint catches it.
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'This ticket has already been rated.' })
      return
    }
    next(err)
  }
}

/* ── GET /ratings/technician/:id ──
   Average + count + recent comments for one technician. Admin/agent can
   view any technician; a technician can view their own. */
export async function getTechnicianRating(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const technicianId = Number(id)

    const role = req.user!.role
    if (role === 'technician' && req.user!.userId !== technicianId) {
      res.status(403).json({ error: 'Forbidden.' })
      return
    }
    if (!['admin', 'support_agent', 'technician'].includes(role)) {
      res.status(403).json({ error: 'Forbidden.' })
      return
    }

    const [[summary]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         COUNT(*) AS rating_count,
         ROUND(AVG(rating), 2) AS avg_rating
       FROM ticket_ratings
       WHERE technician_id = ?`,
      [technicianId]
    )

    const [recent] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT r.rating, r.comment, r.created_at, r.ticket_id,
              CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM ticket_ratings r
       JOIN users e ON e.id = r.employee_id
       WHERE r.technician_id = ?
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [technicianId]
    )

    res.json({
      technician_id: technicianId,
      rating_count: summary.rating_count,
      avg_rating: summary.avg_rating,
      recent,
    })
  } catch (err) { next(err) }
}

/* ── GET /ratings/summary ──
   All technicians with their average rating — admin/agent leaderboard view. */
export async function listTechnicianRatings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // MariaDB rejects ordering by an aggregate ALIAS wrapped in another
    // expression (e.g. "avg_rating IS NULL") — "reference to group function
    // not supported" in strict mode. Using the full AVG(...) expression
    // directly in ORDER BY sidesteps that; the alias is still fine to
    // select and to read from the JSON response.
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         u.id AS technician_id,
         CONCAT(u.first_name, ' ', u.last_name) AS technician_name,
         COUNT(r.id) AS rating_count,
         ROUND(AVG(r.rating), 2) AS avg_rating
       FROM users u
       LEFT JOIN ticket_ratings r ON r.technician_id = u.id
       WHERE u.role = 'technician'
       GROUP BY u.id
       ORDER BY AVG(r.rating) IS NULL, AVG(r.rating) DESC`
    )
    res.json(rows)
  } catch (err) { next(err) }
}