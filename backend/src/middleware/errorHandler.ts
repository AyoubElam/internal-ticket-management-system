import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[ERROR]', err.message)
  const status = (err as NodeJS.ErrnoException & { status?: number }).status ?? 500
  res.status(status).json({
    error:   err.message ?? 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
