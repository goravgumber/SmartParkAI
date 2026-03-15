import crypto from 'crypto'

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 404
  })
}

export function errorHandler(error, req, res, next) {
  const requestId = crypto.randomUUID()
  console.error(`[${requestId}]`, error)

  const statusCode = error.statusCode || 500
  const safeMessage = statusCode >= 500 ? 'Internal Server Error' : error.message || 'Request failed'
  res.status(statusCode).json({
    success: false,
    error: safeMessage,
    code: statusCode,
    requestId
  })
}
