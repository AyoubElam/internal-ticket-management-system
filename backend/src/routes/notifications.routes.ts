import { Router } from 'express'
import { listNotifications, markNotificationRead, markAllRead } from '../controllers/notifications.controller'
import { authenticate } from '../middleware/authenticate'

const router = Router()

router.use(authenticate)

router.get('/', listNotifications)
router.patch('/read-all', markAllRead)
router.patch('/:id/read', markNotificationRead)

export default router