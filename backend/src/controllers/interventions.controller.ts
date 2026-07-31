import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest, InterventionStatus } from '../types'
import mysql from 'mysql2/promise'

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
         t.title AS ticket_title, t.priority, t.category, t.zone_id,
         CONCAT(u.first_name, ' ', u.last_name) AS technician_name,
         z.name AS zone_name
       FROM interventions i
       JOIN tickets t  ON t.id = i.ticket_id
       JOIN users   u  ON u.id = i.technician_id
       LEFT JOIN zones z ON z.id = t.zone_id
       ${whereSQL}
       ORDER BY i.updated_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) { next(err) }
}

/* ── POST /interventions ── */
export async function createIntervention(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ticket_id, technician_id, notes } = req.body as {
      ticket_id: number; technician_id: number; notes?: string
    }

    // Auto-assign ticket
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

    res.status(201).json({ id: result.insertId, message: 'Intervention created.' })
  } catch (err) { next(err) }
}

/* ── PATCH /interventions/:id ── */
export async function updateIntervention(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { status, notes } = req.body as { status?: InterventionStatus; notes?: string }

    const fields: string[] = ['updated_at = NOW()']
    const params: unknown[] = []

    if (status) { fields.push('status = ?'); params.push(status) }
    if (notes  !== undefined) { fields.push('notes = ?'); params.push(notes) }

    params.push(id)

    await pool.query(`UPDATE interventions SET ${fields.join(', ')} WHERE id = ?`, params)

    // If completed, update parent ticket to in_progress or resolved
    if (status === 'completed') {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT ticket_id FROM interventions WHERE id = ?', [id]
      )
      if (rows[0]) {
        await pool.query(
          `UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [rows[0].ticket_id]
        )
      }
    }

    res.json({ message: 'Intervention updated.' })
  } catch (err) { next(err) }
}
