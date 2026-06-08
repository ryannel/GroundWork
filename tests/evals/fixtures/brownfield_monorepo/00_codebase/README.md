# Tasklet

Tasklet is a small task-tracking product. Teams create boards, add tasks, assign them to
members, and move them through a workflow. It is a two-service monorepo:

- **api** — a Go REST service backed by PostgreSQL, exposing the task and board endpoints.
- **web** — a Next.js frontend where users manage their boards and tasks.

## Running locally

```bash
docker compose up
```

The API listens on `:4000`; the web app on `:3000`.
