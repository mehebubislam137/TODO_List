/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TASKFLOW Personal Productivity Workspace
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BellOff,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  HelpCircle,
  Keyboard,
  LayoutDashboard,
  ListTodo,
  Menu,
  Moon,
  Plus,
  Redo2,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Timer,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  AnalyticsData,
  api,
  DashboardData,
  FocusSessionRecord,
  UserPreferences,
} from './services/api';
import {
  AlarmSoundType,
  CategoryItem,
  formatLocalDate,
  getTaskAlarmOccurrenceKey,
  isTaskOverdue,
  RecurrencePattern,
  shouldTaskAlarmRing,
  TagItem,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from './utils/taskLogic';
import {
  ALARM_SOUND_OPTIONS,
  sendAlarmBrowserNotification,
  startRingingAlarm,
  stopRingingAlarm,
} from './utils/alarmAudio';
import { applyThemeToDocument } from './utils/themeEngine';
import {
  CommandPalette,
  NavSectionId,
  ShortcutsHelpModal,
} from './components/CommandPalette';
import { TaskModal } from './components/TaskModal';
import { DashboardView } from './components/DashboardView';
import {
  TaskFilterView,
  TasksWorkspaceView,
} from './components/TasksWorkspaceView';
import { DailyTasksView } from './components/DailyTasksView';
import { CategoriesView } from './components/CategoriesView';
import { CalendarView } from './components/CalendarView';
import { FocusModeView } from './components/FocusModeView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';

interface UndoHistoryEntry {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export default function App() {
  // Chrome-style navigation history stack (Back / Forward)
  const [navHistory, setNavHistory] = useState<NavSectionId[]>(['dashboard']);
  const [navHistoryIndex, setNavHistoryIndex] = useState<number>(0);
  const activeNav: NavSectionId = navHistory[navHistoryIndex] || 'dashboard';
  const canGoBack = navHistoryIndex > 0;
  const canGoForward = navHistoryIndex < navHistory.length - 1;

  const navigateTo = useCallback((next: NavSectionId) => {
    setNavHistory((prev) => {
      const current = prev[navHistoryIndex];
      if (current === next) return prev;
      const truncated = prev.slice(0, navHistoryIndex + 1);
      const updated = [...truncated, next].slice(-50);
      setNavHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [navHistoryIndex]);

  const handleNavBack = useCallback(() => {
    setNavHistoryIndex((idx) => (idx > 0 ? idx - 1 : idx));
  }, []);

  const handleNavForward = useCallback(() => {
    setNavHistoryIndex((idx) =>
      idx < navHistory.length - 1 ? idx + 1 : idx
    );
  }, [navHistory.length]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<UndoHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoHistoryEntry[]>([]);
  const [isApplyingHistory, setIsApplyingHistory] = useState(false);

  // Workspace state
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    canUndo?: boolean;
  } | null>(null);

  const [workspaceUser, setWorkspaceUser] = useState<{
    uid: string;
    email: string;
    isAnonymous: boolean;
  }>({
    uid: 'anon_initializing',
    email: 'anonymous@taskflow.local',
    isAnonymous: true,
  });
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    userId: '',
    theme: 'dark',
    themePreset: 'editorial-dark',
    accentColor: '#C6F36B',
    defaultPriority: 'Medium',
    defaultTaskView: 'list',
    defaultCategoryId: null,
    weekStart: 'monday',
    calendarView: 'month',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    workDurationMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
    soundEnabled: true,
    dailyTaskTarget: 5,
    dailyFocusGoalMinutes: 100,
    customAlarmAudioData: null,
    customAlarmAudioName: null,
  });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [focusSessions, setFocusSessions] = useState<FocusSessionRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Modals, Focus Target & Ringing Alarm state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<'detailed' | 'quick'>(
    'detailed'
  );
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [focusTargetTask, setFocusTargetTask] = useState<TaskItem | null>(null);
  const [ringingAlarmTask, setRingingAlarmTask] = useState<TaskItem | null>(null);

  const acknowledgedAlarmsRef = useRef<Set<string>>(new Set());
  const snoozeUntilRef = useRef<Record<string, number>>({});
  const lastActiveDateRef = useRef<string>(formatLocalDate(new Date()));
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const gChordTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string, canUndo: boolean = false) => {
    setToastState({ message: msg, canUndo });
    window.setTimeout(() => {
      setToastState((curr) => (curr?.message === msg ? null : curr));
    }, 4000);
  }, []);

  const pushUndoEntry = useCallback((entry: UndoHistoryEntry) => {
    setUndoStack((prev) => [...prev.slice(-29), entry]);
    setRedoStack([]);
  }, []);

  // Customizable Theme Engine with Automatic WCAG Contrast Adjustments
  useEffect(() => {
    applyThemeToDocument(
      preferences.themePreset,
      preferences.accentColor,
      preferences.theme
    );
  }, [preferences.themePreset, preferences.accentColor, preferences.theme]);

  const loadWorkspaceData = useCallback(async () => {
    setErrorBanner(null);
    try {
      const data = await api.initWorkspace();
      setWorkspaceUser(data.user);
      setTasks(data.tasks);
      setCategories(data.categories);
      setTags(data.tags);
      setPreferences(data.preferences);
      setDashboard(data.dashboard);
      setFocusSessions(data.focusSessions);
      setAnalytics(data.analytics);
    } catch (err: any) {
      console.error('Failed to load workspace:', err);
      setErrorBanner(
        err.message || 'Failed to connect to TASKFLOW PostgreSQL workspace.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const refreshDerivedData = useCallback(async () => {
    try {
      const [nextTasks, nextCats, nextTags, nextDash, nextAnalytics] =
        await Promise.all([
          api.getTasks(),
          api.getCategories(),
          api.getTags(),
          api.getDashboard(),
          api.getAnalytics(),
        ]);
      setTasks(nextTasks);
      setCategories(nextCats);
      setTags(nextTags);
      setDashboard(nextDash);
      setAnalytics(nextAnalytics);
    } catch (err: any) {
      console.error('Error refreshing workspace telemetry:', err);
    }
  }, []);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || isApplyingHistory) return;
    const entry = undoStack[undoStack.length - 1];
    setIsApplyingHistory(true);
    try {
      await entry.undo();
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev.slice(-29), entry]);
      await refreshDerivedData();
      showToast(`Undid: ${entry.label}`, false);
    } catch (err: any) {
      setErrorBanner(err.message || 'Undo failed');
    } finally {
      setIsApplyingHistory(false);
    }
  }, [undoStack, isApplyingHistory, refreshDerivedData, showToast]);

  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0 || isApplyingHistory) return;
    const entry = redoStack[redoStack.length - 1];
    setIsApplyingHistory(true);
    try {
      await entry.redo();
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev.slice(-29), entry]);
      await refreshDerivedData();
      showToast(`Redid: ${entry.label}`, false);
    } catch (err: any) {
      setErrorBanner(err.message || 'Redo failed');
    } finally {
      setIsApplyingHistory(false);
    }
  }, [redoStack, isApplyingHistory, refreshDerivedData, showToast]);

  // Task Alarm Monitor & Midnight Daily-Tasks Auto-Restart Watcher
  useEffect(() => {
    const alarmInterval = window.setInterval(() => {
      const now = new Date();
      const currentDateStr = formatLocalDate(now);

      // If midnight rolled over while tab is open, automatically restart daily tasks
      if (currentDateStr !== lastActiveDateRef.current) {
        lastActiveDateRef.current = currentDateStr;
        acknowledgedAlarmsRef.current.clear();
        api
          .resetDailyTasks(false)
          .then((res) => {
            if (res.resetCount > 0) {
              setTasks(res.tasks);
              showToast(`New day started: ${res.resetCount} daily tasks restarted`);
            }
          })
          .catch(() => {
            // Silent retry on next user fetch
          });
      }

      if (ringingAlarmTask) return;

      for (const t of tasks) {
        if (
          shouldTaskAlarmRing(
            t,
            now,
            acknowledgedAlarmsRef.current,
            snoozeUntilRef.current
          )
        ) {
          delete snoozeUntilRef.current[t.id];
          setRingingAlarmTask(t);
          startRingingAlarm(
            t.alarmSound || 'classic',
            t.alarmAudioData || preferences.customAlarmAudioData
          );
          sendAlarmBrowserNotification(
            'TASKFLOW Task Alarm',
            `${t.title} — due ${t.dueTime || 'now'}`
          );
          break;
        }
      }
    }, 1000);

    return () => window.clearInterval(alarmInterval);
  }, [tasks, ringingAlarmTask, preferences.customAlarmAudioData, showToast]);

  useEffect(() => {
    return () => {
      stopRingingAlarm();
    };
  }, []);

  const handleTriggerTestAlarm = useCallback(
    (task: TaskItem) => {
      setRingingAlarmTask(task);
      startRingingAlarm(
        task.alarmSound || 'classic',
        task.alarmAudioData || preferences.customAlarmAudioData
      );
      sendAlarmBrowserNotification(
        'TASKFLOW Alarm Preview',
        `${task.title} — due ${task.dueTime || 'now'}`
      );
    },
    [preferences.customAlarmAudioData]
  );

  const handleDismissAlarm = useCallback(
    async (task: TaskItem) => {
      stopRingingAlarm();
      setRingingAlarmTask(null);
      const now = new Date();
      const occKey = getTaskAlarmOccurrenceKey(task, now);
      acknowledgedAlarmsRef.current.add(occKey);
      delete snoozeUntilRef.current[task.id];

      const targetDate = task.dueDate || formatLocalDate(now);
      const triggerStamp = task.dueTime
        ? `${targetDate} ${task.dueTime}`
        : `${targetDate} 00:00`;
      try {
        await api.acknowledgeAlarm(task.id, triggerStamp);
        await refreshDerivedData();
      } catch {
        // In-memory acknowledgement already stops repeat ringing
      }
    },
    [refreshDerivedData]
  );

  const handleSnoozeAlarm = useCallback(
    async (task: TaskItem, minutes: number = 5) => {
      stopRingingAlarm();
      setRingingAlarmTask(null);
      snoozeUntilRef.current[task.id] = Date.now() + minutes * 60 * 1000;
      try {
        await api.snoozeAlarm(task.id, minutes);
        await refreshDerivedData();
      } catch {
        // Local snooze fallback remains active
      }
      showToast(`Alarm snoozed for ${minutes} minutes`);
    },
    [refreshDerivedData, showToast]
  );

  // Universal Cross-Platform Keyboard Shortcuts (including G + key navigation chords)
  useEffect(() => {
    const clearGChord = () => {
      if (gChordTimerRef.current !== null) {
        window.clearTimeout(gChordTimerRef.current);
        gChordTimerRef.current = null;
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Alt + Left / Right -> Back / Forward navigation like Chrome
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        clearGChord();
        handleNavBack();
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        clearGChord();
        handleNavForward();
        return;
      }

      // Ctrl + K -> Quick Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        clearGChord();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl + Z / Ctrl + Y -> Undo / Redo when not editing a text input
      if (!isInputFocused && (e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (
          e.key.toLowerCase() === 'y' ||
          (e.key.toLowerCase() === 'z' && e.shiftKey)
        ) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      // Esc -> Close active modal
      if (e.key === 'Escape') {
        clearGChord();
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (shortcutsModalOpen) setShortcutsModalOpen(false);
        else if (taskModalOpen) setTaskModalOpen(false);
        return;
      }

      if (
        isInputFocused ||
        taskModalOpen ||
        commandPaletteOpen ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }

      const lowerKey = e.key.toLowerCase();

      // Complete G + <key> navigation chord if active
      if (gChordTimerRef.current !== null) {
        clearGChord();
        const chordMap: Record<string, NavSectionId> = {
          d: 'dashboard',
          r: 'tasks-daily',
          t: 'tasks-all',
          c: 'calendar',
          f: 'focus',
          a: 'analytics',
          s: 'settings',
        };
        if (chordMap[lowerKey]) {
          e.preventDefault();
          navigateTo(chordMap[lowerKey]);
          return;
        }
      }

      // Start G + <key> navigation chord
      if (lowerKey === 'g') {
        e.preventDefault();
        clearGChord();
        gChordTimerRef.current = window.setTimeout(() => {
          gChordTimerRef.current = null;
        }, 900);
        return;
      }

      if (lowerKey === 'n') {
        e.preventDefault();
        setEditingTask(null);
        setPreselectedDate(null);
        setTaskModalMode('detailed');
        setTaskModalOpen(true);
      } else if (lowerKey === 'q') {
        e.preventDefault();
        setEditingTask(null);
        setPreselectedDate(null);
        setTaskModalMode('quick');
        setTaskModalOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        if (!activeNav.startsWith('tasks-') || activeNav === 'tasks-daily') {
          navigateTo('tasks-all');
        }
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 60);
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      clearGChord();
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [
    activeNav,
    commandPaletteOpen,
    shortcutsModalOpen,
    taskModalOpen,
    handleNavBack,
    handleNavForward,
    handleUndo,
    handleRedo,
    navigateTo,
  ]);

  // Task Handlers
  const handleOpenCreateTask = (
    mode: 'detailed' | 'quick' = 'detailed',
    dateStr: string | null = null
  ) => {
    setEditingTask(null);
    setPreselectedDate(dateStr);
    setTaskModalMode(mode);
    setTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: TaskItem) => {
    setEditingTask(task);
    setPreselectedDate(null);
    setTaskModalMode('detailed');
    setTaskModalOpen(true);
  };

  const handleSaveTaskModal = async (
    payload: {
      title: string;
      description: string;
      priority: TaskPriority;
      status: TaskStatus;
      categoryId: string | null;
      startDate: string | null;
      dueDate: string | null;
      dueTime: string | null;
      isImportant: boolean;
      recurrencePattern: RecurrencePattern;
      recurrenceInterval: number;
      alarmEnabled: boolean;
      alarmMinutesBefore: number;
      alarmSound: AlarmSoundType;
      alarmAudioData: string | null;
      alarmAudioName: string | null;
      isDailyTask: boolean;
      subtasks: { id?: string; title: string; isCompleted?: boolean }[];
      tagIds: string[];
      tagNames: string[];
    },
    editingId?: string
  ) => {
    if (editingId) {
      const previous = tasks.find((t) => t.id === editingId);
      await api.updateTask(editingId, payload);
      if (previous) {
        pushUndoEntry({
          label: `Edit "${payload.title}"`,
          undo: async () => {
            await api.updateTask(editingId, {
              title: previous.title,
              description: previous.description,
              priority: previous.priority,
              status: previous.status,
              categoryId: previous.categoryId,
              startDate: previous.startDate,
              dueDate: previous.dueDate,
              dueTime: previous.dueTime,
              isImportant: previous.isImportant,
              recurrencePattern: previous.recurrencePattern,
              recurrenceInterval: previous.recurrenceInterval,
              alarmEnabled: previous.alarmEnabled,
              alarmMinutesBefore: previous.alarmMinutesBefore,
              alarmSound: previous.alarmSound,
              alarmAudioData: previous.alarmAudioData,
              alarmAudioName: previous.alarmAudioName,
              isDailyTask: previous.isDailyTask,
            });
          },
          redo: async () => {
            await api.updateTask(editingId, payload);
          },
        });
      }
      showToast('Task updated', Boolean(previous));
    } else {
      const created = await api.createTask(payload);
      pushUndoEntry({
        label: `Create "${created.title}"`,
        undo: async () => {
          await api.deleteTask(created.id, false);
        },
        redo: async () => {
          await api.restoreTask(created.id);
        },
      });
      showToast('Task created', true);
    }
    await refreshDerivedData();
  };

  const handleCreateDailyTask = async (payload: {
    title: string;
    priority: TaskPriority;
    categoryId: string | null;
    dueTime: string | null;
    alarmEnabled: boolean;
    alarmMinutesBefore: number;
    alarmSound: AlarmSoundType;
    alarmAudioData?: string | null;
    alarmAudioName?: string | null;
  }) => {
    const todayStr = formatLocalDate(new Date());
    const created = await api.createTask({
      title: payload.title,
      priority: payload.priority,
      status: 'Pending',
      categoryId: payload.categoryId,
      startDate: todayStr,
      dueDate: todayStr,
      dueTime: payload.dueTime,
      recurrencePattern: 'daily',
      recurrenceInterval: 1,
      alarmEnabled: payload.alarmEnabled,
      alarmMinutesBefore: payload.alarmMinutesBefore,
      alarmSound: payload.alarmSound,
      alarmAudioData: payload.alarmAudioData || null,
      alarmAudioName: payload.alarmAudioName || null,
      isDailyTask: true,
    });
    pushUndoEntry({
      label: `Add daily task "${created.title}"`,
      undo: async () => {
        await api.deleteTask(created.id, false);
      },
      redo: async () => {
        await api.restoreTask(created.id);
      },
    });
    showToast(`Daily task "${created.title}" added`, true);
    await refreshDerivedData();
  };

  const handleRestartDailyTasks = async () => {
    try {
      const result = await api.resetDailyTasks(true);
      if (result.previousStates.length > 0) {
        pushUndoEntry({
          label: 'Restart Daily Tasks list',
          undo: async () => {
            await Promise.all(
              result.previousStates.map((prev) =>
                api.updateTaskStatus(prev.id, prev.status)
              )
            );
          },
          redo: async () => {
            await api.resetDailyTasks(true);
          },
        });
      }
      showToast(`Restarted ${result.resetCount} daily tasks`, result.previousStates.length > 0);
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to restart daily tasks');
    }
  };

  const handleStatusChange = async (task: TaskItem, status: TaskStatus) => {
    const prevStatus = task.status;
    try {
      await api.updateTaskStatus(task.id, status);
      if (ringingAlarmTask?.id === task.id && status === 'Completed') {
        stopRingingAlarm();
        setRingingAlarmTask(null);
      }
      pushUndoEntry({
        label: `Set "${task.title}" to ${status}`,
        undo: async () => {
          await api.updateTaskStatus(task.id, prevStatus);
        },
        redo: async () => {
          await api.updateTaskStatus(task.id, status);
        },
      });
      showToast(
        status === 'Completed'
          ? `Completed "${task.title}"`
          : `Status updated to ${status}`,
        true
      );
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to update task status');
    }
  };

  const handlePriorityChange = async (
    task: TaskItem,
    priority: TaskPriority
  ) => {
    const prevPriority = task.priority;
    try {
      await api.updateTaskPriority(task.id, priority);
      pushUndoEntry({
        label: `Set priority of "${task.title}" to ${priority}`,
        undo: async () => {
          await api.updateTaskPriority(task.id, prevPriority);
        },
        redo: async () => {
          await api.updateTaskPriority(task.id, priority);
        },
      });
      showToast(`Priority set to ${priority}`, true);
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to update priority');
    }
  };

  const handleToggleImportant = async (task: TaskItem) => {
    const nextImportant = !task.isImportant;
    try {
      await api.updateTask(task.id, { isImportant: nextImportant });
      pushUndoEntry({
        label: nextImportant
          ? `Mark "${task.title}" Important`
          : `Unmark "${task.title}" Important`,
        undo: async () => {
          await api.updateTask(task.id, { isImportant: !nextImportant });
        },
        redo: async () => {
          await api.updateTask(task.id, { isImportant: nextImportant });
        },
      });
      showToast(
        nextImportant ? 'Marked as Important' : 'Removed from Important',
        true
      );
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to toggle importance');
    }
  };

  const handleArchiveTask = async (task: TaskItem, isArchived: boolean) => {
    try {
      await api.archiveTask(task.id, isArchived);
      pushUndoEntry({
        label: isArchived ? `Archive "${task.title}"` : `Unarchive "${task.title}"`,
        undo: async () => {
          await api.archiveTask(task.id, !isArchived);
        },
        redo: async () => {
          await api.archiveTask(task.id, isArchived);
        },
      });
      showToast(isArchived ? 'Task archived' : 'Restored from archive', true);
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to update archive state');
    }
  };

  const handleRestoreTask = async (task: TaskItem) => {
    try {
      await api.restoreTask(task.id);
      pushUndoEntry({
        label: `Restore "${task.title}"`,
        undo: async () => {
          await api.deleteTask(task.id, false);
        },
        redo: async () => {
          await api.restoreTask(task.id);
        },
      });
      showToast('Task restored to active workspace', true);
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to restore task');
    }
  };

  const handleDuplicateTask = async (task: TaskItem) => {
    try {
      const dup = await api.duplicateTask(task.id);
      pushUndoEntry({
        label: `Duplicate "${task.title}"`,
        undo: async () => {
          await api.deleteTask(dup.id, false);
        },
        redo: async () => {
          await api.restoreTask(dup.id);
        },
      });
      showToast('Task duplicated', true);
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to duplicate task');
    }
  };

  const handleDeleteTask = async (task: TaskItem, permanent: boolean) => {
    try {
      await api.deleteTask(task.id, permanent);
      if (!permanent) {
        pushUndoEntry({
          label: `Delete "${task.title}"`,
          undo: async () => {
            await api.restoreTask(task.id);
          },
          redo: async () => {
            await api.deleteTask(task.id, false);
          },
        });
      }
      showToast(
        permanent
          ? 'Task permanently deleted'
          : 'Moved to Recently Deleted trash',
        !permanent
      );
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to delete task');
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await api.emptyTrash();
      showToast('Recently Deleted trash emptied');
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to empty trash');
    }
  };

  const handleBulkAction = async (
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
  ) => {
    try {
      await api.bulkTasks(taskIds, action, value);
      showToast(`Bulk ${action} applied to ${taskIds.length} tasks`);
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Bulk action failed');
    }
  };

  const handleToggleSubtask = async (
    _taskId: string,
    subtaskId: string,
    isCompleted: boolean
  ) => {
    try {
      await api.updateSubtask(subtaskId, { isCompleted });
      pushUndoEntry({
        label: isCompleted ? 'Complete subtask' : 'Reopen subtask',
        undo: async () => {
          await api.updateSubtask(subtaskId, { isCompleted: !isCompleted });
        },
        redo: async () => {
          await api.updateSubtask(subtaskId, { isCompleted });
        },
      });
      await refreshDerivedData();
      if (focusTargetTask) {
        const updatedList = await api.getTasks();
        const refreshed = updatedList.find((t) => t.id === focusTargetTask.id);
        if (refreshed) setFocusTargetTask(refreshed);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to update subtask');
    }
  };

  const handleAddSubtaskInline = async (taskId: string, title: string) => {
    try {
      await api.addSubtask(taskId, title);
      showToast('Subtask added');
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to add subtask');
    }
  };

  const handleReorderTasks = async (orderedTaskIds: string[]) => {
    const previousOrderIds = tasks.map((t) => t.id);
    const rankMap = new Map<string, number>(
      orderedTaskIds.map((id, idx) => [id, idx])
    );

    // Optimistic reorder so drag-and-drop feels immediate
    setTasks((prev) =>
      [...prev]
        .map((t) => ({
          ...t,
          sortOrder: rankMap.has(t.id) ? rankMap.get(t.id)! : t.sortOrder,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );

    try {
      await api.reorderTasks(orderedTaskIds);
      pushUndoEntry({
        label: 'Reorder tasks',
        undo: async () => {
          await api.reorderTasks(previousOrderIds);
        },
        redo: async () => {
          await api.reorderTasks(orderedTaskIds);
        },
      });
      showToast('Task order saved', true);
      await refreshDerivedData();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to reorder tasks');
      await refreshDerivedData();
    }
  };

  const handleUpdatePreferences = async (next: Partial<UserPreferences>) => {
    const updated = await api.updatePreferences(next);
    setPreferences(updated);
    showToast('Workspace preferences saved');
    await refreshDerivedData();
  };

  const handleStartFocusOnTask = (task: TaskItem) => {
    setFocusTargetTask(task);
    navigateTo('focus');
  };

  // Sidebar navigation counts
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const activeTasks = tasks.filter((t) => !t.deletedAt && !t.isArchived);
  const dailyActiveTasks = activeTasks.filter((t) => t.isDailyTask);
  const dailyDoneCount = dailyActiveTasks.filter(
    (t) => t.status === 'Completed'
  ).length;
  const navCounts = {
    dailyLabel: `${dailyDoneCount}/${dailyActiveTasks.length}`,
    all: activeTasks.length,
    today: activeTasks.filter(
      (t) => t.dueDate === todayStr || isTaskOverdue(t, now)
    ).length,
    upcoming: activeTasks.filter(
      (t) => t.dueDate && t.dueDate > todayStr && t.status !== 'Completed'
    ).length,
    inProgress: activeTasks.filter((t) => t.status === 'In Progress').length,
    completed: activeTasks.filter((t) => t.status === 'Completed').length,
    important: activeTasks.filter((t) => t.isImportant).length,
    overdue: activeTasks.filter((t) => isTaskOverdue(t, now)).length,
    archive: tasks.filter((t) => !t.deletedAt && t.isArchived).length,
    trash: tasks.filter((t) => Boolean(t.deletedAt)).length,
  };

  const toggleThemeQuick = async () => {
    const isCurrentlyLight =
      preferences.theme === 'light' ||
      preferences.themePreset === 'crisp-light' ||
      preferences.themePreset === 'warm-sepia';
    const nextPatch: Partial<UserPreferences> = isCurrentlyLight
      ? {
          theme: 'dark',
          themePreset: 'editorial-dark',
          accentColor: '#C6F36B',
        }
      : {
          theme: 'light',
          themePreset: 'crisp-light',
          accentColor: '#2D6A00',
        };
    setPreferences((prev) => ({ ...prev, ...nextPatch }));
    try {
      await api.updatePreferences(nextPatch);
    } catch {
      // Ignore transient preference error
    }
  };

  const mapNavToTaskView = (nav: NavSectionId): TaskFilterView => {
    switch (nav) {
      case 'tasks-today':
        return 'today';
      case 'tasks-upcoming':
        return 'upcoming';
      case 'tasks-in-progress':
        return 'in-progress';
      case 'tasks-completed':
        return 'completed';
      case 'tasks-important':
        return 'important';
      case 'tasks-overdue':
        return 'overdue';
      case 'archive':
        return 'archive';
      case 'tasks-trash':
        return 'trash';
      default:
        return 'all';
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Sidebar Navigation (Section 4 Complete Navigation Structure) */}
      <aside
        aria-label="Primary Workspace Navigation"
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="overflow-y-auto flex-1">
          {/* Brand Header */}
          <div className="h-14 px-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                navigateTo('dashboard');
                setMobileMenuOpen(false);
              }}
              className="text-base font-bold tracking-tight font-display text-[var(--text-primary)] flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <span className="w-2.5 h-2.5 bg-[var(--accent-primary)] inline-block" />
              TASKFLOW
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation drawer"
              className="lg:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Actions Trigger */}
          <div className="p-3 border-b border-[var(--border-subtle)] space-y-2">
            <button
              type="button"
              onClick={() => handleOpenCreateTask('detailed')}
              className="w-full bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-3 py-2 text-xs font-semibold hover:opacity-90 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Task
              </span>
              <kbd className="font-mono text-[10px] opacity-80">N</kbd>
            </button>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Quick Search
              </span>
              <kbd className="font-mono text-[10px]">Ctrl+K</kbd>
            </button>
          </div>

          {/* Restructured Sidebar Navigation: Distinct "Views" and "Modules" */}
          <nav className="p-3 space-y-5 text-xs">
            {/* Section 1: Views */}
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Views
              </div>
              {(
                [
                  {
                    id: 'dashboard',
                    label: 'Dashboard',
                    icon: LayoutDashboard,
                  },
                  {
                    id: 'tasks-daily',
                    label: 'Daily Tasks',
                    icon: Repeat,
                    count: navCounts.dailyLabel,
                    accent: true,
                  },
                  {
                    id: 'tasks-all',
                    label: 'All Tasks',
                    icon: ListTodo,
                    count: navCounts.all,
                  },
                  {
                    id: 'tasks-today',
                    label: 'Today',
                    icon: Clock,
                    count: navCounts.today,
                  },
                  {
                    id: 'tasks-upcoming',
                    label: 'Upcoming',
                    icon: Calendar,
                    count: navCounts.upcoming,
                  },
                  {
                    id: 'tasks-in-progress',
                    label: 'In Progress',
                    icon: Timer,
                    count: navCounts.inProgress,
                  },
                  {
                    id: 'tasks-completed',
                    label: 'Completed',
                    icon: CheckCircle2,
                    count: navCounts.completed,
                  },
                  {
                    id: 'tasks-important',
                    label: 'Important',
                    icon: Star,
                    count: navCounts.important,
                  },
                  {
                    id: 'tasks-overdue',
                    label: 'Overdue',
                    icon: AlertTriangle,
                    count: navCounts.overdue,
                    danger: navCounts.overdue > 0,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      navigateTo(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 font-medium transition-colors ${
                      active
                        ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </span>
                    {'count' in item && item.count !== undefined && (
                      <span
                        className={`font-mono tabular-nums text-[11px] ${
                          'danger' in item && item.danger
                            ? 'text-[var(--status-danger)] font-semibold'
                            : 'accent' in item && item.accent
                              ? 'text-[var(--accent-primary)] font-medium'
                              : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Section 2: Modules */}
            <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
              <div className="px-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Modules
              </div>
              {(
                [
                  {
                    id: 'categories',
                    label: 'Categories',
                    icon: FolderKanban,
                    count: categories.length,
                  },
                  {
                    id: 'calendar',
                    label: 'Calendar',
                    icon: Calendar,
                  },
                  {
                    id: 'focus',
                    label: 'Focus Mode',
                    icon: Timer,
                  },
                  {
                    id: 'analytics',
                    label: 'Analytics',
                    icon: BarChart3,
                  },
                  {
                    id: 'archive',
                    label: 'Archived Tasks',
                    icon: Archive,
                    count: navCounts.archive,
                  },
                  {
                    id: 'tasks-trash',
                    label: 'Recently Deleted',
                    icon: Trash2,
                    count: navCounts.trash,
                  },
                  {
                    id: 'settings',
                    label: 'Settings',
                    icon: Settings,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      navigateTo(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 font-medium transition-colors ${
                      active
                        ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </span>
                    {'count' in item && item.count !== undefined && (
                      <span className="font-mono tabular-nums text-[11px] text-[var(--text-muted)]">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Sidebar Footer: Shortcuts & Theme Switch */}
        <div className="p-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(true)}
            className="hover:text-[var(--text-primary)] flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Shortcuts (?)
          </button>
          <button
            type="button"
            onClick={toggleThemeQuick}
            aria-label="Toggle Dark or Light theme"
            className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 flex items-center gap-1.5 text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            {preferences.theme === 'light' ? (
              <>
                <Sun className="w-3.5 h-3.5" /> Light
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" /> Dark
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar: Chrome-style Back/Forward + Undo/Redo + Breadcrumb on left, primary actions on right */}
        <header className="h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 sm:px-8 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Dedicated Back / Forward Navigation Controls */}
            <div
              className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-main)] shrink-0"
              role="group"
              aria-label="Page navigation history"
            >
              <button
                type="button"
                onClick={handleNavBack}
                disabled={!canGoBack}
                title="Back (Alt + Left)"
                aria-label="Back"
                className="px-2 sm:px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNavForward}
                disabled={!canGoForward}
                title="Forward (Alt + Right)"
                aria-label="Go Forward"
                className="p-1.5 border-l border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Undo / Redo Action Controls */}
            <div
              className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-main)] shrink-0"
              role="group"
              aria-label="Undo and Redo actions"
            >
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0 || isApplyingHistory}
                title={
                  undoStack.length > 0
                    ? `Undo: ${undoStack[undoStack.length - 1].label} (Ctrl + Z)`
                    : 'Nothing to undo (Ctrl + Z)'
                }
                aria-label="Undo last action"
                className="px-2 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Undo</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0 || isApplyingHistory}
                title={
                  redoStack.length > 0
                    ? `Redo: ${redoStack[redoStack.length - 1].label} (Ctrl + Y)`
                    : 'Nothing to redo (Ctrl + Y)'
                }
                aria-label="Redo action"
                className="p-1.5 border-l border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="hidden lg:block text-xs font-mono text-[var(--text-secondary)] truncate pl-1">
              <span>TASKFLOW</span>
              <span aria-hidden="true"> / </span>
              <span className="text-[var(--text-primary)] font-medium capitalize">
                {activeNav === 'tasks-daily'
                  ? 'Daily Tasks'
                  : activeNav === 'tasks-trash'
                    ? 'Recently Deleted'
                    : activeNav.replace('tasks-', 'Views · ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShortcutsModalOpen(true)}
              aria-label="Open keyboard shortcuts cheat sheet"
              className="hidden sm:flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] whitespace-nowrap shrink-0"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Shortcuts</span>
              <kbd className="font-mono text-[10px] text-[var(--text-muted)]">
                ?
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Quick Search</span>
              <kbd className="font-mono text-[10px] text-[var(--text-muted)]">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateTask('quick')}
              className="hidden sm:flex border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Quick Add</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateTask('detailed')}
              className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Task</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </header>

        {/* Active Ringing Task Alarm Alert Banner */}
        {ringingAlarmTask && (
          <div
            role="alertdialog"
            aria-label="Ringing Task Alarm"
            className="fixed top-16 right-4 left-4 sm:left-auto sm:w-[440px] z-50 border-2 border-[var(--accent-primary)] bg-[var(--bg-elevated)] p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] shrink-0 animate-pulse">
                  <BellRing className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-mono font-semibold text-[var(--accent-primary)] truncate">
                    TASK ALARM RINGING ·{' '}
                    {ringingAlarmTask.alarmSound === 'custom'
                      ? (
                          ringingAlarmTask.alarmAudioName ||
                          preferences.customAlarmAudioName ||
                          'Custom Audio'
                        ).toUpperCase()
                      : (
                          ALARM_SOUND_OPTIONS.find(
                            (o) => o.value === ringingAlarmTask.alarmSound
                          )?.label || ringingAlarmTask.alarmSound
                        ).toUpperCase()}
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 truncate">
                    {ringingAlarmTask.title}
                  </div>
                  <div className="text-xs font-mono text-[var(--text-secondary)] mt-0.5">
                    Due {ringingAlarmTask.dueTime || 'now'} ·{' '}
                    {ringingAlarmTask.alarmMinutesBefore === 0
                      ? 'Scheduled time reached'
                      : `${ringingAlarmTask.alarmMinutesBefore} min early reminder`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDismissAlarm(ringingAlarmTask)}
                aria-label="Stop alarm"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDismissAlarm(ringingAlarmTask)}
                className="flex-1 bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-3 py-2 text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <BellOff className="w-3.5 h-3.5" /> Stop Alarm
              </button>
              <button
                type="button"
                onClick={() => handleSnoozeAlarm(ringingAlarmTask, 5)}
                className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] whitespace-nowrap"
              >
                Snooze 5m
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(ringingAlarmTask, 'Completed')}
                className="border border-[var(--status-success)] px-3 py-2 text-xs font-medium text-[var(--status-success)] hover:bg-[var(--status-success)]/10 whitespace-nowrap"
              >
                Complete
              </button>
            </div>
          </div>
        )}

        {/* Feedback Toast with Quick Undo */}
        {toastState && (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-50 border border-[var(--accent-primary)] bg-[var(--bg-elevated)] px-4 py-2.5 text-xs font-medium text-[var(--text-primary)] shadow-xl flex items-center gap-3"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{toastState.message}</span>
            </span>
            {toastState.canUndo && undoStack.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] font-mono text-[var(--accent-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1"
              >
                <Undo2 className="w-3 h-3" /> Undo
              </button>
            )}
          </div>
        )}

        {/* Viewport Workspace Canvas */}
        <main className="flex-1 px-4 sm:px-8 pt-6 max-w-7xl w-full mx-auto">
          {errorBanner && (
            <div
              role="alert"
              className="mb-6 border border-[var(--status-danger)] bg-[var(--status-danger)]/10 p-4 flex items-center justify-between gap-4 text-xs text-[var(--status-danger)]"
            >
              <span>{errorBanner}</span>
              <button
                type="button"
                onClick={loadWorkspaceData}
                className="border border-[var(--status-danger)] px-3 py-1 font-medium hover:bg-[var(--status-danger)]/10 flex items-center gap-1 shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {isLoading ? (
            /* Clean Skeleton Loading State */
            <div className="space-y-6 animate-pulse">
              <div className="h-16 border border-[var(--border-subtle)] bg-[var(--bg-secondary)]" />
              <div className="h-36 border border-[var(--border-subtle)] bg-[var(--bg-secondary)]" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 h-72 border border-[var(--border-subtle)] bg-[var(--bg-secondary)]" />
                <div className="lg:col-span-5 h-72 border border-[var(--border-subtle)] bg-[var(--bg-secondary)]" />
              </div>
            </div>
          ) : (
            <>
              {activeNav === 'dashboard' && dashboard && (
                <DashboardView
                  dashboard={dashboard}
                  tasks={tasks}
                  workspaceUid={workspaceUser.uid}
                  isAnonymous={workspaceUser.isAnonymous}
                  onNavigate={navigateTo}
                  onOpenCreateTask={handleOpenCreateTask}
                  onEditTask={handleOpenEditTask}
                  onToggleTaskStatus={handleStatusChange}
                  onStartFocusOnTask={handleStartFocusOnTask}
                />
              )}

              {activeNav === 'tasks-daily' && (
                <DailyTasksView
                  tasks={tasks}
                  categories={categories}
                  defaultCategoryId={preferences.defaultCategoryId}
                  onCreateDailyTask={handleCreateDailyTask}
                  onStatusChange={handleStatusChange}
                  onToggleImportant={handleToggleImportant}
                  onEditTask={handleOpenEditTask}
                  onDeleteTask={handleDeleteTask}
                  onStartFocus={handleStartFocusOnTask}
                  onRestartDailyTasks={handleRestartDailyTasks}
                  onTriggerTestAlarm={handleTriggerTestAlarm}
                />
              )}

              {((activeNav.startsWith('tasks-') && activeNav !== 'tasks-daily') ||
                activeNav === 'archive') && (
                <TasksWorkspaceView
                  view={mapNavToTaskView(activeNav)}
                  tasks={tasks}
                  categories={categories}
                  tags={tags}
                  defaultViewMode={preferences.defaultTaskView}
                  dailyTaskTarget={preferences.dailyTaskTarget}
                  searchInputRef={searchInputRef}
                  onOpenCreateTask={handleOpenCreateTask}
                  onEditTask={handleOpenEditTask}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onToggleImportant={handleToggleImportant}
                  onArchiveTask={handleArchiveTask}
                  onRestoreTask={handleRestoreTask}
                  onDuplicateTask={handleDuplicateTask}
                  onDeleteTask={handleDeleteTask}
                  onEmptyTrash={handleEmptyTrash}
                  onBulkAction={handleBulkAction}
                  onToggleSubtask={handleToggleSubtask}
                  onAddSubtaskInline={handleAddSubtaskInline}
                  onReorderTasks={handleReorderTasks}
                  onStartFocus={handleStartFocusOnTask}
                />
              )}

              {activeNav === 'categories' && (
                <CategoriesView
                  categories={categories}
                  tasks={tasks}
                  onCreateCategory={async (name, color) => {
                    await api.createCategory(name, color);
                    showToast(`Category "${name}" created`);
                    await refreshDerivedData();
                  }}
                  onUpdateCategory={async (id, name, color) => {
                    await api.updateCategory(id, name, color);
                    showToast('Category updated');
                    await refreshDerivedData();
                  }}
                  onDeleteCategory={async (id, reassignTo) => {
                    await api.deleteCategory(id, reassignTo);
                    showToast('Category deleted and tasks preserved');
                    await refreshDerivedData();
                  }}
                  onEditTask={handleOpenEditTask}
                />
              )}

              {activeNav === 'calendar' && (
                <CalendarView
                  tasks={tasks}
                  defaultCalendarView={preferences.calendarView}
                  weekStart={preferences.weekStart}
                  onOpenCreateOnDate={(dateStr) =>
                    handleOpenCreateTask('detailed', dateStr)
                  }
                  onEditTask={handleOpenEditTask}
                  onRescheduleTaskDate={async (task, nextDateStr) => {
                    const prevDue = task.dueDate;
                    await api.updateTask(task.id, { dueDate: nextDateStr });
                    pushUndoEntry({
                      label: `Reschedule "${task.title}" to ${nextDateStr}`,
                      undo: async () => {
                        await api.updateTask(task.id, { dueDate: prevDue });
                      },
                      redo: async () => {
                        await api.updateTask(task.id, { dueDate: nextDateStr });
                      },
                    });
                    showToast(`Rescheduled "${task.title}" to ${nextDateStr}`, true);
                    await refreshDerivedData();
                  }}
                  onToggleTaskStatus={handleStatusChange}
                />
              )}

              {activeNav === 'focus' && (
                <FocusModeView
                  tasks={tasks}
                  selectedTask={focusTargetTask}
                  preferences={preferences}
                  focusSessions={focusSessions}
                  onSelectTask={setFocusTargetTask}
                  onRecordSession={async (payload) => {
                    await api.recordFocusSession(payload);
                    const updatedSessions = await api.getFocusSessions();
                    setFocusSessions(updatedSessions);
                    showToast('Focus session recorded to PostgreSQL');
                    await refreshDerivedData();
                  }}
                  onUpdatePreferences={handleUpdatePreferences}
                  onToggleSubtask={handleToggleSubtask}
                  onExitFocusMode={() => navigateTo('dashboard')}
                />
              )}

              {activeNav === 'analytics' && analytics && dashboard && (
                <AnalyticsView analytics={analytics} dashboard={dashboard} />
              )}

              {activeNav === 'settings' && (
                <SettingsView
                  preferences={preferences}
                  categories={categories}
                  workspaceUser={workspaceUser}
                  onSavePreferences={handleUpdatePreferences}
                  onWorkspaceReload={loadWorkspaceData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Task Creation / Editing / Smart Quick Add Modal */}
      <TaskModal
        isOpen={taskModalOpen}
        initialMode={taskModalMode}
        editingTask={editingTask}
        defaultDate={preselectedDate}
        defaultPriority={preferences.defaultPriority}
        defaultCategoryId={preferences.defaultCategoryId}
        defaultCustomAlarmAudioData={preferences.customAlarmAudioData}
        defaultCustomAlarmAudioName={preferences.customAlarmAudioName}
        categories={categories}
        tags={tags}
        onClose={() => setTaskModalOpen(false)}
        onSave={handleSaveTaskModal}
      />

      {/* Quick Search Dialog (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={navigateTo}
        onOpenCreateTask={handleOpenCreateTask}
        onToggleTheme={toggleThemeQuick}
        onSelectTaskForEdit={handleOpenEditTask}
        tasks={tasks}
      />

      {/* Keyboard Shortcuts Modal (?) */}
      <ShortcutsHelpModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
}
