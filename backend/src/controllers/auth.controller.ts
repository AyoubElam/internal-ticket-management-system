import type { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../config/database'
import { signToken } from '../config/jwt'
import type { User, AuthRequest } from '../types'

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string }

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' })
      return
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
      [email]
    )

    const user = rows[0] as User & { password_hash: string } | undefined
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials.' })
      return
    }

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      res.status(401).json({ error: 'Invalid credentials.' })
      return
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email })

    res.json({
      token,
      user: {
        id:         user.id,
        email:      user.email,
        firstName:  user.first_name,
        lastName:   user.last_name,
        role:       user.role,
        zoneId:     user.zone_id,
        isActive:   user.is_active,
        createdAt:  user.created_at,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, email, first_name, last_name, role, zone_id, is_active, created_at FROM users WHERE id = ?',
      [req.user!.userId]
    )
    if (!rows[0]) { res.status(404).json({ error: 'User not found.' }); return }
    res.json(rows[0])
  } catch (err) {
    next(err)
  }
}

// fix import
import mysql from 'mysql2/promise'
