# Tasklet

Tasklet is a small task-tracking product. Teams create boards, add tasks, assign them to
members, and move them through a workflow. It is a monorepo of three parts:

- **api** — a Go REST service backed by PostgreSQL, exposing the task and board endpoints.
- **web** — a Next.js frontend where users manage their boards and tasks.
- **cli** — a Go command-line client (`tasklet`) for scripting board and task operations against the API.

## Running locally

```bash
docker compose up
```

The API listens on `:4000`; the web app on `:3000`. The CLI talks to the running API:

```bash
go run ./services/cli boards
```
