# TASKFLOW — Editorial Personal Productivity & Focus Workspace

TASKFLOW is a full-stack personal productivity workspace combining task management, deadline awareness, calendar-based planning, Pomodoro focus intervals, and database-driven analytics.

## 1. Architecture & Technology Stack

- **Frontend**: React 19, modular component architecture, custom semantic CSS variables (`src/index.css`) with Editorial Dark (`#101210` + `#C6F36B` electric lime) and Light themes.
- **Backend**: Node.js + Express.js REST API (`server.ts`, `src/middleware/auth.ts`, `src/db/repository.ts`).
- **Database**: PostgreSQL with Drizzle ORM (`src/db/schema.ts`, `src/db/index.ts`, `database/migrations/001_taskflow_schema_and_rls.sql`).
- **Authentication & Workspace Isolation**:
  - Opens directly into an active personal workspace with **zero login or registration barriers**.
  - Establishes a cryptographically signed anonymous workspace session (`POST /api/auth/anonymous`) or verifies Firebase Auth ID tokens (`Authorization: Bearer <token>`).
  - Every query and mutation enforces strict ownership filtering (`user_id = req.user.uid`).

## 2. Database Schema

1. `users`: `uid` (PK), `email`, `is_anonymous`, `created_at`
2. `categories`: `id` (UUID PK), `user_id` (FK), `name`, `color`, `is_default`, `created_at`
3. `tags`: `id` (UUID PK), `user_id` (FK), `name`, `color`, `created_at`
4. `tasks`: `id` (UUID PK), `user_id` (FK), `title`, `description`, `priority`, `status`, `category_id` (FK `ON DELETE SET NULL`), `start_date`, `due_date`, `due_time`, `is_important`, `is_archived`, `recurrence_pattern`, `recurrence_interval`, `deleted_at`, `created_at`, `updated_at`, `completed_at`
5. `task_tags`: `id` (UUID PK), `task_id` (FK), `tag_id` (FK)
6. `subtasks`: `id` (UUID PK), `task_id` (FK `ON DELETE CASCADE`), `user_id` (FK), `title`, `is_completed`, `sort_order`, `created_at`
7. `recurring_rules`: `id` (UUID PK), `task_id` (FK), `user_id` (FK), `frequency`, `interval_days`, `last_generated_for_date`, `is_active`, `created_at`
8. `focus_sessions`: `id` (UUID PK), `user_id` (FK), `task_id` (FK), `session_type`, `planned_duration_seconds`, `actual_duration_seconds`, `started_at`, `ended_at`, `completion_status`, `created_at`
9. `activity_logs`: `id` (UUID PK), `user_id` (FK), `task_id` (FK), `action_type`, `task_title`, `detail`, `created_at`
10. `user_preferences`: `user_id` (PK/FK), `theme`, `default_priority`, `default_task_view`, `default_category_id`, `week_start`, `calendar_view`, `timezone`, `work_duration_minutes`, `short_break_minutes`, `long_break_minutes`, `sessions_before_long_break`, `sound_enabled`, `daily_task_target`, `daily_focus_goal_minutes`, `updated_at`

## 3. Setup & Execution Instructions

1. Configure environment variables (`.env.example`):
   - `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`
2. Run unit tests:
   ```bash
   npx --yes tsx --test src/utils/taskLogic.test.ts
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   npm start
   ```
