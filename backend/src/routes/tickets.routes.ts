import { Router } from 'express'
import {
  listTickets, getTicket, getTicketTimeline, createTicket, updateTicket, editTicket, cancelTicket, addComment,
  bulkUpdateTickets, reopenTicket, closeTicket,
} from '../controllers/tickets.controller'
import {
  listAttachments, uploadAttachment, downloadAttachment, deleteAttachment,
} from '../controllers/attachments.controller'
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
router.patch('/:id/reopen',   authorize('admin','support_agent','employee'), reopenTicket)
router.patch('/:id/close',    authorize('admin','support_agent','employee'), closeTicket)
router.post('/:id/comments',  addComment)

// ── Attachments ───────────────────────────────────────────────
router.get('/:id/attachments',                    listAttachments)
router.post('/:id/attachments',                   uploadAttachment)
router.get('/:id/attachments/:attId/download',    downloadAttachment)
router.delete('/:id/attachments/:attId',          deleteAttachment)

export default router