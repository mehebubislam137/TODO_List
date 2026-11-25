import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Timer,
  X,
} from 'lucide-react';
import { FocusSessionRecord, UserPreferences } from '../services/api';
import { formatLocalDate, TaskItem } from '../utils/taskLogic';
import { previewAlarmSound } from '../utils/alarmAudio';

interface FocusModeViewProps {
  tasks: TaskItem[];
  selectedTask: TaskItem | null;
  preferences: UserPreferences;
  focusSessions: FocusSessionRecord[];
  onSelectTask: (task: TaskItem | null) => void;
  onRecordSession: (payload: {
    taskId?: string | null;
    sessionType: 'work' | 'short_break' | 'long_break';
    plannedDurationSeconds: number;
    actualDurationSeconds: number;
    startedAt: string;
    endedAt: string;
    completionStatus: 'completed' | 'interrupted' | 'skipped';
  }) => Promise<void>;
  onToggleSubtask: (
    taskId: string,
    subtaskId: string,
    isCompleted: boolean
  ) => Promise<void>;
  onUpdatePreferences: (next: Partial<UserPreferences>) => Promise<void>;
  onExitFocusMode: () => void;
}

export const FocusModeView: React.FC<FocusModeViewProps> = ({
  tasks,
  selectedTask,
  preferences,
  focusSessions,
  onSelectTask,
  onRecordSession,
  onToggleSubtask,
  onUpdatePreferences,
  onExitFocusMode,
}) => {
  const activeTasks = tasks.filter(
    (t) => !t.deletedAt && !t.isArchived && t.status !== 'Completed'
  );

  const [sessionType, setSessionType] = useState<
    'work' | 'short_break' | 'long_break'
  >('work');
  const [completedWorkCount, setCompletedWorkCount] = useState(0);

  const [workMinsDraft, setWorkMinsDraft] = useState<number>(
    preferences.workDurationMinutes || 25
  );
  const [shortBreakDraft, setShortBreakDraft] = useState<number>(
    preferences.shortBreakMinutes || 5
  );
  const [longBreakDraft, setLongBreakDraft] = useState<number>(
    preferences.longBreakMinutes || 15
  );
  const [showCustomTiming, setShowCustomTiming] = useState<boolean>(false);
  const [savingTiming, setSavingTiming] = useState<boolean>(false);
  const [timingSavedNote, setTimingSavedNote] = useState<string | null>(null);

  const getPlannedSeconds = (type: 'work' | 'short_break' | 'long_break') => {
    if (type === 'work') return Math.max(1, workMinsDraft || 25) * 60;
    if (type === 'short_break')
      return Math.max(1, shortBreakDraft || 5) * 60;
    return Math.max(1, longBreakDraft || 15) * 60;
  };

  const [plannedSeconds, setPlannedSeconds] = useState<number>(() =>
    getPlannedSeconds('work')
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [sessionStartIso, setSessionStartIso] = useState<string | null>(null);

  const runAnchorTimestampRef = useRef<number | null>(null);
  const accumulatedBeforePauseRef = useRef<number>(0);

  useEffect(() => {
    setWorkMinsDraft(preferences.workDurationMinutes || 25);
    setShortBreakDraft(preferences.shortBreakMinutes || 5);
    setLongBreakDraft(preferences.longBreakMinutes || 15);
  }, [
    preferences.workDurationMinutes,
    preferences.shortBreakMinutes,
    preferences.longBreakMinutes,
  ]);

  useEffect(() => {
    const nextPlanned = getPlannedSeconds(sessionType);
    setPlannedSeconds(nextPlanned);
    setElapsedSeconds(0);
    setIsRunning(false);
    runAnchorTimestampRef.current = null;
    accumulatedBeforePauseRef.current = 0;
    setSessionStartIso(null);
  }, [sessionType, workMinsDraft, shortBreakDraft, longBreakDraft]);

  const applyQuickMinutesForCurrentMode = async (
    minutes: number,
    persist: boolean = true
  ) => {
    const clamped = Math.max(1, Math.min(180, minutes));
    setIsRunning(false);
    runAnchorTimestampRef.current = null;
    accumulatedBeforePauseRef.current = 0;
    setElapsedSeconds(0);
    setSessionStartIso(null);
    setPlannedSeconds(clamped * 60);

    if (sessionType === 'work') {
      setWorkMinsDraft(clamped);
      if (persist) {
        await onUpdatePreferences({ workDurationMinutes: clamped });
      }
    } else if (sessionType === 'short_break') {
      setShortBreakDraft(clamped);
      if (persist) {
        await onUpdatePreferences({ shortBreakMinutes: clamped });
      }
    } else {
      setLongBreakDraft(clamped);
      if (persist) {
        await onUpdatePreferences({ longBreakMinutes: clamped });
      }
    }
    setTimingSavedNote(`Timer set to ${clamped}m`);
    window.setTimeout(() => setTimingSavedNote(null), 2500);
  };

  const handleSaveCustomTimings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTiming(true);
    try {
      const nextWork = Math.max(1, Math.min(180, Number(workMinsDraft) || 25));
      const nextShort = Math.max(1, Math.min(60, Number(shortBreakDraft) || 5));
      const nextLong = Math.max(1, Math.min(90, Number(longBreakDraft) || 15));
      setWorkMinsDraft(nextWork);
      setShortBreakDraft(nextShort);
      setLongBreakDraft(nextLong);
      await onUpdatePreferences({
        workDurationMinutes: nextWork,
        shortBreakMinutes: nextShort,
        longBreakMinutes: nextLong,
      });
      setTimingSavedNote('Focus timings saved');
      window.setTimeout(() => setTimingSavedNote(null), 2500);
    } finally {
      setSavingTiming(false);
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      if (runAnchorTimestampRef.current !== null) {
        const deltaSecs = Math.floor(
          (Date.now() - runAnchorTimestampRef.current) / 1000
        );
        const totalElapsed = Math.min(
          plannedSeconds,
          accumulatedBeforePauseRef.current + deltaSecs
        );
        setElapsedSeconds(totalElapsed);
        if (totalElapsed >= plannedSeconds) {
          handleCompleteCurrentSession(totalElapsed);
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isRunning, plannedSeconds]);

  const handleStartOrResume = () => {
    if (!sessionStartIso) {
      setSessionStartIso(new Date().toISOString());
    }
    runAnchorTimestampRef.current = Date.now();
    setIsRunning(true);
  };

  const handlePause = () => {
    if (runAnchorTimestampRef.current !== null) {
      const deltaSecs = Math.floor(
        (Date.now() - runAnchorTimestampRef.current) / 1000
      );
      accumulatedBeforePauseRef.current = Math.min(
        plannedSeconds,
        accumulatedBeforePauseRef.current + deltaSecs
      );
      setElapsedSeconds(accumulatedBeforePauseRef.current);
    }
    runAnchorTimestampRef.current = null;
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    runAnchorTimestampRef.current = null;
    accumulatedBeforePauseRef.current = 0;
    setElapsedSeconds(0);
    setSessionStartIso(null);
  };

  const handleCompleteCurrentSession = async (overrideElapsed?: number) => {
    setIsRunning(false);
    runAnchorTimestampRef.current = null;
    const actualSecs = Math.max(
      60,
      overrideElapsed !== undefined ? overrideElapsed : elapsedSeconds || plannedSeconds
    );
    const endedIso = new Date().toISOString();
    const startedIso =
      sessionStartIso ||
      new Date(Date.now() - actualSecs * 1000).toISOString();

    await onRecordSession({
      taskId: selectedTask?.id || null,
      sessionType,
      plannedDurationSeconds: plannedSeconds,
      actualDurationSeconds: actualSecs,
      startedAt: startedIso,
      endedAt: endedIso,
      completionStatus: 'completed',
    });

    if (preferences.soundEnabled) {
      previewAlarmSound('chime');
    }

    if (sessionType === 'work') {
      const nextCount = completedWorkCount + 1;
      setCompletedWorkCount(nextCount);
      const targetSessions = preferences.sessionsBeforeLongBreak || 4;
      if (nextCount % targetSessions === 0) {
        setSessionType('long_break');
      } else {
        setSessionType('short_break');
      }
    } else {
      setSessionType('work');
    }
  };

  const handleSkipBreak = () => {
    setSessionType('work');
  };

  const remainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
  const formatMMSS = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPct =
    plannedSeconds > 0
      ? Math.min(100, Math.round((elapsedSeconds / plannedSeconds) * 100))
      : 0;

  const todayStr = formatLocalDate(new Date());
  const completedWorkSessions = focusSessions.filter(
    (s) => s.sessionType === 'work' && s.completionStatus === 'completed'
  );
  const totalFocusMinutes = Math.round(
    completedWorkSessions.reduce((acc, s) => acc + s.actualDurationSeconds, 0) /
      60
  );
  const todayFocusMinutes = Math.round(
    completedWorkSessions
      .filter((s) => formatLocalDate(new Date(s.startedAt)) === todayStr)
      .reduce((acc, s) => acc + s.actualDurationSeconds, 0) / 60
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Top Distraction-Free Instrument Header */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Timer className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Focus Mode & Pomodoro Instrument
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Timestamp-synchronized interval timer · Long break every{' '}
              {preferences.sessionsBeforeLongBreak} work sessions
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onExitFocusMode}
          className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <X className="w-3.5 h-3.5" /> Exit Focus Mode
        </button>
      </div>

      {/* Main Instrument Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Precision Timer Console */}
        <div className="lg:col-span-7 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div className="flex flex-wrap items-center border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-0.5">
              {(
                [
                  { id: 'work', label: `Work (${workMinsDraft}m)` },
                  {
                    id: 'short_break',
                    label: `Short Break (${shortBreakDraft}m)`,
                  },
                  {
                    id: 'long_break',
                    label: `Long Break (${longBreakDraft}m)`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSessionType(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    sessionType === tab.id
                      ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                Cycle {completedWorkCount % (preferences.sessionsBeforeLongBreak || 4)}{' '}
                / {preferences.sessionsBeforeLongBreak || 4}
              </span>
              <button
                type="button"
                onClick={() => setShowCustomTiming((v) => !v)}
                aria-expanded={showCustomTiming}
                className={`border px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  showCustomTiming
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Set Timing
              </button>
            </div>
          </div>

          {/* Quick Duration Presets + Inline Custom Timing Set */}
          <div className="pt-3.5 space-y-3 border-b border-[var(--border-subtle)] pb-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono text-[var(--text-muted)] mr-1">
                  QUICK SET:
                </span>
                {(sessionType === 'work'
                  ? [15, 25, 45, 60, 90]
                  : sessionType === 'short_break'
                    ? [5, 10, 15]
                    : [15, 20, 30]
                ).map((mins) => {
                  const activeMins = Math.round(plannedSeconds / 60);
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => applyQuickMinutesForCurrentMode(mins, true)}
                      className={`border px-2.5 py-1 text-xs font-mono tabular-nums transition-colors ${
                        activeMins === mins
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-semibold'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {mins}m
                    </button>
                  );
                })}
              </div>
              {timingSavedNote && (
                <span className="text-[11px] font-mono text-[var(--status-success)] flex items-center gap-1">
                  <Check className="w-3 h-3" /> {timingSavedNote}
                </span>
              )}
            </div>

            {showCustomTiming && (
              <form
                onSubmit={handleSaveCustomTimings}
                className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end text-xs"
              >
                <div>
                  <label
                    htmlFor="focus-work-mins"
                    className="block text-[11px] text-[var(--text-secondary)] mb-1"
                  >
                    Work (min)
                  </label>
                  <input
                    id="focus-work-mins"
                    type="number"
                    min={1}
                    max={180}
                    value={workMinsDraft}
                    onChange={(e) =>
                      setWorkMinsDraft(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 font-mono text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="focus-short-mins"
                    className="block text-[11px] text-[var(--text-secondary)] mb-1"
                  >
                    Short Break
                  </label>
                  <input
                    id="focus-short-mins"
                    type="number"
                    min={1}
                    max={60}
                    value={shortBreakDraft}
                    onChange={(e) =>
                      setShortBreakDraft(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 font-mono text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="focus-long-mins"
                    className="block text-[11px] text-[var(--text-secondary)] mb-1"
                  >
                    Long Break
                  </label>
                  <input
                    id="focus-long-mins"
                    type="number"
                    min={1}
                    max={90}
                    value={longBreakDraft}
                    onChange={(e) =>
                      setLongBreakDraft(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 font-mono text-[var(--text-primary)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingTiming}
                  className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                >
                  {savingTiming ? 'Saving...' : 'Save Timing'}
                </button>
              </form>
            )}
          </div>

          <div className="my-8 text-center space-y-3">
            <div
              className="text-6xl sm:text-7xl font-bold font-mono tabular-nums tracking-tight text-[var(--text-primary)]"
              data-testid="pomodoro-remaining-time"
            >
              {formatMMSS(remainingSeconds)}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs font-mono tabular-nums text-[var(--text-secondary)]">
              <span>Elapsed: {formatMMSS(elapsedSeconds)}</span>
              <span aria-hidden="true">·</span>
              <span>Remaining: {formatMMSS(remainingSeconds)}</span>
              <span aria-hidden="true">·</span>
              <span>{progressPct}%</span>
            </div>
            <div className="max-w-md mx-auto h-1.5 bg-[var(--bg-main)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-[var(--border-subtle)]">
            {!isRunning ? (
              <button
                type="button"
                onClick={handleStartOrResume}
                className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-6 py-2.5 text-xs font-semibold hover:opacity-90 flex items-center gap-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                {elapsedSeconds > 0 ? 'Resume Timer' : 'Start Focus Session'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="border border-[var(--accent-primary)] bg-[var(--bg-secondary)] px-6 py-2.5 text-xs font-semibold text-[var(--accent-primary)] flex items-center gap-2 whitespace-nowrap"
              >
                <Pause className="w-4 h-4" /> Pause Timer
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>

            <button
              type="button"
              onClick={() => handleCompleteCurrentSession()}
              className="border border-[var(--status-success)] px-4 py-2.5 text-xs font-medium text-[var(--status-success)] hover:bg-[var(--status-success)]/10 flex items-center gap-1.5 whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Complete Session
            </button>

            {sessionType !== 'work' && (
              <button
                type="button"
                onClick={handleSkipBreak}
                className="border border-[var(--border-subtle)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 whitespace-nowrap"
              >
                <FastForward className="w-3.5 h-3.5" /> Skip Break
              </button>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Active Task Inspector & Subtask Checklist */}
        <div className="lg:col-span-5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="focus-task-selector"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
              >
                Selected Task for Focus Session
              </label>
              <select
                id="focus-task-selector"
                value={selectedTask?.id || ''}
                onChange={(e) => {
                  const found =
                    activeTasks.find((t) => t.id === e.target.value) || null;
                  onSelectTask(found);
                }}
                className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="">General Unassigned Deep Work</option>
                {activeTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.priority})
                  </option>
                ))}
              </select>
            </div>

            {selectedTask ? (
              <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-3">
                <div>
                  <div className="text-xs font-mono text-[var(--text-secondary)]">
                    {selectedTask.categoryName || 'Uncategorized'} ·{' '}
                    {selectedTask.priority} Priority ·{' '}
                    {selectedTask.dueDate || 'No deadline'}
                  </div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)] mt-1">
                    {selectedTask.title}
                  </h2>
                  {selectedTask.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      {selectedTask.description}
                    </p>
                  )}
                </div>

                {selectedTask.subtasks.length > 0 && (
                  <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
                    <div className="text-xs font-medium text-[var(--text-secondary)]">
                      Subtasks (
                      {
                        selectedTask.subtasks.filter((s) => s.isCompleted)
                          .length
                      }
                      /{selectedTask.subtasks.length})
                    </div>
                    {selectedTask.subtasks.map((st) => (
                      <label
                        key={st.id}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={st.isCompleted}
                          onChange={(e) =>
                            onToggleSubtask(
                              selectedTask.id,
                              st.id,
                              e.target.checked
                            )
                          }
                          className="accent-[var(--accent-primary)]"
                        />
                        <span
                          className={
                            st.isCompleted
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-primary)]'
                          }
                        >
                          {st.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]">
                Select an active task above to bind your Pomodoro intervals and
                subtasks directly to that deliverable.
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4 grid grid-cols-3 gap-3 text-center">
            <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">Today Focus</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-0.5">
                {todayFocusMinutes}m
              </div>
            </div>
            <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">Total Focus</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                {totalFocusMinutes}m
              </div>
            </div>
            <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">Sessions</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--status-success)] mt-0.5">
                {completedWorkSessions.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persisted Focus Session History Table */}
      <section className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Persisted Focus Session History
          </h2>
          <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
            {focusSessions.length} recorded sessions
          </span>
        </div>
        {focusSessions.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            No focus sessions recorded yet. Complete a session above to log it to
            PostgreSQL.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono">
                <tr>
                  <th className="py-2.5 px-4">Associated Task</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Planned</th>
                  <th className="py-2.5 px-4 text-right">Actual</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                  <th className="py-2.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {focusSessions.slice(0, 12).map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--bg-secondary)]/50">
                    <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">
                      {s.taskTitle}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[var(--text-secondary)]">
                      {s.sessionType.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {Math.round(s.plannedDurationSeconds / 60)}m
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {Math.max(1, Math.round(s.actualDurationSeconds / 60))}m
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[var(--status-success)]">
                      {s.completionStatus}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[var(--text-muted)]">
                      {formatLocalDate(new Date(s.startedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
