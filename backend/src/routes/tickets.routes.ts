import { Router } from 'express'
import {
  listTickets, getTicket, getTicketTimeline, createTicket, updateTicket, editTicket, cancelTicket, addComment,
  bulkUpdateTickets,
} from '../controllers/tickets.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.use(authenticate)

router.get('/',              listTickets)
router.post('/',              authorize('admin','support_agent','employee'), createTicket)

// IMPORTANT: /bulk must be declared before /:id — otherwise Express would
// match PATCH /tickets/bulk as PATCH /tickets/:id with id="bulk".
router.patch('/bulk',         authorize('admin','support_agent'), bulkUpdateTickets)

router.get('/:id',            getTicket)
router.get('/:id/timeline',   getTicketTimeline)
router.patch('/:id',          authorize('admin','support_agent'), updateTicket)
router.patch('/:id/edit',     authorize('admin','support_agent','employee'), editTicket)
router.patch('/:id/cancel',   authorize('admin','support_agent','employee'), cancelTicket)
router.post('/:id/comments',  addComment)

export default router