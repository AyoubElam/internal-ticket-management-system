import { Router } from 'express'
import { getKpiStats, getMyKpi } from '../controllers/analytics.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.get('/kpi',    authenticate, authorize('admin','support_agent'), getKpiStats)
router.get('/my-kpi', authenticate, authorize('admin','support_agent'), getMyKpi)

export default router