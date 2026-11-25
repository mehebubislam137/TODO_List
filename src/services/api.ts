import {
  AlarmSoundType,
  CategoryItem,
  formatLocalDate,
  RecurrencePattern,
  TagItem,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../utils/taskLogic';

export interface UserPreferences {
  userId: string;
  theme: 'dark' | 'light' | 'system';
  themePreset: string;
  accentColor: string;
  customAlarmAudioData: string | null;
  customAlarmAudioName: string | null;
  defaultPriority: TaskPriority;
  defaultTaskView: 'list' | 'grid' | 'kanban';
  defaultCategoryId: string | null;
  weekStart: 'monday' | 'sunday';
  calendarView: 'month' | 'week' | 'day';
  timezone: string;
  workDurationMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  soundEnabled: boolean;
  dailyTaskTarget: number;
  dailyFocusGoalMinutes: number;
}

export interface ActiveAlarmSummary {
  taskId: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  alarmMinutesBefore: number;
  alarmSound: AlarmSoundType;
  alarmAudioName: string | null;
  alarmSnoozedUntil: string | null;
  lastAlarmTriggeredDate: string | null;
  isDailyTask: boolean;
}

export interface FocusSessionRecord {
  id: string;
  userId: string;
  taskId: string | null;
  taskTitle: string;
  sessionType: 'work' | 'short_break' | 'long_break';
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  startedAt: string;
  endedAt: string;
  completionStatus: 'completed' | 'interrupted' | 'skipped';
}

export interface ActivityLogRecord {
  id: string;
  taskId: string | null;
  actionType: string;
  taskTitle: string;
  detail: string;
  createdAt: string;
}

export interface DashboardData {
  stats: {
    totalActive: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    completionPercentage: number;
    todaysTotal: number;
    completedToday: number;
    dailyTaskTarget: number;
    dailyFocusGoalMinutes: number;
    streak: number;
    totalFocusMinutes: number;
    sessionsCompleted: number;
    dailyFocusMinutes: number;
    weeklyFocusMinutes: number;
  };
  briefing: string[];
  weeklySeries: {
    date: string;
    label: string;
    completed: number;
    created: number;
  }[];
  recentActivity: ActivityLogRecord[];
}

export interface AnalyticsData {
  dailyTrends: {
    date: string;
    label: string;
    completedTasks: number;
    focusMinutes: number;
  }[];
  categoryDistribution: {
    id: string;
    name: string;
    color: string;
    total: number;
    completed: number;
  }[];
  priorityDistribution: {
    priority: TaskPriority;
    total: number;
    completed: number;
    pending: number;
  }[];
  averageDailyCompletion: number;
  streak: number;
  totalActiveTasks: number;
  totalCompletedTasks: number;
}

export interface WorkspaceBootstrapData {
  user: {
    uid: string;
    email: string;
    isAnonymous: boolean;
  };
  tasks: TaskItem[];
  categories: CategoryItem[];
  tags: TagItem[];
  preferences: UserPreferences;
  dashboard: DashboardData;
  focusSessions: FocusSessionRecord[];
  analytics: AnalyticsData;
}

// In-memory bearer token (never stores raw auth tokens in localStorage)
let activeAccessToken: string | null = null;
const SESSION_UID_HINT_KEY = 'taskflow_anon_uid_hint';

export function setAccessToken(token: string | null) {
  activeAccessToken = token;
}

export function getAccessToken(): string | null {
  return activeAccessToken;
}

async function ensureSessionToken(): Promise<string> {
  if (activeAccessToken) return activeAccessToken;

  let existingUid: string | undefined;
  try {
    existingUid = sessionStorage.getItem(SESSION_UID_HINT_KEY) || undefined;
  } catch {
    existingUid = undefined;
  }

  const res = await fetch('/api/auth/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ existingUid }),
  });

  const json = await res.json();
  if (!res.ok || !json.success || !json.data?.token) {
    throw new Error(json.message || 'Failed to establish anonymous session');
  }

  activeAccessToken = json.data.token;
  try {
    sessionStorage.setItem(SESSION_UID_HINT_KEY, json.data.uid);
  } catch {
    // Ignore storage restriction
  }
  return activeAccessToken!;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await ensureSessionToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({
    success: false,
    message: 'Unexpected server response',
  }));

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }

  return json.data as T;
}

export const api = {
  initWorkspace: () =>
    apiRequest<WorkspaceBootstrapData>('/api/workspace/init', {
      method: 'POST',
      body: JSON.stringify({ localDate: formatLocalDate(new Date()) }),
    }),

  getTasks: () =>
    apiRequest<TaskItem[]>(
      `/api/tasks?localDate=${encodeURIComponent(formatLocalDate(new Date()))}`
    ),

  resetDailyTasks: (force: boolean = true) =>
    apiRequest<{
      resetCount: number;
      previousStates: { id: string; status: TaskStatus; completedAt: string | null }[];
      tasks: TaskItem[];
    }>('/api/tasks/daily/reset', {
      method: 'POST',
      body: JSON.stringify({ localDate: formatLocalDate(new Date()), force }),
    }),

  createTask: (payload: {
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
  }) =>
    apiRequest<TaskItem>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTask: (
    taskId: string,
    payload: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      status: TaskStatus;
      categoryId: string | null;
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
      tagIds: string[];
      subtasks: { id?: string; title: string; isCompleted?: boolean }[];
    }>
  ) =>
    apiRequest<TaskItem>(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  reorderTasks: (orderedTaskIds: string[]) =>
    apiRequest<TaskItem[]>('/api/tasks/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ orderedTaskIds }),
    }),

  // Alarm Notification API
  getAlarms: () =>
    apiRequest<ActiveAlarmSummary[]>(
      `/api/alarms?localDate=${encodeURIComponent(formatLocalDate(new Date()))}`
    ),

  acknowledgeAlarm: (taskId: string, triggerStamp?: string) =>
    apiRequest<TaskItem>(`/api/alarms/${taskId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ triggerStamp }),
    }),

  snoozeAlarm: (taskId: string, minutes: number = 5) =>
    apiRequest<{ task: TaskItem; snoozedUntil: string }>(
      `/api/alarms/${taskId}/snooze`,
      {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      }
    ),

  updateTaskStatus: (taskId: string, status: TaskStatus) =>
    apiRequest<TaskItem>(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  updateTaskPriority: (taskId: string, priority: TaskPriority) =>
    apiRequest<TaskItem>(`/api/tasks/${taskId}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority }),
    }),

  archiveTask: (taskId: string, isArchived: boolean = true) =>
    apiRequest<TaskItem>(`/api/tasks/${taskId}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ isArchived }),
    }),

  restoreTask: (taskId: string) =>
    apiRequest<TaskItem>(`/api/tasks/${taskId}/restore`, {
      method: 'PATCH',
    }),

  duplicateTask: (taskId: string) =>
    apiRequest<TaskItem>(`/api/tasks/${taskId}/duplicate`, {
      method: 'POST',
    }),

  deleteTask: (taskId: string, permanent: boolean = false) =>
    apiRequest<{ id: string; permanent: boolean }>(
      `/api/tasks/${taskId}${permanent ? '?permanent=true' : ''}`,
      { method: 'DELETE' }
    ),

  emptyTrash: () =>
    apiRequest<null>('/api/tasks/trash/empty', {
      method: 'DELETE',
    }),

  bulkTasks: (
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
  ) =>
    apiRequest<TaskItem[]>('/api/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ taskIds, action, value }),
    }),

  // Subtasks
  addSubtask: (taskId: string, title: string) =>
    apiRequest<{ id: string; taskId: string; title: string; isCompleted: boolean }>(
      `/api/tasks/${taskId}/subtasks`,
      {
        method: 'POST',
        body: JSON.stringify({ title }),
      }
    ),

  updateSubtask: (
    subtaskId: string,
    payload: { title?: string; isCompleted?: boolean }
  ) =>
    apiRequest<{ id: string; taskId: string; title: string; isCompleted: boolean }>(
      `/api/subtasks/${subtaskId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  deleteSubtask: (subtaskId: string) =>
    apiRequest<{ id: string }>(`/api/subtasks/${subtaskId}`, {
      method: 'DELETE',
    }),

  // Categories
  getCategories: () => apiRequest<CategoryItem[]>('/api/categories'),
  createCategory: (name: string, color: string) =>
    apiRequest<CategoryItem>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
  updateCategory: (id: string, name: string, color: string) =>
    apiRequest<CategoryItem>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, color }),
    }),
  deleteCategory: (id: string, reassignTo?: string | null) =>
    apiRequest<{ id: string }>(
      `/api/categories/${id}${
        reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ''
      }`,
      { method: 'DELETE' }
    ),

  // Tags
  getTags: () => apiRequest<TagItem[]>('/api/tags'),
  createTag: (name: string, color: string = '#C6F36B') =>
    apiRequest<TagItem>('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
  deleteTag: (id: string) =>
    apiRequest<{ id: string }>(`/api/tags/${id}`, {
      method: 'DELETE',
    }),

  // Focus Sessions
  recordFocusSession: (payload: {
    taskId?: string | null;
    sessionType: 'work' | 'short_break' | 'long_break';
    plannedDurationSeconds: number;
    actualDurationSeconds: number;
    startedAt: string;
    endedAt: string;
    completionStatus: 'completed' | 'interrupted' | 'skipped';
  }) =>
    apiRequest<FocusSessionRecord>('/api/focus-sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getFocusSessions: () => apiRequest<FocusSessionRecord[]>('/api/focus-sessions'),

  // Dashboard & Analytics
  getDashboard: () => apiRequest<DashboardData>('/api/dashboard/stats'),
  getAnalytics: () => apiRequest<AnalyticsData>('/api/analytics/daily'),

  // Preferences
  getPreferences: () => apiRequest<UserPreferences>('/api/preferences'),
  updatePreferences: (payload: Partial<UserPreferences>) =>
    apiRequest<UserPreferences>('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Data Export
  exportTasks: () => apiRequest<any>('/api/export/tasks'),
  exportWorkspace: () => apiRequest<any>('/api/export/workspace'),
};
