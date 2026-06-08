# Planex — Project Notes for Claude

## What Is This

Planex is a full-stack task manager app built for an SDI university project.

- **Frontend**: React 19 + Vite + React Router 7, lives in `planex-frontend/`
- **Backend**: Express.js 4 + Sequelize 6 + PostgreSQL, lives in `planex-backend/`
- **Real-time**: WebSocket (`ws` library) for live chat and live task/subtask updates
- **Auth**: JWT (15-min access token + 7-day refresh token) stored in cookies, RBAC with 5 roles

---

## How to Run

**Backend** (port 3001):
```
cd planex-backend
npm run dev        # nodemon, auto-restarts on file changes
# or
npm start
```

**Frontend** (port 5173):
```
cd planex-frontend
npm run dev
```

Access at `http://localhost:5173`. All `/api` and `/ws` requests proxy to `http://localhost:3001`.

**Database**: PostgreSQL, database name `planex_dev`. Must exist before running backend.
```
# In psql:
CREATE DATABASE planex_dev;
# Then run migrations + seed:
cd planex-backend && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all
```

---

## Demo Credentials

| Role    | Email                  | Password     |
|---------|------------------------|--------------|
| Admin   | admin@planex.com       | admin123     |
| Manager | manager@planex.com     | manager123   |
| Editor  | editor@planex.com      | editor123    |
| Viewer  | viewer@planex.com      | viewer123    |
| User    | user@planex.com        | user123      |

---

## Architecture Notes

### Auth Flow
- Access token expires after **15 minutes**. The backend returns `{ code: 'TOKEN_EXPIRED' }` in the 401 body so the frontend can silently refresh.
- `planex-frontend/src/services/api.js` — the `request()` function handles all API calls. It attaches the Bearer token, handles 401s (attempts refresh unless ACCOUNT_LOCKED or INACTIVITY_TIMEOUT), and dispatches `auth:logout` / `auth:inactivity-logout` events on failure.
- `planex-backend/src/middleware/auth.js` — `authenticateJwt()` returns the string `'EXPIRED'` (not null) when a JWT is expired so `authenticate()` can return the right code.

### WebSocket / Live Updates
- `planex-backend/src/websocket/wsServer.js` — `broadcastTaskEvent(type, payload)` sends to all connected clients.
- `planex-frontend/src/context/ChatContext.jsx` — receives WS messages and dispatches `window.CustomEvent` for task and subtask events.
- Task events: `task:created`, `task:updated`, `task:deleted`
- Subtask events: `subtask:created`, `subtask:updated`, `subtask:deleted`
- Views (MasterView, KanbanView, CalendarView) and SubtaskPanel listen to these events via `window.addEventListener`.

### Subtask Route Auth
- Subtask routes are mounted separately in `planex-backend/src/app.js`:
  ```js
  app.use('/api/tasks/:taskId/subtasks', authenticate, updateLastActivity, subtaskRoutes)
  ```
  The `authenticate` middleware **must** stay on this line — subtasks.js does NOT apply it internally.
- Subtask routes use `subtasks:create/update/delete` permissions (not `tasks:*`). All roles down to `user` have these.

### Optimistic Updates & Race Condition Guard
- When a user creates a subtask locally, the API response and the incoming WebSocket broadcast can race. Both `handleAdd` in SubtaskPanel and `onCreated` use `.some(s => s.id === newId)` deduplication before adding to state.

---

## Views / Routes

| Path           | Component       | Notes                                      |
|----------------|-----------------|--------------------------------------------|
| `/`            | Login           |                                            |
| `/register`    | Register        |                                            |
| `/forgot-password` | ForgotPassword |                                        |
| `/reset-password/:token` | ResetPassword |                                  |
| `/tasks`       | MasterView      | Paginated task list with filters           |
| `/tasks/:id`   | DetailView      | Task detail, edit, subtasks                |
| `/tasks/new`   | DetailView      | New task form                              |
| `/kanban`      | KanbanView      | Drag-and-drop Kanban board                 |
| `/calendar`    | CalendarView    | Monthly calendar with task chips           |
| `/statistics`  | Statistics      |                                            |
| `/admin`       | AdminView       | Admin-only                                 |

---

## Key Files

```
planex-backend/
  src/
    server.js                        # Entry point — dotenv loaded HERE (first line)
    app.js                           # Express app, route mounting
    middleware/auth.js               # JWT auth, RBAC, session management
    routes/auth.js                   # Login, register, refresh, forgot/reset password
    routes/taskRoutes.js             # Task CRUD + WebSocket broadcasts
    routes/subtasks.js               # Subtask CRUD + WebSocket broadcasts
    websocket/wsServer.js            # WebSocket server + broadcastTaskEvent
    database/
      models/Task.js                 # Includes Status field ('todo'|'in_progress'|'done')
      repositories/taskRepository.js # updateStatus() syncs Status + IsCompleted
      repositories/subtaskRepository.js
      migrations/                    # Includes add-status-to-tasks migration
      seeders/20260428190100-seed-roles-permissions.js

planex-frontend/
  src/
    services/api.js                  # All fetch calls, token refresh logic
    context/AuthContext.jsx          # Auth state, login/logout, token init
    context/ChatContext.jsx          # WebSocket connection, dispatches window events
    components/
      ProtectedRoute.jsx
      SubtaskPanel.jsx               # Live subtask CRUD via WebSocket events
      ChatPanel.jsx
    views/
      MasterView.jsx                 # Task list
      DetailView.jsx                 # Task detail/edit
      KanbanView.jsx                 # Kanban board (native HTML5 drag-and-drop)
      CalendarView.jsx               # Monthly calendar view
```

---

## Environment Variables (planex-backend/.env)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<gmail address>
SMTP_PASS=<gmail app password>
SMTP_FROM=<gmail address>
```

JWT secrets and other config fall back to hardcoded dev defaults if not set.

---

## What Was Built / Fixed (Session — 2026-06-08)

### Bugs Fixed
- **Backend crash on startup** — removed dead AI/security files (detectionEngine, llmDetector, SuspiciousActivity, ObservationList) and cleaned all their references from models/index.js, ActivityLog.js, graphql/resolvers.js, graphql/schema.js.
- **dotenv never loaded** — added `require('dotenv').config(...)` as the very first line of server.js. Without it, all `.env` vars (SMTP etc.) were silently ignored.
- **Password reset email not sending** — caused by the dotenv issue above. Also removed the old dev-mode "show link on page" behaviour from ForgotPassword.jsx.
- **SubtaskPanel "Authentication required"** — the panel had its own hardcoded `apiFetch` that called `http://hostname:3001` directly with no Authorization header. Fixed by replacing it with the shared `request()` from api.js.
- **Subtask delete silently failing (403)** — the DELETE route used `requirePermission('tasks:delete')` but regular users only have `subtasks:delete`. Fixed all three subtask routes to use `subtasks:create/update/delete`.
- **Subtask `authenticate` middleware missing** — subtask routes were mounted in app.js without the `authenticate` middleware. Added it to the mount line.
- **Redirect to login on task click (token expiry)** — the backend's 401 for expired JWTs had no `code` field, so the frontend skipped the refresh and logged the user out instead. Fixed: `authenticateJwt()` now returns `'EXPIRED'` for expired tokens; `authenticate()` returns `{ code: 'TOKEN_EXPIRED' }`; and the frontend now attempts a refresh on any 401 that isn't ACCOUNT_LOCKED or INACTIVITY_TIMEOUT.
- **Subtask add duplication after deletes** — race condition between the local state update in `handleAdd` and the incoming WebSocket broadcast. Fixed with `.some()` deduplication in both paths.

### Features Added
- **3-way auth button removed** from Login page.
- **Kanban board** (`/kanban`) — drag-and-drop between To Do / In Progress / Done columns. Moving to Done syncs `IsCompleted=true`. Native HTML5 drag API. Optimistic updates with rollback on error.
- **Task Status field** — new `Status` column on Tasks table (`'todo'|'in_progress'|'done'`), kept in sync with `IsCompleted`. Added via Sequelize migration.
- **Live task updates** — WebSocket broadcasts after every task mutation (create/update/delete/toggle/status change). MasterView, KanbanView, and CalendarView all subscribe.
- **Live subtask updates** — WebSocket broadcasts after every subtask mutation. SubtaskPanel subscribes and filters by taskId.
- **Calendar view** (`/calendar`) — monthly grid, task chips color-coded by priority, today highlighted, prev/next month navigation, "Today" button, day-detail panel below the grid, live updates via WebSocket.
- **Sidebar updated** — Calendar and Kanban links added to all view sidebars (MasterView, KanbanView, DetailView, CalendarView).

---

## VS Code Hint (Not an Error)

All backend `.js` files show hint code `80001`: "File is a CommonJS module; it may be converted to an ES module." This is cosmetic — the backend intentionally uses CommonJS (`require`/`module.exports`). Ignore it.
