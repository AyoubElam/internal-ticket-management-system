import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest, InterventionStatus } from '../types'
import mysql from 'mysql2/promise'

async function notifyUsers(userIds: number[], message: string): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (!unique.length) return
  const values = unique.map((id) => [id, message, 0])
  await pool.query(
    `INSERT INTO notifications (user_id, message, is_read) VALUES ?`,
    [values]
  )
}

async function getStaffIds(): Promise<number[]> {
  const [staff] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM users WHERE role IN ('admin', 'support_agent')`
  )
  return staff.map(u => u.id)
}

/* ── GET /interventions ── */
export async function listInterventions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: string[] = []
    const params: unknown[] = []

    // Technicians see only their own interventions
    if (req.user!.role === 'technician') {
      where.push('i.technician_id = ?')
      params.push(req.user!.userId)
    }

    const { status } = req.query as { status?: InterventionStatus }
    if (status) { where.push('i.status = ?'); params.push(status) }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT i.*,
         t.title AS ticket_title, t.priority, t.category,
         CONCAT(u.first_name, ' ', u.last_name) AS technician_name
       FROM interventions i
       JOIN tickets t  ON t.id = i.ticket_id
       JOIN users   u  ON u.id = i.technician_id
       ${whereSQL}
       ORDER BY i.updated_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) { next(err) }
}

/* ── POST /interventions ── */
/* This is the ONLY place a technician gets assigned to a ticket.
   Ticket detail page's old direct PATCH assigned_to_id must not be used anymore. */
export async function createIntervention(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ticket_id, technician_id, notes } = req.body as {
      ticket_id: number; technician_id: number; notes?: string
    }

    if (!ticket_id || !technician_id) {
      res.status(400).json({ error: 'ticket_id and technician_id are required.' })
      return
    }

    // Ticket must exist and currently be unassigned — prevents double
    // assignment (two interventions rows / a silently overwritten technician).
    const [ticketRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, title, status, assigned_to_id, created_by_id FROM tickets WHERE id = ?`,
      [ticket_id]
    )
    const ticket = ticketRows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }
    if (ticket.assigned_to_id || ticket.status !== 'created') {
      res.status(400).json({ error: 'This ticket is already assigned.' })
      return
    }

    // technician_id must actually be an active technician.
    const [techRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id FROM users WHERE id = ? AND role = 'technician' AND is_active = 1`,
      [technician_id]
    )
    if (!techRows[0]) {
      res.status(400).json({ error: 'Selected user is not an active technician.' })
      return
    }

    await pool.query(
      `UPDATE tickets SET assigned_to_id = ?, status = 'assigned', updated_at = NOW()
       WHERE id = ?`,
      [technician_id, ticket_id]
    )

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO interventions (ticket_id, technician_id, status, notes)
       VALUES (?, ?, 'traveling', ?)`,
      [ticket_id, technician_id, notes ?? null]
    )

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'CREATE_INTERVENTION', 'intervention', ?, ?)`,
      [req.user!.userId, result.insertId, `Intervention created for ticket #${ticket_id}`]
    )

    // Notify the employee their ticket moved, and the technician they've
    // got a new job. This used to happen inside tickets.controller's
    // updateTicket when assigning via PATCH — that path is gone now, so
    // it has to live here instead.
    await notifyUsers(
      [ticket.created_by_id],
      `Your ticket #${ticket_id} has been assigned to a technician.`
    )
    await notifyUsers(
      [technician_id],
      `You've been assigned to ticket #${ticket_id}: ${ticket.title}`
    )

    res.status(201).json({ id: result.insertId, message: 'Intervention created.' })
  } catch (err) { next(err) }
}

/* ── PATCH /interventions/:id ── */
export async function updateIntervention(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { status, notes } = req.body as { status?: InterventionStatus; notes?: string }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT i.id, i.ticket_id, i.technician_id, i.status,
              t.title AS ticket_title, t.created_by_id
       FROM interventions i
       JOIN tickets t ON t.id = i.ticket_id
       WHERE i.id = ?`,
      [id]
    )
    const intervention = rows[0]
    if (!intervention) { res.status(404).json({ error: 'Intervention not found.' }); return }

    // A technician may only update their own intervention.
    if (req.user!.role === 'technician' && intervention.technician_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only update your own interventions.' })
      return
    }

    // Completing requires a closing report note — enforced server-side too,
    // not just in the UI.
    if (status === 'completed' && !notes?.trim() && !intervention.notes) {
      res.status(400).json({ error: 'A closing report note is required to mark this complete.' })
      return
    }

    const fields: string[] = ['updated_at = NOW()']
    const params: unknown[] = []

    if (status) { fields.push('status = ?'); params.push(status) }
    if (notes !== undefined) { fields.push('notes = ?'); params.push(notes) }

    params.push(id)

    await pool.query(`UPDATE interventions SET ${fields.join(', ')} WHERE id = ?`, params)

    // Keep the parent ticket's status in sync with the intervention —
    // this is now the ONLY path that moves a ticket through
    // assigned → in_progress → resolved. Technicians no longer touch
    // /tickets/:id directly. Notifications live here too, since
    // updateTicket's notification block never fires for this path anymore.
    if (status === 'in_progress') {
      await pool.query(
        `UPDATE tickets SET status = 'in_progress', updated_at = NOW() WHERE id = ?`,
        [intervention.ticket_id]
      )
      await notifyUsers(
        [intervention.created_by_id],
        `Your ticket #${intervention.ticket_id} has been marked as in progress.`
      )
    }

    if (status === 'completed') {
      await pool.query(
        `UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [intervention.ticket_id]
      )
      await notifyUsers(
        [intervention.created_by_id],
        `Your ticket #${intervention.ticket_id} has been resolved.`
      )
      // Staff need to know it's ready to close — nobody was ever
      // notified of this before, at all.
      const staffIds = await getStaffIds()
      await notifyUsers(
        staffIds,
        `Ticket #${intervention.ticket_id} (${intervention.ticket_title}) was resolved by the technician and is ready to close.`
      )
    }

    if (status) {
      await pool.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'UPDATE_INTERVENTION', 'intervention', ?, ?)`,
        [req.user!.userId, id, `Status changed to ${status}`]
      )
    }

    res.json({ message: 'Intervention updated.' })
  } catch (err) { next(err) }
}