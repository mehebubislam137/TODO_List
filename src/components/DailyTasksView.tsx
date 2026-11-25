import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  Music,
  Play,
  Plus,
  Repeat,
  RotateCw,
  Star,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  AlarmSoundType,
  CategoryItem,
  formatAlarmRingTime,
  formatLocalDate,
  getTimeUntilMidnight,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../utils/taskLogic';
import {
  ALARM_SOUND_OPTIONS,
  previewAlarmSound,
  readAudioFileAsDataUrl,
} from '../utils/alarmAudio';

interface DailyTasksViewProps {
  tasks: TaskItem[];
  categories: CategoryItem[];
  defaultCategoryId: string | null;
  onCreateDailyTask: (payload: {
    title: string;
    priority: TaskPriority;
    categoryId: string | null;
    dueTime: string | null;
    alarmEnabled: boolean;
    alarmMinutesBefore: number;
    alarmSound: AlarmSoundType;
    alarmAudioData?: string | null;
    alarmAudioName?: string | null;
  }) => Promise<void>;
  onStatusChange: (task: TaskItem, status: TaskStatus) => Promise<void>;
  onToggleImportant: (task: TaskItem) => Promise<void>;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (task: TaskItem, permanent: boolean) => Promise<void>;
  onStartFocus: (task: TaskItem) => void;
  onRestartDailyTasks: () => Promise<void>;
  onTriggerTestAlarm: (task: TaskItem) => void;
}

export const DailyTasksView: React.FC<DailyTasksViewProps> = ({
  tasks,
  categories,
  defaultCategoryId,
  onCreateDailyTask,
  onStatusChange,
  onToggleImportant,
  onEditTask,
  onDeleteTask,
  onStartFocus,
  onRestartDailyTasks,
  onTriggerTestAlarm,
}) => {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [dueTime, setDueTime] = useState('09:00');
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmMinutesBefore, setAlarmMinutesBefore] = useState<number>(10);
  const [alarmSound, setAlarmSound] = useState<AlarmSoundType>('classic');
  const [alarmAudioData, setAlarmAudioData] = useState<string | null>(null);
  const [alarmAudioName, setAlarmAudioName] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [countdown, setCountdown] = useState(() => getTimeUntilMidnight(new Date()));
  const dailyAudioInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getTimeUntilMidnight(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dailyTasks = useMemo(() => {
    return tasks
      .filter((t) => t.isDailyTask && !t.deletedAt && !t.isArchived)
      .sort((a, b) => {
        // Pending first, then by dueTime ascending, then creation time
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        const ta = a.dueTime || '99:99';
        const tb = b.dueTime || '99:99';
        if (ta !== tb) return ta.localeCompare(tb);
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [tasks]);

  const completedCount = dailyTasks.filter((t) => t.status === 'Completed').length;
  const totalCount = dailyTasks.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const todayStr = formatLocalDate(new Date());

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || isAdding) return;
    setIsAdding(true);
    try {
      await onCreateDailyTask({
        title: clean,
        priority,
        categoryId,
        dueTime: dueTime || null,
        alarmEnabled: alarmEnabled && Boolean(dueTime),
        alarmMinutesBefore: Math.max(0, Number(alarmMinutesBefore) || 0),
        alarmSound,
        alarmAudioData: alarmSound === 'custom' ? alarmAudioData : null,
        alarmAudioName: alarmSound === 'custom' ? alarmAudioName : null,
      });
      setTitle('');
      setAlarmAudioData(null);
      setAlarmAudioName(null);
      if (alarmSound === 'custom') setAlarmSound('classic');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDailyAudioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setAudioError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { name, dataUrl } = await readAudioFileAsDataUrl(file);
      setAlarmAudioData(dataUrl);
      setAlarmAudioName(name);
      setAlarmSound('custom');
      previewAlarmSound('custom', dataUrl);
    } catch (err: any) {
      setAudioError(err.message || 'Could not load audio file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRestartNow = async () => {
    if (isRestarting || dailyTasks.length === 0) return;
    setIsRestarting(true);
    try {
      await onRestartDailyTasks();
    } finally {
      setIsRestarting(false);
    }
  };

  const previewRingTime =
    alarmEnabled && dueTime
      ? formatAlarmRingTime(dueTime, alarmMinutesBefore)
      : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--accent-primary)] mb-1">
            <Repeat className="w-3.5 h-3.5" />
            <span>AUTOMATIC DAILY RESTART · {todayStr}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Daily Tasks
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Recurring daily checklist that automatically resets every day at midnight (00:00) with optional task alarms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-2 text-xs">
            <span className="text-[var(--text-muted)] block text-[10px] font-mono">
              NEXT AUTO-RESTART
            </span>
            <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
              {countdown.label}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRestartNow}
            disabled={isRestarting || totalCount === 0}
            className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
            Restart Daily List
          </button>
        </div>
      </div>

      {/* Daily Progress Ledger */}
      <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-[var(--text-secondary)]">
            Today&apos;s Daily Routine Progress
          </div>
          <div className="text-sm font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
            {completedCount} of {totalCount} completed ({progressPct}%) ·{' '}
            {Math.max(0, totalCount - completedCount)} remaining
          </div>
        </div>
        <div className="w-full sm:w-72 h-2 bg-[var(--bg-main)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent-primary)] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Quick Add Daily Task Form */}
      <form
        onSubmit={handleQuickCreate}
        className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
          <h2 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            <span>Add Daily Task (Auto-restarts every midnight)</span>
          </h2>
          {previewRingTime && (
            <span className="text-[11px] font-mono text-[var(--accent-primary)] flex items-center gap-1">
              <Bell className="w-3 h-3 shrink-0" />
              <span>Alarm rings at {previewRingTime} ({alarmMinutesBefore}m before {dueTime})</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label
              htmlFor="daily-task-title"
              className="block text-[11px] text-[var(--text-secondary)] mb-1"
            >
              Daily Task Name *
            </label>
            <input
              id="daily-task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Review flashcards, Take vitamins, Evening walk..."
              className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="daily-task-time"
              className="block text-[11px] text-[var(--text-secondary)] mb-1"
            >
              Daily Time
            </label>
            <input
              id="daily-task-time"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-2 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="daily-task-priority"
              className="block text-[11px] text-[var(--text-secondary)] mb-1"
            >
              Priority
            </label>
            <select
              id="daily-task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="daily-task-category"
              className="block text-[11px] text-[var(--text-secondary)] mb-1"
            >
              Category
            </label>
            <select
              id="daily-task-category"
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Inline Alarm Configuration Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={alarmEnabled}
                onChange={(e) => setAlarmEnabled(e.target.checked)}
                className="accent-[var(--accent-primary)]"
              />
              <Bell className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Enable Alarm</span>
            </label>

            {alarmEnabled && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--text-secondary)]">Ring</span>
                  <input
                    type="number"
                    min={0}
                    max={240}
                    aria-label="Alarm minutes before due time"
                    value={alarmMinutesBefore}
                    onChange={(e) =>
                      setAlarmMinutesBefore(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-16 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2 py-1 text-xs font-mono text-[var(--text-primary)]"
                  />
                  <span className="text-[var(--text-secondary)]">min before</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label="Daily task alarm sound"
                    value={alarmSound}
                    onChange={(e) => setAlarmSound(e.target.value as AlarmSoundType)}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                  >
                    {ALARM_SOUND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    ref={dailyAudioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                    onChange={handleDailyAudioUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => dailyAudioInputRef.current?.click()}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1 whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Gallery Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => previewAlarmSound(alarmSound, alarmAudioData)}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Test
                  </button>
                  {alarmSound === 'custom' && alarmAudioName && (
                    <span className="text-[11px] font-mono text-[var(--accent-primary)] flex items-center gap-1 max-w-[150px] truncate">
                      <Music className="w-3 h-3 shrink-0" />
                      <span className="truncate">{alarmAudioName}</span>
                    </span>
                  )}
                </div>
                {audioError && (
                  <span className="text-[11px] text-[var(--status-danger)]">
                    {audioError}
                  </span>
                )}
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={isAdding || !title.trim()}
            className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAdding ? 'Adding...' : 'Add Daily Task'}
          </button>
        </div>
      </form>

      {/* Daily Tasks Checklist */}
      <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--text-primary)]">
            Active Daily Routine ({completedCount}/{totalCount})
          </span>
          <span className="font-mono text-[var(--text-muted)]">
            Resets daily at 00:00
          </span>
        </div>

        {dailyTasks.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              No daily routine tasks yet
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Add habits or daily checklist items above. Each task will automatically restart to Pending every morning.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {dailyTasks.map((task) => {
              const isDone = task.status === 'Completed';
              const ringTime =
                task.alarmEnabled && task.dueTime
                  ? formatAlarmRingTime(task.dueTime, task.alarmMinutesBefore)
                  : null;
              const soundMeta = ALARM_SOUND_OPTIONS.find(
                (o) => o.value === task.alarmSound
              );

              return (
                <div
                  key={task.id}
                  className="px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-[var(--bg-secondary)]/60 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        onStatusChange(task, isDone ? 'Pending' : 'Completed')
                      }
                      aria-label={`Toggle daily task ${task.title}`}
                      className="mt-0.5 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className={`text-left text-sm font-medium hover:underline truncate ${
                            isDone
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {task.title}
                        </button>
                        {task.isImportant && (
                          <Star className="w-3.5 h-3.5 text-[var(--status-warning)] fill-current shrink-0" />
                        )}
                      </div>

                      {task.description && (
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-1">
                          {task.description}
                        </p>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                        <span>{task.categoryName || 'Uncategorized'}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            task.priority === 'High'
                              ? 'text-[var(--status-warning)] font-medium'
                              : ''
                          }
                        >
                          {task.priority}
                        </span>
                        {task.dueTime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center gap-1 text-[var(--text-primary)]">
                              <Clock className="w-3 h-3" />
                              {task.dueTime}
                            </span>
                          </>
                        )}
                        {task.alarmEnabled && ringTime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center gap-1 text-[var(--accent-primary)]">
                              <Bell className="w-3 h-3" />
                              Alarm {ringTime} ({task.alarmMinutesBefore}m early ·{' '}
                              {task.alarmSound === 'custom' && task.alarmAudioName
                                ? task.alarmAudioName
                                : soundMeta?.label || task.alarmSound}
                              )
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.alarmEnabled && !isDone && (
                      <button
                        type="button"
                        onClick={() => onTriggerTestAlarm(task)}
                        title="Test this task's ringing alarm now"
                        className="border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1 whitespace-nowrap"
                      >
                        <Bell className="w-3 h-3" /> Ring Test
                      </button>
                    )}
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => onStartFocus(task)}
                        className="border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1 whitespace-nowrap"
                      >
                        <Play className="w-3 h-3" /> Focus
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleImportant(task)}
                      aria-label={`Toggle important for ${task.title}`}
                      className={`p-1.5 ${
                        task.isImportant
                          ? 'text-[var(--status-warning)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          task.isImportant ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditTask(task)}
                      aria-label={`Edit ${task.title}`}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task, false)}
                      aria-label={`Delete ${task.title}`}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
