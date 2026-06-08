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

  type Query {
    tasks(page: Int, limit: Int, filter: String, priority: String, search: String): TaskPage!
    task(id: Int!): Task
    statistics: Statistics!
    subtasks(taskId: Int!): [Subtask!]!
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

  }
`)

module.exports = schema