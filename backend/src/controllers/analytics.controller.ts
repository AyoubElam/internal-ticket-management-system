import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest } from '../types'
import mysql from 'mysql2/promise'

export async function getKpiStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [[totals]] = await pool.query<mysql.RowDataPacket[]>(`
      SELECT
        COUNT(*) AS total_tickets,
        SUM(status NOT IN ('resolved','closed')) AS open_tickets,
        SUM(status IN ('resolved','closed') AND DATE(resolved_at) = CURDATE()) AS resolved_today,
        AVG(CASE WHEN resolved_at IS NOT NULL
            THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END) AS avg_resolution_hours,
        SUM(priority = 'critical' AND status NOT IN ('resolved','closed')) AS critical_open
      FROM tickets
    `)

    const [byStatus] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT status, COUNT(*) AS count FROM tickets GROUP BY status`
    )

    const [byPriority] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT priority, COUNT(*) AS count FROM tickets GROUP BY priority`
    )

    const [byCategory] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT category, COUNT(*) AS count FROM tickets GROUP BY category`
    )

    const [overTime] = await pool.query<mysql.RowDataPacket[]>(`
      SELECT
        DATE_FORMAT(d.dt, '%b %d') AS date,
        COALESCE(SUM(t.created_at >= d.dt AND t.created_at < DATE_ADD(d.dt, INTERVAL 1 DAY)), 0) AS created,
        COALESCE(SUM(t.resolved_at >= d.dt AND t.resolved_at < DATE_ADD(d.dt, INTERVAL 1 DAY)), 0) AS resolved
      FROM (
        SELECT DATE(NOW() - INTERVAL (a.a + (10 * b.a)) DAY) AS dt
        FROM (SELECT 0 a UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) a
        CROSS JOIN (SELECT 0 a) b
        WHERE a.a <= 6
      ) d
      LEFT JOIN tickets t ON 1=1
      GROUP BY d.dt
      ORDER BY d.dt
    `)

    const [[sla]] = await pool.query<mysql.RowDataPacket[]>(`
      SELECT ROUND(
        100.0 * SUM(
          CASE
            WHEN priority = 'critical' AND TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, NOW())) <= 4  THEN 1
            WHEN priority = 'high'     AND TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, NOW())) <= 24 THEN 1
            WHEN priority = 'medium'   AND TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, NOW())) <= 72 THEN 1
            WHEN priority = 'low'      AND TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, NOW())) <= 168 THEN 1
            ELSE 0
          END
        ) / COUNT(*), 1
      ) AS sla_compliance
      FROM tickets
    `)

    res.json({
      totalTickets:         totals.total_tickets,
      openTickets:          totals.open_tickets,
      resolvedToday:        totals.resolved_today,
      avgResolutionHours:   totals.avg_resolution_hours
        ? Math.round(Number(totals.avg_resolution_hours) * 10) / 10
        : 0,
      criticalOpen:         totals.critical_open,
      slaCompliance:        sla.sla_compliance ?? 0,
      byStatus:             byStatus,
      byPriority:           byPriority,
      byCategory:           byCategory,
      ticketsOverTime:      overTime,
    })
  } catch (err) { next(err) }
}
