export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (error) {
      const issues = error?.issues || []
      const message = issues[0]?.message || 'Invalid request body.'
      res.status(400).json({
        success: false,
        error: message,
        code: 400,
        details: issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      })
    }
  }
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query)
      next()
    } catch (error) {
      const issues = error?.issues || []
      const message = issues[0]?.message || 'Invalid query parameters.'
      res.status(400).json({
        success: false,
        error: message,
        code: 400,
        details: issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      })
    }
  }
}
