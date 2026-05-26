
export function validateTask(fields) {
  const errors = {}
  if (!fields.title || fields.title.trim() === '')
    errors.title = 'Task name is required.'
  if (!fields.dueDate || fields.dueDate.trim() === '')
    errors.dueDate = 'Due date is required.'
  else if (isNaN(Date.parse(fields.dueDate)))
    errors.dueDate = 'Due date must be a valid date (YYYY-MM-DD).'
  return errors
}