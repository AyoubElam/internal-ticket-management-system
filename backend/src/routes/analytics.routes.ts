import { Router } from 'express'
import { getKpiStats } from '../controllers/analytics.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.get('/kpi', authenticate, authorize('admin','support_agent'), getKpiStats)

export default router
