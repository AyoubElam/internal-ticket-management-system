import type { Response, NextFunction } from 'express'
import { verifyToken } from '../config/jwt'
import type { AuthRequest } from '../types'

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' })
    return
  }

  const token = header.slice(7)
  try {
    req.user = verifyToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Token expired or invalid.' })
  }
}
