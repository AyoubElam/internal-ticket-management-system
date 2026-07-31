import type { Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../config/database'
import type { AuthRequest, Role } from '../types'
import mysql from 'mysql2/promise'

/* ── GET /users ── */
export async function listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role, zone_id, is_active } = req.query as Record<string, string>

    const where: string[] = []
    const params: unknown[] = []

    if (role)      { where.push('role = ?');      params.push(role) }
    if (zone_id)   { where.push('zone_id = ?');   params.push(zone_id) }
    if (is_active) { where.push('is_active = ?'); params.push(is_active === 'true' ? 1 : 0) }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, role, zone_id, is_active, created_at
       FROM users ${whereSQL} ORDER BY created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) { next(err) }
}

/* ── GET /users/:id ── */
export async function getUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, role, zone_id, is_active, created_at
       FROM users WHERE id = ?`,
      [req.params.id]
    )
    if (!rows[0]) { res.status(404).json({ error: 'User not found.' }); return }
    res.json(rows[0])
  } catch (err) { next(err) }
}

/* ── POST /users ── */
export async function createUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, first_name, last_name, role, zone_id } = req.body as {
      email: string; password: string; first_name: string
      last_name: string; role: Role; zone_id?: number
    }

    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?', [email]
    )
    if ((existing as unknown[]).length > 0) {
      res.status(409).json({ error: 'Email already in use.' }); return
    }

    const hash = await bcrypt.hash(password, 12)

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, zone_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, hash, first_name, last_name, role, zone_id ?? null]
    )

    res.status(201).json({ id: result.insertId, message: 'User created.' })
  } catch (err) { next(err) }
}

/* ── PATCH /users/:id ── */
export async function updateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { first_name, last_name, role, zone_id, is_active } = req.body as {
      first_name?: string; last_name?: string; role?: Role
      zone_id?: number | null; is_active?: boolean
    }

    const fields: string[] = []
    const params: unknown[] = []

    if (first_name  !== undefined) { fields.push('first_name = ?');  params.push(first_name) }
    if (last_name   !== undefined) { fields.push('last_name = ?');   params.push(last_name) }
    if (role        !== undefined) { fields.push('role = ?');        params.push(role) }
    if (zone_id     !== undefined) { fields.push('zone_id = ?');     params.push(zone_id) }
    if (is_active   !== undefined) { fields.push('is_active = ?');   params.push(is_active ? 1 : 0) }

    if (!fields.length) { res.status(400).json({ error: 'No fields to update.' }); return }
    params.push(id)

    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)
    res.json({ message: 'User updated.' })
  } catch (err) { next(err) }
}
