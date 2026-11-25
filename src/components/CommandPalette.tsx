import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  FolderKanban,
  Keyboard,
  LayoutDashboard,
  ListTodo,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Sun,
  Timer,
  X,
} from 'lucide-react';
import { TaskItem } from '../utils/taskLogic';

export type NavSectionId =
  | 'dashboard'
  | 'tasks-daily'
  | 'tasks-all'
  | 'tasks-today'
  | 'tasks-upcoming'
  | 'tasks-in-progress'
  | 'tasks-completed'
  | 'tasks-important'
  | 'tasks-overdue'
  | 'tasks-trash'
  | 'categories'
  | 'calendar'
  | 'focus'
  | 'analytics'
  | 'archive'
  | 'settings';

interface QuickSearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: NavSectionId) => void;
  onOpenCreateTask: (mode: 'detailed' | 'quick') => void;
  onToggleTheme: () => void;
  onSelectTaskForEdit: (task: TaskItem) => void;
  tasks: TaskItem[];
}

export const CommandPalette: React.FC<QuickSearchPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenCreateTask,
  onToggleTheme,
  onSelectTaskForEdit,
  tasks,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickActions = [
    {
      id: 'action-create-task',
      label: 'Create New Task',
      shortcut: 'N',
      icon: Plus,
      action: () => {
        onClose();
        onOpenCreateTask('detailed');
      },
    },
    {
      id: 'action-quick-add',
      label: 'Smart Quick Add Task',
      shortcut: 'Q',
      icon: Sparkles,
      action: () => {
        onClose();
        onOpenCreateTask('quick');
      },
    },
    {
      id: 'action-dashboard',
      label: 'Open Dashboard',
      shortcut: 'G D',
      icon: LayoutDashboard,
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'action-daily-tasks',
      label: 'Open Daily Tasks (Auto-Restart)',
      shortcut: 'G R',
      icon: Repeat,
      action: () => {
        onNavigate('tasks-daily');
        onClose();
      },
    },
    {
      id: 'action-my-tasks',
      label: 'Open My Tasks (All Tasks)',
      shortcut: 'G T',
      icon: ListTodo,
      action: () => {
        onNavigate('tasks-all');
        onClose();
      },
    },
    {
      id: 'action-today',
      label: 'Open Today Workspace',
      shortcut: '',
      icon: Calendar,
      action: () => {
        onNavigate('tasks-today');
        onClose();
      },
    },
    {
      id: 'action-calendar',
      label: 'Open Interactive Calendar',
      shortcut: 'G C',
      icon: Calendar,
      action: () => {
        onNavigate('calendar');
        onClose();
      },
    },
    {
      id: 'action-focus',
      label: 'Open Focus Mode & Pomodoro Timer',
      shortcut: 'G F',
      icon: Timer,
      action: () => {
        onNavigate('focus');
        onClose();
      },
    },
    {
      id: 'action-completed',
      label: 'Open Completed Tasks',
      shortcut: '',
      icon: CheckCircle2,
      action: () => {
        onNavigate('tasks-completed');
        onClose();
      },
    },
    {
      id: 'action-categories',
      label: 'Manage Categories',
      shortcut: '',
      icon: FolderKanban,
      action: () => {
        onNavigate('categories');
        onClose();
      },
    },
    {
      id: 'action-analytics',
      label: 'Open Productivity Analytics',
      shortcut: 'G A',
      icon: BarChart3,
      action: () => {
        onNavigate('analytics');
        onClose();
      },
    },
    {
      id: 'action-settings',
      label: 'Open Settings & Themes',
      shortcut: 'G S',
      icon: Settings,
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
    {
      id: 'action-theme',
      label: 'Toggle Dark / Light Theme',
      shortcut: '',
      icon: Sun,
      action: () => {
        onToggleTheme();
        onClose();
      },
    },
  ];

  const q = query.trim().toLowerCase();
  const filteredActions = quickActions.filter((a) =>
    a.label.toLowerCase().includes(q)
  );

  const matchingTasks = q
    ? tasks
        .filter(
          (t) =>
            !t.deletedAt &&
            (t.title.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q) ||
              (t.categoryName && t.categoryName.toLowerCase().includes(q)))
        )
        .slice(0, 6)
    : [];

  const totalItems = filteredActions.length + matchingTasks.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0
      );
    } else if (e.key === 'Enter' && totalItems > 0) {
      e.preventDefault();
      if (activeIndex < filteredActions.length) {
        filteredActions[activeIndex].action();
      } else {
        const taskIdx = activeIndex - filteredActions.length;
        const selectedTask = matchingTasks[taskIdx];
        if (selectedTask) {
          onClose();
          onSelectTaskForEdit(selectedTask);
        }
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Search"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search tasks or jump to any section..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <span className="text-xs font-mono text-[var(--text-muted)]">ESC</span>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {filteredActions.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                Quick Actions
              </div>
              {filteredActions.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {item.shortcut && (
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {matchingTasks.length > 0 && (
            <div>
              <div className="px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                Matching Tasks
              </div>
              {matchingTasks.map((task, idx) => {
                const itemIdx = filteredActions.length + idx;
                const isSelected = itemIdx === activeIndex;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectTaskForEdit(task);
                    }}
                    onMouseEnter={() => setActiveIndex(itemIdx)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <span className="truncate pr-3">{task.title}</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono shrink-0">
                      {task.categoryName || 'Uncategorized'} · {task.priority}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {totalItems === 0 && (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              No matching sections or tasks found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ShortcutsHelpModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const navigationShortcuts = [
    { key: 'Alt + Left / Right', action: 'Navigate Back / Forward' },
    { key: 'G then D', action: 'Go to Dashboard' },
    { key: 'G then R', action: 'Go to Daily Tasks' },
    { key: 'G then T', action: 'Go to All Tasks' },
    { key: 'G then C', action: 'Go to Calendar' },
    { key: 'G then F', action: 'Go to Focus Mode' },
    { key: 'G then A', action: 'Go to Analytics' },
    { key: 'G then S', action: 'Go to Settings & Themes' },
  ];

  const actionShortcuts = [
    { key: 'N', action: 'Create a new task' },
    { key: 'Q', action: 'Open Smart Quick Add parser' },
    { key: 'Ctrl + K', action: 'Open Quick Search' },
    { key: '/', action: 'Focus task search input' },
    { key: 'Ctrl + Z', action: 'Undo last task action' },
    { key: 'Ctrl + Y', action: 'Redo undone action' },
    { key: 'Ctrl + Enter', action: 'Save task inside task dialog' },
    { key: '?', action: 'Toggle this shortcuts cheat sheet' },
    { key: 'Esc', action: 'Close active dialog or search' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-[var(--text-primary)] shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-5">
          <div>
            <h2
              id="shortcuts-modal-title"
              className="text-base font-semibold flex items-center gap-2"
            >
              <Keyboard className="w-4 h-4 text-[var(--accent-primary)]" />
              Keyboard Shortcuts Cheat Sheet
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Persistent cross-platform shortcuts active anywhere outside text inputs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts cheat sheet"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent-primary)] mb-2">
              Navigation
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {navigationShortcuts.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between py-2 text-xs gap-2"
                >
                  <span className="text-[var(--text-secondary)]">{s.action}</span>
                  <kbd className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-primary)] shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent-primary)] mb-2">
              Tasks & Actions
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {actionShortcuts.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between py-2 text-xs gap-2"
                >
                  <span className="text-[var(--text-secondary)]">{s.action}</span>
                  <kbd className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-primary)] shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
