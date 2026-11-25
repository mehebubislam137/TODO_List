import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  isAnonymous: boolean('is_anonymous').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#C6F36B'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#A1A69D'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').notNull().default('Medium'), // Low | Medium | High
  status: text('status').notNull().default('Pending'), // Pending | In Progress | Completed
  categoryId: uuid('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  startDate: text('start_date'), // YYYY-MM-DD
  dueDate: text('due_date'), // YYYY-MM-DD
  dueTime: text('due_time'), // HH:mm
  isImportant: boolean('is_important').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  recurrencePattern: text('recurrence_pattern').notNull().default('none'), // none | daily | weekly | monthly | custom
  recurrenceInterval: integer('recurrence_interval').notNull().default(1),
  alarmEnabled: boolean('alarm_enabled').notNull().default(false),
  alarmMinutesBefore: integer('alarm_minutes_before').notNull().default(10),
  alarmSound: text('alarm_sound').notNull().default('classic'), // classic | digital | chime | urgent | harp | gong | custom
  alarmAudioData: text('alarm_audio_data'),
  alarmAudioName: text('alarm_audio_name'),
  alarmSnoozedUntil: timestamp('alarm_snoozed_until'),
  lastAlarmTriggeredDate: text('last_alarm_triggered_date'),
  isDailyTask: boolean('is_daily_task').notNull().default(false),
  lastDailyResetDate: text('last_daily_reset_date'),
  sortOrder: integer('sort_order').notNull().default(0),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const taskTags = pgTable('task_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  tagId: uuid('tag_id')
    .references(() => tags.id, { onDelete: 'cascade' })
    .notNull(),
});

export const subtasks = pgTable('subtasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const recurringRules = pgTable('recurring_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  frequency: text('frequency').notNull(), // daily | weekly | monthly | custom
  intervalDays: integer('interval_days').notNull().default(1),
  lastGeneratedForDate: text('last_generated_for_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const focusSessions = pgTable('focus_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  sessionType: text('session_type').notNull().default('work'), // work | short_break | long_break
  plannedDurationSeconds: integer('planned_duration_seconds').notNull(),
  actualDurationSeconds: integer('actual_duration_seconds').notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at').notNull(),
  completionStatus: text('completion_status').notNull().default('completed'), // completed | interrupted | skipped
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  actionType: text('action_type').notNull(),
  taskTitle: text('task_title').notNull(),
  detail: text('detail').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .primaryKey(),
  theme: text('theme').notNull().default('dark'), // dark | light | system
  themePreset: text('theme_preset').notNull().default('editorial-dark'),
  accentColor: text('accent_color').notNull().default('#C6F36B'),
  customAlarmAudioData: text('custom_alarm_audio_data'),
  customAlarmAudioName: text('custom_alarm_audio_name'),
  defaultPriority: text('default_priority').notNull().default('Medium'),
  defaultTaskView: text('default_task_view').notNull().default('list'), // list | grid | kanban
  defaultCategoryId: uuid('default_category_id'),
  weekStart: text('week_start').notNull().default('monday'), // monday | sunday
  calendarView: text('calendar_view').notNull().default('month'), // month | week | day
  timezone: text('timezone').notNull().default('UTC'),
  workDurationMinutes: integer('work_duration_minutes').notNull().default(25),
  shortBreakMinutes: integer('short_break_minutes').notNull().default(5),
  longBreakMinutes: integer('long_break_minutes').notNull().default(15),
  sessionsBeforeLongBreak: integer('sessions_before_long_break')
    .notNull()
    .default(4),
  soundEnabled: boolean('sound_enabled').notNull().default(true),
  dailyTaskTarget: integer('daily_task_target').notNull().default(5),
  dailyFocusGoalMinutes: integer('daily_focus_goal_minutes')
    .notNull()
    .default(100),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  tasks: many(tasks),
  categories: many(categories),
  tags: many(tags),
  focusSessions: many(focusSessions),
  activityLogs: many(activityLogs),
  preferences: one(userPreferences, {
    fields: [users.uid],
    references: [userPreferences.userId],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.uid],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.uid],
  }),
  category: one(categories, {
    fields: [tasks.categoryId],
    references: [categories.id],
  }),
  subtasks: many(subtasks),
  taskTags: many(taskTags),
  recurringRules: many(recurringRules),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.taskId],
    references: [tasks.id],
  }),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTags.taskId],
    references: [tasks.id],
  }),
  tag: one(tags, {
    fields: [taskTags.tagId],
    references: [tags.id],
  }),
}));
