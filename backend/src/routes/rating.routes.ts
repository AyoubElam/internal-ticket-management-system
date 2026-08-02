import { Router } from 'express'
import { createRating, getTechnicianRating, listTechnicianRatings } from '../controllers/rating.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.use(authenticate)

router.post('/',                  authorize('employee'), createRating)
router.get('/summary',            authorize('admin', 'support_agent'), listTechnicianRatings)
router.get('/technician/:id',     authorize('admin', 'support_agent', 'technician'), getTechnicianRating)

export default router