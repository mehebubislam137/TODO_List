import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';
import {
  AuthRequest,
  createAnonymousWorkspaceToken,
  requireAuth,
} from './src/middleware/auth.ts';
import {
  acknowledgeTaskAlarmForUser,
  archiveTaskForUser,
  bulkUpdateTasksForUser,
  createCategoryForUser,
  createSubtaskForTask,
  createTagForUser,
  createTaskForUser,
  deleteCategoryForUser,
  deleteSubtaskForUser,
  deleteTagForUser,
  duplicateTaskForUser,
  emptyTrashForUser,
  ensureWorkspaceInitialized,
  getActiveAlarmsForUser,
  getAllTasksForUser,
  getAnalyticsForUser,
  getCategoriesForUser,
  getDashboardDataForUser,
  getFocusSessionsForUser,
  getFocusStatsForUser,
  getPreferencesForUser,
  getRecentActivityForUser,
  getSubtasksForTask,
  getTagsForUser,
  getTaskByIdForUser,
  permanentDeleteTaskForUser,
  recordFocusSessionForUser,
  reorderTasksForUser,
  resetDailyTasksForUser,
  restoreTaskForUser,
  snoozeTaskAlarmForUser,
  softDeleteTaskForUser,
  updateCategoryForUser,
  updatePreferencesForUser,
  updateSubtaskForUser,
  updateTagForUser,
  updateTaskForUser,
} from './src/db/repository.ts';
import { validateTaskInput } from './src/utils/taskLogic.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security headers & JSON request size limit
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '5mb' }));

  // Health-check endpoint (Section 22)
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      message: 'TASKFLOW API service healthy',
      data: { status: 'ok', timestamp: new Date().toISOString() },
    });
  });

  // 1. Automatic Anonymous Authentication Session endpoint (Section 3 & Section 13)
  app.post('/api/auth/anonymous', async (req, res) => {
    try {
      const existingUid =
        typeof req.body?.existingUid === 'string' ? req.body.existingUid : undefined;
      const session = createAnonymousWorkspaceToken(existingUid);
      await ensureWorkspaceInitialized(session.uid, session.email, true);
      res.json({
        success: true,
        message: 'Anonymous workspace session established',
        data: session,
      });
    } catch (error: any) {
      console.error('Error initializing anonymous session:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to establish anonymous session',
      });
    }
  });

  // 2. Full Workspace Bootstrap (Protected)
  app.post('/api/workspace/init', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const clientToday =
        typeof req.body?.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.localDate)
          ? req.body.localDate
          : undefined;
      await ensureWorkspaceInitialized(user.uid, user.email, user.isAnonymous);

      const [tasks, categories, tags, preferences, dashboard, focusSessions, analytics] =
        await Promise.all([
          getAllTasksForUser(user.uid, clientToday),
          getCategoriesForUser(user.uid),
          getTagsForUser(user.uid),
          getPreferencesForUser(user.uid),
          getDashboardDataForUser(user.uid),
          getFocusSessionsForUser(user.uid),
          getAnalyticsForUser(user.uid),
        ]);

      res.json({
        success: true,
        message: 'Workspace initialized successfully',
        data: {
          user,
          tasks,
          categories,
          tags,
          preferences,
          dashboard,
          focusSessions,
          analytics,
        },
      });
    } catch (error: any) {
      console.error('Error bootstrapping workspace:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load workspace data',
      });
    }
  });

  // --- TASKS ENDPOINTS ---
  app.get('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const clientToday =
        typeof req.query.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate)
          ? req.query.localDate
          : undefined;
      const tasks = await getAllTasksForUser(req.user!.uid, clientToday);
      res.json({
        success: true,
        message: 'Tasks retrieved successfully',
        data: tasks,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch tasks',
      });
    }
  });

  app.post('/api/tasks/daily/reset', requireAuth, async (req: AuthRequest, res) => {
    try {
      const localDate =
        typeof req.body?.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.localDate)
          ? req.body.localDate
          : undefined;
      const force = Boolean(req.body?.force);
      const result = await resetDailyTasksForUser(req.user!.uid, localDate, force);
      const tasks = await getAllTasksForUser(req.user!.uid, localDate);
      res.json({
        success: true,
        message:
          result.resetCount > 0
            ? `Restarted ${result.resetCount} daily tasks`
            : 'Daily tasks are already fresh for today',
        data: { ...result, tasks },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reset daily tasks',
      });
    }
  });

  app.patch('/api/tasks/reorder', requireAuth, async (req: AuthRequest, res) => {
    try {
      const orderedTaskIds = req.body?.orderedTaskIds;
      if (
        !Array.isArray(orderedTaskIds) ||
        orderedTaskIds.some((id) => typeof id !== 'string')
      ) {
        return res.status(400).json({
          success: false,
          message: 'orderedTaskIds must be an array of task IDs',
        });
      }
      await reorderTasksForUser(req.user!.uid, orderedTaskIds);
      const tasks = await getAllTasksForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Task order saved',
        data: tasks,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reorder tasks',
      });
    }
  });

  // --- ALARM NOTIFICATION API ENDPOINTS ---
  app.get('/api/alarms', requireAuth, async (req: AuthRequest, res) => {
    try {
      const clientToday =
        typeof req.query.localDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate)
          ? req.query.localDate
          : undefined;
      const alarms = await getActiveAlarmsForUser(req.user!.uid, clientToday);
      res.json({
        success: true,
        message: 'Active alarms retrieved',
        data: alarms,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve active alarms',
      });
    }
  });

  app.post(
    '/api/alarms/:taskId/acknowledge',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const triggerStamp =
          typeof req.body?.triggerStamp === 'string' &&
          req.body.triggerStamp.trim()
            ? req.body.triggerStamp.trim()
            : new Date().toISOString();
        const updated = await acknowledgeTaskAlarmForUser(
          req.user!.uid,
          req.params.taskId,
          triggerStamp
        );
        res.json({
          success: true,
          message: 'Task alarm acknowledged',
          data: updated,
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to acknowledge alarm',
        });
      }
    }
  );

  app.post(
    '/api/alarms/:taskId/snooze',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const minutes = Number(req.body?.minutes ?? 5);
        const result = await snoozeTaskAlarmForUser(
          req.user!.uid,
          req.params.taskId,
          minutes
        );
        res.json({
          success: true,
          message: `Alarm snoozed for ${minutes} minutes`,
          data: result,
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to snooze alarm',
        });
      }
    }
  );

  app.get('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const task = await getTaskByIdForUser(req.user!.uid, req.params.id);
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
        });
      }
      res.json({
        success: true,
        message: 'Task retrieved successfully',
        data: task,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch task',
      });
    }
  });

  app.post('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const validation = validateTaskInput(req.body || {});
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
        });
      }
      const created = await createTaskForUser(req.user!.uid, req.body);
      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: created,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create task',
      });
    }
  });

  app.put('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.body?.title !== undefined) {
        const validation = validateTaskInput(req.body);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.error,
          });
        }
      }
      const updated = await updateTaskForUser(req.user!.uid, req.params.id, req.body);
      res.json({
        success: true,
        message: 'Task updated successfully',
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update task',
      });
    }
  });

  app.delete('/api/tasks/trash/empty', requireAuth, async (req: AuthRequest, res) => {
    try {
      await emptyTrashForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Trash emptied permanently',
        data: null,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to empty trash',
      });
    }
  });

  app.delete('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const permanent = req.query.permanent === 'true';
      if (permanent) {
        await permanentDeleteTaskForUser(req.user!.uid, req.params.id);
        return res.json({
          success: true,
          message: 'Task permanently deleted',
          data: { id: req.params.id, permanent: true },
        });
      } else {
        await softDeleteTaskForUser(req.user!.uid, req.params.id);
        return res.json({
          success: true,
          message: 'Task moved to Recently Deleted',
          data: { id: req.params.id, permanent: false },
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete task',
      });
    }
  });

  app.patch('/api/tasks/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      if (!['Pending', 'In Progress', 'Completed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid task status value',
        });
      }
      const updated = await updateTaskForUser(req.user!.uid, req.params.id, { status });
      res.json({
        success: true,
        message: `Task status updated to ${status}`,
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update task status',
      });
    }
  });

  app.patch('/api/tasks/:id/priority', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { priority } = req.body;
      if (!['Low', 'Medium', 'High'].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid task priority value',
        });
      }
      const updated = await updateTaskForUser(req.user!.uid, req.params.id, { priority });
      res.json({
        success: true,
        message: `Task priority updated to ${priority}`,
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update task priority',
      });
    }
  });

  app.patch('/api/tasks/:id/archive', requireAuth, async (req: AuthRequest, res) => {
    try {
      const isArchived =
        req.body?.isArchived !== undefined ? Boolean(req.body.isArchived) : true;
      const updated = await archiveTaskForUser(
        req.user!.uid,
        req.params.id,
        isArchived
      );
      res.json({
        success: true,
        message: isArchived ? 'Task archived' : 'Task restored from archive',
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to archive task',
      });
    }
  });

  app.patch('/api/tasks/:id/restore', requireAuth, async (req: AuthRequest, res) => {
    try {
      const restored = await restoreTaskForUser(req.user!.uid, req.params.id);
      res.json({
        success: true,
        message: 'Task restored to active tasks',
        data: restored,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to restore task',
      });
    }
  });

  app.post('/api/tasks/:id/duplicate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const duplicated = await duplicateTaskForUser(req.user!.uid, req.params.id);
      res.status(201).json({
        success: true,
        message: 'Task duplicated successfully',
        data: duplicated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to duplicate task',
      });
    }
  });

  app.post('/api/tasks/bulk', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { taskIds, action, value } = req.body;
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one task for bulk operation',
        });
      }
      await bulkUpdateTasksForUser(req.user!.uid, taskIds, action, value);
      const tasks = await getAllTasksForUser(req.user!.uid);
      res.json({
        success: true,
        message: `Bulk ${action} completed for ${taskIds.length} tasks`,
        data: tasks,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to perform bulk operation',
      });
    }
  });

  // --- CATEGORIES ENDPOINTS ---
  app.get('/api/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCategoriesForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Categories loaded',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch categories',
      });
    }
  });

  app.post('/api/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, color } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required',
        });
      }
      const created = await createCategoryForUser(req.user!.uid, name, color);
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: created,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create category',
      });
    }
  });

  app.put('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, color } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required',
        });
      }
      const updated = await updateCategoryForUser(
        req.user!.uid,
        req.params.id,
        name,
        color
      );
      res.json({
        success: true,
        message: 'Category updated successfully',
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update category',
      });
    }
  });

  app.delete('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const reassignToCategoryId =
        typeof req.query.reassignTo === 'string' && req.query.reassignTo.trim()
          ? req.query.reassignTo.trim()
          : null;
      await deleteCategoryForUser(
        req.user!.uid,
        req.params.id,
        reassignToCategoryId
      );
      res.json({
        success: true,
        message: 'Category deleted and associated tasks preserved',
        data: { id: req.params.id },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete category',
      });
    }
  });

  // --- TAGS ENDPOINTS ---
  app.get('/api/tags', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getTagsForUser(req.user!.uid);
      res.json({ success: true, message: 'Tags retrieved', data });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load tags',
      });
    }
  });

  app.post('/api/tags', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, color } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Tag name is required',
        });
      }
      const created = await createTagForUser(req.user!.uid, name, color);
      res.status(201).json({
        success: true,
        message: 'Tag created',
        data: created,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create tag',
      });
    }
  });

  app.put('/api/tags/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, color } = req.body;
      const updated = await updateTagForUser(
        req.user!.uid,
        req.params.id,
        name,
        color
      );
      res.json({ success: true, message: 'Tag updated', data: updated });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update tag',
      });
    }
  });

  app.delete('/api/tags/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteTagForUser(req.user!.uid, req.params.id);
      res.json({
        success: true,
        message: 'Tag deleted',
        data: { id: req.params.id },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete tag',
      });
    }
  });

  // --- SUBTASKS ENDPOINTS ---
  app.get('/api/tasks/:taskId/subtasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getSubtasksForTask(req.user!.uid, req.params.taskId);
      res.json({ success: true, message: 'Subtasks retrieved', data });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load subtasks',
      });
    }
  });

  app.post('/api/tasks/:taskId/subtasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title } = req.body;
      if (!title || !String(title).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Subtask title is required',
        });
      }
      const created = await createSubtaskForTask(
        req.user!.uid,
        req.params.taskId,
        title
      );
      res.status(201).json({
        success: true,
        message: 'Subtask added',
        data: created,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create subtask',
      });
    }
  });

  app.put('/api/subtasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateSubtaskForUser(
        req.user!.uid,
        req.params.id,
        req.body
      );
      res.json({
        success: true,
        message: 'Subtask updated',
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update subtask',
      });
    }
  });

  app.delete('/api/subtasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteSubtaskForUser(req.user!.uid, req.params.id);
      res.json({
        success: true,
        message: 'Subtask removed',
        data: { id: req.params.id },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete subtask',
      });
    }
  });

  // --- DASHBOARD ENDPOINTS ---
  app.get('/api/dashboard/stats', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dashboard = await getDashboardDataForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Dashboard statistics retrieved',
        data: dashboard,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch dashboard statistics',
      });
    }
  });

  app.get('/api/dashboard/activity', requireAuth, async (req: AuthRequest, res) => {
    try {
      const activity = await getRecentActivityForUser(req.user!.uid, 30);
      res.json({
        success: true,
        message: 'Activity log retrieved',
        data: activity,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch activity timeline',
      });
    }
  });

  app.get('/api/dashboard/briefing', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dashboard = await getDashboardDataForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Daily briefing generated',
        data: dashboard.briefing,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate daily briefing',
      });
    }
  });

  // --- FOCUS SESSIONS ENDPOINTS ---
  app.post('/api/focus-sessions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const created = await recordFocusSessionForUser(req.user!.uid, req.body);
      res.status(201).json({
        success: true,
        message: 'Focus session saved',
        data: created,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record focus session',
      });
    }
  });

  app.get('/api/focus-sessions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const sessions = await getFocusSessionsForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Focus sessions retrieved',
        data: sessions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load focus sessions',
      });
    }
  });

  app.get('/api/focus-sessions/stats', requireAuth, async (req: AuthRequest, res) => {
    try {
      const stats = await getFocusStatsForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Focus session statistics retrieved',
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load focus stats',
      });
    }
  });

  // --- ANALYTICS ENDPOINTS ---
  app.get('/api/analytics/daily', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getAnalyticsForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Daily analytics retrieved',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load daily analytics',
      });
    }
  });

  app.get('/api/analytics/weekly', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getAnalyticsForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Weekly analytics retrieved',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load weekly analytics',
      });
    }
  });

  app.get('/api/analytics/monthly', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getAnalyticsForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Monthly analytics retrieved',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load monthly analytics',
      });
    }
  });

  // --- PREFERENCES ENDPOINTS ---
  app.get('/api/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      const prefs = await getPreferencesForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Preferences retrieved',
        data: prefs,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to load preferences',
      });
    }
  });

  app.put('/api/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updatePreferencesForUser(req.user!.uid, req.body);
      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update preferences',
      });
    }
  });

  // --- DATA MANAGEMENT & EXPORT ENDPOINTS ---
  app.get('/api/export/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tasks = await getAllTasksForUser(req.user!.uid);
      res.json({
        success: true,
        message: 'Tasks exported successfully',
        data: {
          exportedAt: new Date().toISOString(),
          workspaceId: req.user!.uid,
          count: tasks.length,
          tasks,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to export tasks',
      });
    }
  });

  app.get('/api/export/workspace', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.uid;
      const [tasks, categories, tags, preferences, focusSessions, activity] =
        await Promise.all([
          getAllTasksForUser(userId),
          getCategoriesForUser(userId),
          getTagsForUser(userId),
          getPreferencesForUser(userId),
          getFocusSessionsForUser(userId),
          getRecentActivityForUser(userId, 100),
        ]);

      res.json({
        success: true,
        message: 'Complete workspace backup generated',
        data: {
          application: 'TASKFLOW',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          workspace: {
            uid: req.user!.uid,
            email: req.user!.email,
            isAnonymous: req.user!.isAnonymous,
          },
          preferences,
          categories,
          tags,
          tasks,
          focusSessions,
          activityLogs: activity,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to export workspace backup',
      });
    }
  });

  // Vite middleware for development; static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });

    // HMR is disabled in this environment; serve a zero-WebSocket @vite/client stub
    // preserving updateStyle/removeStyle/createHotContext so CSS and React load cleanly
    // without unhandled WebSocket rejections behind the HTTPS proxy.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TASKFLOW server running on http://localhost:${PORT}`);
  });
}

startServer();
