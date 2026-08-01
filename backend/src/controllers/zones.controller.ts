import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest } from '../types'
import mysql from 'mysql2/promise'

export async function listZones(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT z.id,
         z.name,
         z.region,
         z.created_at AS createdAt,
         COUNT(DISTINCT CASE WHEN u.role = 'technician'   AND u.is_active = 1 THEN u.id END) AS technicianCount,
         COUNT(DISTINCT CASE WHEN u.role = 'support_agent' AND u.is_active = 1 THEN u.id END) AS agentCount,
         COUNT(DISTINCT CASE WHEN t.status NOT IN ('resolved','closed') THEN t.id END) AS openTicketCount,
         COUNT(DISTINCT CASE WHEN t.status NOT IN ('resolved','closed') AND t.priority = 'critical' THEN t.id END) AS criticalTicketCount
       FROM zones z
       LEFT JOIN users u   ON u.zone_id = z.id
       LEFT JOIN tickets t ON t.zone_id = z.id
       GROUP BY z.id
       ORDER BY z.name`
    )
    res.json(rows)
  } catch (err) { next(err) }
}

export async function listZoneTechnicians(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, first_name AS firstName, last_name AS lastName, role
       FROM users
       WHERE zone_id = ? AND is_active = 1 AND role IN ('technician','support_agent')
       ORDER BY role, first_name`,
      [id]
    )
    res.json(rows)
  } catch (err) { next(err) }
}

export async function createZone(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, region } = req.body as { name?: string; region?: string }
    if (!name?.trim() || !region?.trim()) {
      res.status(400).json({ error: 'Name and region are required.' })
      return
    }
    const [result] = await pool.query<mysql.ResultSetHeader>(
      'INSERT INTO zones (name, region) VALUES (?, ?)',
      [name.trim(), region.trim()]
    )
    res.status(201).json({ id: result.insertId, message: 'Zone created.' })
  } catch (err) { next(err) }
}

export async function updateZone(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { name, region } = req.body as { name?: string; region?: string }
    const fields: string[] = []
    const params: unknown[] = []
    if (name?.trim())   { fields.push('name = ?');   params.push(name.trim()) }
    if (region?.trim()) { fields.push('region = ?'); params.push(region.trim()) }
    if (!fields.length) { res.status(400).json({ error: 'No fields to update.' }); return }
    params.push(id)
    await pool.query(`UPDATE zones SET ${fields.join(', ')} WHERE id = ?`, params)
    res.json({ message: 'Zone updated.' })
  } catch (err) { next(err) }
}