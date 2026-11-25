import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Columns,
  Copy,
  Edit3,
  GripVertical,
  LayoutGrid,
  List,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import {
  addDaysToDateString,
  CategoryItem,
  computeSubtaskProgress,
  formatAlarmRingTime,
  formatLocalDate,
  isTaskOverdue,
  reorderTasksList,
  TagItem,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '../utils/taskLogic';

export type TaskFilterView =
  | 'all'
  | 'today'
  | 'upcoming'
  | 'in-progress'
  | 'completed'
  | 'important'
  | 'overdue'
  | 'archive'
  | 'trash';

interface TasksWorkspaceViewProps {
  view: TaskFilterView;
  tasks: TaskItem[];
  categories: CategoryItem[];
  tags: TagItem[];
  defaultViewMode: 'list' | 'grid' | 'kanban';
  dailyTaskTarget: number;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onOpenCreateTask: (mode: 'detailed' | 'quick') => void;
  onEditTask: (task: TaskItem) => void;
  onStatusChange: (task: TaskItem, status: TaskStatus) => Promise<void>;
  onPriorityChange: (task: TaskItem, priority: TaskPriority) => Promise<void>;
  onToggleImportant: (task: TaskItem) => Promise<void>;
  onArchiveTask: (task: TaskItem, isArchived: boolean) => Promise<void>;
  onRestoreTask: (task: TaskItem) => Promise<void>;
  onDuplicateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (task: TaskItem, permanent: boolean) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
  onBulkAction: (
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
  ) => Promise<void>;
  onToggleSubtask: (
    taskId: string,
    subtaskId: string,
    isCompleted: boolean
  ) => Promise<void>;
  onAddSubtaskInline: (taskId: string, title: string) => Promise<void>;
  onStartFocus: (task: TaskItem) => void;
  onReorderTasks: (orderedTaskIds: string[]) => Promise<void>;
}

export const TasksWorkspaceView: React.FC<TasksWorkspaceViewProps> = ({
  view,
  tasks,
  categories,
  tags,
  defaultViewMode,
  dailyTaskTarget,
  searchInputRef,
  onOpenCreateTask,
  onEditTask,
  onStatusChange,
  onToggleImportant,
  onArchiveTask,
  onRestoreTask,
  onDuplicateTask,
  onDeleteTask,
  onEmptyTrash,
  onBulkAction,
  onToggleSubtask,
  onAddSubtaskInline,
  onStartFocus,
  onReorderTasks,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'kanban'>(
    defaultViewMode
  );
  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [onlyImportantFilter, setOnlyImportantFilter] = useState(false);
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortBy, setSortBy] = useState<
    | 'custom'
    | 'newest'
    | 'oldest'
    | 'due_date'
    | 'priority'
    | 'alphabetical'
    | 'updated'
  >('custom');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>(
    {}
  );
  const [inlineSubtaskInputs, setInlineSubtaskInputs] = useState<
    Record<string, string>
  >({});
  const [confirmPermanentDeleteId, setConfirmPermanentDeleteId] = useState<
    string | null
  >(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  // Drag-and-drop reordering state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Debounce search input (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(rawSearch.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  // Clear selection when view changes
  useEffect(() => {
    setSelectedIds([]);
    setConfirmPermanentDeleteId(null);
    setConfirmEmptyTrash(false);
  }, [view]);

  const now = new Date();
  const todayStr = formatLocalDate(now);
  const tomorrowStr = addDaysToDateString(todayStr, 1);
  const endOfThisWeekStr = addDaysToDateString(todayStr, 7);
  const endOfNextWeekStr = addDaysToDateString(todayStr, 14);

  const viewHeader = useMemo(() => {
    switch (view) {
      case 'today':
        return {
          title: 'Today',
          subtitle: `Scheduled and overdue responsibilities for ${todayStr}`,
        };
      case 'upcoming':
        return {
          title: 'Upcoming Schedule',
          subtitle: 'Chronological horizon across Tomorrow, This Week, Next Week, and Later',
        };
      case 'in-progress':
        return {
          title: 'In Progress',
          subtitle: 'Tasks currently under active execution',
        };
      case 'completed':
        return {
          title: 'Completed Ledger',
          subtitle: 'Historical archive of accomplished tasks with completion timestamps',
        };
      case 'important':
        return {
          title: 'Important Tasks',
          subtitle: 'Tasks explicitly starred as high-significance responsibilities',
        };
      case 'overdue':
        return {
          title: 'Overdue Queue',
          subtitle: 'Active tasks whose scheduled due date or due time has passed',
        };
      case 'archive':
        return {
          title: 'Archived Tasks',
          subtitle: 'Preserved reference tasks hidden from active daily views',
        };
      case 'trash':
        return {
          title: 'Recently Deleted',
          subtitle: 'Soft-deleted tasks recoverable before permanent removal',
        };
      default:
        return {
          title: 'All Active Tasks',
          subtitle: 'Complete workspace inventory with combined filtering and bulk controls',
        };
    }
  }, [view, todayStr]);

  // Filter & sort tasks based on current view + search + filters
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // 1. Primary view scoping
        if (view === 'trash') {
          if (!t.deletedAt) return false;
        } else if (view === 'archive') {
          if (t.deletedAt || !t.isArchived) return false;
        } else {
          // Normal active views exclude deleted and archived
          if (t.deletedAt || t.isArchived) return false;

          if (view === 'today') {
            const isToday = t.dueDate === todayStr;
            const isOverdue = isTaskOverdue(t, now);
            const completedToday =
              t.status === 'Completed' &&
              t.completedAt &&
              formatLocalDate(new Date(t.completedAt)) === todayStr;
            if (!isToday && !isOverdue && !completedToday) return false;
          } else if (view === 'upcoming') {
            if (t.status === 'Completed') return false;
            if (!t.dueDate || t.dueDate <= todayStr) return false;
          } else if (view === 'in-progress') {
            if (t.status !== 'In Progress') return false;
          } else if (view === 'completed') {
            if (t.status !== 'Completed') return false;
          } else if (view === 'important') {
            if (!t.isImportant) return false;
          } else if (view === 'overdue') {
            if (!isTaskOverdue(t, now)) return false;
          }
        }

        // 2. Debounced search (Title, Description, Category, Tags)
        if (debouncedSearch) {
          const inTitle = t.title.toLowerCase().includes(debouncedSearch);
          const inDesc = t.description.toLowerCase().includes(debouncedSearch);
          const inCat =
            t.categoryName &&
            t.categoryName.toLowerCase().includes(debouncedSearch);
          const inTags = t.tags.some((tag) =>
            tag.name.toLowerCase().includes(debouncedSearch)
          );
          if (!inTitle && !inDesc && !inCat && !inTags) return false;
        }

        // 3. Combined filters
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (priorityFilter !== 'ALL' && t.priority !== priorityFilter)
          return false;
        if (categoryFilter !== 'ALL') {
          if (categoryFilter === 'UNCATEGORIZED') {
            if (t.categoryId) return false;
          } else if (t.categoryId !== categoryFilter) {
            return false;
          }
        }
        if (
          tagFilter !== 'ALL' &&
          !t.tags.some((tag) => tag.id === tagFilter)
        ) {
          return false;
        }
        if (onlyImportantFilter && !t.isImportant) return false;
        if (dateFromFilter && (!t.dueDate || t.dueDate < dateFromFilter))
          return false;
        if (dateToFilter && (!t.dueDate || t.dueDate > dateToFilter))
          return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'custom') {
          const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          if (orderDiff !== 0) return orderDiff;
          return b.createdAt.localeCompare(a.createdAt);
        }
        if (sortBy === 'newest') {
          return b.createdAt.localeCompare(a.createdAt);
        }
        if (sortBy === 'oldest') {
          return a.createdAt.localeCompare(b.createdAt);
        }
        if (sortBy === 'due_date') {
          const da = a.dueDate || '9999-12-31';
          const db = b.dueDate || '9999-12-31';
          return da.localeCompare(db);
        }
        if (sortBy === 'priority') {
          const weight: Record<TaskPriority, number> = {
            High: 3,
            Medium: 2,
            Low: 1,
          };
          return weight[b.priority] - weight[a.priority];
        }
        if (sortBy === 'alphabetical') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'updated') {
          return b.updatedAt.localeCompare(a.updatedAt);
        }
        return 0;
      });
  }, [
    tasks,
    view,
    todayStr,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    categoryFilter,
    tagFilter,
    onlyImportantFilter,
    dateFromFilter,
    dateToFilter,
    sortBy,
  ]);

  const toggleSelectTask = (taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTasks.map((t) => t.id));
    }
  };

  const canDragReorder = view !== 'trash' && view !== 'archive';

  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    if (!canDragReorder) return;
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleTaskDragOver = (e: React.DragEvent, targetTaskId: string) => {
    if (!canDragReorder || !draggedTaskId || draggedTaskId === targetTaskId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTaskId !== targetTaskId) {
      setDragOverTaskId(targetTaskId);
    }
  };

  const handleTaskDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverColumn(null);
  };

  const handleDropOnTask = async (
    e: React.DragEvent,
    targetTaskId: string,
    targetColumnStatus?: TaskStatus
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedTaskId || e.dataTransfer.getData('text/plain');
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverColumn(null);

    if (!sourceId || !canDragReorder) return;

    const sourceTask = tasks.find((t) => t.id === sourceId);
    if (!sourceTask) return;

    // If dropped in Kanban across columns, update status first
    if (targetColumnStatus && sourceTask.status !== targetColumnStatus) {
      await onStatusChange(sourceTask, targetColumnStatus);
    }

    if (sourceId !== targetTaskId) {
      const reorderedVisible = reorderTasksList(
        filteredTasks,
        sourceId,
        targetTaskId
      );
      // Merge visible reordered IDs with remaining workspace tasks so global sortOrder stays clean
      const visibleSet = new Set(reorderedVisible.map((t) => t.id));
      const restIds = tasks
        .filter((t) => !visibleSet.has(t.id))
        .map((t) => t.id);
      const nextOrderedIds = [
        ...reorderedVisible.map((t) => t.id),
        ...restIds,
      ];
      if (sortBy !== 'custom') setSortBy('custom');
      await onReorderTasks(nextOrderedIds);
    }
  };

  const handleDropOnKanbanColumn = async (
    e: React.DragEvent,
    colStatus: TaskStatus
  ) => {
    e.preventDefault();
    const sourceId = draggedTaskId || e.dataTransfer.getData('text/plain');
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverColumn(null);
    if (!sourceId || !canDragReorder) return;
    const sourceTask = tasks.find((t) => t.id === sourceId);
    if (sourceTask && sourceTask.status !== colStatus) {
      await onStatusChange(sourceTask, colStatus);
    }
  };

  /**
   * Reusable Interactive Subtask Progress Bar + Expandable Checklist widget for List, Grid & Kanban cards.
   */
  const renderCardSubtaskProgress = (task: TaskItem, compact: boolean = false) => {
    const progress = computeSubtaskProgress(task.subtasks);
    if (progress.total === 0) return null;
    const isExpanded = Boolean(expandedSubtasks[task.id]);

    return (
      <div className={compact ? 'space-y-1.5 pt-1' : 'mt-2 max-w-md space-y-1.5'}>
        <button
          type="button"
          onClick={() =>
            setExpandedSubtasks((prev) => ({
              ...prev,
              [task.id]: !prev[task.id],
            }))
          }
          aria-expanded={isExpanded}
          className="w-full text-left group"
        >
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums mb-1">
            <span className="flex items-center gap-1 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>
                Subtasks {progress.completed}/{progress.total}
              </span>
            </span>
            <span
              className={
                progress.percentage === 100
                  ? 'text-[var(--status-success)] font-semibold'
                  : 'text-[var(--accent-primary)] font-medium'
              }
            >
              {progress.percentage}%
            </span>
          </div>
          <div
            className="w-full h-1.5 bg-[var(--bg-main)] overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${task.title} subtask completion ${progress.percentage}%`}
          >
            <div
              className={`h-full transition-all duration-300 ${
                progress.percentage === 100
                  ? 'bg-[var(--status-success)]'
                  : 'bg-[var(--accent-primary)]'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </button>

        {compact && isExpanded && (
          <div className="border-t border-[var(--border-subtle)] pt-2 space-y-1.5">
            {task.subtasks.map((st) => (
              <label
                key={st.id}
                className="flex items-center gap-2 text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={st.isCompleted}
                  onChange={(e) =>
                    onToggleSubtask(task.id, st.id, e.target.checked)
                  }
                  aria-label={`Toggle subtask ${st.title}`}
                  className="accent-[var(--accent-primary)] cursor-pointer shrink-0"
                />
                <span
                  className={`truncate ${
                    st.isCompleted
                      ? 'line-through text-[var(--text-muted)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  {st.title}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTaskRow = (task: TaskItem) => {
    const overdue = isTaskOverdue(task, now);
    const isDone = task.status === 'Completed';
    const isSelected = selectedIds.includes(task.id);
    const isExpanded = Boolean(expandedSubtasks[task.id]);
    const subProgress = computeSubtaskProgress(task.subtasks);
    const isDragging = draggedTaskId === task.id;
    const isDragTarget = dragOverTaskId === task.id && draggedTaskId !== task.id;

    return (
      <div
        key={task.id}
        draggable={canDragReorder}
        onDragStart={(e) => handleTaskDragStart(e, task.id)}
        onDragOver={(e) => handleTaskDragOver(e, task.id)}
        onDragEnd={handleTaskDragEnd}
        onDrop={(e) => handleDropOnTask(e, task.id)}
        data-task-id={task.id}
        className={`border-b border-[var(--border-subtle)] px-4 py-3.5 transition-colors ${
          isDragTarget ? 'border-t-2 border-t-[var(--accent-primary)]' : ''
        } ${isDragging ? 'opacity-45' : ''} ${
          isSelected
            ? 'bg-[var(--accent-primary)]/10'
            : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-secondary)]/70'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Drag Handle */}
            {canDragReorder && (
              <span
                title="Drag to reorder task"
                aria-label={`Drag handle for ${task.title}`}
                className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] cursor-grab active:cursor-grabbing shrink-0"
              >
                <GripVertical className="w-4 h-4" />
              </span>
            )}

            {/* Multi-select checkbox */}
            <input
              type="checkbox"
              aria-label={`Select task ${task.title}`}
              checked={isSelected}
              onChange={() => toggleSelectTask(task.id)}
              className="mt-1 accent-[var(--accent-primary)] cursor-pointer shrink-0"
            />

            {/* Completion toggle */}
            {view !== 'trash' && (
              <button
                type="button"
                onClick={() =>
                  onStatusChange(task, isDone ? 'Pending' : 'Completed')
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
            )}

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
                  <button
                    type="button"
                    onClick={() => onToggleImportant(task)}
                    aria-label={`Unmark ${task.title} as important`}
                    className="text-[var(--status-warning)] shrink-0"
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
              </div>

              {task.description && (
                <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-1">
                  {task.description}
                </p>
              )}

              {/* Unboxed Metadata Bar with Typographic Separators */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)] font-mono tabular-nums">
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
                <span aria-hidden="true">·</span>
                <span>{task.status}</span>

                {task.dueDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        overdue
                          ? 'text-[var(--status-danger)] font-medium flex items-center gap-1'
                          : ''
                      }
                    >
                      {overdue && <AlertTriangle className="w-3 h-3" />}
                      Due {task.dueDate}
                      {task.dueTime ? ` ${task.dueTime}` : ''}
                    </span>
                  </>
                )}

                {task.completedAt && view === 'completed' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--status-success)]">
                      Completed {formatLocalDate(new Date(task.completedAt))}
                    </span>
                  </>
                )}

                {task.deletedAt && view === 'trash' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--status-danger)]">
                      Deleted {formatLocalDate(new Date(task.deletedAt))}
                    </span>
                  </>
                )}

                {task.isDailyTask ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--accent-primary)]">Daily Restart</span>
                  </>
                ) : (
                  task.recurrencePattern !== 'none' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Repeats {task.recurrencePattern}</span>
                    </>
                  )
                )}

                {task.alarmEnabled && task.dueTime && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--accent-primary)] flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      Alarm {formatAlarmRingTime(task.dueTime, task.alarmMinutesBefore)} (
                      {task.alarmMinutesBefore}m early · {task.alarmSound})
                    </span>
                  </>
                )}

                {task.tags.map((tag) => (
                  <React.Fragment key={tag.id}>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--text-primary)]">
                      #{tag.name}
                    </span>
                  </React.Fragment>
                ))}

                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSubtasks((prev) => ({
                      ...prev,
                      [task.id]: !prev[task.id],
                    }))
                  }
                  className="hover:text-[var(--text-primary)] flex items-center gap-0.5"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Subtasks ({subProgress.completed}/{subProgress.total})
                </button>
              </div>

              {/* Interactive Subtask Progress Bar directly on List Task Card */}
              {renderCardSubtaskProgress(task, false)}
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {view === 'trash' ? (
              <>
                <button
                  type="button"
                  onClick={() => onRestoreTask(task)}
                  className="border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1 whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" /> Restore
                </button>
                {confirmPermanentDeleteId === task.id ? (
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task, true)}
                    className="bg-[var(--status-danger)] text-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                  >
                    Confirm Delete
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmPermanentDeleteId(task.id)}
                    className="border border-[var(--status-danger)] px-2.5 py-1 text-xs font-medium text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 whitespace-nowrap"
                  >
                    Delete Forever
                  </button>
                )}
              </>
            ) : view === 'archive' ? (
              <>
                <button
                  type="button"
                  onClick={() => onArchiveTask(task, false)}
                  className="border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1 whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" /> Restore
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTask(task, true)}
                  aria-label={`Permanently delete ${task.title}`}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                {!isDone && (
                  <button
                    type="button"
                    onClick={() => onStartFocus(task)}
                    aria-label={`Focus on ${task.title}`}
                    title="Start Focus Session"
                    className="border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1 whitespace-nowrap"
                  >
                    <Play className="w-3 h-3" /> Focus
                  </button>
                )}
                {isDone && (
                  <button
                    type="button"
                    onClick={() => onStatusChange(task, 'Pending')}
                    title="Restore to active tasks"
                    className="border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" /> Reopen
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleImportant(task)}
                  aria-label={`Toggle important for ${task.title}`}
                  title="Toggle Important"
                  className={`p-1.5 transition-colors ${
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
                  title="Edit task"
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateTask(task)}
                  aria-label={`Duplicate ${task.title}`}
                  title="Duplicate task"
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onArchiveTask(task, true)}
                  aria-label={`Archive ${task.title}`}
                  title="Archive task"
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTask(task, view === 'completed')}
                  aria-label={`Delete ${task.title}`}
                  title={
                    view === 'completed'
                      ? 'Permanently delete completed task'
                      : 'Move to Recently Deleted'
                  }
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inline Subtask Expansion */}
        {isExpanded && (
          <div className="mt-3 ml-8 pl-4 border-l border-[var(--border-subtle)] space-y-2">
            {task.subtasks.length > 0 ? (
              <ul className="space-y-1">
                {task.subtasks.map((st) => (
                  <li key={st.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={st.isCompleted}
                      onChange={(e) =>
                        onToggleSubtask(task.id, st.id, e.target.checked)
                      }
                      aria-label={`Subtask ${st.title}`}
                      className="accent-[var(--accent-primary)] cursor-pointer"
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
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                No subtasks defined yet.
              </p>
            )}

            {view !== 'trash' && (
              <div className="flex items-center gap-2 pt-1 max-w-md">
                <input
                  type="text"
                  value={inlineSubtaskInputs[task.id] || ''}
                  onChange={(e) =>
                    setInlineSubtaskInputs((prev) => ({
                      ...prev,
                      [task.id]: e.target.value,
                    }))
                  }
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (inlineSubtaskInputs[task.id] || '').trim();
                      if (!val) return;
                      setInlineSubtaskInputs((prev) => ({
                        ...prev,
                        [task.id]: '',
                      }));
                      await onAddSubtaskInline(task.id, val);
                    }
                  }}
                  placeholder="Add subtask and press Enter..."
                  className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const val = (inlineSubtaskInputs[task.id] || '').trim();
                    if (!val) return;
                    setInlineSubtaskInputs((prev) => ({
                      ...prev,
                      [task.id]: '',
                    }));
                    await onAddSubtaskInline(task.id, val);
                  }}
                  className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium hover:text-[var(--text-primary)]"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Grouped sections for Today view (Section 5.4)
  const renderTodaySections = () => {
    const overdueList = filteredTasks.filter((t) => isTaskOverdue(t, now));
    const highPriToday = filteredTasks.filter(
      (t) =>
        !isTaskOverdue(t, now) &&
        t.status !== 'Completed' &&
        t.priority === 'High' &&
        t.dueDate === todayStr
    );
    const remainingToday = filteredTasks.filter(
      (t) =>
        !isTaskOverdue(t, now) &&
        t.status !== 'Completed' &&
        t.priority !== 'High' &&
        t.dueDate === todayStr
    );
    const completedTodayList = filteredTasks.filter(
      (t) => t.status === 'Completed'
    );

    const pct =
      dailyTaskTarget > 0
        ? Math.min(
            100,
            Math.round((completedTodayList.length / dailyTaskTarget) * 100)
          )
        : 0;

    const groups = [
      {
        title: 'Overdue Responsibilities',
        items: overdueList,
        accent: 'text-[var(--status-danger)]',
      },
      {
        title: "Today's High-Priority Tasks",
        items: highPriToday,
        accent: 'text-[var(--status-warning)]',
      },
      {
        title: "Today's Remaining Tasks",
        items: remainingToday,
        accent: 'text-[var(--text-primary)]',
      },
      {
        title: 'Completed Today',
        items: completedTodayList,
        accent: 'text-[var(--status-success)]',
      },
    ];

    return (
      <div className="space-y-6">
        <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              Daily Execution Progress
            </div>
            <div className="text-sm font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
              {completedTodayList.length} completed ·{' '}
              {overdueList.length + highPriToday.length + remainingToday.length}{' '}
              remaining · Target {dailyTaskTarget} ({pct}%)
            </div>
          </div>
          <div className="w-full sm:w-64 h-2 bg-[var(--bg-main)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent-primary)] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {groups.map((g) =>
          g.items.length > 0 ? (
            <div
              key={g.title}
              className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
            >
              <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 flex items-center justify-between">
                <h3 className={`text-xs font-semibold ${g.accent}`}>{g.title}</h3>
                <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                  {g.items.length}
                </span>
              </div>
              <div>{g.items.map(renderTaskRow)}</div>
            </div>
          ) : null
        )}
      </div>
    );
  };

  // Grouped sections for Upcoming view (Section 5.5)
  const renderUpcomingSections = () => {
    const tomorrowTasks = filteredTasks.filter(
      (t) => t.dueDate === tomorrowStr
    );
    const thisWeekTasks = filteredTasks.filter(
      (t) =>
        t.dueDate &&
        t.dueDate > tomorrowStr &&
        t.dueDate <= endOfThisWeekStr
    );
    const nextWeekTasks = filteredTasks.filter(
      (t) =>
        t.dueDate &&
        t.dueDate > endOfThisWeekStr &&
        t.dueDate <= endOfNextWeekStr
    );
    const laterTasks = filteredTasks.filter(
      (t) => t.dueDate && t.dueDate > endOfNextWeekStr
    );

    const horizons = [
      { title: `Tomorrow (${tomorrowStr})`, items: tomorrowTasks },
      { title: 'This Week', items: thisWeekTasks },
      { title: 'Next Week', items: nextWeekTasks },
      { title: 'Later', items: laterTasks },
    ];

    return (
      <div className="space-y-6">
        {horizons.map((h) => (
          <div
            key={h.title}
            className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
          >
            <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                {h.title}
              </h3>
              <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                {h.items.length} tasks
              </span>
            </div>
            {h.items.length === 0 ? (
              <div className="px-4 py-5 text-xs text-[var(--text-muted)]">
                No tasks scheduled in this window.
              </div>
            ) : (
              <div>{h.items.map(renderTaskRow)}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {viewHeader.title}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {viewHeader.subtitle} ·{' '}
            <span className="font-mono tabular-nums">
              {filteredTasks.length} matching records
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {view === 'trash' && filteredTasks.length > 0 && (
            <>
              {confirmEmptyTrash ? (
                <button
                  type="button"
                  onClick={onEmptyTrash}
                  className="bg-[var(--status-danger)] text-white px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Confirm Empty All Trash
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmEmptyTrash(true)}
                  className="border border-[var(--status-danger)] px-3.5 py-2 text-xs font-medium text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 whitespace-nowrap shrink-0"
                >
                  Empty Trash
                </button>
              )}
            </>
          )}

          {view !== 'trash' && (
            <>
              <button
                type="button"
                onClick={() => onOpenCreateTask('quick')}
                className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Quick Add
              </button>
              <button
                type="button"
                onClick={() => onOpenCreateTask('detailed')}
                className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-4 py-2 text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Create Task
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search, Combined Filters, Sort, and View Switcher Bar */}
      <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Debounced Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Search tasks by title, description, category, or #tag..."
              aria-label="Search tasks"
              className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {/* View Modes: List / Grid / Kanban */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-main)] p-0.5"
              role="group"
              aria-label="Task viewing mode"
            >
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  viewMode === 'list'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  viewMode === 'grid'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  viewMode === 'kanban'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Columns className="w-3.5 h-3.5" /> Board
              </button>
            </div>

            {/* Sort selector */}
            <select
              aria-label="Sort tasks by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="custom">Sort: Custom Order (Drag & Drop)</option>
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="due_date">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="alphabetical">Sort: Alphabetical</option>
              <option value="updated">Sort: Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Combined Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="ALL">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="ALL">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="ALL">All Categories</option>
            <option value="UNCATEGORIZED">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by tag"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="ALL">All Tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                #{tag.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyImportantFilter(!onlyImportantFilter)}
            className={`border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              onlyImportantFilter
                ? 'border-[var(--status-warning)] text-[var(--status-warning)] bg-[var(--status-warning)]/10'
                : 'border-[var(--border-subtle)] bg-[var(--bg-main)] text-[var(--text-secondary)]'
            }`}
          >
            ★ Only Important
          </button>

          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span>Due:</span>
            <input
              type="date"
              aria-label="Filter due date from"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2 py-1 text-xs font-mono text-[var(--text-primary)]"
            />
            <span>to</span>
            <input
              type="date"
              aria-label="Filter due date to"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2 py-1 text-xs font-mono text-[var(--text-primary)]"
            />
          </div>

          {(rawSearch ||
            statusFilter !== 'ALL' ||
            priorityFilter !== 'ALL' ||
            categoryFilter !== 'ALL' ||
            tagFilter !== 'ALL' ||
            onlyImportantFilter ||
            dateFromFilter ||
            dateToFilter) && (
            <button
              type="button"
              onClick={() => {
                setRawSearch('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setCategoryFilter('ALL');
                setTagFilter('ALL');
                setOnlyImportantFilter(false);
                setDateFromFilter('');
                setDateToFilter('');
              }}
              className="text-xs text-[var(--accent-primary)] hover:underline px-2 py-1 whitespace-nowrap"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Operations Bar */}
      {selectedIds.length > 0 && (
        <div className="border border-[var(--accent-primary)] bg-[var(--bg-elevated)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono tabular-nums font-semibold text-[var(--accent-primary)]">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
            >
              {selectedIds.length === filteredTasks.length
                ? 'Deselect All'
                : 'Select All Visible'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {view !== 'trash' ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await onBulkAction(selectedIds, 'complete');
                    setSelectedIds([]);
                  }}
                  className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-3 py-1 text-xs font-semibold whitespace-nowrap"
                >
                  Mark Completed
                </button>
                <select
                  aria-label="Bulk change status"
                  defaultValue=""
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    await onBulkAction(selectedIds, 'status', e.target.value);
                    e.target.value = '';
                    setSelectedIds([]);
                  }}
                  className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value="">Set Status...</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
                <select
                  aria-label="Bulk change priority"
                  defaultValue=""
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    await onBulkAction(selectedIds, 'priority', e.target.value);
                    e.target.value = '';
                    setSelectedIds([]);
                  }}
                  className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value="">Set Priority...</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <select
                  aria-label="Bulk change category"
                  defaultValue=""
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    const val =
                      e.target.value === 'NONE' ? null : e.target.value;
                    await onBulkAction(selectedIds, 'category', val);
                    e.target.value = '';
                    setSelectedIds([]);
                  }}
                  className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value="">Move Category...</option>
                  <option value="NONE">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    await onBulkAction(
                      selectedIds,
                      view === 'archive' ? 'restore' : 'archive'
                    );
                    setSelectedIds([]);
                  }}
                  className="border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-primary)] hover:border-[var(--accent-primary)] whitespace-nowrap"
                >
                  {view === 'archive' ? 'Restore Selected' : 'Archive Selected'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onBulkAction(selectedIds, 'delete');
                    setSelectedIds([]);
                  }}
                  className="border border-[var(--status-danger)] px-2.5 py-1 text-xs text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 whitespace-nowrap"
                >
                  Delete Selected
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await onBulkAction(selectedIds, 'restore');
                    setSelectedIds([]);
                  }}
                  className="border border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]"
                >
                  Restore Selected
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onBulkAction(selectedIds, 'permanent_delete');
                    setSelectedIds([]);
                  }}
                  className="bg-[var(--status-danger)] text-white px-3 py-1 text-xs font-semibold"
                >
                  Permanently Delete Selected
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Task List / Grid / Kanban Rendering */}
      {filteredTasks.length === 0 ? (
        <div className="border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-14 px-6 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No tasks match this view or filter criteria.
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
            {view === 'trash'
              ? 'Your Recently Deleted trash is clean.'
              : view === 'archive'
                ? 'Archived tasks will appear here for long-term reference.'
                : 'Create a new task or adjust active filters to populate this workspace.'}
          </p>
          {view !== 'trash' && view !== 'archive' && (
            <button
              type="button"
              onClick={() => onOpenCreateTask('detailed')}
              className="mt-4 bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-4 py-2 text-xs font-semibold hover:opacity-90"
            >
              Create First Task
            </button>
          )}
        </div>
      ) : view === 'today' && viewMode === 'list' ? (
        renderTodaySections()
      ) : view === 'upcoming' && viewMode === 'list' ? (
        renderUpcomingSections()
      ) : viewMode === 'list' ? (
        <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  selectedIds.length > 0 &&
                  selectedIds.length === filteredTasks.length
                }
                onChange={toggleSelectAll}
                className="accent-[var(--accent-primary)]"
              />
              <span>Select all ({filteredTasks.length})</span>
            </label>
            <span className="font-mono">
              {canDragReorder
                ? 'Drag handle to reorder · Click title to edit'
                : 'Click any task title to edit'}
            </span>
          </div>
          <div>{filteredTasks.map(renderTaskRow)}</div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const overdue = isTaskOverdue(task, now);
            const isDone = task.status === 'Completed';
            const isDragging = draggedTaskId === task.id;
            const isDragTarget =
              dragOverTaskId === task.id && draggedTaskId !== task.id;
            return (
              <div
                key={task.id}
                draggable={canDragReorder}
                onDragStart={(e) => handleTaskDragStart(e, task.id)}
                onDragOver={(e) => handleTaskDragOver(e, task.id)}
                onDragEnd={handleTaskDragEnd}
                onDrop={(e) => handleDropOnTask(e, task.id)}
                data-task-id={task.id}
                className={`border bg-[var(--bg-elevated)] p-5 flex flex-col justify-between gap-4 transition-all ${
                  isDragTarget
                    ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)]'
                } ${isDragging ? 'opacity-45' : ''}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {canDragReorder && (
                        <span
                          title="Drag to reorder"
                          className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onStatusChange(
                            task,
                            isDone ? 'Pending' : 'Completed'
                          )
                        }
                        aria-label={`Toggle status for ${task.title}`}
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
                        className={`text-left text-sm font-semibold hover:underline ${
                          isDone
                            ? 'line-through text-[var(--text-muted)]'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {task.title}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleImportant(task)}
                      aria-label={`Star ${task.title}`}
                      className={
                        task.isImportant
                          ? 'text-[var(--status-warning)]'
                          : 'text-[var(--text-muted)]'
                      }
                    >
                      <Star
                        className={`w-4 h-4 ${
                          task.isImportant ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {task.description && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {/* Interactive Subtask Progress Bar on Grid Card */}
                  {renderCardSubtaskProgress(task, true)}
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                  <div>
                    <span>{task.categoryName || 'Uncategorized'}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{task.priority}</span>
                  </div>
                  <div
                    className={
                      overdue ? 'text-[var(--status-danger)] font-medium' : ''
                    }
                  >
                    {task.dueDate || 'No date'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Kanban Board grouped by Status with Drag-and-Drop across & within columns */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {(['Pending', 'In Progress', 'Completed'] as TaskStatus[]).map(
            (colStatus) => {
              const colTasks = filteredTasks.filter(
                (t) => t.status === colStatus
              );
              const isColTarget = dragOverColumn === colStatus;
              return (
                <div
                  key={colStatus}
                  onDragOver={(e) => {
                    if (!canDragReorder) return;
                    e.preventDefault();
                    if (dragOverColumn !== colStatus) setDragOverColumn(colStatus);
                  }}
                  onDragLeave={() => {
                    if (dragOverColumn === colStatus) setDragOverColumn(null);
                  }}
                  onDrop={(e) => handleDropOnKanbanColumn(e, colStatus)}
                  className={`border bg-[var(--bg-secondary)] transition-colors ${
                    isColTarget
                      ? 'border-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                      {colStatus}
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="p-3 space-y-3 min-h-[240px]">
                    {colTasks.map((task) => {
                      const overdue = isTaskOverdue(task, now);
                      const isDragging = draggedTaskId === task.id;
                      const isCardTarget =
                        dragOverTaskId === task.id && draggedTaskId !== task.id;
                      return (
                        <div
                          key={task.id}
                          draggable={canDragReorder}
                          onDragStart={(e) => handleTaskDragStart(e, task.id)}
                          onDragOver={(e) => handleTaskDragOver(e, task.id)}
                          onDragEnd={handleTaskDragEnd}
                          onDrop={(e) => handleDropOnTask(e, task.id, colStatus)}
                          data-task-id={task.id}
                          className={`border bg-[var(--bg-elevated)] p-3.5 space-y-2.5 transition-all ${
                            isCardTarget
                              ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
                              : 'border-[var(--border-subtle)]'
                          } ${isDragging ? 'opacity-45' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-1.5 min-w-0">
                              {canDragReorder && (
                                <span
                                  title="Drag card to reorder or move column"
                                  className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] cursor-grab active:cursor-grabbing shrink-0"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onEditTask(task)}
                                className="text-left text-sm font-medium text-[var(--text-primary)] hover:underline"
                              >
                                {task.title}
                              </button>
                            </div>
                            {task.isImportant && (
                              <Star className="w-3.5 h-3.5 text-[var(--status-warning)] fill-current shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] font-mono tabular-nums">
                            <span>{task.categoryName || 'Uncategorized'}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{task.priority}</span>
                            {task.dueDate && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span
                                  className={
                                    overdue ? 'text-[var(--status-danger)]' : ''
                                  }
                                >
                                  {task.dueDate}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Interactive Subtask Progress Bar directly on Kanban Card */}
                          {renderCardSubtaskProgress(task, true)}

                          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs">
                            <select
                              aria-label={`Change status for ${task.title}`}
                              value={task.status}
                              onChange={(e) =>
                                onStatusChange(
                                  task,
                                  e.target.value as TaskStatus
                                )
                              }
                              className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-2 py-1 text-xs text-[var(--text-primary)]"
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => onStartFocus(task)}
                              className="text-xs text-[var(--accent-primary)] hover:underline"
                            >
                              Focus →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
};
