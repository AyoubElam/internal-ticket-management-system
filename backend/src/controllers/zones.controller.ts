import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest } from '../types'
import mysql from 'mysql2/promise'

export async function listZones(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT z.*,
         COUNT(DISTINCT u.id) AS user_count,
         COUNT(DISTINCT t.id) AS ticket_count
       FROM zones z
       LEFT JOIN users u   ON u.zone_id = z.id
       LEFT JOIN tickets t ON t.zone_id = z.id
       GROUP BY z.id
       ORDER BY z.name`
    )
    res.json(rows)
  } catch (err) { next(err) }
}

export async function createZone(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, region } = req.body as { name: string; region: string }
    const [result] = await pool.query<mysql.ResultSetHeader>(
      'INSERT INTO zones (name, region) VALUES (?, ?)',
      [name, region]
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
    if (name)   { fields.push('name = ?');   params.push(name) }
    if (region) { fields.push('region = ?'); params.push(region) }
    if (!fields.length) { res.status(400).json({ error: 'No fields to update.' }); return }
    params.push(id)
    await pool.query(`UPDATE zones SET ${fields.join(', ')} WHERE id = ?`, params)
    res.json({ message: 'Zone updated.' })
  } catch (err) { next(err) }
}
