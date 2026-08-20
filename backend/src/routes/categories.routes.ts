import { Router } from 'express'
import {
  listCategories, listAllCategories, createCategory, updateCategory, deleteCategory,
} from '../controllers/categories.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()
router.use(authenticate)

// Public (any authenticated role) — active only. Used by the ticket form.
router.get('/', listCategories)

// Admin management — must precede other admin routes only if there were
// path collisions; there aren't here, but /admin is kept distinct from
// /:id on purpose so "admin" is never parsed as a category id.
router.get('/admin',      authorize('admin'), listAllCategories)
router.post('/',          authorize('admin'), createCategory)
router.patch('/:id',      authorize('admin'), updateCategory)
router.delete('/:id',     authorize('admin'), deleteCategory)

export default router