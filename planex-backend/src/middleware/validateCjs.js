// ──────────────────────────────────────────────────────────────
// Validation Middleware — CJS version
// express-validator rules for task endpoints.
// ──────────────────────────────────────────────────────────────

const { body, param, validationResult } = require('express-validator')

// ── Shared rules for task body ────────────────────────────────

const taskBodyRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .isLength({ max: 100 }).withMessage('Title must be at most 100 characters.'),

  body('description')
    .optional()
    .isString().withMessage('Description must be a string.')
    .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters.'),

  body('dueDate')
    .trim()
    .notEmpty().withMessage('Due date is required.')
    .isISO8601().withMessage('Due date must be a valid date (YYYY-MM-DD).'),

  body('collaborators')
    .optional()
    .isArray().withMessage('Collaborators must be an array.'),

  body('collaborators.*')
    .optional()
    .isString().withMessage('Each collaborator must be a string.')
    .trim()
    .notEmpty().withMessage('Collaborator names cannot be empty.'),

  body('priority')
    .trim()
    .notEmpty().withMessage('Priority is required.')
    .isIn(['High', 'Medium', 'Low']).withMessage('Priority must be High, Medium, or Low.'),
]

// ── Update rules (all fields optional but validated if present) ─

const taskUpdateRules = [
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty.')
    .isLength({ max: 100 }).withMessage('Title must be at most 100 characters.'),

  body('description')
    .optional()
    .isString().withMessage('Description must be a string.')
    .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters.'),

  body('dueDate')
    .optional()
    .trim()
    .notEmpty().withMessage('Due date cannot be empty.')
    .isISO8601().withMessage('Due date must be a valid date (YYYY-MM-DD).'),

  body('collaborators')
    .optional()
    .isArray().withMessage('Collaborators must be an array.'),

  body('collaborators.*')
    .optional()
    .isString().withMessage('Each collaborator must be a string.')
    .trim()
    .notEmpty().withMessage('Collaborator names cannot be empty.'),

  body('priority')
    .optional()
    .trim()
    .isIn(['High', 'Medium', 'Low']).withMessage('Priority must be High, Medium, or Low.'),

  body('isCompleted')
    .optional()
    .isBoolean().withMessage('isCompleted must be a boolean.'),
]

// ── Param validation ──────────────────────────────────────────

const idParamRule = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID must be a positive integer.'),
]

// ── Middleware that sends 400 if validation failed ────────────

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  next()
}

module.exports = {
  taskBodyRules,
  taskUpdateRules,
  idParamRule,
  handleValidation,
}
