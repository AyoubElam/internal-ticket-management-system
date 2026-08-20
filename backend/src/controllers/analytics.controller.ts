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

    // category is now category_id (FK to categories.id) — join to get the
    // slug back for the frontend, which still expects the old
    // 'network_support' style string in byCategory[].category.
    const [byCategory] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cat.slug AS category, COUNT(*) AS count
       FROM tickets t
       LEFT JOIN categories cat ON cat.id = t.category_id
       GROUP BY cat.id, cat.slug`
    )

    // Read the requested period (7 or 30 days, default 7)
    const days = Math.min(Math.max(parseInt(String(req.query.days)) || 7, 1), 30)

    // Build a numbers table with 0..days-1 to generate one row per day.
    // MySQL doesn't have generate_series, so we build it with UNIONs.
    const nums = Array.from({ length: days }, (_, i) => `SELECT ${i} AS n`).join(' UNION ALL ')

    const [overTime] = await pool.query<mysql.RowDataPacket[]>(`
      SELECT
        DATE_FORMAT(d.dt, '%b %d') AS date,
        COALESCE(SUM(t.created_at >= d.dt AND t.created_at < DATE_ADD(d.dt, INTERVAL 1 DAY)), 0) AS created,
        COALESCE(SUM(t.resolved_at >= d.dt AND t.resolved_at < DATE_ADD(d.dt, INTERVAL 1 DAY)), 0) AS resolved
      FROM (
        SELECT DATE(NOW() - INTERVAL nums.n DAY) AS dt
        FROM (${nums}) AS nums
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

    // Same SLA thresholds, broken out per priority — powers the 4 SLA bars
    // on the analytics page, which used to be hardcoded fake numbers.
    const [slaByPriority] = await pool.query<mysql.RowDataPacket[]>(`
      SELECT
        priority,
        COUNT(*) AS total,
        ROUND(100.0 * SUM(
          CASE
            WHEN priority = 'critical' AND TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, NOW())) <= 4   THEN 1
            WHEN priority = 'high'     AND TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, NOW())) <= 24  THEN 1
            WHEN priority = 'medium'   AND TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, NOW())) <= 72  THEN 1
            WHEN priority = 'low'      AND TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, NOW())) <= 168 THEN 1
            ELSE 0
          END
        ) / COUNT(*), 1) AS compliance
      FROM tickets
      GROUP BY priority
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
      slaByPriority:        slaByPriority,
      byStatus:             byStatus,
      byPriority:           byPriority,
      byCategory:           byCategory,
      ticketsOverTime:      overTime,
    })
  } catch (err) { next(err) }
}

/* ── GET /analytics/my-kpi ── */
/* Support agent's personal KPI. "Handled" = any ticket this agent has
   acted on (status/priority change), taken from activity_logs since
   tickets don't carry an agent_id column — only assigned_to_id, which
   is the technician. */
export async function getMyKpi(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const agentId = req.user!.userId

    const [[{ handled }]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(DISTINCT entity_id) AS handled
       FROM activity_logs
       WHERE user_id = ? AND entity_type = 'ticket' AND action = 'UPDATE_TICKET'`,
      [agentId]
    )

    const [[{ resolved, avg_resolution_hours }]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         COUNT(*) AS resolved,
         AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.resolved_at)) AS avg_resolution_hours
       FROM tickets t
       WHERE t.status IN ('resolved', 'closed')
         AND t.resolved_at IS NOT NULL
         AND t.id IN (
           SELECT DISTINCT entity_id FROM activity_logs
           WHERE user_id = ? AND entity_type = 'ticket' AND action = 'UPDATE_TICKET'
         )`,
      [agentId]
    )

    const resolutionRate = handled > 0 ? Math.round((resolved / handled) * 100) : 0

    res.json({
      tickets_handled: handled,
      tickets_resolved: resolved,
      resolution_rate: resolutionRate,
      avg_resolution_hours: avg_resolution_hours ? Math.round(avg_resolution_hours * 10) / 10 : null,
    })
  } catch (err) { next(err) }
}