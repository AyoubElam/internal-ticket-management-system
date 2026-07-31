import { Router } from 'express'
import { listUsers, getUser, createUser, updateUser } from '../controllers/users.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.use(authenticate)

router.get('/',      authorize('admin', 'support_agent'), listUsers)
router.get('/:id',   authorize('admin', 'support_agent'), getUser)
router.post('/',     authorize('admin'), createUser)
router.patch('/:id', authorize('admin'), updateUser)

export default router