import { Router } from 'express'
import { listZones, listZoneTechnicians, createZone, updateZone } from '../controllers/zones.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.use(authenticate)
router.use(authorize('admin','support_agent'))

router.get('/',                listZones)
router.get('/:id/technicians', listZoneTechnicians)
router.post('/',               authorize('admin'), createZone)
router.patch('/:id',           authorize('admin'), updateZone)

export default router