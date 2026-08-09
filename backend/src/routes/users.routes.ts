import { Router } from 'express'
import {
  listUsers, getUser, createUser, updateUser,
  updateMe, changeMyPassword,
} from '../controllers/users.controller'
import { authenticate } from '../middleware/authenticate'
import { authorize }     from '../middleware/authorize'

const router = Router()

router.use(authenticate)

// IMPORTANT: '/me' routes must be declared BEFORE '/:id' routes.
// Express matches routes in order, and '/:id' would otherwise swallow
// a literal request to '/me' by treating "me" as the :id param.
router.patch('/me',          updateMe)
router.patch('/me/password', changeMyPassword)

router.get('/',      authorize('admin', 'support_agent'), listUsers)
router.get('/:id',   authorize('admin', 'support_agent'), getUser)
router.post('/',     authorize('admin'), createUser)
router.patch('/:id', authorize('admin'), updateUser)

export default router