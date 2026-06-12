# Planex — Feature Reference
> SDI University Project | Full-stack task manager

---

## Tech Stack
- **Frontend**: React 19 + Vite + React Router 7 (port 5173)
- **Backend**: Express.js 4 + Sequelize 6 + PostgreSQL (port 3001)
- **Real-time**: WebSocket (`ws` library)
- **Auth**: JWT (15-min access + 7-day refresh tokens, stored in cookies)
- **AI**: GROQ SDK — `llama-3.3-70b-versatile` model
- **Email**: Brevo HTTP API (SMTP via Gmail)

---

## 1. Authentication & Security

### Login / Register
- Email + password login with JWT tokens
- Registration with name, email, password
- Tokens stored in cookies; auto-refresh when access token expires (silent, no redirect)

### Role-Based Access Control (RBAC)
- 5 roles: **Admin**, **Manager**, **Editor**, **Viewer**, **User**
- Each role has a distinct permission set controlling what they can create/edit/delete
- Admin-only routes redirect non-admins

### Password Recovery
- "Forgot password" flow: sends reset email via Brevo/SMTP
- Tokenized reset link; email + token verified before allowing password change

### Session Management
- Inactivity timeout — users auto-logged out after prolonged inactivity
- Warning modal before forced logout
- Multiple active sessions visible; individual sessions can be revoked

### Brute Force Protection
- Failed login attempts tracked; account locked after repeated failures
- Locked accounts flagged in the Admin Panel (see Flagged Users)

---

## 2. Task Management

### Core CRUD
- Create, read, update, delete tasks
- Fields: title, description, due date, priority (High / Medium / Low), status

### Task Status & Kanban Sync
- Three statuses: `To Do`, `In Progress`, `Done`
- Status kept in sync with `isCompleted` flag at all times

### Priority System
- High / Medium / Low priority with colour-coded badges
- **Overdue escalation**: tasks past their due date automatically display as High priority (red badge with ↑) across all views — visual only, stored value unchanged

### Recurrence
- Tasks can repeat: Daily / Weekly / Monthly
- Recurrence start and end date configurable
- Calendar view renders recurring tasks across all covered dates

### Collaborators
- Tasks can have multiple collaborators (other users)
- Searchable user autocomplete when adding collaborators
- "Collaborative" filter in task list shows tasks shared with the logged-in user

### Task Dependencies
- Tasks can be blocked by other tasks ("Blocked by" relationship)
- Blocked tasks show 🔒 badge in MasterView, KanbanView, and on the task card
- Cannot move a blocked task to In Progress until all its blockers are completed
- Dependency panel always visible in task detail view with inline search to add/remove blockers
- Circular dependency prevention (A→B→A rejected)

### Subtasks
- Each task can have multiple subtasks
- Subtasks have their own completion toggle
- AI-suggested subtasks via GROQ (generates relevant subtasks from task title + description)

### Bulk Actions (MasterView)
- Select multiple tasks via checkboxes (per-row + select-all in header)
- Floating action bar appears when tasks are selected:
  - ✓ **Complete selected** — marks all chosen tasks as done
  - **Set priority** — apply High / Medium / Low to all selected
  - 🗑 **Delete selected** — batch delete with confirmation dialog
- Selection cleared on page change or filter switch

---

## 3. Views

### Master View (`/tasks`)
- Paginated task list (5 per page)
- Filter tabs: Active / Completed / Collaborative / All Tasks (admin)
- Full-text search
- Client-side priority sort (High→Low / Low→High / off)
- Due-date urgency: overdue rows tinted red, due-soon rows tinted orange
- 🔒 badge on blocked tasks
- Live updates via WebSocket (task created/updated/deleted by any user refreshes the list)

### Kanban Board (`/kanban`)
- Three columns: To Do / In Progress / Done
- Native HTML5 drag-and-drop between columns
- Optimistic updates with rollback on error
- Moving a card to Done sets `isCompleted = true`
- Blocked tasks show 🔒; cannot drag a blocked task to In Progress
- Overdue escalation badge shown on cards
- Live updates via WebSocket

### Calendar View (`/calendar`)
- Monthly grid
- Task chips colour-coded by priority; overdue = red chip, due-soon = orange chip
- Today highlighted
- Previous/next month navigation + "Today" button
- Click a day to see task detail panel below the grid
- Live updates via WebSocket

### Task Detail View (`/tasks/:id`)
- Full task detail: title, description, due date, priority badge, recurrence info, created-by
- Completion toggle (checkbox)
- Overdue escalation on priority badge
- Collaborators panel
- **Blocked by panel**: lists blocking tasks with status chips and navigation links; inline search to add new dependencies
- Warning banner when task is actively blocked
- Subtask panel (live, with AI suggestion button)
- **Activity timeline**: chronological log of all actions on the task (created, status changed, subtask added/completed, dependency added, etc.) with user name and relative timestamp
- Edit mode: update all fields, manage collaborators
- Delete (creator or admin only)

### Statistics (`/statistics`)
- Total, completed, active task counts
- Bar charts: tasks by priority, tasks by status
- Admin can view stats for any user

### Profile (`/profile`)
- Avatar initial + display name + email + role
- Editable display name (saves immediately via API)
- Change password form (current → new → confirm, with validation)
- Personal stats panel: total / completed / active / completion % + progress bar + priority breakdown
- Link to full Statistics view

---

## 4. Admin Panel (`/admin`)

### User Management tab
- List of all registered users
- Change any user's role via dropdown

### Flagged Users tab
- Automatically flags users for:
  - **💬 Toxic chat** — message blocked by AI toxicity filter
  - **🔒 Brute force** — repeated failed login attempts
- Shows flag type badge, detail snippet, and timestamp
- "Clear flags" button per user
- Empty state shown when no flags exist

---

## 5. Real-Time Features (WebSocket)

### Live Chat
- Persistent chat panel available on all views
- Messages stored in DB and broadcast to all connected clients
- **AI toxicity filter**: outgoing messages checked by GROQ before broadcast
  - Toxic messages are dropped server-side (never sent to other users)
  - Sender sees a private ⚠️ warning message in red
  - Sender's account is flagged for admin review
  - Fails open — if GROQ is unavailable, messages pass through normally

### Live Task Updates
- Task created / updated / deleted events broadcast to all clients
- MasterView, KanbanView, CalendarView all auto-refresh without manual reload

### Live Subtask Updates
- Subtask created / updated / deleted events broadcast to all clients
- SubtaskPanel filters events by task ID and deduplicates (race condition guard)

---

## 6. Activity Log

- Every significant action on a task is logged: creation, status changes, toggles, subtask add/complete/remove, dependency add/remove
- Stored in `ActivityLogs` table linked to user and resource
- Displayed as a timeline in Task Detail view
- Shows: user avatar initial, action description (human-readable), relative timestamp (e.g. "3h ago")

---

## 7. AI Features (GROQ — llama-3.3-70b-versatile)

| Feature | Where | How |
|---|---|---|
| Subtask suggestions | Task Detail view | Button → GROQ generates relevant subtasks from task title + description → one-click add |
| Chat toxicity filter | Chat panel (server-side) | Every outgoing message checked; toxic messages dropped before broadcast |

---

## 8. Email (Brevo / SMTP)

- Password reset emails with secure tokenized links
- SMTP configured via environment variables (Gmail app password)

---

## 9. UX / Design Details

- Consistent monospace font (`Courier New`) throughout
- Olive-green (`#8a9e6e`) main background across all views
- Dark sidebar (`#2d3748`) with user avatar and role
- Priority badges: red (High), yellow (Medium), green (Low)
- Urgency overrides: overdue = red, due-soon = orange (chip + row tint)
- Avatar in sidebar is clickable → goes to Profile page
- "Profile" link in all sidebars
- Floating bulk action pill bar (fixed bottom, appears on selection)
- Responsive panels, optimistic UI updates with rollback

---

## Routes Summary

| Path | View | Auth |
|---|---|---|
| `/` | Login | Public |
| `/register` | Register | Public |
| `/forgot-password` | Forgot Password | Public |
| `/reset-password/:token` | Reset Password | Public |
| `/tasks` | MasterView | Protected |
| `/tasks/new` | DetailView (add) | Protected |
| `/tasks/:id` | DetailView (view/edit) | Protected |
| `/kanban` | KanbanView | Protected |
| `/calendar` | CalendarView | Protected |
| `/statistics` | Statistics | Protected |
| `/admin` | AdminView | Protected (Admin only) |
| `/profile` | ProfileView | Protected |
