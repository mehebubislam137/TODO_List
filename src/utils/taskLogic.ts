export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
export type AlarmSoundType =
  | 'classic'
  | 'digital'
  | 'chime'
  | 'urgent'
  | 'harp'
  | 'gong'
  | 'custom';

export interface SubtaskItem {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  taskCount?: number;
}

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  isImportant: boolean;
  isArchived: boolean;
  recurrencePattern: RecurrencePattern;
  recurrenceInterval: number;
  alarmEnabled: boolean;
  alarmMinutesBefore: number;
  alarmSound: AlarmSoundType;
  alarmAudioData: string | null;
  alarmAudioName: string | null;
  alarmSnoozedUntil: string | null;
  lastAlarmTriggeredDate: string | null;
  isDailyTask: boolean;
  lastDailyResetDate: string | null;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  subtasks: SubtaskItem[];
  tags: TagItem[];
}

export interface ParsedQuickAdd {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  categoryName: string | null;
  priority: TaskPriority;
  isImportant: boolean;
  tags: string[];
  recurrencePattern: RecurrencePattern;
}

/**
 * Formats a Date object as local YYYY-MM-DD
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds calendar days to a YYYY-MM-DD date string
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatLocalDate(dt);
}

/**
 * Dynamically calculates whether a task is overdue from dueDate, dueTime, and status.
 * Overdue is NEVER stored as an independent status.
 */
export function isTaskOverdue(
  task: Pick<TaskItem, 'dueDate' | 'dueTime' | 'status' | 'isArchived' | 'deletedAt'>,
  now: Date = new Date()
): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'Completed' || task.isArchived || task.deletedAt) return false;

  const todayStr = formatLocalDate(now);
  if (task.dueDate < todayStr) {
    return true;
  }
  if (task.dueDate === todayStr && task.dueTime) {
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    return task.dueTime < currentTimeStr;
  }
  return false;
}

/**
 * Deterministic rule-based Smart Quick Add parser.
 * Example: "Complete DBMS assignment tomorrow at 6 PM #College !High +exam *important every week"
 */
export function parseSmartQuickAdd(
  rawInput: string,
  referenceDate: Date = new Date()
): ParsedQuickAdd {
  let working = rawInput.trim();
  let priority: TaskPriority = 'Medium';
  let categoryName: string | null = null;
  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let isImportant = false;
  let recurrencePattern: RecurrencePattern = 'none';
  const tags: string[] = [];

  // 1. Priority: !High, !Medium, !Low, !high, !med, !low
  working = working.replace(/(?:^|\s)!(high|medium|med|low)\b/gi, (_, p: string) => {
    const lower = p.toLowerCase();
    if (lower === 'high') priority = 'High';
    else if (lower === 'low') priority = 'Low';
    else priority = 'Medium';
    return ' ';
  });

  // 2. Importance: *important or !important or *star
  working = working.replace(/(?:^|\s)(?:\*important|!important|\*star|\*)\b/gi, () => {
    isImportant = true;
    return ' ';
  });

  // 3. Category: #CategoryName
  working = working.replace(/(?:^|\s)#([a-zA-Z0-9_-]+)/g, (_, cat: string) => {
    if (!categoryName) {
      categoryName = cat.charAt(0).toUpperCase() + cat.slice(1);
    } else {
      tags.push(cat.toLowerCase());
    }
    return ' ';
  });

  // 4. Explicit Tags: +tag or @tag
  working = working.replace(/(?:^|\s)[+@]([a-zA-Z0-9_-]+)/g, (_, tag: string) => {
    tags.push(tag.toLowerCase());
    return ' ';
  });

  // 5. Recurrence: every day / daily / every week / weekly / every month / monthly
  working = working.replace(
    /\b(every\s+day|daily|every\s+week|weekly|every\s+month|monthly)\b/i,
    (match) => {
      const m = match.toLowerCase();
      if (m.includes('day') || m === 'daily') recurrencePattern = 'daily';
      else if (m.includes('week') || m === 'weekly') recurrencePattern = 'weekly';
      else if (m.includes('month') || m === 'monthly') recurrencePattern = 'monthly';
      return ' ';
    }
  );

  // 6. Time: "at 6 PM", "at 6:30pm", "at 18:00", "by 9 am"
  working = working.replace(
    /\b(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    (_, hourStr: string, minStr: string | undefined, meridiem: string | undefined) => {
      let hour = parseInt(hourStr, 10);
      const minutes = minStr ? parseInt(minStr, 10) : 0;
      if (meridiem) {
        const mer = meridiem.toLowerCase();
        if (mer === 'pm' && hour < 12) hour += 12;
        if (mer === 'am' && hour === 12) hour = 0;
      }
      if (hour >= 0 && hour <= 23 && minutes >= 0 && minutes <= 59) {
        dueTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
      return ' ';
    }
  );

  // 7. Relative Date keywords: today, tomorrow, next week, in N days, or YYYY-MM-DD
  const todayStr = formatLocalDate(referenceDate);

  working = working.replace(/\b(\d{4}-\d{2}-\d{2})\b/, (_, isoDate: string) => {
    dueDate = isoDate;
    return ' ';
  });

  if (!dueDate) {
    if (/\btomorrow\b/i.test(working)) {
      dueDate = addDaysToDateString(todayStr, 1);
      working = working.replace(/\btomorrow\b/i, ' ');
    } else if (/\btoday\b/i.test(working)) {
      dueDate = todayStr;
      working = working.replace(/\btoday\b/i, ' ');
    } else if (/\bnext\s+week\b/i.test(working)) {
      dueDate = addDaysToDateString(todayStr, 7);
      working = working.replace(/\bnext\s+week\b/i, ' ');
    } else {
      const inDaysMatch = working.match(/\bin\s+(\d{1,3})\s+days?\b/i);
      if (inDaysMatch) {
        const offset = parseInt(inDaysMatch[1], 10);
        dueDate = addDaysToDateString(todayStr, offset);
        working = working.replace(/\bin\s+\d{1,3}\s+days?\b/i, ' ');
      }
    }
  }

  // If a dueTime was parsed without an explicit date, default dueDate to today
  if (dueTime && !dueDate) {
    dueDate = todayStr;
  }

  const cleanTitle = working.replace(/\s+/g, ' ').trim();

  return {
    title: cleanTitle,
    dueDate,
    dueTime,
    categoryName,
    priority,
    isImportant,
    tags,
    recurrencePattern,
  };
}

/**
 * Calculates consecutive local calendar days on which the user completed at least one task.
 */
export function calculateProgressStreak(
  completedDatesIso: (string | null | undefined)[],
  referenceDate: Date = new Date()
): number {
  const uniqueLocalDays = new Set<string>();
  for (const ts of completedDatesIso) {
    if (!ts) continue;
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      uniqueLocalDays.add(formatLocalDate(d));
    }
  }

  if (uniqueLocalDays.size === 0) return 0;

  const todayStr = formatLocalDate(referenceDate);
  const yesterdayStr = addDaysToDateString(todayStr, -1);

  let cursor = uniqueLocalDays.has(todayStr)
    ? todayStr
    : uniqueLocalDays.has(yesterdayStr)
      ? yesterdayStr
      : null;

  if (!cursor) return 0;

  let streak = 0;
  while (uniqueLocalDays.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateString(cursor, -1);
  }
  return streak;
}

/**
 * Generates deterministic rule-based daily briefing sentences from actual task records.
 */
export function generateDailyBriefing(
  tasks: TaskItem[],
  referenceDate: Date = new Date()
): string[] {
  const todayStr = formatLocalDate(referenceDate);
  const activeTasks = tasks.filter((t) => !t.deletedAt && !t.isArchived);

  const scheduledToday = activeTasks.filter(
    (t) => t.dueDate === todayStr && t.status !== 'Completed'
  );
  const completedToday = activeTasks.filter(
    (t) =>
      t.status === 'Completed' &&
      ((t.completedAt && formatLocalDate(new Date(t.completedAt)) === todayStr) ||
        t.dueDate === todayStr)
  );
  const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t, referenceDate));
  const importantPending = activeTasks.filter(
    (t) => t.isImportant && t.status !== 'Completed'
  );

  const lines: string[] = [];

  if (scheduledToday.length === 1) {
    lines.push('1 task is scheduled for today.');
  } else if (scheduledToday.length > 1) {
    lines.push(`${scheduledToday.length} tasks are scheduled for today.`);
  } else {
    lines.push('No pending tasks are scheduled for today.');
  }

  if (overdueTasks.length === 1) {
    lines.push('1 task is overdue and requires attention.');
  } else if (overdueTasks.length > 1) {
    lines.push(`${overdueTasks.length} tasks are overdue.`);
  }

  if (importantPending.length === 1) {
    lines.push('1 important task is currently active.');
  } else if (importantPending.length > 1) {
    lines.push(`${importantPending.length} important tasks are active.`);
  }

  if (completedToday.length === 1) {
    lines.push('You have completed 1 task today.');
  } else if (completedToday.length > 1) {
    lines.push(`You have completed ${completedToday.length} tasks today.`);
  }

  return lines;
}

/**
 * Calculates next occurrence YYYY-MM-DD for a recurring task.
 */
export function calculateNextOccurrenceDate(
  currentDueDate: string | null,
  pattern: RecurrencePattern,
  interval: number = 1,
  referenceDate: Date = new Date()
): string | null {
  if (pattern === 'none') return null;
  const baseStr = currentDueDate || formatLocalDate(referenceDate);
  const [y, m, d] = baseStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);

  if (pattern === 'daily') {
    dt.setDate(dt.getDate() + Math.max(1, interval));
  } else if (pattern === 'weekly') {
    dt.setDate(dt.getDate() + 7 * Math.max(1, interval));
  } else if (pattern === 'monthly') {
    dt.setMonth(dt.getMonth() + Math.max(1, interval));
  } else if (pattern === 'custom') {
    dt.setDate(dt.getDate() + Math.max(1, interval));
  }
  return formatLocalDate(dt);
}

/**
 * Validates task creation/editing payload according to Section 5.3
 */
export function validateTaskInput(input: {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  startDate?: string | null;
  dueDate?: string | null;
}): { valid: boolean; error?: string } {
  const title = (input.title ?? '').trim();
  if (!title) {
    return { valid: false, error: 'Task title is required and cannot be empty.' };
  }
  if (title.length > 200) {
    return { valid: false, error: 'Task title must not exceed 200 characters.' };
  }
  if (input.description && input.description.length > 4000) {
    return { valid: false, error: 'Task description must not exceed 4000 characters.' };
  }
  const validPriorities = ['Low', 'Medium', 'High'];
  if (input.priority && !validPriorities.includes(input.priority)) {
    return { valid: false, error: 'Priority must be Low, Medium, or High.' };
  }
  const validStatuses = ['Pending', 'In Progress', 'Completed'];
  if (input.status && !validStatuses.includes(input.status)) {
    return { valid: false, error: 'Status must be Pending, In Progress, or Completed.' };
  }
  if (input.startDate && input.dueDate && input.startDate > input.dueDate) {
    return { valid: false, error: 'Start date cannot be later than the due date.' };
  }
  return { valid: true };
}

/**
 * Calculates the exact local Date when a task's alarm should start ringing
 * (dueDate + dueTime minus alarmMinutesBefore). Returns null if alarm is disabled
 * or dueTime is missing.
 */
export function getTaskAlarmTriggerTime(
  task: Pick<
    TaskItem,
    'alarmEnabled' | 'alarmMinutesBefore' | 'dueDate' | 'dueTime' | 'isDailyTask'
  >,
  referenceDate: Date = new Date()
): Date | null {
  if (!task.alarmEnabled || !task.dueTime) return null;
  const dateStr = task.dueDate || (task.isDailyTask ? formatLocalDate(referenceDate) : null);
  if (!dateStr) return null;

  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = task.dueTime.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;

  const dueDateTime = new Date(y, m - 1, d, hh, mm, 0, 0);
  const leadMinutes = Math.max(0, Number(task.alarmMinutesBefore) || 0);
  return new Date(dueDateTime.getTime() - leadMinutes * 60 * 1000);
}

/**
 * Returns formatted HH:mm string for when an alarm will ring given a dueTime and minutesBefore.
 */
export function formatAlarmRingTime(dueTime: string, minutesBefore: number): string | null {
  if (!dueTime || !dueTime.includes(':')) return null;
  const [hh, mm] = dueTime.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const totalMinutes = (hh * 60 + mm - Math.max(0, minutesBefore) + 24 * 60 * 10) % (24 * 60);
  const outH = Math.floor(totalMinutes / 60);
  const outM = totalMinutes % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

/**
 * Determines whether a task's alarm should actively start ringing at `now`.
 * Rings once per occurrence key (`task.id::YYYY-MM-DD::HH:mm::leadMin`) once
 * `now >= triggerTime` and before `dueTime + 5 minutes`.
 */
export function getTaskAlarmOccurrenceKey(
  task: Pick<TaskItem, 'id' | 'dueDate' | 'dueTime' | 'alarmMinutesBefore' | 'isDailyTask'>,
  referenceDate: Date = new Date()
): string {
  const dateStr = task.dueDate || formatLocalDate(referenceDate);
  return `${task.id}::${dateStr}::${task.dueTime || ''}::${task.alarmMinutesBefore || 0}`;
}

export function shouldTaskAlarmRing(
  task: Pick<
    TaskItem,
    | 'id'
    | 'status'
    | 'isArchived'
    | 'deletedAt'
    | 'alarmEnabled'
    | 'alarmMinutesBefore'
    | 'dueDate'
    | 'dueTime'
    | 'isDailyTask'
    | 'lastAlarmTriggeredDate'
    | 'alarmSnoozedUntil'
  >,
  now: Date = new Date(),
  acknowledgedKeys: Set<string> = new Set(),
  snoozeUntilByTaskId: Record<string, number> = {}
): boolean {
  if (!task.alarmEnabled || !task.dueTime) return false;
  if (task.status === 'Completed' || task.isArchived || task.deletedAt) return false;

  const persistedSnoozeMs = task.alarmSnoozedUntil
    ? new Date(task.alarmSnoozedUntil).getTime()
    : 0;
  const localSnoozeMs = snoozeUntilByTaskId[task.id] || 0;
  const snoozeUntil = Math.max(
    Number.isNaN(persistedSnoozeMs) ? 0 : persistedSnoozeMs,
    localSnoozeMs
  );
  if (snoozeUntil > 0) {
    if (now.getTime() < snoozeUntil) return false;
    // Snooze deadline reached -> ring within a 5-minute window
    if (now.getTime() <= snoozeUntil + 5 * 60 * 1000) return true;
  }

  const occKey = getTaskAlarmOccurrenceKey(task, now);
  if (acknowledgedKeys.has(occKey)) return false;

  const todayStr = formatLocalDate(now);
  const targetDateStr = task.dueDate || (task.isDailyTask ? todayStr : null);
  if (!targetDateStr) return false;

  if (task.lastAlarmTriggeredDate === `${targetDateStr} ${task.dueTime}`) {
    return false;
  }

  const triggerTime = getTaskAlarmTriggerTime(task, now);
  if (!triggerTime) return false;

  const [y, m, d] = targetDateStr.split('-').map(Number);
  const [hh, mm] = task.dueTime.split(':').map(Number);
  const dueDateTime = new Date(y, m - 1, d, hh, mm, 0, 0);
  const windowEnd = new Date(dueDateTime.getTime() + 5 * 60 * 1000);

  return now.getTime() >= triggerTime.getTime() && now.getTime() <= windowEnd.getTime();
}

/**
 * Returns true if a daily routine task needs its daily restart for `todayStr`.
 */
export function needsDailyReset(
  task: Pick<
    TaskItem,
    'isDailyTask' | 'lastDailyResetDate' | 'status' | 'dueDate' | 'deletedAt' | 'isArchived'
  >,
  todayStr: string
): boolean {
  if (!task.isDailyTask || task.deletedAt || task.isArchived) return false;
  return task.lastDailyResetDate !== todayStr;
}

/**
 * Returns remaining time until local midnight (00:00:00 next day) for Daily Tasks countdown.
 */
export function getTimeUntilMidnight(now: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  const diffSec = Math.max(0, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  const label = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(
    2,
    '0'
  )}m ${String(seconds).padStart(2, '0')}s`;
  return { hours, minutes, seconds, label };
}

/**
 * Computes live subtask completion progress for interactive task cards.
 */
export function computeSubtaskProgress(
  subtasks: Pick<SubtaskItem, 'isCompleted'>[]
): { completed: number; total: number; percentage: number } {
  const total = subtasks.length;
  if (total === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }
  const completed = subtasks.filter((s) => s.isCompleted).length;
  const percentage = Math.round((completed / total) * 100);
  return { completed, total, percentage };
}

/**
 * Deterministically reorders a list of tasks when dragging `draggedId` onto `targetId`.
 */
export function reorderTasksList<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string
): T[] {
  if (!draggedId || !targetId || draggedId === targetId) return items;
  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const toIndex = items.findIndex((item) => item.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return items;

  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}


