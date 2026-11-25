import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSmartQuickAdd,
  isTaskOverdue,
  calculateProgressStreak,
  generateDailyBriefing,
  calculateNextOccurrenceDate,
  validateTaskInput,
  getTaskAlarmTriggerTime,
  formatAlarmRingTime,
  shouldTaskAlarmRing,
  needsDailyReset,
  getTimeUntilMidnight,
  computeSubtaskProgress,
  reorderTasksList,
  TaskItem,
} from './taskLogic';
import {
  adjustAccentForBackground,
  buildThemeVariables,
  getContrastRatio,
  getOptimalTextColor,
  THEME_PRESETS,
} from './themeEngine';

test('parseSmartQuickAdd extracts title, tomorrow date, 6 PM time, #College category, and !High priority', () => {
  const refDate = new Date(2026, 10, 24, 10, 0, 0); // Nov 24, 2026
  const parsed = parseSmartQuickAdd(
    'Complete DBMS assignment tomorrow at 6 PM #College !High',
    refDate
  );

  assert.equal(parsed.title, 'Complete DBMS assignment');
  assert.equal(parsed.dueDate, '2026-11-25');
  assert.equal(parsed.dueTime, '18:00');
  assert.equal(parsed.categoryName, 'College');
  assert.equal(parsed.priority, 'High');
});

test('parseSmartQuickAdd handles tags, importance, and recurrence', () => {
  const refDate = new Date(2026, 10, 24, 10, 0, 0);
  const parsed = parseSmartQuickAdd(
    'Review quarterly metrics today at 9:30 AM #Work +finance +q4 *important every week',
    refDate
  );

  assert.equal(parsed.title, 'Review quarterly metrics');
  assert.equal(parsed.dueDate, '2026-11-24');
  assert.equal(parsed.dueTime, '09:30');
  assert.equal(parsed.categoryName, 'Work');
  assert.deepEqual(parsed.tags, ['finance', 'q4']);
  assert.equal(parsed.isImportant, true);
  assert.equal(parsed.recurrencePattern, 'weekly');
});

test('isTaskOverdue calculates overdue status dynamically without storing overdue status', () => {
  const now = new Date(2026, 10, 24, 14, 0, 0);

  // Past due date and pending -> overdue
  assert.equal(
    isTaskOverdue(
      {
        dueDate: '2026-11-23',
        dueTime: null,
        status: 'Pending',
        isArchived: false,
        deletedAt: null,
      },
      now
    ),
    true
  );

  // Past due date but Completed -> not overdue
  assert.equal(
    isTaskOverdue(
      {
        dueDate: '2026-11-23',
        dueTime: null,
        status: 'Completed',
        isArchived: false,
        deletedAt: null,
      },
      now
    ),
    false
  );

  // Today with earlier time -> overdue
  assert.equal(
    isTaskOverdue(
      {
        dueDate: '2026-11-24',
        dueTime: '09:00',
        status: 'In Progress',
        isArchived: false,
        deletedAt: null,
      },
      now
    ),
    true
  );

  // Future date -> not overdue
  assert.equal(
    isTaskOverdue(
      {
        dueDate: '2026-11-25',
        dueTime: '09:00',
        status: 'Pending',
        isArchived: false,
        deletedAt: null,
      },
      now
    ),
    false
  );
});

test('calculateProgressStreak counts consecutive local calendar days', () => {
  const refDate = new Date(2026, 10, 24, 18, 0, 0);
  const completedTimestamps = [
    new Date(2026, 10, 24, 12, 0).toISOString(),
    new Date(2026, 10, 23, 15, 0).toISOString(),
    new Date(2026, 10, 22, 9, 0).toISOString(),
    new Date(2026, 10, 20, 9, 0).toISOString(), // gap on Nov 21
  ];

  assert.equal(calculateProgressStreak(completedTimestamps, refDate), 3);
});

test('validateTaskInput enforces title and date range rules', () => {
  assert.equal(validateTaskInput({ title: '   ' }).valid, false);
  assert.equal(
    validateTaskInput({
      title: 'Valid task',
      startDate: '2026-11-26',
      dueDate: '2026-11-24',
    }).valid,
    false
  );
  assert.equal(
    validateTaskInput({
      title: 'Valid task',
      startDate: '2026-11-24',
      dueDate: '2026-11-26',
      priority: 'High',
      status: 'Pending',
    }).valid,
    true
  );
});

test('calculateNextOccurrenceDate advances recurring task dates accurately', () => {
  assert.equal(calculateNextOccurrenceDate('2026-11-24', 'daily', 1), '2026-11-25');
  assert.equal(calculateNextOccurrenceDate('2026-11-24', 'weekly', 1), '2026-12-01');
});

test('generateDailyBriefing summarizes real task counts accurately', () => {
  const refDate = new Date(2026, 10, 24, 12, 0, 0);
  const sampleTasks: TaskItem[] = [
    {
      id: '1',
      userId: 'u1',
      title: 'Today task',
      description: '',
      priority: 'High',
      status: 'Pending',
      categoryId: null,
      startDate: null,
      dueDate: '2026-11-24',
      dueTime: null,
      isImportant: true,
      isArchived: false,
      recurrencePattern: 'none',
      recurrenceInterval: 1,
      alarmEnabled: false,
      alarmMinutesBefore: 10,
      alarmSound: 'classic',
      alarmAudioData: null,
      alarmAudioName: null,
      alarmSnoozedUntil: null,
      lastAlarmTriggeredDate: null,
      isDailyTask: false,
      lastDailyResetDate: null,
      sortOrder: 0,
      deletedAt: null,
      createdAt: refDate.toISOString(),
      updatedAt: refDate.toISOString(),
      completedAt: null,
      subtasks: [],
      tags: [],
    },
    {
      id: '2',
      userId: 'u1',
      title: 'Overdue task',
      description: '',
      priority: 'Medium',
      status: 'Pending',
      categoryId: null,
      startDate: null,
      dueDate: '2026-11-22',
      dueTime: null,
      isImportant: false,
      isArchived: false,
      recurrencePattern: 'none',
      recurrenceInterval: 1,
      alarmEnabled: false,
      alarmMinutesBefore: 10,
      alarmSound: 'classic',
      alarmAudioData: null,
      alarmAudioName: null,
      alarmSnoozedUntil: null,
      lastAlarmTriggeredDate: null,
      isDailyTask: false,
      lastDailyResetDate: null,
      sortOrder: 1,
      deletedAt: null,
      createdAt: refDate.toISOString(),
      updatedAt: refDate.toISOString(),
      completedAt: null,
      subtasks: [],
      tags: [],
    },
  ];

  const briefing = generateDailyBriefing(sampleTasks, refDate);
  assert.ok(briefing.some((line) => line.includes('1 task is scheduled for today')));
  assert.ok(briefing.some((line) => line.includes('1 task is overdue')));
  assert.ok(briefing.some((line) => line.includes('1 important task')));
});

test('getTaskAlarmTriggerTime and formatAlarmRingTime calculate lead-time accurately', () => {
  const trigger = getTaskAlarmTriggerTime({
    alarmEnabled: true,
    alarmMinutesBefore: 15,
    dueDate: '2026-11-24',
    dueTime: '18:00',
    isDailyTask: false,
  });
  assert.ok(trigger);
  assert.equal(trigger!.getHours(), 17);
  assert.equal(trigger!.getMinutes(), 45);
  assert.equal(formatAlarmRingTime('18:00', 15), '17:45');
  assert.equal(formatAlarmRingTime('00:10', 20), '23:50');
});

test('shouldTaskAlarmRing rings inside trigger window and respects completion/ack/snooze', () => {
  const task = {
    id: 't-alarm',
    status: 'Pending' as const,
    isArchived: false,
    deletedAt: null,
    alarmEnabled: true,
    alarmMinutesBefore: 10,
    dueDate: '2026-11-24',
    dueTime: '18:00',
    isDailyTask: false,
    lastAlarmTriggeredDate: null,
    alarmSnoozedUntil: null,
  };

  // 17:49 -> too early
  assert.equal(shouldTaskAlarmRing(task, new Date(2026, 10, 24, 17, 49, 0)), false);
  // 17:50 -> exact trigger time (10 mins before 18:00)
  assert.equal(shouldTaskAlarmRing(task, new Date(2026, 10, 24, 17, 50, 0)), true);
  // Already completed -> should not ring
  assert.equal(
    shouldTaskAlarmRing({ ...task, status: 'Completed' }, new Date(2026, 10, 24, 17, 50, 0)),
    false
  );
  // Already acknowledged for this occurrence -> should not ring
  const ack = new Set(['t-alarm::2026-11-24::18:00::10']);
  assert.equal(shouldTaskAlarmRing(task, new Date(2026, 10, 24, 17, 52, 0), ack), false);
});

test('needsDailyReset detects stale daily tasks and getTimeUntilMidnight computes countdown', () => {
  assert.equal(
    needsDailyReset(
      {
        isDailyTask: true,
        lastDailyResetDate: '2026-11-23',
        status: 'Completed',
        dueDate: '2026-11-23',
        deletedAt: null,
        isArchived: false,
      },
      '2026-11-24'
    ),
    true
  );
  assert.equal(
    needsDailyReset(
      {
        isDailyTask: true,
        lastDailyResetDate: '2026-11-24',
        status: 'Completed',
        dueDate: '2026-11-24',
        deletedAt: null,
        isArchived: false,
      },
      '2026-11-24'
    ),
    false
  );

  const countdown = getTimeUntilMidnight(new Date(2026, 10, 24, 23, 30, 0));
  assert.equal(countdown.hours, 0);
  assert.equal(countdown.minutes, 30);
  assert.equal(countdown.seconds, 0);
});

test('computeSubtaskProgress calculates completion percentage accurately', () => {
  assert.deepEqual(computeSubtaskProgress([]), {
    completed: 0,
    total: 0,
    percentage: 0,
  });
  assert.deepEqual(
    computeSubtaskProgress([
      { isCompleted: true },
      { isCompleted: false },
      { isCompleted: true },
    ]),
    { completed: 2, total: 3, percentage: 67 }
  );
  assert.deepEqual(
    computeSubtaskProgress([{ isCompleted: true }, { isCompleted: true }]),
    { completed: 2, total: 2, percentage: 100 }
  );
});

test('reorderTasksList moves dragged task to target position deterministically', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(
    reorderTasksList(list, 'd', 'b').map((x) => x.id),
    ['a', 'd', 'b', 'c']
  );
  assert.deepEqual(
    reorderTasksList(list, 'a', 'c').map((x) => x.id),
    ['b', 'c', 'a', 'd']
  );
  // Unknown id returns original order unchanged
  assert.deepEqual(
    reorderTasksList(list, 'missing', 'b').map((x) => x.id),
    ['a', 'b', 'c', 'd']
  );
});

test('themeEngine enforces WCAG >= 4.5:1 contrast across all theme presets and custom accents', () => {
  // Bright lime accent on crisp white paper must automatically darken to achieve >= 4.5:1
  const adjustedOnLight = adjustAccentForBackground('#C6F36B', '#FFFFFF', 4.5);
  assert.ok(getContrastRatio(adjustedOnLight, '#FFFFFF') >= 4.5);

  // Dark forest accent on obsidian dark must automatically lighten to achieve >= 4.5:1
  const adjustedOnDark = adjustAccentForBackground('#2D5A00', '#1E221E', 4.5);
  assert.ok(getContrastRatio(adjustedOnDark, '#1E221E') >= 4.5);

  // Optimal button text on bright yellow is dark ink, on deep navy is white ink
  assert.equal(getOptimalTextColor('#FFE14D'), '#101210');
  assert.equal(getOptimalTextColor('#1E3A8A'), '#FFFFFF');

  // Every preset passes WCAG text contrast >= 7.0 (AAA) and accent >= 4.5 (AA)
  for (const preset of THEME_PRESETS) {
    const bundle = buildThemeVariables(preset.id, preset.defaultAccent, preset.mode);
    assert.ok(
      bundle.metrics.textContrastRatio >= 7.0,
      `Preset ${preset.id} primary text contrast too low: ${bundle.metrics.textContrastRatio}`
    );
    assert.ok(
      bundle.metrics.accentContrastRatio >= 4.5,
      `Preset ${preset.id} accent contrast too low: ${bundle.metrics.accentContrastRatio}`
    );
  }
});

