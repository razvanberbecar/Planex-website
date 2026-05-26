const { buildSchema } = require('graphql')

const schema = buildSchema(`
  type Subtask {
    id: Int!
    taskId: Int!
    title: String!
    isCompleted: Boolean!
  }

  type Task {
    id: Int!
    title: String!
    description: String
    dueDate: String!
    collaborators: [String!]!
    isCompleted: Boolean!
    priority: String!
    subtasks: [Subtask!]!
  }

  type TaskPage {
    data: [Task!]!
    page: Int!
    limit: Int!
    total: Int!
    totalPages: Int!
  }

  type PriorityStats {
    high: Int!
    medium: Int!
    low: Int!
  }

  type MonthStat {
    month: String!
    tasks: Int!
    collaborative: Int!
    solo: Int!
  }

  type Statistics {
    total: Int!
    completed: Int!
    active: Int!
    collaborative: Int!
    solo: Int!
    completionRate: Int!
    collaborativeRate: Int!
    priority: PriorityStats!
    peakMonth: String
    monthlyBreakdown: [MonthStat!]!
  }

  # ── Logging & Detection Types ─────────────────────────────

  type ActivityLogType {
    LogId: Int!
    UserId: Int!
    Action: String!
    ResourceType: String
    ResourceId: Int
    Details: String
    IpAddress: String
    UserAgent: String
    Timestamp: String!
    user: UserBrief
  }

  type UserBrief {
    UserId: Int!
    Name: String!
    Email: String!
  }

  type SuspiciousActivityType {
    SuspiciousActivityId: Int!
    UserId: Int!
    ActivityLogId: Int
    RuleTriggered: String!
    Severity: String!
    Details: String
    IsReviewed: Boolean!
    DetectedAt: String!
    ReviewedBy: Int
    ReviewedAt: String
    user: UserBrief
    reviewer: UserBrief
  }

  type ObservationEntryType {
    ObservationId: Int!
    UserId: Int!
    AddedBy: Int!
    Reason: String!
    Status: String!
    SuspiciousActivityId: Int
    StartedAt: String!
    EndedAt: String
    Notes: String
    observedUser: UserBrief
    addedByAdmin: UserBrief
    suspiciousActivity: SuspiciousActivityType
  }

  type Query {
    tasks(page: Int, limit: Int, filter: String, priority: String, search: String): TaskPage!
    task(id: Int!): Task
    statistics: Statistics!
    subtasks(taskId: Int!): [Subtask!]!

    # ── Admin queries ────────────────────────────────────────
    suspiciousActivities(unreviewedOnly: Boolean, severity: String): [SuspiciousActivityType!]!
    observationList(status: String): [ObservationEntryType!]!
  }

  input CreateTaskInput {
    title: String!
    description: String
    dueDate: String!
    collaborators: [String!]
    priority: String
  }

  input UpdateTaskInput {
    title: String
    description: String
    dueDate: String
    collaborators: [String!]

    isCompleted: Boolean
    priority: String
  }

  type Mutation {
    createTask(input: CreateTaskInput!): Task!
    updateTask(id: Int!, input: UpdateTaskInput!): Task
    deleteTask(id: Int!): Boolean!

    createSubtask(taskId: Int!, title: String!): Subtask!
    updateSubtask(id: Int!, title: String, isCompleted: Boolean): Subtask
    deleteSubtask(id: Int!): Boolean!

    # ── Admin mutations ──────────────────────────────────────
    reviewSuspiciousActivity(id: Int!, adminUserId: Int!): SuspiciousActivityType!
    clearObservation(id: Int!, adminUserId: Int!, notes: String): ObservationEntryType!
    restrictUser(id: Int!, adminUserId: Int!, notes: String): ObservationEntryType!
  }
`)

module.exports = schema