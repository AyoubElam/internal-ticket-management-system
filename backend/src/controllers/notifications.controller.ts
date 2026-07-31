import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest } from '../types'
import mysql from 'mysql2/promise'

/* ── GET /notifications ── */
export async function listNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, user_id, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user!.userId]
    )
    res.json({ data: rows })
  } catch (err) { next(err) }
}

/* ── PATCH /notifications/:id/read ── */
export async function markNotificationRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, req.user!.userId]
    )
    res.json({ message: 'Marked as read.' })
  } catch (err) { next(err) }
}

/* ── PATCH /notifications/read-all ── */
export async function markAllRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
      [req.user!.userId]
    )
    res.json({ message: 'All marked as read.' })
  } catch (err) { next(err) }
}