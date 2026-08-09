import type { Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../config/database'
import type { AuthRequest, Role } from '../types'
import mysql from 'mysql2/promise'

/* ── GET /users ── */
export async function listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role, is_active } = req.query as Record<string, string>

    const where: string[] = []
    const params: unknown[] = []

    if (role)      { where.push('role = ?');      params.push(role) }
    if (is_active) { where.push('is_active = ?'); params.push(is_active === 'true' ? 1 : 0) }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, role, is_active, created_at
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
      `SELECT id, email, first_name, last_name, role, is_active, created_at
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
    const { email, password, first_name, last_name, role } = req.body as {
      email: string; password: string; first_name: string
      last_name: string; role: Role
    }

    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?', [email]
    )
    if ((existing as unknown[]).length > 0) {
      res.status(409).json({ error: 'Email already in use.' }); return
    }

    const hash = await bcrypt.hash(password, 12)

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?)`,
      [email, hash, first_name, last_name, role]
    )

    res.status(201).json({ id: result.insertId, message: 'User created.' })
  } catch (err) { next(err) }
}

/* ── PATCH /users/:id ── (admin only: role, active status, or another user's name) */
export async function updateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { first_name, last_name, role, is_active } = req.body as {
      first_name?: string; last_name?: string; role?: Role; is_active?: boolean
    }

    const fields: string[] = []
    const params: unknown[] = []

    if (first_name  !== undefined) { fields.push('first_name = ?');  params.push(first_name) }
    if (last_name   !== undefined) { fields.push('last_name = ?');   params.push(last_name) }
    if (role        !== undefined) { fields.push('role = ?');        params.push(role) }
    if (is_active   !== undefined) { fields.push('is_active = ?');   params.push(is_active ? 1 : 0) }

    if (!fields.length) { res.status(400).json({ error: 'No fields to update.' }); return }
    params.push(id)

    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)
    res.json({ message: 'User updated.' })
  } catch (err) { next(err) }
}

/* ── PATCH /users/me ── (NEW: any authenticated user updates their own name)
   Deliberately does NOT accept role or is_active — those stay admin-only
   via updateUser above. A regular employee/technician/agent hitting this
   route can never promote themselves or reactivate their own account. */
export async function updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId
    const { first_name, last_name } = req.body as { first_name?: string; last_name?: string }

    const fields: string[] = []
    const params: unknown[] = []

    if (first_name !== undefined) {
      if (!first_name.trim()) { res.status(400).json({ error: 'First name cannot be empty.' }); return }
      fields.push('first_name = ?'); params.push(first_name.trim())
    }
    if (last_name !== undefined) {
      if (!last_name.trim()) { res.status(400).json({ error: 'Last name cannot be empty.' }); return }
      fields.push('last_name = ?'); params.push(last_name.trim())
    }

    if (!fields.length) { res.status(400).json({ error: 'No fields to update.' }); return }
    params.push(userId)

    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, role, is_active, created_at
       FROM users WHERE id = ?`,
      [userId]
    )
    res.json(rows[0])
  } catch (err) { next(err) }
}

/* ── PATCH /users/me/password ── (NEW: any authenticated user changes their own password) */
export async function changeMyPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId
    const { current_password, new_password } = req.body as {
      current_password?: string; new_password?: string
    }

    if (!current_password || !new_password) {
      res.status(400).json({ error: 'Current and new password are required.' }); return
    }
    if (new_password.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' }); return
    }
    if (current_password === new_password) {
      res.status(400).json({ error: 'New password must be different from the current password.' }); return
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    )
    if (!rows[0]) { res.status(404).json({ error: 'User not found.' }); return }

    const valid = await bcrypt.compare(current_password, rows[0].password_hash)
    if (!valid) { res.status(401).json({ error: 'Current password is incorrect.' }); return }

    const hash = await bcrypt.hash(new_password, 12)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId])

    res.json({ message: 'Password updated successfully.' })
  } catch (err) { next(err) }
}