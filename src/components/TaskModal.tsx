import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  Clock,
  Music,
  Plus,
  Repeat,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  AlarmSoundType,
  CategoryItem,
  formatAlarmRingTime,
  formatLocalDate,
  parseSmartQuickAdd,
  RecurrencePattern,
  TagItem,
  TaskItem,
  TaskPriority,
  TaskStatus,
  validateTaskInput,
} from '../utils/taskLogic';
import {
  ALARM_SOUND_OPTIONS,
  previewAlarmSound,
  readAudioFileAsDataUrl,
  stopPreviewAudio,
} from '../utils/alarmAudio';

interface TaskModalProps {
  isOpen: boolean;
  initialMode?: 'detailed' | 'quick';
  editingTask: TaskItem | null;
  defaultDate?: string | null;
  defaultPriority?: TaskPriority;
  defaultCategoryId?: string | null;
  defaultCustomAlarmAudioData?: string | null;
  defaultCustomAlarmAudioName?: string | null;
  categories: CategoryItem[];
  tags: TagItem[];
  onClose: () => void;
  onSave: (
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
  ) => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  initialMode = 'detailed',
  editingTask,
  defaultDate,
  defaultPriority = 'Medium',
  defaultCategoryId = null,
  defaultCustomAlarmAudioData = null,
  defaultCustomAlarmAudioName = null,
  categories,
  tags,
  onClose,
  onSave,
}) => {
  const [mode, setMode] = useState<'detailed' | 'quick'>(
    editingTask ? 'detailed' : initialMode
  );
  const [quickInput, setQuickInput] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(defaultPriority);
  const [status, setStatus] = useState<TaskStatus>('Pending');
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [startDate, setStartDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(defaultDate || '');
  const [dueTime, setDueTime] = useState<string>('');
  const [isImportant, setIsImportant] = useState(false);
  const [recurrencePattern, setRecurrencePattern] =
    useState<RecurrencePattern>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [alarmEnabled, setAlarmEnabled] = useState<boolean>(false);
  const [alarmMinutesBefore, setAlarmMinutesBefore] = useState<number>(10);
  const [alarmSound, setAlarmSound] = useState<AlarmSoundType>('classic');
  const [alarmAudioData, setAlarmAudioData] = useState<string | null>(null);
  const [alarmAudioName, setAlarmAudioName] = useState<string | null>(null);
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [isDailyTask, setIsDailyTask] = useState<boolean>(false);
  const [subtaskDrafts, setSubtaskDrafts] = useState<
    { id?: string; title: string; isCompleted?: boolean }[]
  >([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTagNames, setCustomTagNames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopPreviewAudio();
      return;
    }
    setErrorMsg(null);
    setAudioUploadError(null);
    setIsSubmitting(false);

    if (editingTask) {
      setMode('detailed');
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      setCategoryId(editingTask.categoryId);
      setStartDate(editingTask.startDate || '');
      setDueDate(editingTask.dueDate || '');
      setDueTime(editingTask.dueTime || '');
      setIsImportant(editingTask.isImportant);
      setRecurrencePattern(editingTask.recurrencePattern || 'none');
      setRecurrenceInterval(editingTask.recurrenceInterval || 1);
      setAlarmEnabled(Boolean(editingTask.alarmEnabled));
      setAlarmMinutesBefore(editingTask.alarmMinutesBefore ?? 10);
      setAlarmSound(editingTask.alarmSound || 'classic');
      setAlarmAudioData(editingTask.alarmAudioData || null);
      setAlarmAudioName(editingTask.alarmAudioName || null);
      setIsDailyTask(Boolean(editingTask.isDailyTask));
      setSubtaskDrafts(
        editingTask.subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          isCompleted: s.isCompleted,
        }))
      );
      setSelectedTagIds(editingTask.tags.map((t) => t.id));
      setCustomTagNames([]);
      setQuickInput('');
    } else {
      setMode(initialMode);
      setTitle('');
      setDescription('');
      setPriority(defaultPriority);
      setStatus('Pending');
      setCategoryId(defaultCategoryId);
      setStartDate('');
      setDueDate(defaultDate || '');
      setDueTime('');
      setIsImportant(false);
      setRecurrencePattern('none');
      setRecurrenceInterval(1);
      setAlarmEnabled(false);
      setAlarmMinutesBefore(10);
      setAlarmSound('classic');
      setAlarmAudioData(null);
      setAlarmAudioName(null);
      setIsDailyTask(false);
      setSubtaskDrafts([]);
      setSelectedTagIds([]);
      setCustomTagNames([]);
      setQuickInput('');
    }
  }, [
    isOpen,
    editingTask,
    initialMode,
    defaultDate,
    defaultPriority,
    defaultCategoryId,
  ]);

  if (!isOpen) return null;

  const handleGalleryAudioFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setAudioUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { name, dataUrl } = await readAudioFileAsDataUrl(file);
      setAlarmAudioData(dataUrl);
      setAlarmAudioName(name);
      setAlarmSound('custom');
      previewAlarmSound('custom', dataUrl);
    } catch (err: any) {
      setAudioUploadError(err.message || 'Could not load audio file.');
    } finally {
      e.target.value = '';
    }
  };

  const parsedPreview = parseSmartQuickAdd(quickInput);

  const applyQuickParseToDetailed = () => {
    if (!parsedPreview.title) {
      setErrorMsg('Please enter a task description to parse.');
      return;
    }
    setTitle(parsedPreview.title);
    setPriority(parsedPreview.priority);
    if (parsedPreview.dueDate) setDueDate(parsedPreview.dueDate);
    if (parsedPreview.dueTime) setDueTime(parsedPreview.dueTime);
    if (parsedPreview.isImportant) setIsImportant(true);
    if (parsedPreview.recurrencePattern !== 'none') {
      setRecurrencePattern(parsedPreview.recurrencePattern);
    }
    if (parsedPreview.categoryName) {
      const matched = categories.find(
        (c) => c.name.toLowerCase() === parsedPreview.categoryName!.toLowerCase()
      );
      if (matched) setCategoryId(matched.id);
    }
    if (parsedPreview.tags.length > 0) {
      setCustomTagNames((prev) =>
        Array.from(new Set([...prev, ...parsedPreview.tags]))
      );
    }
    setMode('detailed');
  };

  const handleAddSubtaskDraft = () => {
    const clean = newSubtaskTitle.trim();
    if (!clean) return;
    setSubtaskDrafts((prev) => [...prev, { title: clean, isCompleted: false }]);
    setNewSubtaskTitle('');
  };

  const handleAddCustomTag = () => {
    const clean = customTagInput.trim().toLowerCase().replace(/^[+#@]/, '');
    if (!clean) return;
    const existingTag = tags.find((t) => t.name.toLowerCase() === clean);
    if (existingTag) {
      if (!selectedTagIds.includes(existingTag.id)) {
        setSelectedTagIds((prev) => [...prev, existingTag.id]);
      }
    } else if (!customTagNames.includes(clean)) {
      setCustomTagNames((prev) => [...prev, clean]);
    }
    setCustomTagInput('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (mode === 'quick') {
      const parsed = parseSmartQuickAdd(quickInput);
      const validation = validateTaskInput({
        title: parsed.title,
        priority: parsed.priority,
        status: 'Pending',
      });
      if (!validation.valid) {
        setErrorMsg(validation.error || 'Invalid input');
        return;
      }

      let matchedCategoryId: string | null = defaultCategoryId;
      if (parsed.categoryName) {
        const found = categories.find(
          (c) => c.name.toLowerCase() === parsed.categoryName!.toLowerCase()
        );
        if (found) matchedCategoryId = found.id;
      }

      setIsSubmitting(true);
      try {
        await onSave({
          title: parsed.title,
          description: '',
          priority: parsed.priority,
          status: 'Pending',
          categoryId: matchedCategoryId,
          startDate: null,
          dueDate: parsed.dueDate,
          dueTime: parsed.dueTime,
          isImportant: parsed.isImportant,
          recurrencePattern: parsed.recurrencePattern,
          recurrenceInterval: 1,
          alarmEnabled: false,
          alarmMinutesBefore: 10,
          alarmSound: 'classic',
          alarmAudioData: null,
          alarmAudioName: null,
          isDailyTask: parsed.recurrencePattern === 'daily',
          subtasks: [],
          tagIds: [],
          tagNames: parsed.tags,
        });
        onClose();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to save task');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Detailed mode submission
    const validation = validateTaskInput({
      title,
      description,
      priority,
      status,
      startDate: startDate || null,
      dueDate: dueDate || null,
    });
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Please verify task details');
      return;
    }

    // Include any typed subtask that wasn't added with '+' yet
    const finalSubtasks = [...subtaskDrafts];
    if (newSubtaskTitle.trim()) {
      finalSubtasks.push({
        title: newSubtaskTitle.trim(),
        isCompleted: false,
      });
    }

    if (alarmEnabled && !dueTime) {
      setErrorMsg('Please set a Due Time so the task alarm knows when to ring.');
      return;
    }

    const effectiveDueDate =
      dueDate || (alarmEnabled || isDailyTask ? formatLocalDate(new Date()) : null);

    setIsSubmitting(true);
    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim(),
          priority,
          status,
          categoryId: categoryId || null,
          startDate: startDate || null,
          dueDate: effectiveDueDate,
          dueTime: dueTime || null,
          isImportant,
          recurrencePattern: isDailyTask ? 'daily' : recurrencePattern,
          recurrenceInterval,
          alarmEnabled,
          alarmMinutesBefore: Math.max(0, Number(alarmMinutesBefore) || 0),
          alarmSound,
          alarmAudioData: alarmSound === 'custom' ? alarmAudioData : null,
          alarmAudioName: alarmSound === 'custom' ? alarmAudioName : null,
          isDailyTask,
          subtasks: finalSubtasks,
          tagIds: selectedTagIds,
          tagNames: customTagNames,
        },
        editingTask?.id
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="flex items-center gap-4">
            <h2 id="task-modal-title" className="text-lg font-semibold tracking-tight">
              {editingTask ? 'Edit Task' : 'Create Task'}
            </h2>
            {!editingTask && (
              <div className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('detailed')}
                  className={`px-3 py-1 font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'detailed'
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Structured Form
                </button>
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className={`px-3 py-1 font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'quick'
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Smart Quick Add
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {errorMsg && (
            <div
              role="alert"
              className="border border-[var(--status-danger)] bg-[var(--status-danger)]/10 px-4 py-2.5 text-sm text-[var(--status-danger)]"
            >
              {errorMsg}
            </div>
          )}

          {mode === 'quick' ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="smart-quick-add-input"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                >
                  Natural Rule-Based Task Syntax
                </label>
                <input
                  id="smart-quick-add-input"
                  type="text"
                  autoFocus
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="Complete DBMS assignment tomorrow at 6 PM #College !High +exam *important"
                  className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Supported tokens: <span className="font-mono">#Category</span> ·{' '}
                  <span className="font-mono">!High / !Medium / !Low</span> ·{' '}
                  <span className="font-mono">today / tomorrow / next week / YYYY-MM-DD</span> ·{' '}
                  <span className="font-mono">at 6 PM</span> ·{' '}
                  <span className="font-mono">+tag</span> ·{' '}
                  <span className="font-mono">*important</span> ·{' '}
                  <span className="font-mono">every day / week / month</span>
                </p>
              </div>

              {/* Live Deterministic Parser Preview */}
              <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Deterministic Parser Preview
                  </span>
                  <button
                    type="button"
                    onClick={applyQuickParseToDetailed}
                    className="text-xs text-[var(--accent-primary)] hover:underline whitespace-nowrap shrink-0"
                  >
                    Customize in Form
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)] block">Title</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {parsedPreview.title || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block">Due Date</span>
                    <span className="font-mono tabular-nums text-[var(--text-primary)]">
                      {parsedPreview.dueDate || 'Unscheduled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block">Due Time</span>
                    <span className="font-mono tabular-nums text-[var(--text-primary)]">
                      {parsedPreview.dueTime || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block">Category</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {parsedPreview.categoryName || 'Default / None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block">Priority</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {parsedPreview.priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block">Flags & Tags</span>
                    <span className="text-[var(--text-primary)]">
                      {[
                        parsedPreview.isImportant ? 'Important' : null,
                        parsedPreview.recurrencePattern !== 'none'
                          ? `Repeats ${parsedPreview.recurrencePattern}`
                          : null,
                        ...parsedPreview.tags.map((t) => `+${t}`),
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Title & Important toggle */}
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="task-title-input"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                  >
                    Task Title *
                  </label>
                  <input
                    id="task-title-input"
                    type="text"
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What needs to be accomplished?"
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={() => setIsImportant(!isImportant)}
                    aria-pressed={isImportant}
                    className={`flex items-center gap-1.5 border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isImportant
                        ? 'border-[var(--status-warning)] text-[var(--status-warning)] bg-[var(--status-warning)]/10'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${isImportant ? 'fill-current' : ''}`}
                    />
                    Important
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="task-description-input"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Description & Notes
                </label>
                <textarea
                  id="task-description-input"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Context, deliverables, acceptance criteria, or reference links..."
                  className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              {/* Priority, Status, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="task-priority-select"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                  >
                    Priority
                  </label>
                  <select
                    id="task-priority-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="task-status-select"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="task-status-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="task-category-select"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="task-category-select"
                    value={categoryId || ''}
                    onChange={(e) => setCategoryId(e.target.value || null)}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Date, Due Date, Due Time, Recurrence */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label
                    htmlFor="task-start-date"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Start Date
                  </label>
                  <input
                    id="task-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-due-date"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Due Date
                  </label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-due-time"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1"
                  >
                    <Clock className="w-3.5 h-3.5" /> Due Time
                  </label>
                  <input
                    id="task-due-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-recurrence"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1"
                  >
                    <Repeat className="w-3.5 h-3.5" /> Recurrence
                  </label>
                  <select
                    id="task-recurrence"
                    value={recurrencePattern}
                    onChange={(e) =>
                      setRecurrencePattern(e.target.value as RecurrencePattern)
                    }
                    className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom interval (days)</option>
                  </select>
                </div>
              </div>

              {recurrencePattern === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <label htmlFor="recurrence-interval">Repeat every</label>
                  <input
                    id="recurrence-interval"
                    type="number"
                    min={1}
                    max={365}
                    value={recurrenceInterval}
                    onChange={(e) =>
                      setRecurrenceInterval(Math.max(1, Number(e.target.value)))
                    }
                    className="w-20 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2 py-1 font-mono"
                  />
                  <span>days</span>
                </div>
              )}

              {/* Daily Auto-Restart Toggle */}
              <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 text-xs text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDailyTask}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setIsDailyTask(next);
                      if (next) {
                        setRecurrencePattern('daily');
                        if (!dueDate) setDueDate(formatLocalDate(new Date()));
                      }
                    }}
                    className="accent-[var(--accent-primary)]"
                  />
                  <Repeat className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>
                    <strong className="font-medium">Include in Daily Tasks</strong>{' '}
                    <span className="text-[var(--text-secondary)]">
                      (restarts automatically to Pending every day at midnight)
                    </span>
                  </span>
                </label>
              </div>

              {/* Per-Task Alarm Sound & Lead Time Configuration */}
              <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer">
                    <input
                      id="task-alarm-toggle"
                      type="checkbox"
                      checked={alarmEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setAlarmEnabled(enabled);
                        if (enabled && !dueDate) {
                          setDueDate(formatLocalDate(new Date()));
                        }
                      }}
                      className="accent-[var(--accent-primary)]"
                    />
                    <Bell className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Enable Task Alarm Sound</span>
                  </label>

                  {alarmEnabled && dueTime && (
                    <span className="text-[11px] font-mono text-[var(--accent-primary)]">
                      Rings at {formatAlarmRingTime(dueTime, alarmMinutesBefore)} (
                      {alarmMinutesBefore === 0
                        ? 'exact due time'
                        : `${alarmMinutesBefore} min before ${dueTime}`}
                      )
                    </span>
                  )}
                </div>

                {alarmEnabled && (
                  <div className="space-y-3 pt-1 border-t border-[var(--border-subtle)]">
                    {!dueTime && (
                      <p className="text-[11px] text-[var(--status-warning)]">
                        Set a Due Time above so TASKFLOW knows when to trigger this alarm.
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Lead time before set time */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="task-alarm-lead-minutes"
                          className="block text-[11px] text-[var(--text-secondary)]"
                        >
                          Ring Before Set Time (minutes)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="task-alarm-lead-minutes"
                            type="number"
                            min={0}
                            max={1440}
                            value={alarmMinutesBefore}
                            onChange={(e) =>
                              setAlarmMinutesBefore(
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                            className="w-24 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                          />
                          <span className="text-[var(--text-secondary)]">
                            minutes before
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {[0, 5, 10, 15, 30, 60].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setAlarmMinutesBefore(mins)}
                              className={`border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                                alarmMinutesBefore === mins
                                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)]'
                                  : 'border-[var(--border-subtle)] bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {mins === 0 ? 'At time' : `${mins}m`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Alarm Sound Gallery & Device Audio Picker */}
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-[11px] text-[var(--text-secondary)]">
                            Ringtone Gallery & Device Audio
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              previewAlarmSound(
                                alarmSound,
                                alarmAudioData || defaultCustomAlarmAudioData
                              )
                            }
                            className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Volume2 className="w-3 h-3 text-[var(--accent-primary)]" />
                            Preview
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {ALARM_SOUND_OPTIONS.filter(
                            (o) => o.category === 'built-in'
                          ).map((opt) => {
                            const selected = alarmSound === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setAlarmSound(opt.value);
                                  previewAlarmSound(opt.value);
                                }}
                                className={`border px-2.5 py-1.5 text-left text-[11px] transition-colors flex items-center justify-between gap-1 ${
                                  selected
                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)] font-semibold'
                                    : 'border-[var(--border-subtle)] bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                <span className="truncate">{opt.label}</span>
                                <Volume2 className="w-3 h-3 shrink-0 opacity-70" />
                              </button>
                            );
                          })}
                        </div>

                        {/* Choose from Device / Audio Gallery */}
                        <div className="border border-dashed border-[var(--border-subtle)] bg-[var(--bg-main)] p-2.5 space-y-2">
                          <input
                            ref={audioFileInputRef}
                            type="file"
                            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                            onChange={handleGalleryAudioFileSelected}
                            className="hidden"
                            id="task-alarm-audio-file"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => audioFileInputRef.current?.click()}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                              Choose Audio from Gallery
                            </button>

                            {defaultCustomAlarmAudioData &&
                              defaultCustomAlarmAudioName &&
                              !alarmAudioData && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAlarmAudioData(defaultCustomAlarmAudioData);
                                    setAlarmAudioName(defaultCustomAlarmAudioName);
                                    setAlarmSound('custom');
                                    previewAlarmSound(
                                      'custom',
                                      defaultCustomAlarmAudioData
                                    );
                                  }}
                                  className="text-[11px] text-[var(--accent-primary)] hover:underline truncate max-w-[160px]"
                                >
                                  Use saved: {defaultCustomAlarmAudioName}
                                </button>
                              )}
                          </div>

                          {alarmSound === 'custom' && alarmAudioName && (
                            <div className="flex items-center justify-between gap-2 bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[11px]">
                              <span className="flex items-center gap-1.5 text-[var(--accent-primary)] truncate">
                                <Music className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate font-mono">
                                  {alarmAudioName}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  stopPreviewAudio();
                                  setAlarmAudioData(null);
                                  setAlarmAudioName(null);
                                  setAlarmSound('classic');
                                }}
                                className="text-[var(--text-muted)] hover:text-[var(--status-danger)] shrink-0"
                                aria-label="Remove custom alarm audio"
                              >
                                Remove
                              </button>
                            </div>
                          )}

                          {audioUploadError && (
                            <p className="text-[11px] text-[var(--status-danger)]">
                              {audioUploadError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Subtasks */}
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <label
                  htmlFor="new-subtask-input"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-2"
                >
                  Subtasks ({subtaskDrafts.filter((s) => s.isCompleted).length}/
                  {subtaskDrafts.length})
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    id="new-subtask-input"
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtaskDraft();
                      }
                    }}
                    placeholder="Add a smaller actionable step..."
                    className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtaskDraft}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Step
                  </button>
                </div>
                {subtaskDrafts.length > 0 && (
                  <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                    {subtaskDrafts.map((st, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between gap-2 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-1.5 text-xs"
                      >
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(st.isCompleted)}
                            onChange={(e) =>
                              setSubtaskDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? { ...item, isCompleted: e.target.checked }
                                    : item
                                )
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
                        <button
                          type="button"
                          onClick={() =>
                            setSubtaskDrafts((prev) =>
                              prev.filter((_, idx) => idx !== index)
                            )
                          }
                          aria-label={`Remove subtask ${st.title}`}
                          className="text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Tags */}
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <label
                  htmlFor="custom-tag-input"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-2"
                >
                  Tags
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setSelectedTagIds((prev) =>
                            active
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id]
                          )
                        }
                        className={`border px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)] font-medium'
                            : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        #{tag.name}
                      </button>
                    );
                  })}
                  {customTagNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        setCustomTagNames((prev) => prev.filter((n) => n !== name))
                      }
                      className="border border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 px-2.5 py-1 text-xs text-[var(--text-primary)] font-medium whitespace-nowrap shrink-0"
                    >
                      #{name} ×
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    id="custom-tag-input"
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    placeholder="Create or attach tag (e.g. research)..."
                    className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
                  >
                    Add Tag
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Ctrl + Enter to save
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-5 py-2 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingTask
                    ? 'Save Changes'
                    : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
