import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Plus,
} from 'lucide-react';
import {
  addDaysToDateString,
  formatLocalDate,
  isTaskOverdue,
  TaskItem,
  TaskStatus,
} from '../utils/taskLogic';

interface CalendarViewProps {
  tasks: TaskItem[];
  defaultCalendarView: 'month' | 'week' | 'day';
  weekStart: 'monday' | 'sunday';
  onOpenCreateOnDate: (dateStr: string) => void;
  onEditTask: (task: TaskItem) => void;
  onRescheduleTaskDate: (task: TaskItem, nextDateStr: string) => Promise<void>;
  onToggleTaskStatus: (task: TaskItem, nextStatus: TaskStatus) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  defaultCalendarView,
  weekStart,
  onOpenCreateOnDate,
  onEditTask,
  onRescheduleTaskDate,
  onToggleTaskStatus,
}) => {
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const [calMode, setCalMode] = useState<'month' | 'week' | 'day'>(
    defaultCalendarView || 'month'
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [cursorDate, setCursorDate] = useState<Date>(
    new Date(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.deletedAt && !t.isArchived),
    [tasks]
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const t of activeTasks) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) || [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [activeTasks]);

  const weekdayHeaders =
    weekStart === 'monday'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Generate month grid cells
  const monthDays = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const rawDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
    const startOffset =
      weekStart === 'monday' ? (rawDay === 0 ? 6 : rawDay - 1) : rawDay;

    const gridStart = new Date(year, month, 1 - startOffset);
    const cells: { dateStr: string; dayNumber: number; inCurrentMonth: boolean }[] =
      [];

    for (let i = 0; i < 42; i++) {
      const dt = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      );
      cells.push({
        dateStr: formatLocalDate(dt),
        dayNumber: dt.getDate(),
        inCurrentMonth: dt.getMonth() === month,
      });
    }
    return cells;
  }, [cursorDate, weekStart]);

  // Generate week view cells
  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const sel = new Date(y, m - 1, d);
    const rawDay = sel.getDay();
    const offset =
      weekStart === 'monday' ? (rawDay === 0 ? 6 : rawDay - 1) : rawDay;
    const startOfWeek = new Date(y, m - 1, d - offset);

    const days: { dateStr: string; label: string; dayNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(
        startOfWeek.getFullYear(),
        startOfWeek.getMonth(),
        startOfWeek.getDate() + i
      );
      days.push({
        dateStr: formatLocalDate(dt),
        label: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: dt.getDate(),
      });
    }
    return days;
  }, [selectedDateStr, weekStart]);

  const handleNavigatePeriod = (dir: -1 | 1) => {
    if (calMode === 'month') {
      const next = new Date(
        cursorDate.getFullYear(),
        cursorDate.getMonth() + dir,
        1
      );
      setCursorDate(next);
    } else if (calMode === 'week') {
      const nextStr = addDaysToDateString(selectedDateStr, dir * 7);
      setSelectedDateStr(nextStr);
      const [y, m, d] = nextStr.split('-').map(Number);
      setCursorDate(new Date(y, m - 1, d));
    } else {
      const nextStr = addDaysToDateString(selectedDateStr, dir);
      setSelectedDateStr(nextStr);
      const [y, m, d] = nextStr.split('-').map(Number);
      setCursorDate(new Date(y, m - 1, d));
    }
  };

  const handleDropOnDate = async (targetDateStr: string) => {
    if (!draggedTaskId) return;
    const task = activeTasks.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    if (task && task.dueDate !== targetDateStr) {
      await onRescheduleTaskDate(task, targetDateStr);
    }
  };

  const selectedDateTasks = tasksByDate.get(selectedDateStr) || [];

  const periodTitle =
    calMode === 'month'
      ? cursorDate.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      : calMode === 'week'
        ? `Week of ${weekDays[0]?.dateStr} — ${weekDays[6]?.dateStr}`
        : selectedDateStr;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Interactive Planning Calendar
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Schedule deadlines across Monthly, Weekly, and Daily horizons. Drag tasks
            across dates to reschedule.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-0.5">
            {(['month', 'week', 'day'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCalMode(m)}
                className={`px-3 py-1 text-xs font-medium capitalize whitespace-nowrap shrink-0 ${
                  calMode === m
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {m}ly
              </button>
            ))}
          </div>

          <div className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <button
              type="button"
              onClick={() => handleNavigatePeriod(-1)}
              aria-label="Previous period"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDateStr(todayStr);
                setCursorDate(
                  new Date(now.getFullYear(), now.getMonth(), now.getDate())
                );
              }}
              className="px-3 py-1.5 text-xs font-mono font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleNavigatePeriod(1)}
              aria-label="Next period"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenCreateOnDate(selectedDateStr)}
            className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-3.5 py-2 text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add on {selectedDateStr}
          </button>
        </div>
      </div>

      {/* Main Split: Calendar Surface + Selected Date Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {periodTitle}
            </h2>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              Selected: {selectedDateStr}
            </span>
          </div>

          {calMode === 'month' && (
            <div>
              <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 text-center text-xs font-mono text-[var(--text-secondary)]">
                {weekdayHeaders.map((day) => (
                  <div key={day} className="py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-subtle)]">
                {monthDays.map((cell) => {
                  const dayTasks = tasksByDate.get(cell.dateStr) || [];
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedDateStr;

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => setSelectedDateStr(cell.dateStr)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropOnDate(cell.dateStr)}
                      className={`min-h-[96px] p-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-primary)]/10'
                          : cell.inCurrentMonth
                            ? 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-secondary)]/50'
                            : 'bg-[var(--bg-main)]/60 text-[var(--text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span
                          className={
                            isToday
                              ? 'bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-1.5 py-0.5 font-bold'
                              : isSelected
                                ? 'text-[var(--accent-primary)] font-bold'
                                : ''
                          }
                        >
                          {cell.dayNumber}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 space-y-1">
                        {dayTasks.slice(0, 3).map((t) => {
                          const overdue = isTaskOverdue(t, now);
                          const isDone = t.status === 'Completed';
                          return (
                            <div
                              key={t.id}
                              draggable
                              onDragStart={() => setDraggedTaskId(t.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditTask(t);
                              }}
                              className={`truncate px-1.5 py-0.5 text-[11px] border ${
                                isDone
                                  ? 'border-[var(--border-subtle)] text-[var(--text-muted)] line-through'
                                  : overdue
                                    ? 'border-[var(--status-danger)] text-[var(--status-danger)] bg-[var(--status-danger)]/10'
                                    : t.priority === 'High'
                                      ? 'border-[var(--status-warning)] text-[var(--text-primary)]'
                                      : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                              }`}
                            >
                              {t.title}
                            </div>
                          );
                        })}
                        {dayTasks.length > 3 && (
                          <div className="text-[10px] font-mono text-[var(--text-muted)] pl-1">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {calMode === 'week' && (
            <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)] min-h-[380px]">
              {weekDays.map((wd) => {
                const dayTasks = tasksByDate.get(wd.dateStr) || [];
                const isSelected = wd.dateStr === selectedDateStr;
                const isToday = wd.dateStr === todayStr;

                return (
                  <div
                    key={wd.dateStr}
                    onClick={() => setSelectedDateStr(wd.dateStr)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOnDate(wd.dateStr)}
                    className={`p-3 cursor-pointer ${
                      isSelected ? 'bg-[var(--accent-primary)]/10' : ''
                    }`}
                  >
                    <div className="border-b border-[var(--border-subtle)] pb-2 mb-2 flex items-center justify-between">
                      <span className="text-xs font-mono text-[var(--text-secondary)]">
                        {wd.label}
                      </span>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          isToday
                            ? 'bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-1.5 py-0.5 font-bold'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {wd.dayNum}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {dayTasks.map((t) => {
                        const overdue = isTaskOverdue(t, now);
                        const isDone = t.status === 'Completed';
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={() => setDraggedTaskId(t.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTask(t);
                            }}
                            className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2 text-xs space-y-1"
                          >
                            <div
                              className={`font-medium ${
                                isDone
                                  ? 'line-through text-[var(--text-muted)]'
                                  : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {t.title}
                            </div>
                            <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                              {t.priority}
                              {overdue ? ' · Overdue' : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calMode === 'day' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Daily Agenda for {selectedDateStr}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCreateOnDate(selectedDateStr)}
                  className="text-xs text-[var(--accent-primary)] hover:underline"
                >
                  + Schedule task on {selectedDateStr}
                </button>
              </div>
              {selectedDateTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)]">
                  No tasks scheduled for {selectedDateStr}.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {selectedDateTasks.map((t) => (
                    <div
                      key={t.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleTaskStatus(
                              t,
                              t.status === 'Completed' ? 'Pending' : 'Completed'
                            )
                          }
                          className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] shrink-0"
                        >
                          {t.status === 'Completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onEditTask(t)}
                            className="text-sm font-medium text-[var(--text-primary)] hover:underline text-left truncate block w-full"
                          >
                            {t.title}
                          </button>
                          <div className="text-xs text-[var(--text-secondary)] font-mono">
                            {t.categoryName || 'Uncategorized'} · {t.priority}{' '}
                            Priority · {t.dueTime || 'All day'}
                          </div>
                        </div>
                      </div>
                      <input
                        type="date"
                        aria-label={`Reschedule ${t.title}`}
                        value={t.dueDate || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            onRescheduleTaskDate(t, e.target.value);
                          }
                        }}
                        className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2 py-1 text-xs font-mono text-[var(--text-primary)] shrink-0"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 4 Cols: Selected Date Inspector */}
        <div className="lg:col-span-4 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 className="text-sm font-semibold font-mono text-[var(--text-primary)]">
                {selectedDateStr}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onOpenCreateOnDate(selectedDateStr)}
              className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
            >
              + New Task
            </button>
          </div>

          {selectedDateTasks.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              No tasks scheduled on {selectedDateStr}. Click &ldquo;+ New Task&rdquo;
              to plan a deliverable for this date.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {selectedDateTasks.map((task) => {
                const overdue = isTaskOverdue(task, now);
                const isDone = task.status === 'Completed';
                return (
                  <div key={task.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleTaskStatus(
                              task,
                              isDone ? 'Pending' : 'Completed'
                            )
                          }
                          className="mt-0.5 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className={`text-left text-sm font-medium hover:underline truncate block ${
                            isDone
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {task.title}
                        </button>
                      </div>
                    </div>

                    <div className="pl-6 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[var(--text-secondary)]">
                      <div>
                        <span>{task.categoryName || 'Uncategorized'}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{task.priority}</span>
                        {task.dueTime && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {task.dueTime}
                            </span>
                          </>
                        )}
                        {overdue && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="text-[var(--status-danger)] inline-flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Overdue
                            </span>
                          </>
                        )}
                      </div>

                      <input
                        type="date"
                        aria-label={`Change deadline for ${task.title}`}
                        value={task.dueDate || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            onRescheduleTaskDate(task, e.target.value);
                          }
                        }}
                        className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
