// TASKFLOW Settings & Workspace Governance View
import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  Database,
  Download,
  Keyboard,
  Music,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Volume2,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { api, setAccessToken, UserPreferences } from '../services/api';
import { CategoryItem, TaskPriority } from '../utils/taskLogic';
import {
  ACCENT_SWATCHES,
  buildThemeVariables,
  THEME_PRESETS,
  ThemePresetDefinition,
} from '../utils/themeEngine';
import {
  getNotificationPermissionState,
  previewAlarmSound,
  readAudioFileAsDataUrl,
  requestAlarmNotificationPermission,
} from '../utils/alarmAudio';

interface SettingsViewProps {
  preferences: UserPreferences;
  categories: CategoryItem[];
  workspaceUser: {
    uid: string;
    email: string;
    isAnonymous: boolean;
  };
  onSavePreferences: (next: Partial<UserPreferences>) => Promise<void>;
  onWorkspaceReload: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  categories,
  workspaceUser,
  onSavePreferences,
  onWorkspaceReload,
}) => {
  const [form, setForm] = useState<UserPreferences>(preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState(() =>
    getNotificationPermissionState()
  );
  const defaultAudioInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm(preferences);
  }, [preferences]);

  const themePreviewBundle = buildThemeVariables(
    form.themePreset,
    form.accentColor,
    form.theme
  );

  const handleSelectThemePreset = async (preset: ThemePresetDefinition) => {
    const nextPatch: Partial<UserPreferences> = {
      theme: preset.mode,
      themePreset: preset.id,
      accentColor: preset.defaultAccent,
    };
    const nextForm = { ...form, ...nextPatch };
    setForm(nextForm);
    await onSavePreferences(nextPatch);
  };

  const handleSelectAccentColor = async (hex: string) => {
    const nextForm = { ...form, accentColor: hex };
    setForm(nextForm);
    await onSavePreferences({ accentColor: hex });
  };

  const handleDefaultAlarmAudioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setAudioUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { name, dataUrl } = await readAudioFileAsDataUrl(file);
      const patch = {
        customAlarmAudioData: dataUrl,
        customAlarmAudioName: name,
      };
      setForm((prev) => ({ ...prev, ...patch }));
      await onSavePreferences(patch);
      previewAlarmSound('custom', dataUrl);
      setSavedBanner(`Saved custom gallery ringtone "${name}".`);
    } catch (err: any) {
      setAudioUploadError(err.message || 'Could not load audio file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleEnableBrowserNotifications = async () => {
    const next = await requestAlarmNotificationPermission();
    setNotifPermission(next);
    if (next === 'granted') {
      setSavedBanner('Desktop alarm notifications enabled.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedBanner(null);
    try {
      await onSavePreferences(form);
      setSavedBanner('Preferences saved and persisted to PostgreSQL.');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTasksJson = async () => {
    setExportStatus('Preparing tasks JSON export...');
    try {
      const data = await api.exportTasks();
      triggerDownload(
        `taskflow-tasks-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2),
        'application/json'
      );
      setExportStatus(`Exported ${data.count} tasks as JSON.`);
    } catch (err: any) {
      setExportStatus(err.message || 'Export failed');
    }
  };

  const handleExportTasksCsv = async () => {
    setExportStatus('Preparing tasks CSV export...');
    try {
      const data = await api.exportTasks();
      const rows = data.tasks || [];
      const headers = [
        'id',
        'title',
        'priority',
        'status',
        'categoryName',
        'dueDate',
        'dueTime',
        'isImportant',
        'isArchived',
        'createdAt',
        'completedAt',
      ];
      const csvLines = [
        headers.join(','),
        ...rows.map((r: any) =>
          headers
            .map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`)
            .join(',')
        ),
      ];
      triggerDownload(
        `taskflow-tasks-${new Date().toISOString().slice(0, 10)}.csv`,
        csvLines.join('\n'),
        'text/csv'
      );
      setExportStatus(`Exported ${rows.length} tasks as CSV.`);
    } catch (err: any) {
      setExportStatus(err.message || 'CSV export failed');
    }
  };

  const handleExportWorkspaceBackup = async () => {
    setExportStatus('Generating full PostgreSQL workspace backup...');
    try {
      const data = await api.exportWorkspace();
      triggerDownload(
        `taskflow-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2),
        'application/json'
      );
      setExportStatus('Full workspace backup downloaded.');
    } catch (err: any) {
      setExportStatus(err.message || 'Backup download failed');
    }
  };

  const handleOptionalGoogleLink = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setAccessToken(token);
      await onWorkspaceReload();
      setSavedBanner(`Switched to verified Google workspace (${cred.user.email}).`);
    } catch (err: any) {
      setExportStatus(
        err.message || 'Google Sign-In popup closed or unavailable in this browser.'
      );
    }
  };

  const shortcuts = [
    { key: 'Alt + Left / Right', desc: 'Navigate Back / Forward between views' },
    { key: 'G then D / R / T', desc: 'Jump to Dashboard / Daily Tasks / All Tasks' },
    { key: 'G then C / F / A / S', desc: 'Jump to Calendar / Focus / Analytics / Settings' },
    { key: 'Ctrl + Z / Ctrl + Y', desc: 'Undo / Redo last task action' },
    { key: 'Ctrl + K', desc: 'Open Quick Search' },
    { key: 'N / Q', desc: 'Create Task / Smart Quick Add parser' },
    { key: '/', desc: 'Focus search input in My Tasks' },
    { key: 'Ctrl + Enter', desc: 'Save task when inside Task Modal' },
    { key: 'Esc', desc: 'Dismiss active modal or quick search' },
    { key: '?', desc: 'Open keyboard shortcuts cheat sheet' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Workspace Settings & Data Governance
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Configure customizable themes with automatic WCAG contrast, alarm audio
            gallery defaults, Pomodoro timers, and workspace backups.
          </p>
        </div>
        {savedBanner && (
          <div className="border border-[var(--status-success)] bg-[var(--status-success)]/10 px-3.5 py-1.5 text-xs text-[var(--status-success)] flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> {savedBanner}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Appearance, Task Preferences, Calendar, Focus, Alarm Gallery */}
          <div className="lg:col-span-7 space-y-6">
            {/* Appearance & Customizable Themes with Auto-Contrast */}
            <section className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 space-y-5">
              <div className="border-b border-[var(--border-subtle)] pb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
                  1. Customizable Themes & Automatic Contrast
                </h2>
                <span className="font-mono text-[11px] text-[var(--status-success)] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Text {themePreviewBundle.metrics.textContrastRatio}:1 · Accent{' '}
                  {themePreviewBundle.metrics.accentContrastRatio}:1 · WCAG{' '}
                  {themePreviewBundle.metrics.wcagGrade}
                </span>
              </div>

              {/* Theme Preset Swatches */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  Theme Presets
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {THEME_PRESETS.map((preset) => {
                    const isSelected = form.themePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectThemePreset(preset)}
                        className={`border p-3 text-left transition-colors flex items-start gap-3 ${
                          isSelected
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)]'
                        }`}
                      >
                        <div
                          className="w-10 h-10 shrink-0 border flex flex-col justify-between p-1"
                          style={{
                            backgroundColor: preset.bgMain,
                            borderColor: preset.borderSubtle,
                          }}
                        >
                          <span
                            className="block h-1.5 w-6"
                            style={{ backgroundColor: preset.textPrimary }}
                          />
                          <span
                            className="block h-2 w-full"
                            style={{ backgroundColor: preset.defaultAccent }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-[var(--text-primary)]">
                              {preset.name}
                            </span>
                            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                              {preset.mode}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                            {preset.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color Customization with Auto-Contrast Adjustment */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Accent Color (Auto-adjusted for sharp text legibility)
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    Surface {form.accentColor} → Text Ink{' '}
                    {themePreviewBundle.variables['--accent-primary']}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_SWATCHES.map((swatch) => {
                    const active =
                      form.accentColor?.toUpperCase() ===
                      swatch.hex.toUpperCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => handleSelectAccentColor(swatch.hex)}
                        title={swatch.name}
                        aria-label={`Set accent color to ${swatch.name}`}
                        className={`w-7 h-7 border flex items-center justify-center transition-transform ${
                          active
                            ? 'border-[var(--text-primary)] scale-110'
                            : 'border-[var(--border-subtle)] hover:scale-105'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {active && (
                          <Check
                            className="w-3.5 h-3.5"
                            style={{
                              color:
                                themePreviewBundle.variables['--accent-contrast'],
                            }}
                          />
                        )}
                      </button>
                    );
                  })}

                  <label className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1 text-xs text-[var(--text-primary)] flex items-center gap-2 cursor-pointer">
                    <input
                      type="color"
                      aria-label="Pick custom accent color"
                      value={form.accentColor || '#C6F36B'}
                      onChange={(e) => handleSelectAccentColor(e.target.value)}
                      className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-[11px]">Custom</span>
                  </label>
                </div>
              </div>
            </section>

            {/* Task & Calendar Preferences */}
            <section className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  2. Task & Calendar Preferences
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label
                    htmlFor="pref-default-priority"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Default Task Priority
                  </label>
                  <select
                    id="pref-default-priority"
                    value={form.defaultPriority}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        defaultPriority: e.target.value as TaskPriority,
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-primary)]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="pref-default-view"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Default Task View Mode
                  </label>
                  <select
                    id="pref-default-view"
                    value={form.defaultTaskView}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        defaultTaskView: e.target.value as
                          | 'list'
                          | 'grid'
                          | 'kanban',
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-primary)]"
                  >
                    <option value="list">List View</option>
                    <option value="grid">Grid View</option>
                    <option value="kanban">Kanban Board</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="pref-default-cat"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Default Category
                  </label>
                  <select
                    id="pref-default-cat"
                    value={form.defaultCategoryId || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        defaultCategoryId: e.target.value || null,
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-primary)]"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="pref-week-start"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Week-Start Preference
                  </label>
                  <select
                    id="pref-week-start"
                    value={form.weekStart}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weekStart: e.target.value as 'monday' | 'sunday',
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-primary)]"
                  >
                    <option value="monday">Monday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="pref-cal-view"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Default Calendar View
                  </label>
                  <select
                    id="pref-cal-view"
                    value={form.calendarView}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        calendarView: e.target.value as 'month' | 'week' | 'day',
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-primary)]"
                  >
                    <option value="month">Monthly</option>
                    <option value="week">Weekly</option>
                    <option value="day">Daily</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="pref-timezone"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Timezone Preference
                  </label>
                  <input
                    id="pref-timezone"
                    type="text"
                    value={form.timezone}
                    onChange={(e) =>
                      setForm({ ...form, timezone: e.target.value })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </section>

            {/* Focus & Productivity Targets */}
            <section className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  3. Focus Timer & Daily Productivity Targets
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label
                    htmlFor="pref-work-mins"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Work Duration (mins)
                  </label>
                  <input
                    id="pref-work-mins"
                    type="number"
                    min={1}
                    max={180}
                    value={form.workDurationMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        workDurationMinutes: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pref-short-break"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Short Break (mins)
                  </label>
                  <input
                    id="pref-short-break"
                    type="number"
                    min={1}
                    max={60}
                    value={form.shortBreakMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        shortBreakMinutes: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pref-long-break"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Long Break (mins)
                  </label>
                  <input
                    id="pref-long-break"
                    type="number"
                    min={1}
                    max={90}
                    value={form.longBreakMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        longBreakMinutes: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pref-sessions-before-long"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Sessions Before Long Break
                  </label>
                  <input
                    id="pref-sessions-before-long"
                    type="number"
                    min={1}
                    max={12}
                    value={form.sessionsBeforeLongBreak}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sessionsBeforeLongBreak: Math.max(
                          1,
                          Number(e.target.value)
                        ),
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pref-daily-target"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Daily Task Target
                  </label>
                  <input
                    id="pref-daily-target"
                    type="number"
                    min={1}
                    max={50}
                    value={form.dailyTaskTarget}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        dailyTaskTarget: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pref-focus-goal"
                    className="block text-[var(--text-secondary)] mb-1"
                  >
                    Daily Focus Goal (mins)
                  </label>
                  <input
                    id="pref-focus-goal"
                    type="number"
                    min={10}
                    max={720}
                    value={form.dailyFocusGoalMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        dailyFocusGoalMinutes: Math.max(
                          10,
                          Number(e.target.value)
                        ),
                      })
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[var(--border-subtle)]">
                <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.soundEnabled}
                    onChange={(e) =>
                      setForm({ ...form, soundEnabled: e.target.checked })
                    }
                    className="accent-[var(--accent-primary)]"
                  />
                  Enable timer completion audio notification
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-5 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save All Preferences'}
                </button>
              </div>
            </section>

            {/* Alarm Notifications & Custom Gallery Audio Default */}
            <section className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[var(--accent-primary)]" />
                  Alarm Notifications & Custom Audio Gallery
                </h2>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  Desktop Alerts: {notifPermission}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3.5 text-xs">
                <div>
                  <div className="font-medium text-[var(--text-primary)]">
                    Browser Desktop Notifications
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Receive system notifications alongside your alarm ringtone when a
                    task alarm fires.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEnableBrowserNotifications}
                  disabled={
                    notifPermission === 'granted' ||
                    notifPermission === 'unsupported'
                  }
                  className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50 whitespace-nowrap"
                >
                  {notifPermission === 'granted'
                    ? 'Notifications Enabled'
                    : notifPermission === 'unsupported'
                      ? 'Not Supported'
                      : 'Enable Desktop Alerts'}
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="font-medium text-[var(--text-primary)]">
                  Saved Custom Gallery Alarm Ringtone
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Upload an MP3, WAV, OGG, or M4A ringtone from your device gallery to
                  reuse quickly across any task alarm.
                </p>
                <input
                  ref={defaultAudioInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                  onChange={handleDefaultAlarmAudioUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => defaultAudioInputRef.current?.click()}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Choose Audio from Gallery
                  </button>

                  {form.customAlarmAudioData && form.customAlarmAudioName && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          previewAlarmSound('custom', form.customAlarmAudioData)
                        }
                        className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const patch = {
                            customAlarmAudioData: null,
                            customAlarmAudioName: null,
                          };
                          setForm((prev) => ({ ...prev, ...patch }));
                          await onSavePreferences(patch);
                        }}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--status-danger)] px-2"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>

                {form.customAlarmAudioName && (
                  <div className="flex items-center gap-2 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs font-mono text-[var(--accent-primary)]">
                    <Music className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{form.customAlarmAudioName}</span>
                  </div>
                )}

                {audioUploadError && (
                  <p className="text-xs text-[var(--status-danger)]">
                    {audioUploadError}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Right 5 Cols: Data Management, Workspace Identity & Keyboard Shortcuts */}
          <div className="lg:col-span-5 space-y-6">
            {/* Data Management & Backups */}
            <section className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Database className="w-4 h-4 text-[var(--accent-primary)]" />
                  4. Data Management & Export
                </h2>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleExportTasksJson}
                  className="w-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center justify-between"
                >
                  <span>Export Tasks (JSON)</span>
                  <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                </button>

                <button
                  type="button"
                  onClick={handleExportTasksCsv}
                  className="w-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center justify-between"
                >
                  <span>Export Tasks Spreadsheet (CSV)</span>
                  <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                </button>

                <button
                  type="button"
                  onClick={handleExportWorkspaceBackup}
                  className="w-full bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-4 py-2.5 text-xs font-semibold hover:opacity-90 flex items-center justify-between"
                >
                  <span>Download Complete Workspace Backup (JSON)</span>
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              {exportStatus && (
                <div className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs font-mono text-[var(--text-secondary)]">
                  {exportStatus}
                </div>
              )}

              {/* Workspace Information & Anonymous Recovery Notice */}
              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2.5 text-xs">
                <div className="font-semibold text-[var(--text-primary)]">
                  Workspace Isolation Identity
                </div>
                <div className="font-mono text-[11px] bg-[var(--bg-main)] border border-[var(--border-subtle)] p-2.5 space-y-1 text-[var(--text-secondary)]">
                  <div>UID: {workspaceUser.uid}</div>
                  <div>
                    Mode:{' '}
                    {workspaceUser.isAnonymous
                      ? 'Isolated Anonymous Session'
                      : `Verified (${workspaceUser.email})`}
                  </div>
                </div>

                <div className="border border-[var(--status-warning)]/50 bg-[var(--status-warning)]/10 p-3 space-y-1.5 text-[var(--text-secondary)]">
                  <div className="font-semibold text-[var(--status-warning)] flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Anonymous Workspace Recovery Limitations
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    TASKFLOW opens directly into an isolated anonymous workspace
                    without requiring registration. All records are strictly scoped to
                    your authenticated UID in PostgreSQL. Because anonymous sessions
                    are bound to your current browser session, clearing browser
                    session data or switching devices creates a fresh anonymous UID.
                    Download regular JSON backups above or optionally bind a Google
                    account below for cross-device access.
                  </p>
                  {workspaceUser.isAnonymous && (
                    <button
                      type="button"
                      onClick={handleOptionalGoogleLink}
                      className="mt-2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    >
                      Optional: Sync with Google Workspace Account
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Keyboard Shortcuts Reference */}
            <section className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-[var(--accent-primary)]" />
                  5. Keyboard Shortcuts
                </h2>
              </div>
              <div className="divide-y divide-[var(--border-subtle)] text-xs">
                {shortcuts.map((s) => (
                  <div
                    key={s.key}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <span className="text-[var(--text-secondary)]">{s.desc}</span>
                    <kbd className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[var(--text-primary)]">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
};
