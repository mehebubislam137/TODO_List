import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Play,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react';
import { DashboardData } from '../services/api';
import {
  formatLocalDate,
  isTaskOverdue,
  TaskItem,
  TaskStatus,
} from '../utils/taskLogic';
import { NavSectionId } from './CommandPalette';

interface DashboardViewProps {
  dashboard: DashboardData;
  tasks: TaskItem[];
  workspaceUid: string;
  isAnonymous: boolean;
  onNavigate: (section: NavSectionId) => void;
  onOpenCreateTask: (mode: 'detailed' | 'quick') => void;
  onEditTask: (task: TaskItem) => void;
  onToggleTaskStatus: (task: TaskItem, nextStatus: TaskStatus) => Promise<void>;
  onStartFocusOnTask: (task: TaskItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dashboard,
  tasks,
  workspaceUid,
  isAnonymous,
  onNavigate,
  onOpenCreateTask,
  onEditTask,
  onToggleTaskStatus,
  onStartFocusOnTask,
}) => {
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const activeTasks = tasks.filter((t) => !t.deletedAt && !t.isArchived);

  const todaysTasks = activeTasks.filter(
    (t) => t.dueDate === todayStr || isTaskOverdue(t, now)
  );
  const todaysCompleted = activeTasks.filter(
    (t) =>
      t.status === 'Completed' &&
      ((t.completedAt && formatLocalDate(new Date(t.completedAt)) === todayStr) ||
        t.dueDate === todayStr)
  );
  const todaysRemaining = activeTasks.filter(
    (t) => t.dueDate === todayStr && t.status !== 'Completed'
  );
  const todaysHighPriority = todaysRemaining.filter((t) => t.priority === 'High');

  const upcomingDeadlines = activeTasks
    .filter((t) => t.dueDate && t.status !== 'Completed')
    .sort((a, b) => {
      const da = `${a.dueDate || '9999-12-31'} ${a.dueTime || '23:59'}`;
      const db = `${b.dueDate || '9999-12-31'} ${b.dueTime || '23:59'}`;
      return da.localeCompare(db);
    })
    .slice(0, 7);

  const { stats, briefing, weeklySeries, recentActivity } = dashboard;
  const maxWeeklyVal = Math.max(
    4,
    ...weeklySeries.map((d) => Math.max(d.completed, d.created))
  );

  const dailyGoalPct =
    stats.dailyTaskTarget > 0
      ? Math.min(
          100,
          Math.round((stats.completedToday / stats.dailyTaskTarget) * 100)
        )
      : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Hero & Daily Briefing */}
      <section className="border-b border-[var(--border-subtle)] pb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
              <span>{formattedDate}</span>
              <span aria-hidden="true">·</span>
              <span>
                Workspace {workspaceUid.slice(0, 13)} (
                {isAnonymous ? 'Isolated Anonymous Session' : 'Verified Account'})
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-[var(--accent-primary)]">
                <Flame className="w-3.5 h-3.5" />
                {stats.streak} day streak
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {greeting}. Your workspace is active.
            </h1>
            <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
              {briefing.join(' ')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenCreateTask('quick')}
              className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Smart Quick Add
            </button>
            <button
              type="button"
              onClick={() => onOpenCreateTask('detailed')}
              className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>
      </section>

      {/* Editorial Productivity Overview Ledger (Non-repetitive structured composition) */}
      <section aria-label="Productivity Overview">
        <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)]">
          {/* Primary Completion Rate Anchor */}
          <div className="lg:col-span-4 p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-medium text-[var(--text-secondary)]">
                Workspace Completion Ratio
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-4xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  {stats.completionPercentage}%
                </span>
                <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                  {stats.completed} of {stats.totalActive} active tasks
                </span>
              </div>
            </div>
            <div className="mt-5">
              <div className="h-1.5 w-full bg-[var(--bg-main)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                  style={{ width: `${stats.completionPercentage}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)] font-mono tabular-nums">
                <span>Daily Goal: {stats.completedToday}/{stats.dailyTaskTarget}</span>
                <span>Focus Today: {stats.dailyFocusMinutes}m</span>
              </div>
            </div>
          </div>

          {/* Structured Status Breakdown Table */}
          <div className="lg:col-span-5 p-6 flex flex-col justify-between">
            <div className="text-xs font-medium text-[var(--text-secondary)] mb-3">
              Task Status Distribution
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[var(--text-muted)]">Total Active</div>
                <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[var(--text-primary)]">
                  {stats.totalActive}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">In Progress</div>
                <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[var(--accent-primary)]">
                  {stats.inProgress}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">Pending</div>
                <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[var(--text-primary)]">
                  {stats.pending}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">Completed</div>
                <div className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[var(--status-success)]">
                  {stats.completed}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">
                Overdue attention queue
              </span>
              <button
                type="button"
                onClick={() => onNavigate('tasks-overdue')}
                className={`font-mono tabular-nums font-medium hover:underline ${
                  stats.overdue > 0
                    ? 'text-[var(--status-danger)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {stats.overdue} overdue →
              </button>
            </div>
          </div>

          {/* Daily Briefing Callout */}
          <div className="lg:col-span-3 p-6 flex flex-col justify-between bg-[var(--bg-elevated)]">
            <div>
              <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Daily Rule-Based Briefing
              </div>
              <ul className="space-y-1.5 text-xs text-[var(--text-primary)]">
                {briefing.map((line, i) => (
                  <li key={i} className="leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('focus')}
              className="mt-4 text-left text-xs font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              Launch Pomodoro Focus Session <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Main Two-Column Editorial Split: Today's Overview & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Today's Overview */}
        <section className="lg:col-span-7 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Today&apos;s Focus & Execution
                </h2>
                <p className="text-xs text-[var(--text-secondary)] font-mono tabular-nums mt-0.5">
                  {todaysCompleted.length} completed · {todaysRemaining.length}{' '}
                  remaining · {todaysHighPriority.length} high-priority
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tasks-today')}
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
              >
                Open Today View →
              </button>
            </div>

            {/* Daily Completion Progress Bar */}
            <div className="mb-5 border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3.5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[var(--text-secondary)]">
                  Daily Task Target Progress
                </span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {stats.completedToday} / {stats.dailyTaskTarget} tasks ({dailyGoalPct}
                  %)
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--bg-main)] overflow-hidden">
                <div
                  className="h-full bg-[var(--status-success)] transition-all duration-300"
                  style={{ width: `${dailyGoalPct}%` }}
                />
              </div>
            </div>

            {/* Today's Task Rows */}
            {todaysTasks.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-[var(--border-subtle)]">
                <p className="text-sm text-[var(--text-secondary)]">
                  No tasks scheduled for today yet.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenCreateTask('detailed')}
                  className="mt-3 border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                >
                  Schedule Task for Today
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {todaysTasks.slice(0, 6).map((task) => {
                  const overdue = isTaskOverdue(task, now);
                  const isDone = task.status === 'Completed';
                  const completedSubs = task.subtasks.filter(
                    (s) => s.isCompleted
                  ).length;

                  return (
                    <div
                      key={task.id}
                      className="py-3 flex items-start justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleTaskStatus(
                              task,
                              isDone ? 'Pending' : 'Completed'
                            )
                          }
                          aria-label={`Mark "${task.title}" as ${
                            isDone ? 'Pending' : 'Completed'
                          }`}
                          className="mt-0.5 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onEditTask(task)}
                            className={`text-left text-sm font-medium hover:underline block truncate ${
                              isDone
                                ? 'line-through text-[var(--text-muted)]'
                                : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {task.title}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)] font-mono tabular-nums">
                            <span>{task.categoryName || 'Uncategorized'}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                task.priority === 'High'
                                  ? 'text-[var(--status-warning)] font-medium'
                                  : ''
                              }
                            >
                              {task.priority} Priority
                            </span>
                            {task.isImportant && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[var(--status-warning)] flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-current" /> Important
                                </span>
                              </>
                            )}
                            {overdue && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[var(--status-danger)] font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Overdue (
                                  {task.dueDate})
                                </span>
                              </>
                            )}
                            {task.subtasks.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  Subtasks {completedSubs}/{task.subtasks.length}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => onStartFocusOnTask(task)}
                          aria-label={`Focus on ${task.title}`}
                          className="border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors flex items-center gap-1 shrink-0"
                        >
                          <Play className="w-3 h-3" /> Focus
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right 5 Cols: Upcoming Deadlines */}
        <section className="lg:col-span-5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Approaching Deadlines
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Chronological schedule of active deadlines
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tasks-upcoming')}
                className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
              >
                All Upcoming →
              </button>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--text-muted)]">
                No pending deadlines scheduled.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {upcomingDeadlines.map((task) => {
                  const overdue = isTaskOverdue(task, now);
                  return (
                    <div
                      key={task.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className="w-full text-left text-sm font-medium text-[var(--text-primary)] hover:underline truncate block"
                        >
                          {task.title}
                        </button>
                        <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                          <span>{task.categoryName || 'Uncategorized'}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{task.priority} Priority</span>
                          <span aria-hidden="true"> · </span>
                          <span>{task.status}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums text-xs">
                        <div
                          className={
                            overdue
                              ? 'text-[var(--status-danger)] font-semibold'
                              : task.dueDate === todayStr
                                ? 'text-[var(--accent-primary)] font-medium'
                                : 'text-[var(--text-primary)]'
                          }
                        >
                          {overdue ? `Overdue · ${task.dueDate}` : task.dueDate}
                        </div>
                        {task.dueTime && (
                          <div className="text-[var(--text-muted)] flex items-center justify-end gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {task.dueTime}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Bottom Two-Column Split: 7-Day Weekly Progress Visualization & Chronological Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Weekly Progress Chart from real DB records */}
        <section className="lg:col-span-7 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Weekly Completion Throughput
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Tasks completed vs. created over the past 7 calendar days
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              Full Analytics →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4 px-2 border-b border-[var(--border-subtle)]">
            {weeklySeries.map((day) => {
              const compHeight = Math.round((day.completed / maxWeeklyVal) * 100);
              const createdHeight = Math.round((day.created / maxWeeklyVal) * 100);
              return (
                <div
                  key={day.date}
                  className="flex flex-col items-center justify-end h-full gap-2"
                >
                  <div className="w-full flex items-end justify-center gap-1.5 h-32">
                    <div
                      title={`${day.completed} completed on ${day.date}`}
                      className="w-3.5 bg-[var(--accent-primary)] transition-all duration-300"
                      style={{ height: `${Math.max(6, compHeight)}%` }}
                    />
                    <div
                      title={`${day.created} created on ${day.date}`}
                      className="w-3.5 bg-[var(--border-subtle)] transition-all duration-300"
                      style={{ height: `${Math.max(6, createdHeight)}%` }}
                    />
                  </div>
                  <div className="text-center pb-2">
                    <div className="text-xs font-mono text-[var(--text-secondary)]">
                      {day.label}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                      {day.completed}✓
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[var(--accent-primary)] inline-block" />
                Completed Tasks
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[var(--border-subtle)] inline-block" />
                Created Tasks
              </span>
            </div>
            <span className="font-mono tabular-nums">
              Weekly Focus: {stats.weeklyFocusMinutes} mins ({stats.sessionsCompleted}{' '}
              sessions)
            </span>
          </div>
        </section>

        {/* Right 5 Cols: Recent Activity Timeline */}
        <section className="lg:col-span-5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Recent Workspace Activity
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Chronological audit log of task transitions
              </p>
            </div>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              No workspace activity recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] max-h-60 overflow-y-auto pr-1">
              {recentActivity.slice(0, 8).map((act) => {
                const timeLabel = new Date(act.createdAt).toLocaleTimeString(
                  'en-US',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                );
                return (
                  <div
                    key={act.id}
                    className="py-2.5 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--text-primary)] truncate">
                        {act.taskTitle}
                      </div>
                      <div className="text-[var(--text-secondary)] mt-0.5">
                        {act.detail || act.actionType.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                      {timeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
