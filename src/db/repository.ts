import { and, asc, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from './index.ts';
import {
  activityLogs,
  categories,
  focusSessions,
  recurringRules,
  subtasks,
  tags,
  tasks,
  taskTags,
  userPreferences,
  users,
} from './schema.ts';
import {
  addDaysToDateString,
  AlarmSoundType,
  calculateNextOccurrenceDate,
  calculateProgressStreak,
  formatLocalDate,
  generateDailyBriefing,
  isTaskOverdue,
  RecurrencePattern,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../utils/taskLogic.ts';

const DEFAULT_CATEGORIES = [
  { name: 'Personal', color: '#C6F36B', isDefault: true },
  { name: 'College', color: '#60A5FA', isDefault: true },
  { name: 'Work', color: '#E7B96A', isDefault: true },
  { name: 'Shopping', color: '#F472B6', isDefault: true },
  { name: 'Health', color: '#83C995', isDefault: true },
  { name: 'Projects', color: '#A78BFA', isDefault: true },
  { name: 'Others', color: '#A1A69D', isDefault: true },
];

const DEFAULT_TAGS = [
  { name: 'deep-work', color: '#C6F36B' },
  { name: 'milestone', color: '#E7B96A' },
  { name: 'research', color: '#60A5FA' },
  { name: 'routine', color: '#83C995' },
];

export async function logActivity(
  userId: string,
  actionType: string,
  taskTitle: string,
  detail: string = '',
  taskId: string | null = null
) {
  try {
    await db.insert(activityLogs).values({
      userId,
      taskId,
      actionType,
      taskTitle,
      detail,
    });
  } catch (error) {
    console.error('Failed to record activity log:', error);
  }
}

export async function ensureWorkspaceInitialized(
  uid: string,
  email: string,
  isAnonymous: boolean = true
) {
  try {
    await db
      .insert(users)
      .values({ uid, email, isAnonymous })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, isAnonymous },
      });

    await db
      .insert(userPreferences)
      .values({ userId: uid })
      .onConflictDoNothing({ target: userPreferences.userId });

    const existingCats = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, uid));

    if (existingCats.length === 0) {
      const insertedCats = await db
        .insert(categories)
        .values(
          DEFAULT_CATEGORIES.map((c) => ({
            userId: uid,
            name: c.name,
            color: c.color,
            isDefault: c.isDefault,
          }))
        )
        .returning();

      const insertedTags = await db
        .insert(tags)
        .values(
          DEFAULT_TAGS.map((t) => ({
            userId: uid,
            name: t.name,
            color: t.color,
          }))
        )
        .returning();

      const catByName = new Map(insertedCats.map((c) => [c.name, c.id]));
      const tagByName = new Map(insertedTags.map((t) => [t.name, t.id]));

      const now = new Date();
      const todayStr = formatLocalDate(now);
      const yesterdayStr = addDaysToDateString(todayStr, -1);
      const tomorrowStr = addDaysToDateString(todayStr, 1);
      const inThreeDaysStr = addDaysToDateString(todayStr, 3);
      const nextWeekStr = addDaysToDateString(todayStr, 6);

      // Seed starter tasks so the workspace is immediately informative and functional
      const starterTasks = await db
        .insert(tasks)
        .values([
          {
            userId: uid,
            title: 'Finalize PostgreSQL indexing & RLS verification matrix',
            description:
              'Audit composite indexes on tasks(user_id, due_date) and verify row-level ownership boundaries.',
            priority: 'High',
            status: 'In Progress',
            categoryId: catByName.get('Work') || null,
            startDate: yesterdayStr,
            dueDate: todayStr,
            dueTime: '17:30',
            isImportant: true,
            isArchived: false,
            recurrencePattern: 'none',
            recurrenceInterval: 1,
          },
          {
            userId: uid,
            title: 'Complete DBMS relational algebra & normalization assignment',
            description:
              'Prove BCNF decomposition and submit SQL migration scripts for the semester laboratory.',
            priority: 'High',
            status: 'Pending',
            categoryId: catByName.get('College') || null,
            startDate: todayStr,
            dueDate: tomorrowStr,
            dueTime: '18:00',
            isImportant: true,
            isArchived: false,
            recurrencePattern: 'none',
            recurrenceInterval: 1,
          },
          {
            userId: uid,
            title: 'Review quarterly product roadmap & sprint backlog',
            description:
              'Prioritize Q4 deliverables and align milestone estimates with engineering capacity.',
            priority: 'Medium',
            status: 'Pending',
            categoryId: catByName.get('Projects') || null,
            startDate: yesterdayStr,
            dueDate: yesterdayStr,
            dueTime: '16:00',
            isImportant: false,
            isArchived: false,
            recurrencePattern: 'weekly',
            recurrenceInterval: 1,
          },
          {
            userId: uid,
            title: '45-minute strength & mobility conditioning session',
            description: 'Zone 2 warmup followed by posterior chain mobility protocol.',
            priority: 'Medium',
            status: 'Completed',
            categoryId: catByName.get('Health') || null,
            startDate: todayStr,
            dueDate: todayStr,
            dueTime: '08:30',
            isImportant: false,
            isArchived: false,
            recurrencePattern: 'daily',
            recurrenceInterval: 1,
            alarmEnabled: true,
            alarmMinutesBefore: 15,
            alarmSound: 'chime',
            isDailyTask: true,
            lastDailyResetDate: todayStr,
            completedAt: new Date(now.getTime() - 2 * 3600 * 1000),
          },
          {
            userId: uid,
            title: 'Morning inbox triage & top-3 daily priority planning',
            description: 'Review today deadlines, clear quick replies, and pick 3 core focus tasks.',
            priority: 'High',
            status: 'Pending',
            categoryId: catByName.get('Personal') || null,
            startDate: todayStr,
            dueDate: todayStr,
            dueTime: '09:00',
            isImportant: true,
            isArchived: false,
            recurrencePattern: 'daily',
            recurrenceInterval: 1,
            alarmEnabled: true,
            alarmMinutesBefore: 10,
            alarmSound: 'classic',
            isDailyTask: true,
            lastDailyResetDate: todayStr,
          },
          {
            userId: uid,
            title: 'Evening 30-minute reading & workspace shutdown review',
            description: 'Log completed items, tidy open notes, and prepare tomorrow schedule.',
            priority: 'Medium',
            status: 'Pending',
            categoryId: catByName.get('Personal') || null,
            startDate: todayStr,
            dueDate: todayStr,
            dueTime: '21:00',
            isImportant: false,
            isArchived: false,
            recurrencePattern: 'daily',
            recurrenceInterval: 1,
            alarmEnabled: true,
            alarmMinutesBefore: 15,
            alarmSound: 'chime',
            isDailyTask: true,
            lastDailyResetDate: todayStr,
          },
          {
            userId: uid,
            title: 'Prepare design critique notes for Editorial UI typography',
            description:
              'Evaluate contrast ratios, tabular numeral alignment, and keyboard navigation flows.',
            priority: 'Low',
            status: 'Completed',
            categoryId: catByName.get('Work') || null,
            startDate: yesterdayStr,
            dueDate: yesterdayStr,
            dueTime: '14:00',
            isImportant: false,
            isArchived: false,
            recurrencePattern: 'none',
            recurrenceInterval: 1,
            completedAt: new Date(now.getTime() - 24 * 3600 * 1000),
          },
          {
            userId: uid,
            title: 'Order ergonomic split keyboard switches & desk mat',
            description: 'Compare tactile silent switches for distraction-free writing sessions.',
            priority: 'Low',
            status: 'Pending',
            categoryId: catByName.get('Shopping') || null,
            startDate: todayStr,
            dueDate: inThreeDaysStr,
            dueTime: null,
            isImportant: false,
            isArchived: false,
            recurrencePattern: 'none',
            recurrenceInterval: 1,
          },
          {
            userId: uid,
            title: 'Synthesize literature notes on distributed consensus protocols',
            description: 'Compare Raft leader election timing with Paxos quorum assumptions.',
            priority: 'High',
            status: 'Pending',
            categoryId: catByName.get('College') || null,
            startDate: tomorrowStr,
            dueDate: nextWeekStr,
            dueTime: '15:00',
            isImportant: true,
            isArchived: false,
            recurrencePattern: 'none',
            recurrenceInterval: 1,
          },
        ])
        .returning();

      if (starterTasks.length >= 2) {
        const firstTask = starterTasks[0];
        const secondTask = starterTasks[1];

        await db.insert(subtasks).values([
          {
            taskId: firstTask.id,
            userId: uid,
            title: 'Verify foreign key ON DELETE behaviors',
            isCompleted: true,
            sortOrder: 0,
          },
          {
            taskId: firstTask.id,
            userId: uid,
            title: 'Benchmark composite due_date query plan',
            isCompleted: true,
            sortOrder: 1,
          },
          {
            taskId: firstTask.id,
            userId: uid,
            title: 'Document workspace isolation guarantees',
            isCompleted: false,
            sortOrder: 2,
          },
          {
            taskId: secondTask.id,
            userId: uid,
            title: 'Draft 3NF and BCNF dependency diagrams',
            isCompleted: true,
            sortOrder: 0,
          },
          {
            taskId: secondTask.id,
            userId: uid,
            title: 'Write test queries for relational join integrity',
            isCompleted: false,
            sortOrder: 1,
          },
        ]);

        const deepWorkTag = tagByName.get('deep-work');
        const milestoneTag = tagByName.get('milestone');
        const researchTag = tagByName.get('research');

        const tagLinks: { taskId: string; tagId: string }[] = [];
        if (deepWorkTag) tagLinks.push({ taskId: firstTask.id, tagId: deepWorkTag });
        if (milestoneTag) tagLinks.push({ taskId: firstTask.id, tagId: milestoneTag });
        if (researchTag) tagLinks.push({ taskId: secondTask.id, tagId: researchTag });

        if (tagLinks.length > 0) {
          await db.insert(taskTags).values(tagLinks);
        }

        // Seed 2 focus sessions
        await db.insert(focusSessions).values([
          {
            userId: uid,
            taskId: firstTask.id,
            sessionType: 'work',
            plannedDurationSeconds: 1500,
            actualDurationSeconds: 1500,
            startedAt: new Date(now.getTime() - 3 * 3600 * 1000),
            endedAt: new Date(now.getTime() - 3 * 3600 * 1000 + 1500 * 1000),
            completionStatus: 'completed',
          },
          {
            userId: uid,
            taskId: secondTask.id,
            sessionType: 'work',
            plannedDurationSeconds: 1500,
            actualDurationSeconds: 1500,
            startedAt: new Date(now.getTime() - 26 * 3600 * 1000),
            endedAt: new Date(now.getTime() - 26 * 3600 * 1000 + 1500 * 1000),
            completionStatus: 'completed',
          },
        ]);

        await db.insert(activityLogs).values([
          {
            userId: uid,
            taskId: firstTask.id,
            actionType: 'task_created',
            taskTitle: firstTask.title,
            detail: 'Assigned to Work · Priority High',
          },
          {
            userId: uid,
            taskId: starterTasks[3].id,
            actionType: 'task_completed',
            taskTitle: starterTasks[3].title,
            detail: 'Completed on schedule',
          },
          {
            userId: uid,
            taskId: firstTask.id,
            actionType: 'focus_completed',
            taskTitle: firstTask.title,
            detail: '25 min Pomodoro work session completed',
          },
        ]);
      }
    }
  } catch (error) {
    console.error('Database error initializing workspace:', error);
    throw new Error('Failed to initialize workspace in database.', { cause: error });
  }
}

/**
 * Automatically restarts all active Daily Tasks whose lastDailyResetDate !== todayStr.
 * Also supports manual forced restart when force === true.
 */
export async function resetDailyTasksForUser(
  userId: string,
  todayStr: string = formatLocalDate(new Date()),
  force: boolean = false
): Promise<{ resetCount: number; previousStates: { id: string; status: TaskStatus; completedAt: string | null }[] }> {
  try {
    const dailyRows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.isDailyTask, true),
          isNull(tasks.deletedAt),
          eq(tasks.isArchived, false)
        )
      );

    const toReset = dailyRows.filter(
      (t) => force || t.lastDailyResetDate !== todayStr
    );

    if (toReset.length === 0) {
      return { resetCount: 0, previousStates: [] };
    }

    const previousStates = toReset.map((t) => ({
      id: t.id,
      status: t.status as TaskStatus,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    }));

    const resetIds = toReset.map((t) => t.id);
    const now = new Date();

    await db
      .update(tasks)
      .set({
        status: 'Pending',
        completedAt: null,
        dueDate: todayStr,
        lastDailyResetDate: todayStr,
        lastAlarmTriggeredDate: null,
        updatedAt: now,
      })
      .where(and(eq(tasks.userId, userId), inArray(tasks.id, resetIds)));

    // Reset subtasks for these daily tasks so each day starts clean
    await db
      .update(subtasks)
      .set({ isCompleted: false })
      .where(and(eq(subtasks.userId, userId), inArray(subtasks.taskId, resetIds)));

    if (force) {
      await logActivity(
        userId,
        'task_updated',
        `${toReset.length} daily tasks`,
        'Daily routine manually restarted'
      );
    }

    return { resetCount: toReset.length, previousStates };
  } catch (error) {
    console.error('Database error resetting daily tasks:', error);
    throw new Error('Failed to reset daily tasks.', { cause: error });
  }
}

export async function getAllTasksForUser(
  userId: string,
  clientTodayStr?: string
): Promise<TaskItem[]> {
  try {
    const todayStr = clientTodayStr || formatLocalDate(new Date());
    await resetDailyTasksForUser(userId, todayStr, false);

    const userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));

    if (userTasks.length === 0) return [];

    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    const userSubtasks = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.userId, userId))
      .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));

    const userTags = await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId));

    const taskIds = userTasks.map((t) => t.id);
    const allTaskTagRows =
      taskIds.length > 0
        ? await db
            .select()
            .from(taskTags)
            .where(inArray(taskTags.taskId, taskIds))
        : [];

    const catMap = new Map(userCategories.map((c) => [c.id, c]));
    const tagMap = new Map(userTags.map((t) => [t.id, t]));

    const subtasksByTask = new Map<string, typeof userSubtasks>();
    for (const st of userSubtasks) {
      const list = subtasksByTask.get(st.taskId) || [];
      list.push(st);
      subtasksByTask.set(st.taskId, list);
    }

    const tagsByTask = new Map<string, { id: string; name: string; color: string }[]>();
    for (const tt of allTaskTagRows) {
      const tag = tagMap.get(tt.tagId);
      if (tag) {
        const list = tagsByTask.get(tt.taskId) || [];
        list.push({ id: tag.id, name: tag.name, color: tag.color });
        tagsByTask.set(tt.taskId, list);
      }
    }

    return userTasks.map((t) => {
      const cat = t.categoryId ? catMap.get(t.categoryId) : null;
      return {
        id: t.id,
        userId: t.userId,
        title: t.title,
        description: t.description,
        priority: t.priority as TaskPriority,
        status: t.status as TaskStatus,
        categoryId: t.categoryId,
        categoryName: cat ? cat.name : null,
        categoryColor: cat ? cat.color : null,
        startDate: t.startDate,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        isImportant: t.isImportant,
        isArchived: t.isArchived,
        recurrencePattern: (t.recurrencePattern || 'none') as RecurrencePattern,
        recurrenceInterval: t.recurrenceInterval || 1,
        alarmEnabled: Boolean(t.alarmEnabled),
        alarmMinutesBefore: t.alarmMinutesBefore ?? 10,
        alarmSound: (t.alarmSound || 'classic') as AlarmSoundType,
        alarmAudioData: t.alarmAudioData || null,
        alarmAudioName: t.alarmAudioName || null,
        alarmSnoozedUntil: t.alarmSnoozedUntil
          ? t.alarmSnoozedUntil.toISOString()
          : null,
        lastAlarmTriggeredDate: t.lastAlarmTriggeredDate || null,
        isDailyTask: Boolean(t.isDailyTask),
        lastDailyResetDate: t.lastDailyResetDate || null,
        sortOrder: t.sortOrder ?? 0,
        deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        subtasks: (subtasksByTask.get(t.id) || []).map((s) => ({
          id: s.id,
          taskId: s.taskId,
          title: s.title,
          isCompleted: s.isCompleted,
          sortOrder: s.sortOrder,
        })),
        tags: tagsByTask.get(t.id) || [],
      };
    });
  } catch (error) {
    console.error('Database query failed in getAllTasksForUser:', error);
    throw new Error('Failed to load tasks from database.', { cause: error });
  }
}

export async function getTaskByIdForUser(
  userId: string,
  taskId: string
): Promise<TaskItem | null> {
  const all = await getAllTasksForUser(userId);
  return all.find((t) => t.id === taskId) || null;
}

export async function createTaskForUser(
  userId: string,
  payload: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    categoryId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    isImportant?: boolean;
    recurrencePattern?: RecurrencePattern;
    recurrenceInterval?: number;
    alarmEnabled?: boolean;
    alarmMinutesBefore?: number;
    alarmSound?: AlarmSoundType;
    alarmAudioData?: string | null;
    alarmAudioName?: string | null;
    isDailyTask?: boolean;
    sortOrder?: number;
    subtasks?: { title: string; isCompleted?: boolean }[];
    tagIds?: string[];
    tagNames?: string[];
  }
): Promise<TaskItem> {
  try {
    // Verify category ownership if provided
    let validCategoryId: string | null = null;
    if (payload.categoryId) {
      const cat = await db
        .select()
        .from(categories)
        .where(
          and(eq(categories.id, payload.categoryId), eq(categories.userId, userId))
        );
      if (cat.length > 0) {
        validCategoryId = cat[0].id;
      }
    }

    const status = payload.status || 'Pending';
    const completedAt = status === 'Completed' ? new Date() : null;
    const isDaily = Boolean(payload.isDailyTask);
    const todayStr = formatLocalDate(new Date());

    const [inserted] = await db
      .insert(tasks)
      .values({
        userId,
        title: payload.title.trim(),
        description: (payload.description || '').trim(),
        priority: payload.priority || 'Medium',
        status,
        categoryId: validCategoryId,
        startDate: payload.startDate || (isDaily ? todayStr : null),
        dueDate: payload.dueDate || (isDaily ? todayStr : null),
        dueTime: payload.dueTime || null,
        isImportant: Boolean(payload.isImportant),
        isArchived: false,
        recurrencePattern: isDaily ? 'daily' : payload.recurrencePattern || 'none',
        recurrenceInterval: payload.recurrenceInterval || 1,
        alarmEnabled: Boolean(payload.alarmEnabled),
        alarmMinutesBefore: Math.max(0, Number(payload.alarmMinutesBefore ?? 10) || 0),
        alarmSound: payload.alarmSound || 'classic',
        alarmAudioData: payload.alarmAudioData || null,
        alarmAudioName: payload.alarmAudioName || null,
        alarmSnoozedUntil: null,
        lastAlarmTriggeredDate: null,
        isDailyTask: isDaily,
        lastDailyResetDate: isDaily ? todayStr : null,
        sortOrder: payload.sortOrder ?? 0,
        completedAt,
      })
      .returning();

    if (payload.recurrencePattern && payload.recurrencePattern !== 'none') {
      await db.insert(recurringRules).values({
        taskId: inserted.id,
        userId,
        frequency: payload.recurrencePattern,
        intervalDays: payload.recurrenceInterval || 1,
        isActive: true,
      });
    }

    if (payload.subtasks && payload.subtasks.length > 0) {
      const validSubtasks = payload.subtasks
        .map((s, idx) => ({
          taskId: inserted.id,
          userId,
          title: (s.title || '').trim(),
          isCompleted: Boolean(s.isCompleted),
          sortOrder: idx,
        }))
        .filter((s) => s.title.length > 0);

      if (validSubtasks.length > 0) {
        await db.insert(subtasks).values(validSubtasks);
      }
    }

    // Handle tagIds and tagNames
    const finalTagIds = new Set<string>(payload.tagIds || []);
    if (payload.tagNames && payload.tagNames.length > 0) {
      const existingTags = await db
        .select()
        .from(tags)
        .where(eq(tags.userId, userId));
      const existingByName = new Map(
        existingTags.map((t) => [t.name.toLowerCase(), t.id])
      );

      for (const rawName of payload.tagNames) {
        const cleanName = rawName.trim().toLowerCase();
        if (!cleanName) continue;
        const foundId = existingByName.get(cleanName);
        if (foundId) {
          finalTagIds.add(foundId);
        } else {
          const [createdTag] = await db
            .insert(tags)
            .values({
              userId,
              name: cleanName,
              color: '#C6F36B',
            })
            .returning();
          finalTagIds.add(createdTag.id);
          existingByName.set(cleanName, createdTag.id);
        }
      }
    }

    if (finalTagIds.size > 0) {
      await db.insert(taskTags).values(
        Array.from(finalTagIds).map((tagId) => ({
          taskId: inserted.id,
          tagId,
        }))
      );
    }

    await logActivity(
      userId,
      'task_created',
      inserted.title,
      `Priority ${inserted.priority} · Status ${inserted.status}`,
      inserted.id
    );

    const created = await getTaskByIdForUser(userId, inserted.id);
    if (!created) throw new Error('Created task could not be retrieved.');
    return created;
  } catch (error) {
    console.error('Database error creating task:', error);
    throw new Error('Failed to create task in database.', { cause: error });
  }
}

export async function updateTaskForUser(
  userId: string,
  taskId: string,
  payload: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    categoryId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    isImportant?: boolean;
    isArchived?: boolean;
    recurrencePattern?: RecurrencePattern;
    recurrenceInterval?: number;
    alarmEnabled?: boolean;
    alarmMinutesBefore?: number;
    alarmSound?: AlarmSoundType;
    alarmAudioData?: string | null;
    alarmAudioName?: string | null;
    alarmSnoozedUntil?: string | null;
    lastAlarmTriggeredDate?: string | null;
    isDailyTask?: boolean;
    lastDailyResetDate?: string | null;
    sortOrder?: number;
    tagIds?: string[];
    subtasks?: { id?: string; title: string; isCompleted?: boolean }[];
  }
): Promise<TaskItem> {
  try {
    const existingRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    if (existingRows.length === 0) {
      throw new Error('Task not found or unauthorized.');
    }
    const existing = existingRows[0];

    let validCategoryId = existing.categoryId;
    if (payload.categoryId !== undefined) {
      if (payload.categoryId === null || payload.categoryId === '') {
        validCategoryId = null;
      } else {
        const cat = await db
          .select()
          .from(categories)
          .where(
            and(eq(categories.id, payload.categoryId), eq(categories.userId, userId))
          );
        validCategoryId = cat.length > 0 ? cat[0].id : null;
      }
    }

    const nextStatus = (payload.status || existing.status) as TaskStatus;
    let nextCompletedAt = existing.completedAt;
    const transitioningToCompleted =
      existing.status !== 'Completed' && nextStatus === 'Completed';

    if (transitioningToCompleted) {
      nextCompletedAt = new Date();
    } else if (nextStatus !== 'Completed') {
      nextCompletedAt = null;
    }

    const nextIsDaily =
      payload.isDailyTask !== undefined
        ? Boolean(payload.isDailyTask)
        : existing.isDailyTask;
    const todayStr = formatLocalDate(new Date());

    const nextRecurrence = (
      nextIsDaily
        ? 'daily'
        : payload.recurrencePattern ?? existing.recurrencePattern ?? 'none'
    ) as RecurrencePattern;
    const nextInterval = payload.recurrenceInterval ?? existing.recurrenceInterval ?? 1;

    const dueTimeChanged =
      payload.dueTime !== undefined && payload.dueTime !== existing.dueTime;
    const alarmMinChanged =
      payload.alarmMinutesBefore !== undefined &&
      payload.alarmMinutesBefore !== existing.alarmMinutesBefore;
    const nextLastAlarm =
      payload.lastAlarmTriggeredDate !== undefined
        ? payload.lastAlarmTriggeredDate
        : dueTimeChanged || alarmMinChanged
          ? null
          : existing.lastAlarmTriggeredDate;

    await db
      .update(tasks)
      .set({
        title: payload.title !== undefined ? payload.title.trim() : existing.title,
        description:
          payload.description !== undefined
            ? payload.description.trim()
            : existing.description,
        priority: payload.priority || existing.priority,
        status: nextStatus,
        categoryId: validCategoryId,
        startDate:
          payload.startDate !== undefined ? payload.startDate : existing.startDate,
        dueDate:
          payload.dueDate !== undefined
            ? payload.dueDate
            : nextIsDaily && !existing.dueDate
              ? todayStr
              : existing.dueDate,
        dueTime: payload.dueTime !== undefined ? payload.dueTime : existing.dueTime,
        isImportant:
          payload.isImportant !== undefined
            ? Boolean(payload.isImportant)
            : existing.isImportant,
        isArchived:
          payload.isArchived !== undefined
            ? Boolean(payload.isArchived)
            : existing.isArchived,
        recurrencePattern: nextRecurrence,
        recurrenceInterval: nextInterval,
        alarmEnabled:
          payload.alarmEnabled !== undefined
            ? Boolean(payload.alarmEnabled)
            : existing.alarmEnabled,
        alarmMinutesBefore:
          payload.alarmMinutesBefore !== undefined
            ? Math.max(0, Number(payload.alarmMinutesBefore) || 0)
            : existing.alarmMinutesBefore,
        alarmSound: payload.alarmSound ?? existing.alarmSound,
        alarmAudioData:
          payload.alarmAudioData !== undefined
            ? payload.alarmAudioData
            : existing.alarmAudioData,
        alarmAudioName:
          payload.alarmAudioName !== undefined
            ? payload.alarmAudioName
            : existing.alarmAudioName,
        alarmSnoozedUntil:
          payload.alarmSnoozedUntil !== undefined
            ? payload.alarmSnoozedUntil
              ? new Date(payload.alarmSnoozedUntil)
              : null
            : transitioningToCompleted || dueTimeChanged || alarmMinChanged
              ? null
              : existing.alarmSnoozedUntil,
        lastAlarmTriggeredDate: nextLastAlarm,
        isDailyTask: nextIsDaily,
        lastDailyResetDate:
          payload.lastDailyResetDate !== undefined
            ? payload.lastDailyResetDate
            : nextIsDaily
              ? existing.lastDailyResetDate || todayStr
              : existing.lastDailyResetDate,
        sortOrder:
          payload.sortOrder !== undefined ? payload.sortOrder : existing.sortOrder,
        completedAt: nextCompletedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    // Sync tags if provided
    if (payload.tagIds !== undefined) {
      await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
      if (payload.tagIds.length > 0) {
        await db.insert(taskTags).values(
          payload.tagIds.map((tagId) => ({
            taskId,
            tagId,
          }))
        );
      }
    }

    // Sync subtasks if provided
    if (payload.subtasks !== undefined) {
      await db.delete(subtasks).where(eq(subtasks.taskId, taskId));
      const cleanSubtasks = payload.subtasks
        .map((s, idx) => ({
          taskId,
          userId,
          title: (s.title || '').trim(),
          isCompleted: Boolean(s.isCompleted),
          sortOrder: idx,
        }))
        .filter((s) => s.title.length > 0);
      if (cleanSubtasks.length > 0) {
        await db.insert(subtasks).values(cleanSubtasks);
      }
    }

    // Section 6.4: If a non-daily-routine recurring task transitions to Completed, generate next occurrence once
    // Daily routine tasks (isDailyTask === true) reset themselves in-place every day instead of duplicating
    if (transitioningToCompleted && nextRecurrence !== 'none' && !nextIsDaily) {
      const nextDueDate = calculateNextOccurrenceDate(
        payload.dueDate ?? existing.dueDate,
        nextRecurrence,
        nextInterval
      );
      if (nextDueDate) {
        await db.insert(tasks).values({
          userId,
          title: payload.title !== undefined ? payload.title.trim() : existing.title,
          description:
            payload.description !== undefined
              ? payload.description.trim()
              : existing.description,
          priority: payload.priority || existing.priority,
          status: 'Pending',
          categoryId: validCategoryId,
          startDate: nextDueDate,
          dueDate: nextDueDate,
          dueTime: payload.dueTime ?? existing.dueTime,
          isImportant:
            payload.isImportant !== undefined
              ? Boolean(payload.isImportant)
              : existing.isImportant,
          isArchived: false,
          recurrencePattern: nextRecurrence,
          recurrenceInterval: nextInterval,
        });
      }
    }

    // Log specific activity events
    const finalTitle =
      payload.title !== undefined ? payload.title.trim() : existing.title;
    if (transitioningToCompleted) {
      await logActivity(userId, 'task_completed', finalTitle, 'Marked as Completed', taskId);
    } else if (payload.priority && payload.priority !== existing.priority) {
      await logActivity(
        userId,
        'priority_changed',
        finalTitle,
        `Priority changed to ${payload.priority}`,
        taskId
      );
    } else if (
      payload.categoryId !== undefined &&
      validCategoryId !== existing.categoryId
    ) {
      await logActivity(
        userId,
        'category_changed',
        finalTitle,
        'Category updated',
        taskId
      );
    } else {
      await logActivity(userId, 'task_updated', finalTitle, 'Task details updated', taskId);
    }

    const updated = await getTaskByIdForUser(userId, taskId);
    if (!updated) throw new Error('Updated task could not be retrieved.');
    return updated;
  } catch (error) {
    console.error('Database error updating task:', error);
    throw new Error('Failed to update task.', { cause: error });
  }
}

export async function softDeleteTaskForUser(userId: string, taskId: string) {
  try {
    const existing = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    if (existing.length === 0) throw new Error('Task not found.');

    await db
      .update(tasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    await logActivity(
      userId,
      'task_deleted',
      existing[0].title,
      'Moved to Recently Deleted',
      taskId
    );
  } catch (error) {
    console.error('Database error soft-deleting task:', error);
    throw new Error('Failed to move task to trash.', { cause: error });
  }
}

export async function permanentDeleteTaskForUser(userId: string, taskId: string) {
  try {
    const existing = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    if (existing.length === 0) throw new Error('Task not found.');

    await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    await logActivity(
      userId,
      'task_deleted',
      existing[0].title,
      'Permanently deleted'
    );
  } catch (error) {
    console.error('Database error permanently deleting task:', error);
    throw new Error('Failed to permanently delete task.', { cause: error });
  }
}

export async function emptyTrashForUser(userId: string) {
  try {
    await db
      .delete(tasks)
      .where(and(eq(tasks.userId, userId), isNotNull(tasks.deletedAt)));
    await logActivity(userId, 'task_deleted', 'Trash emptied', 'All deleted tasks removed');
  } catch (error) {
    console.error('Database error emptying trash:', error);
    throw new Error('Failed to empty trash.', { cause: error });
  }
}

export async function restoreTaskForUser(
  userId: string,
  taskId: string
): Promise<TaskItem> {
  try {
    const existing = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    if (existing.length === 0) throw new Error('Task not found.');

    const nextStatus =
      existing[0].status === 'Completed' && !existing[0].deletedAt && !existing[0].isArchived
        ? 'Pending'
        : existing[0].status;

    await db
      .update(tasks)
      .set({
        deletedAt: null,
        isArchived: false,
        status: nextStatus,
        completedAt: nextStatus === 'Completed' ? existing[0].completedAt : null,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    await logActivity(
      userId,
      'task_restored',
      existing[0].title,
      'Restored to active tasks',
      taskId
    );

    const restored = await getTaskByIdForUser(userId, taskId);
    if (!restored) throw new Error('Restored task not found.');
    return restored;
  } catch (error) {
    console.error('Database error restoring task:', error);
    throw new Error('Failed to restore task.', { cause: error });
  }
}

export async function archiveTaskForUser(
  userId: string,
  taskId: string,
  isArchived: boolean = true
): Promise<TaskItem> {
  try {
    const existing = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    if (existing.length === 0) throw new Error('Task not found.');

    await db
      .update(tasks)
      .set({ isArchived, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    await logActivity(
      userId,
      isArchived ? 'task_archived' : 'task_restored',
      existing[0].title,
      isArchived ? 'Archived task' : 'Unarchived task',
      taskId
    );

    const updated = await getTaskByIdForUser(userId, taskId);
    if (!updated) throw new Error('Task not found after archive update.');
    return updated;
  } catch (error) {
    console.error('Database error archiving task:', error);
    throw new Error('Failed to update task archive status.', { cause: error });
  }
}

export async function duplicateTaskForUser(
  userId: string,
  taskId: string
): Promise<TaskItem> {
  try {
    const source = await getTaskByIdForUser(userId, taskId);
    if (!source) throw new Error('Source task not found.');

    return await createTaskForUser(userId, {
      title: `${source.title} (Copy)`,
      description: source.description,
      priority: source.priority,
      status: 'Pending',
      categoryId: source.categoryId,
      startDate: source.startDate,
      dueDate: source.dueDate,
      dueTime: source.dueTime,
      isImportant: source.isImportant,
      recurrencePattern: source.recurrencePattern,
      recurrenceInterval: source.recurrenceInterval,
      alarmEnabled: source.alarmEnabled,
      alarmMinutesBefore: source.alarmMinutesBefore,
      alarmSound: source.alarmSound,
      alarmAudioData: source.alarmAudioData,
      alarmAudioName: source.alarmAudioName,
      isDailyTask: source.isDailyTask,
      subtasks: source.subtasks.map((s) => ({
        title: s.title,
        isCompleted: false,
      })),
      tagIds: source.tags.map((t) => t.id),
    });
  } catch (error) {
    console.error('Database error duplicating task:', error);
    throw new Error('Failed to duplicate task.', { cause: error });
  }
}

export async function bulkUpdateTasksForUser(
  userId: string,
  taskIds: string[],
  action:
    | 'complete'
    | 'status'
    | 'priority'
    | 'category'
    | 'archive'
    | 'restore'
    | 'delete'
    | 'permanent_delete',
  value?: string | null
) {
  try {
    if (!taskIds || taskIds.length === 0) return;
    const now = new Date();
    const condition = and(eq(tasks.userId, userId), inArray(tasks.id, taskIds));

    if (action === 'complete') {
      await db
        .update(tasks)
        .set({ status: 'Completed', completedAt: now, updatedAt: now })
        .where(condition);
      await logActivity(
        userId,
        'task_completed',
        `${taskIds.length} tasks`,
        'Bulk completed'
      );
    } else if (action === 'status' && value) {
      await db
        .update(tasks)
        .set({
          status: value,
          completedAt: value === 'Completed' ? now : null,
          updatedAt: now,
        })
        .where(condition);
      await logActivity(
        userId,
        'task_updated',
        `${taskIds.length} tasks`,
        `Bulk status set to ${value}`
      );
    } else if (action === 'priority' && value) {
      await db
        .update(tasks)
        .set({ priority: value, updatedAt: now })
        .where(condition);
      await logActivity(
        userId,
        'priority_changed',
        `${taskIds.length} tasks`,
        `Bulk priority set to ${value}`
      );
    } else if (action === 'category') {
      await db
        .update(tasks)
        .set({ categoryId: value || null, updatedAt: now })
        .where(condition);
      await logActivity(
        userId,
        'category_changed',
        `${taskIds.length} tasks`,
        'Bulk category updated'
      );
    } else if (action === 'archive') {
      await db
        .update(tasks)
        .set({ isArchived: true, updatedAt: now })
        .where(condition);
      await logActivity(
        userId,
        'task_archived',
        `${taskIds.length} tasks`,
        'Bulk archived'
      );
    } else if (action === 'restore') {
      await db
        .update(tasks)
        .set({ isArchived: false, deletedAt: null, updatedAt: now })
        .where(condition);
      await logActivity(
        userId,
        'task_restored',
        `${taskIds.length} tasks`,
        'Bulk restored'
      );
    } else if (action === 'delete') {
      await db
        .update(tasks)
        .set({ deletedAt: now, updatedAt: now })
        .where(condition);
      await logActivity(
        userId,
        'task_deleted',
        `${taskIds.length} tasks`,
        'Bulk moved to Recently Deleted'
      );
    } else if (action === 'permanent_delete') {
      await db.delete(tasks).where(condition);
      await logActivity(
        userId,
        'task_deleted',
        `${taskIds.length} tasks`,
        'Bulk permanently deleted'
      );
    }
  } catch (error) {
    console.error('Database error executing bulk task action:', error);
    throw new Error('Bulk operation failed.', { cause: error });
  }
}

/**
 * Persists drag-and-drop sort order for a user's tasks.
 */
export async function reorderTasksForUser(
  userId: string,
  orderedTaskIds: string[]
): Promise<void> {
  try {
    if (!Array.isArray(orderedTaskIds) || orderedTaskIds.length === 0) return;
    const now = new Date();
    await Promise.all(
      orderedTaskIds.map((taskId, index) =>
        db
          .update(tasks)
          .set({ sortOrder: index, updatedAt: now })
          .where(and(eq(tasks.userId, userId), eq(tasks.id, taskId)))
      )
    );
  } catch (error) {
    console.error('Database error reordering tasks:', error);
    throw new Error('Failed to save custom task order.', { cause: error });
  }
}

/**
 * Alarm API: Lists all active upcoming/scheduled task alarms for the user.
 */
export async function getActiveAlarmsForUser(
  userId: string,
  clientTodayStr?: string
) {
  const allTasks = await getAllTasksForUser(userId, clientTodayStr);
  return allTasks
    .filter(
      (t) =>
        !t.deletedAt &&
        !t.isArchived &&
        t.status !== 'Completed' &&
        t.alarmEnabled &&
        Boolean(t.dueTime)
    )
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      alarmMinutesBefore: t.alarmMinutesBefore,
      alarmSound: t.alarmSound,
      alarmAudioName: t.alarmAudioName,
      alarmSnoozedUntil: t.alarmSnoozedUntil,
      lastAlarmTriggeredDate: t.lastAlarmTriggeredDate,
      isDailyTask: t.isDailyTask,
    }));
}

export async function acknowledgeTaskAlarmForUser(
  userId: string,
  taskId: string,
  triggerStamp: string
): Promise<TaskItem> {
  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  if (existing.length === 0) {
    throw new Error('Task not found or unauthorized.');
  }
  await db
    .update(tasks)
    .set({
      lastAlarmTriggeredDate: triggerStamp,
      alarmSnoozedUntil: null,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  const updated = await getTaskByIdForUser(userId, taskId);
  if (!updated) throw new Error('Task not found after alarm acknowledge.');
  return updated;
}

export async function snoozeTaskAlarmForUser(
  userId: string,
  taskId: string,
  minutes: number = 5
): Promise<{ task: TaskItem; snoozedUntil: string }> {
  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  if (existing.length === 0) {
    throw new Error('Task not found or unauthorized.');
  }
  const safeMinutes = Math.max(1, Math.min(180, Number(minutes) || 5));
  const snoozedUntilDate = new Date(Date.now() + safeMinutes * 60 * 1000);
  await db
    .update(tasks)
    .set({
      alarmSnoozedUntil: snoozedUntilDate,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  await logActivity(
    userId,
    'alarm_snoozed',
    existing[0].title,
    `Alarm snoozed for ${safeMinutes} minutes`,
    taskId
  );

  const updated = await getTaskByIdForUser(userId, taskId);
  if (!updated) throw new Error('Task not found after alarm snooze.');
  return { task: updated, snoozedUntil: snoozedUntilDate.toISOString() };
}

// Categories CRUD
export async function getCategoriesForUser(userId: string) {
  try {
    const userCats = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.createdAt));

    const activeTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
          eq(tasks.isArchived, false)
        )
      );

    const countMap = new Map<string, number>();
    for (const t of activeTasks) {
      if (t.categoryId) {
        countMap.set(t.categoryId, (countMap.get(t.categoryId) || 0) + 1);
      }
    }

    return userCats.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isDefault: c.isDefault,
      taskCount: countMap.get(c.id) || 0,
    }));
  } catch (error) {
    console.error('Database error fetching categories:', error);
    throw new Error('Failed to load categories.', { cause: error });
  }
}

export async function createCategoryForUser(
  userId: string,
  name: string,
  color: string
) {
  try {
    const [created] = await db
      .insert(categories)
      .values({
        userId,
        name: name.trim(),
        color: color || '#C6F36B',
        isDefault: false,
      })
      .returning();
    return { ...created, taskCount: 0 };
  } catch (error) {
    console.error('Database error creating category:', error);
    throw new Error('Failed to create category.', { cause: error });
  }
}

export async function updateCategoryForUser(
  userId: string,
  categoryId: string,
  name: string,
  color: string
) {
  try {
    const [updated] = await db
      .update(categories)
      .set({ name: name.trim(), color })
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .returning();
    if (!updated) throw new Error('Category not found.');
    return updated;
  } catch (error) {
    console.error('Database error updating category:', error);
    throw new Error('Failed to update category.', { cause: error });
  }
}

export async function deleteCategoryForUser(
  userId: string,
  categoryId: string,
  reassignToCategoryId?: string | null
) {
  try {
    const existing = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
    if (existing.length === 0) throw new Error('Category not found.');
    if (existing[0].isDefault) {
      throw new Error(
        'Default system categories are protected from permanent deletion. You can rename or change their color.'
      );
    }

    // Reassign tasks or leave them uncategorized (Section 5.9: Deleting a category must NEVER delete its tasks)
    await db
      .update(tasks)
      .set({
        categoryId: reassignToCategoryId || null,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.userId, userId), eq(tasks.categoryId, categoryId)));

    await db
      .delete(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  } catch (error: any) {
    console.error('Database error deleting category:', error);
    throw new Error(error.message || 'Failed to delete category.', {
      cause: error,
    });
  }
}

// Tags CRUD
export async function getTagsForUser(userId: string) {
  try {
    return await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(asc(tags.name));
  } catch (error) {
    console.error('Database error loading tags:', error);
    throw new Error('Failed to load tags.', { cause: error });
  }
}

export async function createTagForUser(
  userId: string,
  name: string,
  color: string = '#C6F36B'
) {
  try {
    const [created] = await db
      .insert(tags)
      .values({ userId, name: name.trim().toLowerCase(), color })
      .returning();
    return created;
  } catch (error) {
    console.error('Database error creating tag:', error);
    throw new Error('Failed to create tag.', { cause: error });
  }
}

export async function updateTagForUser(
  userId: string,
  tagId: string,
  name: string,
  color: string
) {
  try {
    const [updated] = await db
      .update(tags)
      .set({ name: name.trim().toLowerCase(), color })
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .returning();
    if (!updated) throw new Error('Tag not found.');
    return updated;
  } catch (error) {
    console.error('Database error updating tag:', error);
    throw new Error('Failed to update tag.', { cause: error });
  }
}

export async function deleteTagForUser(userId: string, tagId: string) {
  try {
    await db
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
  } catch (error) {
    console.error('Database error deleting tag:', error);
    throw new Error('Failed to delete tag.', { cause: error });
  }
}

// Subtasks CRUD (Section 6.2 & Section 10.10: subtasks inherit ownership of parent task)
export async function getSubtasksForTask(userId: string, taskId: string) {
  try {
    return await db
      .select()
      .from(subtasks)
      .where(and(eq(subtasks.taskId, taskId), eq(subtasks.userId, userId)))
      .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));
  } catch (error) {
    console.error('Database error fetching subtasks:', error);
    throw new Error('Failed to load subtasks.', { cause: error });
  }
}

export async function createSubtaskForTask(
  userId: string,
  taskId: string,
  title: string
) {
  try {
    const parent = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    if (parent.length === 0) throw new Error('Parent task not found.');

    const existing = await getSubtasksForTask(userId, taskId);
    const [created] = await db
      .insert(subtasks)
      .values({
        taskId,
        userId,
        title: title.trim(),
        isCompleted: false,
        sortOrder: existing.length,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database error creating subtask:', error);
    throw new Error('Failed to create subtask.', { cause: error });
  }
}

export async function updateSubtaskForUser(
  userId: string,
  subtaskId: string,
  payload: { title?: string; isCompleted?: boolean }
) {
  try {
    const existing = await db
      .select()
      .from(subtasks)
      .where(and(eq(subtasks.id, subtaskId), eq(subtasks.userId, userId)));
    if (existing.length === 0) throw new Error('Subtask not found.');

    const [updated] = await db
      .update(subtasks)
      .set({
        title:
          payload.title !== undefined ? payload.title.trim() : existing[0].title,
        isCompleted:
          payload.isCompleted !== undefined
            ? Boolean(payload.isCompleted)
            : existing[0].isCompleted,
      })
      .where(and(eq(subtasks.id, subtaskId), eq(subtasks.userId, userId)))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database error updating subtask:', error);
    throw new Error('Failed to update subtask.', { cause: error });
  }
}

export async function deleteSubtaskForUser(userId: string, subtaskId: string) {
  try {
    await db
      .delete(subtasks)
      .where(and(eq(subtasks.id, subtaskId), eq(subtasks.userId, userId)));
  } catch (error) {
    console.error('Database error deleting subtask:', error);
    throw new Error('Failed to delete subtask.', { cause: error });
  }
}

// Focus Sessions
export async function recordFocusSessionForUser(
  userId: string,
  payload: {
    taskId?: string | null;
    sessionType: 'work' | 'short_break' | 'long_break';
    plannedDurationSeconds: number;
    actualDurationSeconds: number;
    startedAt: string;
    endedAt: string;
    completionStatus: 'completed' | 'interrupted' | 'skipped';
  }
) {
  try {
    let validTaskId: string | null = null;
    let taskTitle = 'Unassigned Focus Session';
    if (payload.taskId) {
      const found = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, payload.taskId), eq(tasks.userId, userId)));
      if (found.length > 0) {
        validTaskId = found[0].id;
        taskTitle = found[0].title;
      }
    }

    const [created] = await db
      .insert(focusSessions)
      .values({
        userId,
        taskId: validTaskId,
        sessionType: payload.sessionType || 'work',
        plannedDurationSeconds: payload.plannedDurationSeconds,
        actualDurationSeconds: payload.actualDurationSeconds,
        startedAt: new Date(payload.startedAt),
        endedAt: new Date(payload.endedAt),
        completionStatus: payload.completionStatus || 'completed',
      })
      .returning();

    if (payload.sessionType === 'work' && payload.completionStatus === 'completed') {
      const mins = Math.max(1, Math.round(payload.actualDurationSeconds / 60));
      await logActivity(
        userId,
        'focus_completed',
        taskTitle,
        `${mins} min focus session completed`,
        validTaskId
      );
    }

    return created;
  } catch (error) {
    console.error('Database error recording focus session:', error);
    throw new Error('Failed to record focus session.', { cause: error });
  }
}

export async function getFocusSessionsForUser(userId: string) {
  try {
    const rows = await db
      .select()
      .from(focusSessions)
      .where(eq(focusSessions.userId, userId))
      .orderBy(desc(focusSessions.startedAt));

    const userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId));
    const taskTitleMap = new Map(userTasks.map((t) => [t.id, t.title]));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      taskId: r.taskId,
      taskTitle: r.taskId ? taskTitleMap.get(r.taskId) || 'Deleted Task' : 'General Focus',
      sessionType: r.sessionType,
      plannedDurationSeconds: r.plannedDurationSeconds,
      actualDurationSeconds: r.actualDurationSeconds,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt.toISOString(),
      completionStatus: r.completionStatus,
    }));
  } catch (error) {
    console.error('Database error loading focus sessions:', error);
    throw new Error('Failed to load focus sessions.', { cause: error });
  }
}

export async function getFocusStatsForUser(userId: string) {
  try {
    const sessions = await getFocusSessionsForUser(userId);
    const now = new Date();
    const todayStr = formatLocalDate(now);
    const sevenDaysAgoStr = addDaysToDateString(todayStr, -6);

    const workSessions = sessions.filter(
      (s) => s.sessionType === 'work' && s.completionStatus === 'completed'
    );

    let totalFocusSeconds = 0;
    let dailyFocusSeconds = 0;
    let weeklyFocusSeconds = 0;

    for (const s of workSessions) {
      totalFocusSeconds += s.actualDurationSeconds;
      const dayStr = formatLocalDate(new Date(s.startedAt));
      if (dayStr === todayStr) {
        dailyFocusSeconds += s.actualDurationSeconds;
      }
      if (dayStr >= sevenDaysAgoStr && dayStr <= todayStr) {
        weeklyFocusSeconds += s.actualDurationSeconds;
      }
    }

    return {
      totalFocusMinutes: Math.round(totalFocusSeconds / 60),
      sessionsCompleted: workSessions.length,
      dailyFocusMinutes: Math.round(dailyFocusSeconds / 60),
      weeklyFocusMinutes: Math.round(weeklyFocusSeconds / 60),
    };
  } catch (error) {
    console.error('Database error computing focus stats:', error);
    throw new Error('Failed to compute focus statistics.', { cause: error });
  }
}

// Preferences
export async function getPreferencesForUser(userId: string) {
  try {
    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    if (rows.length > 0) return rows[0];

    const [created] = await db
      .insert(userPreferences)
      .values({ userId })
      .returning();
    return created;
  } catch (error) {
    console.error('Database error getting preferences:', error);
    throw new Error('Failed to load user preferences.', { cause: error });
  }
}

export async function updatePreferencesForUser(
  userId: string,
  payload: Partial<typeof userPreferences.$inferInsert>
) {
  try {
    await getPreferencesForUser(userId);
    const [updated] = await db
      .update(userPreferences)
      .set({
        ...payload,
        userId,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database error updating preferences:', error);
    throw new Error('Failed to save preferences.', { cause: error });
  }
}

// Activity timeline
export async function getRecentActivityForUser(userId: string, limit: number = 30) {
  try {
    const rows = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      actionType: r.actionType,
      taskTitle: r.taskTitle,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Database error loading activity timeline:', error);
    throw new Error('Failed to load activity timeline.', { cause: error });
  }
}

// Dashboard & Analytics calculations using real database records
export async function getDashboardDataForUser(userId: string) {
  try {
    const allTasks = await getAllTasksForUser(userId);
    const prefs = await getPreferencesForUser(userId);
    const focusStats = await getFocusStatsForUser(userId);
    const recentActivity = await getRecentActivityForUser(userId, 15);

    const now = new Date();
    const todayStr = formatLocalDate(now);
    const activeTasks = allTasks.filter((t) => !t.deletedAt && !t.isArchived);

    const completedTasks = activeTasks.filter((t) => t.status === 'Completed');
    const pendingTasks = activeTasks.filter((t) => t.status === 'Pending');
    const inProgressTasks = activeTasks.filter((t) => t.status === 'In Progress');
    const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t, now));

    const totalCount = activeTasks.length;
    const completionPercentage =
      totalCount > 0 ? Math.round((completedTasks.length / totalCount) * 100) : 0;

    const todaysTasks = activeTasks.filter((t) => t.dueDate === todayStr);
    const completedTodayCount = activeTasks.filter(
      (t) =>
        t.status === 'Completed' &&
        ((t.completedAt && formatLocalDate(new Date(t.completedAt)) === todayStr) ||
          t.dueDate === todayStr)
    ).length;

    const streak = calculateProgressStreak(
      completedTasks.map((t) => t.completedAt || t.updatedAt),
      now
    );

    const briefing = generateDailyBriefing(allTasks, now);

    // 7-day weekly progress chart from real records
    const weeklySeries: {
      date: string;
      label: string;
      completed: number;
      created: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStr = addDaysToDateString(todayStr, -i);
      const [y, m, d] = dayStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const label = dt.toLocaleDateString('en-US', { weekday: 'short' });

      const completedOnDay = activeTasks.filter(
        (t) =>
          t.status === 'Completed' &&
          ((t.completedAt && formatLocalDate(new Date(t.completedAt)) === dayStr) ||
            (!t.completedAt && t.dueDate === dayStr))
      ).length;

      const createdOnDay = allTasks.filter(
        (t) => formatLocalDate(new Date(t.createdAt)) === dayStr
      ).length;

      weeklySeries.push({
        date: dayStr,
        label,
        completed: completedOnDay,
        created: createdOnDay,
      });
    }

    return {
      stats: {
        totalActive: activeTasks.length,
        completed: completedTasks.length,
        pending: pendingTasks.length,
        inProgress: inProgressTasks.length,
        overdue: overdueTasks.length,
        completionPercentage,
        todaysTotal: todaysTasks.length,
        completedToday: completedTodayCount,
        dailyTaskTarget: prefs.dailyTaskTarget,
        dailyFocusGoalMinutes: prefs.dailyFocusGoalMinutes,
        streak,
        ...focusStats,
      },
      briefing,
      weeklySeries,
      recentActivity,
    };
  } catch (error) {
    console.error('Database error computing dashboard data:', error);
    throw new Error('Failed to compute dashboard statistics.', { cause: error });
  }
}

export async function getAnalyticsForUser(userId: string) {
  try {
    const allTasks = await getAllTasksForUser(userId);
    const sessions = await getFocusSessionsForUser(userId);
    const userCategories = await getCategoriesForUser(userId);

    const now = new Date();
    const todayStr = formatLocalDate(now);
    const activeTasks = allTasks.filter((t) => !t.deletedAt && !t.isArchived);
    const completedTasks = activeTasks.filter((t) => t.status === 'Completed');

    // 14-day daily completion & focus minutes
    const dailyTrends: {
      date: string;
      label: string;
      completedTasks: number;
      focusMinutes: number;
    }[] = [];

    for (let i = 13; i >= 0; i--) {
      const dayStr = addDaysToDateString(todayStr, -i);
      const [y, m, d] = dayStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const label = dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const compCount = completedTasks.filter(
        (t) =>
          (t.completedAt && formatLocalDate(new Date(t.completedAt)) === dayStr) ||
          (!t.completedAt && t.dueDate === dayStr)
      ).length;

      const focusSecs = sessions
        .filter(
          (s) =>
            s.sessionType === 'work' &&
            s.completionStatus === 'completed' &&
            formatLocalDate(new Date(s.startedAt)) === dayStr
        )
        .reduce((acc, s) => acc + s.actualDurationSeconds, 0);

      dailyTrends.push({
        date: dayStr,
        label,
        completedTasks: compCount,
        focusMinutes: Math.round(focusSecs / 60),
      });
    }

    // Category distribution
    const categoryDistribution = userCategories.map((c) => {
      const catTasks = activeTasks.filter((t) => t.categoryId === c.id);
      const catCompleted = catTasks.filter((t) => t.status === 'Completed').length;
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        total: catTasks.length,
        completed: catCompleted,
      };
    });

    const uncategorizedTasks = activeTasks.filter((t) => !t.categoryId);
    if (uncategorizedTasks.length > 0) {
      categoryDistribution.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        color: '#70776E',
        total: uncategorizedTasks.length,
        completed: uncategorizedTasks.filter((t) => t.status === 'Completed').length,
      });
    }

    // Priority distribution
    const priorities: TaskPriority[] = ['High', 'Medium', 'Low'];
    const priorityDistribution = priorities.map((p) => {
      const pTasks = activeTasks.filter((t) => t.priority === p);
      return {
        priority: p,
        total: pTasks.length,
        completed: pTasks.filter((t) => t.status === 'Completed').length,
        pending: pTasks.filter((t) => t.status !== 'Completed').length,
      };
    });

    const totalCompletedLast14 = dailyTrends.reduce(
      (sum, d) => sum + d.completedTasks,
      0
    );
    const averageDailyCompletion = Number((totalCompletedLast14 / 14).toFixed(1));
    const streak = calculateProgressStreak(
      completedTasks.map((t) => t.completedAt || t.updatedAt),
      now
    );

    return {
      dailyTrends,
      categoryDistribution,
      priorityDistribution,
      averageDailyCompletion,
      streak,
      totalActiveTasks: activeTasks.length,
      totalCompletedTasks: completedTasks.length,
    };
  } catch (error) {
    console.error('Database error computing analytics:', error);
    throw new Error('Failed to load productivity analytics.', { cause: error });
  }
}
