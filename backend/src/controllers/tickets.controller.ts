import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest, TicketStatus, TicketPriority, TicketCategory } from '../types'
import mysql from 'mysql2/promise'

/* ── helpers ── */
function paginate(page?: string | number, limit?: string | number) {
  const p = Math.max(1, Number(page) || 1)
  const l = Math.min(100, Math.max(1, Number(limit) || 20))
  return { offset: (p - 1) * l, limit: l, page: p }
}

const STATUS_VERB: Record<string, string> = {
  created:     'created',
  assigned:    'assigned to a technician',
  in_progress: 'marked as in progress',
  resolved:    'resolved',
  closed:      'closed',
  cancelled:   'cancelled',
}

async function notifyUsers(userIds: number[], message: string): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (!unique.length) return
  const values = unique.map((id) => [id, message, 0])
  await pool.query(
    `INSERT INTO notifications (user_id, message, is_read) VALUES ?`,
    [values]
  )
}

// Shared visibility check — same rule used by getTicket and now the
// timeline endpoint: employee sees only their own, technician only what's
// assigned to them, admin/support_agent see everything.
async function assertCanViewTicket(
  req: AuthRequest, ticketId: string
): Promise<{ ok: true; ticket: mysql.RowDataPacket } | { ok: false; status: number; error: string }> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, created_by_id, assigned_to_id FROM tickets WHERE id = ?`,
    [ticketId]
  )
  const ticket = rows[0]
  if (!ticket) return { ok: false, status: 404, error: 'Ticket not found.' }

  if (req.user!.role === 'employee' && ticket.created_by_id !== req.user!.userId) {
    return { ok: false, status: 403, error: 'Forbidden.' }
  }
  if (req.user!.role === 'technician' && ticket.assigned_to_id !== req.user!.userId) {
    return { ok: false, status: 403, error: 'Forbidden.' }
  }
  return { ok: true, ticket }
}

/* ── GET /tickets ── */
export async function listTickets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, status, priority, category } = req.query as Record<string, string>
    const { offset, limit: lim } = paginate(page, limit)

    const where: string[] = []
    const params: unknown[] = []

    if (req.user!.role === 'employee') {
      where.push('t.created_by_id = ?')
      params.push(req.user!.userId)
    }
    if (req.user!.role === 'technician') {
      where.push('t.assigned_to_id = ?')
      params.push(req.user!.userId)
    }

    if (status)   { where.push('t.status = ?');   params.push(status) }
    if (priority) { where.push('t.priority = ?'); params.push(priority) }
    if (category) { where.push('t.category = ?'); params.push(category) }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // location_label (t.location_label, straight off the ticket) is the
    // display value — the exact place the employee picked.
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         t.*,
         CONCAT(cb.first_name, ' ', cb.last_name) AS created_by_name,
         CONCAT(ab.first_name, ' ', ab.last_name) AS assigned_to_name,
         COUNT(c.id) AS comments_count
       FROM tickets t
       LEFT JOIN users  cb ON cb.id = t.created_by_id
       LEFT JOIN users  ab ON ab.id = t.assigned_to_id
       LEFT JOIN comments c ON c.ticket_id = t.id
       ${whereSQL}
       GROUP BY t.id
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, lim, offset]
    )
    const [[{ total }]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM tickets t ${whereSQL}`,
      params
    )

    res.json({ data: rows, total, page: Number(page) || 1, limit: lim })
  } catch (err) { next(err) }
}

/* ── GET /tickets/:id ── */
export async function getTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.*,
         CONCAT(cb.first_name, ' ', cb.last_name) AS created_by_name,
         cb.role AS created_by_role,
         CONCAT(ab.first_name, ' ', ab.last_name) AS assigned_to_name,
         ab.role AS assigned_to_role,
         r.rating  AS employee_rating,
         r.comment AS rating_comment
       FROM tickets t
       LEFT JOIN users cb ON cb.id = t.created_by_id
       LEFT JOIN users ab ON ab.id = t.assigned_to_id
       LEFT JOIN ticket_ratings r ON r.ticket_id = t.id
       WHERE t.id = ?`,
      [id]
    )
    if (!rows[0]) { res.status(404).json({ error: 'Ticket not found.' }); return }

    if (req.user!.role === 'employee' && rows[0].created_by_id !== req.user!.userId) {
      res.status(403).json({ error: 'Forbidden.' }); return
    }
    // Technicians may only open tickets assigned to them.
    if (req.user!.role === 'technician' && rows[0].assigned_to_id !== req.user!.userId) {
      res.status(403).json({ error: 'Forbidden.' }); return
    }

    const [comments] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT c.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.role AS user_role
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.ticket_id = ?
       ORDER BY c.created_at ASC`,
      [id]
    )

    // Hide internal notes from anyone who isn't admin/support_agent
    const isStaff = req.user!.role === 'admin' || req.user!.role === 'support_agent'
    const visibleComments = isStaff ? comments : comments.filter(c => !c.is_internal)

    res.json({ ...rows[0], comments: visibleComments })
  } catch (err) { next(err) }
}

/* ── GET /tickets/:id/timeline ──
   Full chronological activity log for one ticket — creation, edits,
   status changes, cancellation, rating, etc. Same visibility rule as
   getTicket: employee (own ticket only), technician (assigned only),
   admin/support_agent (any). Available to all three roles the person
   asked for (employee, agent, admin) via that shared rule. */
export async function getTicketTimeline(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params

    const access = await assertCanViewTicket(req, id)
    if (!access.ok) { res.status(access.status).json({ error: access.error }); return }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         a.id, a.action, a.details, a.created_at,
         CONCAT(u.first_name, ' ', u.last_name) AS user_name,
         u.role AS user_role
       FROM activity_logs a
       JOIN users u ON u.id = a.user_id
       WHERE a.entity_type = 'ticket' AND a.entity_id = ?
       ORDER BY a.created_at ASC`,
      [id]
    )

    res.json(rows)
  } catch (err) { next(err) }
}

/* ── POST /tickets ── */
export async function createTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, description, category, priority } = req.body as {
      title: string; description: string
      category: TicketCategory; priority: TicketPriority
    }

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO tickets (title, description, category, priority, status, created_by_id)
       VALUES (?, ?, ?, ?, 'created', ?)`,
      [title, description, category, priority, req.user!.userId]
    )

    const ticketId = result.insertId

    // Activity log
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'CREATE_TICKET', 'ticket', ?, ?)`,
      [req.user!.userId, ticketId, `Created ticket: ${title}`]
    )

    // Notify all admins and support agents
    const [staff] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id FROM users WHERE role IN ('admin', 'support_agent')`
    )

    if (staff.length > 0) {
      const notifMessage = priority === 'critical'
        ? `New critical ticket #${ticketId} requires immediate attention.`
        : `New ticket #${ticketId} has been submitted.`

      const values = staff.map((u) => [u.id, notifMessage, 0])
      await pool.query(
        `INSERT INTO notifications (user_id, message, is_read) VALUES ?`,
        [values]
      )
    }

    res.status(201).json({ id: ticketId, message: 'Ticket created.' })
  } catch (err) { next(err) }
}

/* ── PATCH /tickets/:id ──
   support_agent: status ONLY (technician assignment still goes through
   POST /interventions, not here).
   admin: status + title/description/category/priority/location — full edit. */
export async function updateTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const {
      status, assigned_to_id, priority,
      title, description, category,
    } = req.body as {
      status?: TicketStatus; assigned_to_id?: number; priority?: TicketPriority
      title?: string; description?: string; category?: TicketCategory
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, title, status, assigned_to_id, created_by_id FROM tickets WHERE id = ?`,
      [id]
    )
    const ticket = rows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }

    // Technicians no longer PATCH tickets directly — their status changes
    // go through PATCH /interventions/:id, which syncs the ticket status
    // itself. Route-level authorize() also excludes technician now; this
    // is a defense-in-depth check in case that ever drifts.
    if (req.user!.role === 'technician') {
      res.status(403).json({ error: 'Technicians update status via their assigned intervention, not directly.' })
      return
    }

    // assigned_to_id is no longer settable here either — assignment only
    // happens through POST /interventions, which also creates the
    // dispatch record. Setting it here would silently orphan a ticket
    // from an intervention row.
    if (assigned_to_id !== undefined) {
      res.status(400).json({ error: 'Use POST /interventions to assign a technician, not PATCH /tickets/:id.' })
      return
    }

    // support_agent can only move `status` through this endpoint. Everything
    // else (title/description/category/priority) is admin-only.
    // This is defense-in-depth — the UI never sends these fields for an
    // agent — but we still reject them server-side in case that drifts.
    const isAdmin = req.user!.role === 'admin'
    const triedRestrictedField =
      priority !== undefined || title !== undefined ||
      description !== undefined || category !== undefined
    if (!isAdmin && triedRestrictedField) {
      res.status(403).json({ error: 'Support agents can only update status here. Ask an admin for other changes.' })
      return
    }

    const fields: string[] = []
    const params: unknown[] = []

    if (status)                  { fields.push('status = ?');         params.push(status) }
    if (isAdmin && title)              { fields.push('title = ?');          params.push(title) }
    if (isAdmin && description)        { fields.push('description = ?');    params.push(description) }
    if (isAdmin && category)           { fields.push('category = ?');       params.push(category) }
    if (isAdmin && priority)           { fields.push('priority = ?');       params.push(priority) }

    if (status === 'resolved' || status === 'closed') {
      fields.push('resolved_at = NOW()')
    }

    if (!fields.length) { res.status(400).json({ error: 'No fields to update.' }); return }

    fields.push('updated_at = NOW()')
    params.push(id)

    await pool.query(
      `UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`,
      params
    )

    // Activity log — write a clean, human-readable summary keyed to the
    // simplified 4-stage timeline (Created / Assigned / In Progress /
    // Resolved) instead of dumping raw request JSON.
    let logAction = 'UPDATE_TICKET'
    let logDetails = 'Ticket updated'

    if (status === 'resolved') {
      logAction = 'RESOLVE_TICKET'
      logDetails = 'Ticket resolved'
    } else if (status === 'closed') {
      logAction = 'CLOSE_TICKET'
      logDetails = 'Ticket closed'
    } else if (status && status !== ticket.status) {
      logAction = 'UPDATE_TICKET'
      logDetails = `Status changed to ${status.replace('_', ' ')}`
    } else if (isAdmin && (priority || title || description || category)) {
      logDetails = 'Ticket details updated'
    }

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, 'ticket', ?, ?)`,
      [req.user!.userId, logAction, id, logDetails]
    )

    // Notifications
    if (status && status !== ticket.status) {
      const verb = STATUS_VERB[status] ?? status
      await notifyUsers(
        [ticket.created_by_id],
        `Your ticket #${id} has been ${verb}.`
      )
    }

    res.json({ message: 'Ticket updated.' })
  } catch (err) { next(err) }
}

/* ── POST /tickets/:id/comments ── */
export async function addComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { content, is_internal } = req.body as { content: string; is_internal?: boolean }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, created_by_id, assigned_to_id FROM tickets WHERE id = ?`,
      [id]
    )
    const ticket = rows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }

    const role = req.user!.role
    if (role === 'employee' && ticket.created_by_id !== req.user!.userId) {
      res.status(403).json({ error: 'Forbidden.' }); return
    }
    if (role === 'technician' && ticket.assigned_to_id !== req.user!.userId) {
      res.status(403).json({ error: 'Forbidden.' }); return
    }

    const internal = (role === 'admin' || role === 'support_agent')
      ? (is_internal ?? false)
      : false

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO comments (ticket_id, user_id, content, is_internal)
       VALUES (?, ?, ?, ?)`,
      [id, req.user!.userId, content, internal]
    )

    // Notify the other party. Internal notes are staff-only visibility,
    // so the employee creator never gets pinged about those.
    const recipients = new Set<number>()
    if (ticket.created_by_id !== req.user!.userId) recipients.add(ticket.created_by_id)
    if (ticket.assigned_to_id && ticket.assigned_to_id !== req.user!.userId) recipients.add(ticket.assigned_to_id)
    if (internal) recipients.delete(ticket.created_by_id)
    await notifyUsers([...recipients], `New comment on ticket #${id}.`)

    res.status(201).json({ id: result.insertId, message: 'Comment added.' })
  } catch (err) { next(err) }
}

/* ── PATCH /tickets/:id/edit (employee edits their own ticket, only while status = 'created') ── */
export async function editTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { title, description, category, priority } = req.body as {
      title?: string; description?: string; category?: TicketCategory; priority?: TicketPriority
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, status, created_by_id FROM tickets WHERE id = ?`,
      [id]
    )
    const ticket = rows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }

    // Only the creator can edit
    if (ticket.created_by_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only edit your own tickets.' }); return
    }

    // Only editable while still in 'created' status
    if (ticket.status !== 'created') {
      res.status(400).json({ error: 'This ticket can no longer be edited because it is already being handled.' })
      return
    }

    const fields: string[] = []
    const params: unknown[] = []

    if (title)       { fields.push('title = ?');       params.push(title) }
    if (description) { fields.push('description = ?'); params.push(description) }
    if (category)    { fields.push('category = ?');    params.push(category) }
    if (priority)    { fields.push('priority = ?');     params.push(priority) }

    if (!fields.length) { res.status(400).json({ error: 'No fields to update.' }); return }

    fields.push('updated_at = NOW()')
    params.push(id)

    await pool.query(
      `UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`,
      params
    )

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'EDIT_TICKET', 'ticket', ?, ?)`,
      [req.user!.userId, id, `Edited: ${JSON.stringify(req.body)}`]
    )

    res.json({ message: 'Ticket updated.' })
  } catch (err) { next(err) }
}

/* ── PATCH /tickets/:id/cancel (employee cancels their own ticket, only while status = 'created') ── */
export async function cancelTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, status, created_by_id FROM tickets WHERE id = ?`,
      [id]
    )
    const ticket = rows[0]
    if (!ticket) { res.status(404).json({ error: 'Ticket not found.' }); return }

    if (ticket.created_by_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only cancel your own tickets.' }); return
    }

    if (ticket.status !== 'created') {
      res.status(400).json({ error: 'This ticket can no longer be cancelled because it is already being handled.' })
      return
    }

    await pool.query(
      `UPDATE tickets SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [id]
    )

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'CANCEL_TICKET', 'ticket', ?, ?)`,
      [req.user!.userId, id, 'Ticket cancelled by requester']
    )

    res.json({ message: 'Ticket cancelled.' })
  } catch (err) { next(err) }
}

/* ── PATCH /tickets/bulk ──
   Bulk status and/or priority change for admin/support_agent, driven by
   the ticket queue's multi-select toolbar. Each ticket is validated
   individually against the same rules as the single-ticket updateTicket
   endpoint (support_agent: status only; admin: status + priority) so
   nothing here bypasses the normal permission model — it's just looped.

   Only allows the same "safe" bulk-friendly transitions: resolved→closed
   and cancelling. Assignment (created→pending_assignment) is NOT done
   here — that goes through the dedicated bulk-assign intervention
   endpoint, since it also has to create per-ticket intervention rows and
   respect the technician-acceptance flow. */
export async function bulkUpdateTickets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ticket_ids, status, priority } = req.body as {
      ticket_ids: number[]; status?: TicketStatus; priority?: TicketPriority
    }

    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      res.status(400).json({ error: 'ticket_ids must be a non-empty array.' })
      return
    }
    if (ticket_ids.length > 100) {
      res.status(400).json({ error: 'Cannot bulk-update more than 100 tickets at once.' })
      return
    }
    if (!status && !priority) {
      res.status(400).json({ error: 'Provide a status and/or priority to apply.' })
      return
    }

    const isAdmin = req.user!.role === 'admin'
    if (priority && !isAdmin) {
      res.status(403).json({ error: 'Only admins can bulk-update priority.' })
      return
    }

    // Bulk status changes are limited to the safe, unambiguous transitions.
    // Anything involving assignment goes through /interventions/bulk-assign
    // instead, since it needs the acceptance flow.
    const ALLOWED_BULK_STATUSES: TicketStatus[] = ['closed', 'cancelled']
    if (status && !ALLOWED_BULK_STATUSES.includes(status)) {
      res.status(400).json({
        error: `Bulk status change to "${status}" isn't supported. Use bulk-assign for assignment, or update tickets individually for other transitions.`,
      })
      return
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, status, created_by_id FROM tickets WHERE id IN (?)`,
      [ticket_ids]
    )

    const results: { id: number; ok: boolean; error?: string }[] = []

    for (const ticket of rows) {
      // Same per-ticket guard rules as the single-ticket endpoints.
      if (status === 'closed' && ticket.status !== 'resolved') {
        results.push({ id: ticket.id, ok: false, error: 'Not resolved yet.' })
        continue
      }
      if (status === 'cancelled' && ticket.status !== 'created') {
        results.push({ id: ticket.id, ok: false, error: 'Already being handled.' })
        continue
      }

      const fields: string[] = ['updated_at = NOW()']
      const params: unknown[] = []
      if (status)   { fields.push('status = ?');   params.push(status) }
      if (priority) { fields.push('priority = ?'); params.push(priority) }
      if (status === 'closed') fields.push('resolved_at = COALESCE(resolved_at, NOW())')
      params.push(ticket.id)

      await pool.query(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, params)

      const action = status === 'closed' ? 'CLOSE_TICKET' : status === 'cancelled' ? 'CANCEL_TICKET' : 'UPDATE_TICKET'
      const details = status === 'closed' ? 'Ticket closed (bulk action)'
        : status === 'cancelled' ? 'Ticket cancelled (bulk action)'
        : `Priority set to ${priority} (bulk action)`

      await pool.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'ticket', ?, ?)`,
        [req.user!.userId, action, ticket.id, details]
      )

      results.push({ id: ticket.id, ok: true })
    }

    const notFoundIds = ticket_ids.filter(id => !rows.some(r => r.id === id))
    for (const id of notFoundIds) results.push({ id, ok: false, error: 'Not found.' })

    const succeeded = results.filter(r => r.ok).length
    res.json({
      message: `${succeeded}/${ticket_ids.length} ticket(s) updated.`,
      results,
    })
  } catch (err) { next(err) }
}