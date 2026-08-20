import type { Response, NextFunction } from 'express'
import pool from '../config/database'
import type { AuthRequest } from '../types'
import mysql from 'mysql2/promise'

/* ── GET /categories ── */
/* Public (any authenticated role) — active categories only, used by the
   ticket creation form's category picker. */
export async function listCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, slug, label, sla_hours, is_active, sort_order
       FROM categories
       WHERE is_active = 1
       ORDER BY sort_order ASC, label ASC`
    )
    res.json(rows)
  } catch (err) { next(err) }
}

/* ── GET /categories/admin ──
   Admin-only — returns EVERY category including inactive ones, for the
   management page. Separate from listCategories above so nothing else
   in the app (ticket form, filters) accidentally starts offering
   inactive categories just because this list changed. */
export async function listAllCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, slug, label, sla_hours, is_active, sort_order, created_at, updated_at
       FROM categories
       ORDER BY sort_order ASC, label ASC`
    )
    res.json(rows)
  } catch (err) { next(err) }
}

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* ── POST /categories ── (admin) */
export async function createCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { label, slug, sla_hours, sort_order } = req.body as {
      label: string; slug?: string; sla_hours?: number; sort_order?: number
    }

    if (!label?.trim()) {
      res.status(400).json({ error: 'label is required.' })
      return
    }

    const finalSlug = (slug?.trim() || slugify(label))
    if (!finalSlug) {
      res.status(400).json({ error: 'Could not derive a valid slug from that label — provide one explicitly.' })
      return
    }

    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id FROM categories WHERE slug = ?`, [finalSlug]
    )
    if (existing[0]) {
      res.status(409).json({ error: `A category with slug "${finalSlug}" already exists.` })
      return
    }

    // Default sort_order to end of list if not provided.
    let finalSortOrder = sort_order
    if (finalSortOrder === undefined) {
      const [[maxRow]] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM categories`
      )
      finalSortOrder = maxRow.maxOrder + 1
    }

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `INSERT INTO categories (slug, label, sla_hours, sort_order)
       VALUES (?, ?, ?, ?)`,
      [finalSlug, label.trim(), sla_hours ?? null, finalSortOrder]
    )

    res.status(201).json({ id: result.insertId, slug: finalSlug, message: 'Category created.' })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'A category with that slug already exists.' })
      return
    }
    next(err)
  }
}

/* ── PATCH /categories/:id ── (admin)
   NOTE: `slug` is intentionally NOT editable here. Tickets reference the
   category by slug (t.category enum/column in earlier schema versions,
   or a slug lookup), so renaming it out from under existing tickets
   would silently break their category display. Rename the label freely;
   if the slug genuinely needs to change, retire this row (is_active=0)
   and create a new one instead. */
export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const { label, sla_hours, is_active, sort_order } = req.body as {
      label?: string; sla_hours?: number | null; is_active?: boolean; sort_order?: number
    }

    const fields: string[] = []
    const params: unknown[] = []

    if (label !== undefined) {
      if (!label.trim()) { res.status(400).json({ error: 'label cannot be empty.' }); return }
      fields.push('label = ?'); params.push(label.trim())
    }
    if (sla_hours !== undefined) { fields.push('sla_hours = ?'); params.push(sla_hours) }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0) }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order) }

    if (!fields.length) { res.status(400).json({ error: 'No fields to update.' }); return }

    fields.push('updated_at = NOW()')
    params.push(id)

    const [result] = await pool.query<mysql.ResultSetHeader>(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params
    )
    if (result.affectedRows === 0) { res.status(404).json({ error: 'Category not found.' }); return }

    res.json({ message: 'Category updated.' })
  } catch (err) { next(err) }
}

/* ── DELETE /categories/:id ── (admin)
   Soft-delete by default (is_active = 0) if any ticket already uses this
   category's id — hard-deleting it would violate the fk_ticket_category
   foreign key (tickets.category_id → categories.id) and/or orphan those
   tickets. Only hard-deletes when nothing references it. */
export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id, slug FROM categories WHERE id = ?`, [id]
    )
    const category = rows[0]
    if (!category) { res.status(404).json({ error: 'Category not found.' }); return }

    const [[{ inUse }]] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS inUse FROM tickets WHERE category_id = ?`, [category.id]
    )

    if (inUse > 0) {
      await pool.query(`UPDATE categories SET is_active = 0, updated_at = NOW() WHERE id = ?`, [id])
      res.json({ message: `Category is used by ${inUse} ticket(s) — deactivated instead of deleted so those tickets keep their category.` })
      return
    }

    await pool.query(`DELETE FROM categories WHERE id = ?`, [id])
    res.json({ message: 'Category deleted.' })
  } catch (err) { next(err) }
}