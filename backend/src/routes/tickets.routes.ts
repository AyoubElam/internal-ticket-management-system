import { Router } from 'express'
import {
  listTickets, getTicket, createTicket, updateTicket, editTicket, cancelTicket, addComment,
} from '../controllers/tickets.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.use(authenticate)

router.get('/',              listTickets)
router.post('/',              authorize('admin','support_agent','employee'), createTicket)
router.get('/:id',            getTicket)
router.patch('/:id',          authorize('admin','support_agent'), updateTicket)
router.patch('/:id/edit',     authorize('admin','support_agent','employee'), editTicket)
router.patch('/:id/cancel',   authorize('admin','support_agent','employee'), cancelTicket)
router.post('/:id/comments',  addComment)

export default router