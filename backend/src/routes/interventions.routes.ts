import { Router } from 'express'
import { listInterventions, createIntervention, updateIntervention } from '../controllers/interventions.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.use(authenticate)
router.use(authorize('admin','support_agent','technician'))

router.get('/',      listInterventions)
router.post('/',     authorize('admin','support_agent'), createIntervention)
router.patch('/:id', updateIntervention)

export default router
