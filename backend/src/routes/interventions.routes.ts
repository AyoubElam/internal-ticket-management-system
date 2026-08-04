import { Router } from 'express'
import {
  listInterventions, createIntervention, updateIntervention,
  acceptAssignment, rejectAssignment, bulkAssignIntervention,
} from '../controllers/interventions.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.use(authenticate)
router.use(authorize('admin', 'support_agent', 'technician'))

router.get('/',      listInterventions)
router.post('/',     authorize('admin', 'support_agent'), createIntervention)

router.post('/bulk-assign', authorize('admin', 'support_agent'), bulkAssignIntervention)

// Technician responds to a pending assignment. Keyed by ticket id, not
// intervention id, since no interventions row exists until acceptance.
router.patch('/assignments/:ticketId/accept', authorize('technician'), acceptAssignment)
router.patch('/assignments/:ticketId/reject', authorize('technician'), rejectAssignment)

router.patch('/:id', updateIntervention)

export default router