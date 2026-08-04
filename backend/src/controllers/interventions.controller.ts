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
   Ticket detail page's old direct PATCH assigned_to_id must not be used anymore.

   CHANGED: this no longer creates the interventions row or fully assigns
   the ticket immediately. It puts the ticket into 'pending_assignment'
   and waits for the technician to accept/reject (see acceptAssignment /
   rejectAssignment below). The interventions row — the thing that
   actually tracks traveling/in_progress/completed — only gets created
   once the technician accepts, since there's no work to track before
   that. This means NO schema change was needed on `interventions` at
   all; only `tickets.status` gained the 'pending_assignment' value. */
export async function createIntervention(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ticket_id, technician_id } = req.body as {
      ticket_id: number; technician_id: number
    }

    if (!ticket_id || !technician_id) {
      res.status(400).json({ error: 'ticket_id and technician_id are required.' })
      return
    }

    // Ticket must exist and currently be unassigned — prevents double
    // assignment / racing a still-pending assignment.
    const [ticketRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, title, status, assigned_to_id, created_by_id FROM tickets WHERE id = ?`,
      [ticket_id]
    )
    const ticket = ticketRows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }
    if (ticket.assigned_to_id || ticket.status !== 'created') {
      res.status(400).json({
        error: ticket.status === 'pending_assignment'
          ? 'This ticket already has a pending assignment awaiting the technician\'s response.'
          : 'This ticket is already assigned.',
      })
      return
    }

    // technician_id must actually be an active technician.
    const [techRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, first_name, last_name FROM users WHERE id = ? AND role = 'technician' AND is_active = 1`,
      [technician_id]
    )
    const tech = techRows[0]
    if (!tech) {
      res.status(400).json({ error: 'Selected user is not an active technician.' })
      return
    }

    await pool.query(
      `UPDATE tickets SET assigned_to_id = ?, status = 'pending_assignment', updated_at = NOW()
       WHERE id = ?`,
      [technician_id, ticket_id]
    )

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'ASSIGN_TICKET', 'ticket', ?, ?)`,
      [req.user!.userId, ticket_id, `Assigned to ${tech.first_name} ${tech.last_name}, awaiting response`]
    )

    // Only the technician is notified now — the employee gets notified
    // once it's actually accepted (see acceptAssignment), so they aren't
    // told "assigned" for something that might get rejected a minute later.
    await notifyUsers(
      [technician_id],
      `You've been assigned ticket #${ticket_id}: ${ticket.title}. Please accept or reject it.`
    )

    res.status(201).json({ message: 'Technician assigned — awaiting their response.' })
  } catch (err) { next(err) }
}

/* ── PATCH /interventions/assignments/:ticketId/accept ──
   Technician accepts a pending assignment. This is where the actual
   interventions row gets created (status='traveling'), and the ticket
   moves pending_assignment → assigned. */
export async function acceptAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ticketId } = req.params

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, title, status, assigned_to_id, created_by_id FROM tickets WHERE id = ?`,
      [ticketId]
    )
    const ticket = rows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }

    if (ticket.assigned_to_id !== req.user!.userId) {
      res.status(403).json({ error: 'This assignment is not yours to respond to.' })
      return
    }
    if (ticket.status !== 'pending_assignment') {
      res.status(400).json({ error: 'This ticket has no pending assignment to respond to.' })
      return
    }

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO interventions (ticket_id, technician_id, status, notes)
       VALUES (?, ?, 'traveling', NULL)`,
      [ticketId, req.user!.userId]
    )

    await pool.query(
      `UPDATE tickets SET status = 'assigned', updated_at = NOW() WHERE id = ?`,
      [ticketId]
    )

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'ACCEPT_ASSIGNMENT', 'ticket', ?, ?)`,
      [req.user!.userId, ticketId, 'Technician accepted the assignment']
    )

    await notifyUsers([ticket.created_by_id], `Your ticket #${ticketId} has been assigned to a technician.`)

    res.status(201).json({ id: result.insertId, message: 'Assignment accepted.' })
  } catch (err) { next(err) }
}

/* ── PATCH /interventions/assignments/:ticketId/reject ──
   Technician declines. Ticket bounces back to 'created', unassigned, so
   an admin/agent can pick someone else. No interventions row was ever
   created for a rejected assignment (there's nothing to track). */
export async function rejectAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ticketId } = req.params
    const { reason } = req.body as { reason?: string }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, status, assigned_to_id FROM tickets WHERE id = ?`,
      [ticketId]
    )
    const ticket = rows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }

    if (ticket.assigned_to_id !== req.user!.userId) {
      res.status(403).json({ error: 'This assignment is not yours to respond to.' })
      return
    }
    if (ticket.status !== 'pending_assignment') {
      res.status(400).json({ error: 'This ticket has no pending assignment to respond to.' })
      return
    }

    await pool.query(
      `UPDATE tickets SET status = 'created', assigned_to_id = NULL, updated_at = NOW() WHERE id = ?`,
      [ticketId]
    )

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'REJECT_ASSIGNMENT', 'ticket', ?, ?)`,
      [req.user!.userId, ticketId, `Technician declined${reason?.trim() ? `: ${reason.trim()}` : ''}`]
    )

    const staffIds = await getStaffIds()
    await notifyUsers(staffIds, `Ticket #${ticketId} assignment was declined — needs reassignment.`)

    res.json({ message: 'Assignment rejected. Ticket is available for reassignment.' })
  } catch (err) { next(err) }
}

/* ── POST /interventions/bulk-assign ──
   Admin/agent assigns ONE technician to MULTIPLE tickets at once, from
   the queue's bulk toolbar. Same pending_assignment flow, just looped
   with per-ticket error collection so one bad ticket doesn't abort the
   whole batch. */
export async function bulkAssignIntervention(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ticket_ids, technician_id } = req.body as { ticket_ids: number[]; technician_id: number }

    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0 || !technician_id) {
      res.status(400).json({ error: 'ticket_ids (non-empty array) and technician_id are required.' })
      return
    }
    if (ticket_ids.length > 50) {
      res.status(400).json({ error: 'Cannot bulk-assign more than 50 tickets at once.' })
      return
    }

    const [techRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, first_name, last_name FROM users WHERE id = ? AND role = 'technician' AND is_active = 1`,
      [technician_id]
    )
    const tech = techRows[0]
    if (!tech) { res.status(400).json({ error: 'Selected user is not an active technician.' }); return }

    const [tickets] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, status, assigned_to_id, title FROM tickets WHERE id IN (?)`,
      [ticket_ids]
    )

    const results: { id: number; ok: boolean; error?: string }[] = []
    const techName = `${tech.first_name} ${tech.last_name}`

    for (const ticket of tickets) {
      if (ticket.assigned_to_id || ticket.status !== 'created') {
        results.push({ id: ticket.id, ok: false, error: `Ticket is "${ticket.status}", not assignable.` })
        continue
      }

      await pool.query(
        `UPDATE tickets SET assigned_to_id = ?, status = 'pending_assignment', updated_at = NOW() WHERE id = ?`,
        [technician_id, ticket.id]
      )
      await pool.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'ASSIGN_TICKET', 'ticket', ?, ?)`,
        [req.user!.userId, ticket.id, `Assigned to ${techName}, awaiting response (bulk action)`]
      )
      results.push({ id: ticket.id, ok: true })
    }

    const notFoundIds = ticket_ids.filter(id => !tickets.some(t => t.id === id))
    for (const id of notFoundIds) results.push({ id, ok: false, error: 'Not found.' })

    const succeeded = results.filter(r => r.ok).length
    if (succeeded > 0) {
      await notifyUsers([technician_id], `You've been assigned ${succeeded} ticket(s). Please accept or reject each.`)
    }

    res.json({ message: `${succeeded}/${ticket_ids.length} ticket(s) assigned to ${techName}.`, results })
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