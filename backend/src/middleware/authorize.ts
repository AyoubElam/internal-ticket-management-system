import type { Response, NextFunction } from 'express'
import type { AuthRequest, Role } from '../types'

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions.' })
      return
    }
    next()
  }
}
