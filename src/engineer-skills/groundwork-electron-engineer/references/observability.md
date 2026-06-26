# Observability

An Electron app has two processes and no backend span surface. Distributed tracing lives at the capability core — the services the app talks to — which is why trace-assertions are N/A for the desktop shell (`references/testing-and-smoke.md`). The shell's observability job is **crash reporting and structured logs across the main/renderer boundary**, plus update telemetry. Instrument for the questions you will ask when a user reports a crash you cannot reproduce; the discipline is the framework canon adapted to a binary running on someone else's machine (`docs/principles/quality/observability.md`).

## Crash Reporting — Both Processes

Two signals, both required, because they catch different failures:

- **Native crashes.** Electron's built-in `crashReporter` (Crashpad) captures native crashes in main and renderer and uploads minidumps. Start it in main *before* `app` is ready — a reporter started late misses the early crash.
- **JS exceptions.** A sink (Sentry-for-Electron shape) captures uncaught JS in both processes — main's `process.on('uncaughtException')`/`'unhandledRejection'` and the renderer's `window` handlers. A native crash and a JS exception are different events; you need both wired.

## Structured Logs Across the Process Boundary

- **Main-process logging** goes to a rotating file sink (electron-log shape) as JSON, severity-tagged. Main has no devtools console, so an unstructured main log is invisible in the field.
- **Renderer errors forward to main** over IPC, so a single log stream reconstructs an incident that spans both processes. An error that lands only in the renderer devtools is gone the moment the window closes.
- Tag every line with the process (`main`/`renderer`) and a session id, so a multi-process incident reads as one timeline.

## App and Update Telemetry

`autoUpdater` lifecycle events — update available, downloaded, applied, failed — are the signal for whether the fleet is actually on the new build. A silent update failure strands users on an old version with nothing to alert on, the desktop equivalent of a botched rollout. Carry app version, OS, and channel as context on every event.

## What to Capture vs PII

- **Capture** process, session id, error type and stack, app/OS/channel version, and update events.
- **Never** log tokens, file paths containing usernames, or PII into logs, crash context, or minidumps. The upload is third-party — redact at the edge.

## Where Distributed Tracing Lives

The end-to-end request trace belongs to the services the app calls and is asserted at the capability core. The shell does not emit spans; it correlates by attaching a request id it can log on both sides of the IPC boundary.

## Anti-Patterns

- **`console.log` in main.** There is no console to read in the field — log structured to the sink.
- **Renderer errors that never cross to main.** Lost when the window closes.
- **A late `crashReporter`.** Started after `app` ready, it misses the crashes that happen at startup.
- **A collector in the shell.** The app reports to a sink; it does not run backend OTel infrastructure.
- **PII in logs or minidumps.** Usernames in paths and tokens in context follow the upload off-machine.
