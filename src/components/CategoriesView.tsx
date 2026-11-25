import React, { useState } from 'react';
import { Check, Edit3, FolderKanban, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { CategoryItem, TaskItem } from '../utils/taskLogic';

const COLOR_SWATCHES = [
  '#C6F36B',
  '#83C995',
  '#60A5FA',
  '#E7B96A',
  '#E77F79',
  '#F472B6',
  '#A78BFA',
  '#38BDF8',
  '#A1A69D',
];

interface CategoriesViewProps {
  categories: CategoryItem[];
  tasks: TaskItem[];
  onCreateCategory: (name: string, color: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string, color: string) => Promise<void>;
  onDeleteCategory: (id: string, reassignTo: string | null) => Promise<void>;
  onEditTask: (task: TaskItem) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  tasks,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onEditTask,
}) => {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#C6F36B');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#C6F36B');
  const [deletingCat, setDeletingCat] = useState<CategoryItem | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    categories[0]?.id || null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeTasks = tasks.filter((t) => !t.deletedAt && !t.isArchived);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMsg('Category name cannot be empty.');
      return;
    }
    try {
      await onCreateCategory(trimmed, newColor);
      setNewName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create category');
    }
  };

  const handleStartEdit = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
    setErrorMsg(null);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setErrorMsg('Category name is required.');
      return;
    }
    try {
      await onUpdateCategory(id, trimmed, editColor);
      setEditingId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update category');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCat) return;
    try {
      await onDeleteCategory(
        deletingCat.id,
        reassignTargetId ? reassignTargetId : null
      );
      if (selectedCategoryId === deletingCat.id) {
        setSelectedCategoryId(categories[0]?.id || null);
      }
      setDeletingCat(null);
      setReassignTargetId('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete category');
    }
  };

  const inspectedTasks = activeTasks.filter((t) =>
    selectedCategoryId === 'UNCATEGORIZED'
      ? !t.categoryId
      : t.categoryId === selectedCategoryId
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="border-b border-[var(--border-subtle)] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Categories & Classification
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Organize primary task classifications. Deleting a category never deletes
            its tasks.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
          {categories.length} configured categories
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="border border-[var(--status-danger)] bg-[var(--status-danger)]/10 px-4 py-2.5 text-xs text-[var(--status-danger)]"
        >
          {errorMsg}
        </div>
      )}

      {/* Create New Category Bar */}
      <form
        onSubmit={handleCreate}
        className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        <div className="flex-1">
          <label htmlFor="new-category-name" className="sr-only">
            New Category Name
          </label>
          <input
            id="new-category-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Create custom category (e.g. Research, Finance, Fitness)..."
            className="w-full border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setNewColor(swatch)}
              aria-label={`Select color ${swatch}`}
              className={`w-6 h-6 border transition-transform ${
                newColor === swatch
                  ? 'border-[var(--text-primary)] scale-110'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
        <button
          type="submit"
          className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-4 py-2 text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Category
        </button>
      </form>

      {/* Category Deletion & Task Reassignment Confirmation Dialog */}
      {deletingCat && (
        <div className="border border-[var(--status-warning)] bg-[var(--bg-elevated)] p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Delete Category &ldquo;{deletingCat.name}&rdquo;
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Associated tasks will be preserved. Choose whether to reassign them to
                another category or leave them uncategorized:
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeletingCat(null)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <select
              aria-label="Reassign tasks to category"
              value={reassignTargetId}
              onChange={(e) => setReassignTargetId(e.target.value)}
              className="border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="">Leave tasks Uncategorized</option>
              {categories
                .filter((c) => c.id !== deletingCat.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    Move tasks to {c.name}
                  </option>
                ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="bg-[var(--status-danger)] text-white px-4 py-2 text-xs font-semibold whitespace-nowrap"
              >
                Confirm Delete Category
              </button>
              <button
                type="button"
                onClick={() => setDeletingCat(null)}
                className="border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Layout: Categories List + Tasks in Selected Category */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-subtle)]">
          {categories.map((cat) => {
            const count = activeTasks.filter((t) => t.categoryId === cat.id).length;
            const isEditing = editingId === cat.id;
            const isSelected = selectedCategoryId === cat.id;

            return (
              <div
                key={cat.id}
                className={`p-4 transition-colors ${
                  isSelected
                    ? 'bg-[var(--bg-secondary)]'
                    : 'hover:bg-[var(--bg-secondary)]/50'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Edit category name"
                        className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat.id)}
                        className="bg-[var(--accent-surface)] text-[var(--accent-contrast)] px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {COLOR_SWATCHES.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          onClick={() => setEditColor(swatch)}
                          className={`w-5 h-5 border ${
                            editColor === swatch
                              ? 'border-[var(--text-primary)] scale-110'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0"
                    >
                      <span
                        className="w-3.5 h-3.5 shrink-0 inline-block"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                          <span>{cat.name}</span>
                          {cat.isDefault && (
                            <span className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                          {count} active {count === 1 ? 'task' : 'tasks'}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        aria-label={`Edit category ${cat.name}`}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {!cat.isDefault && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingCat(cat);
                            setReassignTargetId('');
                          }}
                          aria-label={`Delete category ${cat.name}`}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized bucket */}
          <div className="p-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('UNCATEGORIZED')}
              className="flex items-center gap-3 text-left flex-1"
            >
              <span className="w-3.5 h-3.5 bg-[var(--text-muted)] inline-block" />
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Uncategorized
                </div>
                <div className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                  {activeTasks.filter((t) => !t.categoryId).length} active tasks
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Inspector for Selected Category */}
        <div className="lg:col-span-5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[var(--accent-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {selectedCategoryId === 'UNCATEGORIZED'
                  ? 'Uncategorized Tasks'
                  : categories.find((c) => c.id === selectedCategoryId)?.name ||
                    'Category Tasks'}
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
              {inspectedTasks.length} tasks
            </span>
          </div>

          {inspectedTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No active tasks in this category.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {inspectedTasks.map((t) => (
                <div
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onEditTask(t)}
                    className={`flex-1 min-w-0 text-left font-medium hover:underline truncate ${
                      t.status === 'Completed'
                        ? 'line-through text-[var(--text-muted)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {t.title}
                  </button>
                  <span className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                    {t.priority} · {t.dueDate || 'No date'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
