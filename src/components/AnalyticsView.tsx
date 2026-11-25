// TASKFLOW Productivity Analytics View
import React, { useState } from 'react';
import { Flame, TrendingUp } from 'lucide-react';
import { AnalyticsData, DashboardData } from '../services/api';

interface AnalyticsViewProps {
  analytics: AnalyticsData;
  dashboard: DashboardData;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analytics,
  dashboard,
}) => {
  const [horizon, setHorizon] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const {
    dailyTrends,
    categoryDistribution,
    priorityDistribution,
    averageDailyCompletion,
    streak,
    totalActiveTasks,
    totalCompletedTasks,
  } = analytics;

  const displayedTrends =
    horizon === 'daily'
      ? dailyTrends.slice(-7)
      : horizon === 'weekly'
        ? dailyTrends
        : dailyTrends;

  const maxTaskCount = Math.max(
    3,
    ...displayedTrends.map((d) => d.completedTasks)
  );
  const maxFocusMins = Math.max(
    30,
    ...displayedTrends.map((d) => d.focusMinutes)
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Productivity Analytics & Telemetry
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            All metrics are calculated directly from persisted PostgreSQL task and
            focus session records.
          </p>
        </div>

        <div className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-0.5">
          {(
            [
              { id: 'daily', label: '7-Day Daily' },
              { id: 'weekly', label: '14-Day Weekly' },
              { id: 'monthly', label: 'Monthly Window' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setHorizon(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                horizon === tab.id
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Quantitative Summary Strip */}
      <section className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)]">
        <div className="p-5">
          <div className="text-xs text-[var(--text-secondary)]">
            Consecutive Progress Streak
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-[var(--accent-primary)]">
              {streak}
            </span>
            <span className="text-xs font-mono text-[var(--text-secondary)] flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> days
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Consecutive local calendar days with ≥1 completed task.
          </p>
        </div>

        <div className="p-5">
          <div className="text-xs text-[var(--text-secondary)]">
            Average Daily Completion
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
              {averageDailyCompletion}
            </span>
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              tasks / day
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Rolling 14-day mean completion velocity across workspace.
          </p>
        </div>

        <div className="p-5">
          <div className="text-xs text-[var(--text-secondary)]">
            Overall Completion Ratio
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-[var(--status-success)]">
              {dashboard.stats.completionPercentage}%
            </span>
            <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
              ({totalCompletedTasks}/{totalActiveTasks})
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Ratio of completed tasks to total non-deleted active tasks.
          </p>
        </div>

        <div className="p-5">
          <div className="text-xs text-[var(--text-secondary)]">
            Cumulative Focus Time
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
              {dashboard.stats.totalFocusMinutes}m
            </span>
            <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
              ({dashboard.stats.sessionsCompleted} sessions)
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Verified completed Pomodoro work intervals in PostgreSQL.
          </p>
        </div>
      </section>

      {/* Two-Column Charts: Task Completion Trend & Focus-Time Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Task Completion Trend */}
        <section className="lg:col-span-6 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Task Completion Velocity ({horizon})
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Completed tasks recorded per local calendar date
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
          </div>

          <div
            className="grid gap-2 items-end h-44 pt-4 border-b border-[var(--border-subtle)]"
            style={{
              gridTemplateColumns: `repeat(${displayedTrends.length}, minmax(0, 1fr))`,
            }}
          >
            {displayedTrends.map((d) => {
              const pct = Math.round((d.completedTasks / maxTaskCount) * 100);
              return (
                <div
                  key={d.date}
                  className="flex flex-col items-center justify-end h-full gap-1.5"
                >
                  <span className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)]">
                    {d.completedTasks}
                  </span>
                  <div className="w-full flex items-end justify-center h-28">
                    <div
                      title={`${d.completedTasks} tasks completed on ${d.date}`}
                      className="w-full max-w-[24px] bg-[var(--accent-primary)] transition-all duration-300"
                      style={{ height: `${Math.max(6, pct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] pb-1.5 truncate max-w-full">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Focus-Time Trend */}
        <section className="lg:col-span-6 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Focus-Time Accumulation ({horizon})
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Minutes spent in verified Pomodoro work intervals
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
              Goal: {dashboard.stats.dailyFocusGoalMinutes}m / day
            </span>
          </div>

          <div
            className="grid gap-2 items-end h-44 pt-4 border-b border-[var(--border-subtle)]"
            style={{
              gridTemplateColumns: `repeat(${displayedTrends.length}, minmax(0, 1fr))`,
            }}
          >
            {displayedTrends.map((d) => {
              const pct = Math.round((d.focusMinutes / maxFocusMins) * 100);
              return (
                <div
                  key={d.date}
                  className="flex flex-col items-center justify-end h-full gap-1.5"
                >
                  <span className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)]">
                    {d.focusMinutes}m
                  </span>
                  <div className="w-full flex items-end justify-center h-28">
                    <div
                      title={`${d.focusMinutes} focus minutes on ${d.date}`}
                      className="w-full max-w-[24px] bg-[var(--status-success)] transition-all duration-300"
                      style={{ height: `${Math.max(6, pct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] pb-1.5 truncate max-w-full">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Category Distribution & Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Category Distribution */}
        <section className="lg:col-span-7 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <div className="border-b border-[var(--border-subtle)] pb-3 mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Category Distribution & Completion Breakdown
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Task allocation and completion ratio across workspace categories
            </p>
          </div>

          <div className="space-y-3.5">
            {categoryDistribution.map((cat) => {
              const pct =
                totalActiveTasks > 0
                  ? Math.round((cat.total / totalActiveTasks) * 100)
                  : 0;
              const compPct =
                cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;

              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                      <span
                        className="w-2.5 h-2.5 inline-block"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                      {cat.completed}/{cat.total} completed ({compPct}%) · {pct}%
                      of workspace
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[var(--bg-main)] overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.max(cat.total > 0 ? 4 : 0, pct)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Priority Distribution */}
        <section className="lg:col-span-5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
          <div className="border-b border-[var(--border-subtle)] pb-3 mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Priority Stratification
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Completed vs. pending workload by priority level
            </p>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {priorityDistribution.map((p) => {
              const compRatio =
                p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              return (
                <div key={p.priority} className="py-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {p.priority} Priority
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                      {p.total} total ({p.completed} completed · {p.pending}{' '}
                      pending)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--bg-main)] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        p.priority === 'High'
                          ? 'bg-[var(--status-warning)]'
                          : p.priority === 'Medium'
                            ? 'bg-[var(--accent-primary)]'
                            : 'bg-[var(--status-success)]'
                      }`}
                      style={{ width: `${compRatio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
