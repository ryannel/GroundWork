#!/usr/bin/env python3
"""
Probe script: validates that an eval sandbox scaffold is correctly provisioned and running.

Runs five phases in order — abort early if a phase is impossible to continue from:

  Phase 1  Structure   — static checks, no Docker (fast, always runs)
  Phase 2  Boot        — ./dev start, wait for infra readiness
  Phase 3  Health      — probe every service health endpoint on its assigned port
  Phase 4  System      — run inner system tests in the isolated topology
  Phase 5  Teardown    — ./dev clean --hard (skipped with --no-teardown)

Service configuration is discovered dynamically from docs/infrastructure.md so the
script works for any project, not just the storytelling_engine sandbox.

Usage:
  python tests/evals/validate_scaffold.py --suite storytelling_engine
  python tests/evals/validate_scaffold.py --workspace .sandboxes/evals
  python tests/evals/validate_scaffold.py --suite storytelling_engine --skip-boot
  python tests/evals/validate_scaffold.py --suite storytelling_engine --no-teardown
"""

import argparse
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
RUNS_BASE = REPO_ROOT / "tests" / "evals" / "runs"
LIVE_SANDBOX = REPO_ROOT / ".sandboxes" / "evals"

# ── ANSI ───────────────────────────────────────────────────────────────────────
G = "\033[32m"   # green
R = "\033[31m"   # red
Y = "\033[33m"   # yellow
C = "\033[36m"   # cyan
B = "\033[1m"    # bold
D = "\033[2m"    # dim
NC = "\033[0m"   # reset

_failures: list[str] = []


def ok(msg: str) -> bool:
    print(f"  {G}✔{NC} {msg}")
    return True


def fail(msg: str) -> bool:
    print(f"  {R}✘{NC} {msg}")
    _failures.append(msg)
    return False


def info(msg: str) -> None:
    print(f"  {D}→{NC} {msg}")


def warn(msg: str) -> None:
    print(f"  {Y}!{NC} {msg}")


def section(title: str) -> None:
    print(f"\n{B}{C}── {title}{NC}")


# ── Service model ──────────────────────────────────────────────────────────────
@dataclass
class Service:
    name: str
    generator: str   # go-microservice | python-microservice | nextjs-app | docs-site
    language: str    # Go | Python | TypeScript | Markdown
    port: int
    health_path: str # e.g. /health or /api/healthz


# ── Infrastructure discovery ───────────────────────────────────────────────────
_TABLE_HEADER = re.compile(r"\|\s*`?Service`?\s*\|.*Port.*\|", re.IGNORECASE)
_ROW = re.compile(r"^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|")


def parse_infrastructure_md(workspace: Path) -> list[Service]:
    """Extract service rows from the | Service | Generator | Language | Port | Health | ... table."""
    infra = workspace / "docs" / "infrastructure.md"
    if not infra.exists():
        return []

    services: list[Service] = []
    in_table = False

    for line in infra.read_text().splitlines():
        stripped = line.strip()
        if _TABLE_HEADER.search(stripped):
            in_table = True
            continue
        if not in_table:
            continue
        if re.match(r"^\|[-| ]+\|$", stripped):
            continue
        if not stripped.startswith("|"):
            in_table = False
            continue

        m = _ROW.match(stripped)
        if not m:
            continue

        def cell(n: int) -> str:
            return re.sub(r"`", "", m.group(n)).strip()

        name = cell(1)
        generator = cell(2)
        language = cell(3)
        port_raw = cell(4)
        health_raw = cell(5)

        try:
            port = int(port_raw)
        except ValueError:
            continue

        # Strip "GET " or "POST " prefix from health path
        health_path = re.sub(r"^(GET|POST|PUT)\s+", "", health_raw).strip()
        if not health_path.startswith("/"):
            health_path = "/health"

        services.append(Service(name, generator, language, port, health_path))

    return services


def _extract_container_name(workspace: Path, service_key: str) -> str | None:
    """Scan docker-compose.yml for the container_name of a given service key."""
    dc = workspace / "docker-compose.yml"
    if not dc.exists():
        return None
    in_svc = False
    for line in dc.read_text().splitlines():
        stripped = line.rstrip()
        # Service header: exactly "  <key>:" (2-space indent, no trailing content)
        if stripped == f"  {service_key}:":
            in_svc = True
            continue
        # Exit when we reach the next sibling service (2-space indent, not 4-space property)
        if in_svc and re.match(r"^  \S", stripped) and not stripped.startswith("    "):
            in_svc = False
        if in_svc and "container_name:" in line:
            return line.split("container_name:", 1)[-1].strip()
    return None


def _parse_db_name_from_env(svc_dir: Path) -> str | None:
    """Extract DB name from a service .env (DB_NAME= or from DATABASE_URL=)."""
    env = svc_dir / ".env"
    if not env.exists():
        return svc_dir.name
    for line in env.read_text().splitlines():
        if line.startswith("DB_NAME="):
            return line.split("=", 1)[1].strip()
        # DATABASE_URL=postgres://user:pass@host:port/dbname?params — match last path segment
        m = re.search(r"DATABASE_URL=\S+://[^/]+/([^?]+)", line)
        if m:
            return m.group(1)
    return svc_dir.name  # fallback to directory name



# ── Phase 1: Structure ─────────────────────────────────────────────────────────
def check_structure(workspace: Path) -> bool:
    section("Phase 1 — Structure")
    passed = True

    # ./dev CLI
    dev = workspace / "dev"
    if dev.exists() and os.access(dev, os.X_OK):
        ok("./dev script present and executable")
    elif dev.exists():
        ok("./dev script present (not +x, will invoke via bash)")
    else:
        fail("./dev script missing")
        passed = False

    # docker-compose.yml
    dc = workspace / "docker-compose.yml"
    if dc.exists():
        ok("docker-compose.yml present")
        content = dc.read_text()
        for required_token in ("aspire-dashboard", "db"):
            if required_token in content:
                ok(f"  docker-compose.yml includes '{required_token}'")
            else:
                fail(f"  docker-compose.yml is missing '{required_token}'")
                passed = False
        # Port collision check
        port_map: dict[int, list[str]] = {}
        for line in content.splitlines():
            m = re.search(r'"?(\d{2,5}):\d{2,5}"?', line)
            if m:
                p = int(m.group(1))
                port_map.setdefault(p, []).append(line.strip())
        collisions = {p: lines for p, lines in port_map.items() if len(lines) > 1}
        if collisions:
            for port, lines in collisions.items():
                fail(f"  Port collision on {port}: {lines}")
                passed = False
        else:
            ok("  No port collisions in docker-compose.yml")
    else:
        fail("docker-compose.yml missing")
        passed = False

    # docs/infrastructure.md
    if (workspace / "docs" / "infrastructure.md").exists():
        ok("docs/infrastructure.md present")
    else:
        fail("docs/infrastructure.md missing — scaffold agent may not have committed Phase 4")
        passed = False

    # services/
    services_dir = workspace / "services"
    if not services_dir.exists() or not any(services_dir.iterdir()):
        fail("services/ directory empty or missing")
        return False

    svc_dirs = [d for d in services_dir.iterdir() if d.is_dir()]
    ok(f"services/ contains {len(svc_dirs)} service(s): {', '.join(d.name for d in svc_dirs)}")

    for svc_dir in svc_dirs:
        name = svc_dir.name
        has_go = (svc_dir / "go.mod").exists()
        has_py = (svc_dir / "pyproject.toml").exists()
        has_next = (svc_dir / "package.json").exists()
        has_dockerfile = (svc_dir / "Dockerfile").exists() or (svc_dir / "Dockerfile.dev").exists()
        has_env = (svc_dir / ".env").exists()

        if has_go:
            kind = "Go"
            has_air = (svc_dir / ".air.toml").exists()
            ok(f"  {name}: Go service (go.mod ✔, .air.toml {'✔' if has_air else '✘'})")
            if not has_air:
                warn(f"  {name}: missing .air.toml — hot reload won't start via ./dev")
        elif has_py:
            ok(f"  {name}: Python service (pyproject.toml ✔)")
        elif has_next and (svc_dir / "source.config.ts").exists():
            ok(f"  {name}: Docs site (source.config.ts ✔)")
        elif has_next:
            ok(f"  {name}: Next.js app (package.json ✔)")
        else:
            fail(f"  {name}: unrecognised service — no go.mod, pyproject.toml, or package.json")
            passed = False

        if not has_dockerfile and not has_go:
            # Go services run natively; a missing Dockerfile is only a problem for containerised services
            fail(f"  {name}: Dockerfile missing (service will not build in Docker)")
            passed = False

        if not has_env and has_go:
            warn(f"  {name}: .env missing — service may not know its PORT or DB_NAME")

    # Port cross-check: compare infrastructure.md documented port vs. package.json dev script port
    import json as _json
    documented_ports = {svc.name: svc.port for svc in parse_infrastructure_md(workspace)}
    for svc_dir in svc_dirs:
        pkg_json = svc_dir / "package.json"
        if not pkg_json.exists() or (svc_dir / "source.config.ts").exists():
            continue
        try:
            pkg = _json.loads(pkg_json.read_text())
            dev_script = pkg.get("scripts", {}).get("dev", "")
            m = re.search(r"--port[=\s]+(\d+)", dev_script)
            if m:
                actual_port = int(m.group(1))
                documented = documented_ports.get(svc_dir.name)
                if documented and documented != actual_port:
                    warn(
                        f"  {svc_dir.name}: infrastructure.md documents :{documented} "
                        f"but package.json dev script uses :{actual_port} "
                        f"— agent documentation may be incorrect"
                    )
        except Exception:
            pass

    # System test runner
    st_dir = workspace / "tests" / "system"
    if (st_dir / "test_system.py").exists() and (st_dir / "docker-compose.test.yml").exists():
        ok("System test runner present (tests/system/)")
    else:
        fail("System test runner missing — system-test-runner generator was not invoked")
        passed = False

    return passed


# ── Phase 2: Boot ──────────────────────────────────────────────────────────────
def check_boot(workspace: Path) -> bool:
    section("Phase 2 — Boot")

    # Locate the postgres container name
    db_container = _extract_container_name(workspace, "db") or "db"
    info(f"Postgres container: {db_container}")

    services_dir = workspace / "services"
    dc_content = (workspace / "docker-compose.yml").read_text() if (workspace / "docker-compose.yml").exists() else ""

    # Pre-flight: install npm deps for Next.js services BEFORE ./dev start so the
    # first start attempt doesn't fail with "next: command not found"
    for svc_dir in sorted(services_dir.iterdir()):
        pkg_json = svc_dir / "package.json"
        if not pkg_json.exists() or (svc_dir / "source.config.ts").exists():
            continue
        if not (svc_dir / "node_modules").exists():
            info(f"  Installing npm deps for {svc_dir.name} (pre-flight) ...")
            r = subprocess.run(
                ["npm", "install", "--silent"],
                cwd=svc_dir,
                capture_output=True,
                text=True,
                timeout=120,
            )
            if r.returncode == 0:
                ok(f"  {svc_dir.name}: npm install succeeded")
            else:
                warn(f"  {svc_dir.name}: npm install failed — {r.stderr[-150:]}")

    # Pre-compile Go services BEFORE ./dev start so air's rebuild is near-instant
    # (Go caches compiled packages; a warm cache reduces air startup to <1s)
    go_services = [d for d in sorted(services_dir.iterdir()) if (d / "go.mod").exists()]
    if go_services:
        info("Pre-compiling Go services (warms Go cache before air starts) ...")
        for svc_dir in go_services:
            (svc_dir / "tmp").mkdir(exist_ok=True)
            r = subprocess.run(
                ["go", "build", "-o", "./tmp/main", "./cmd/api"],
                cwd=svc_dir,
                capture_output=True,
                text=True,
                timeout=300,
            )
            if r.returncode == 0:
                ok(f"  {svc_dir.name}: compiled ok")
            else:
                warn(f"  {svc_dir.name}: pre-compile failed — {r.stderr[-300:]}")

    info("Running ./dev start ...")
    res = subprocess.run(
        ["bash", "./dev", "start"],
        cwd=workspace,
        capture_output=True,
        text=True,
        timeout=120,
    )
    if res.returncode != 0:
        fail(f"./dev start exited {res.returncode}")
        print(res.stdout[-1500:])
        print(res.stderr[-500:])
        return False
    ok("./dev start completed (exit 0)")

    # Wait for Postgres
    info("Waiting for PostgreSQL ...")
    pg_ready = False
    for _ in range(60):
        r = subprocess.run(
            ["docker", "exec", db_container, "pg_isready", "-U", "postgres"],
            capture_output=True,
            text=True,
        )
        if r.returncode == 0:
            pg_ready = True
            break
        time.sleep(1)
    if pg_ready:
        ok(f"PostgreSQL ready ({db_container})")
    else:
        fail(f"PostgreSQL never became ready in {db_container}")
        return False

    # Create per-service databases that Go services expect
    for svc_dir in sorted(services_dir.iterdir()):
        if not (svc_dir / "go.mod").exists():
            continue
        db_name = _parse_db_name_from_env(svc_dir) or svc_dir.name
        check_q = f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"
        create_q = f'CREATE DATABASE "{db_name}"'
        subprocess.run(
            f"docker exec {db_container} psql -U postgres -tc \"{check_q}\" | grep -q 1 "
            f"|| docker exec {db_container} psql -U postgres -c \"{create_q}\"",
            shell=True,
            executable="/bin/bash",
            capture_output=True,
        )
        info(f"  Ensured database: {db_name}")

    # Start Python services that have a Dockerfile in docker-compose.yml (skipped by ./dev start natively)
    for svc_dir in sorted(services_dir.iterdir()):
        if not (svc_dir / "pyproject.toml").exists():
            continue
        if (svc_dir / "Dockerfile").exists() and svc_dir.name in dc_content:
            info(f"  Starting {svc_dir.name} via Docker Compose (Python service) ...")
            r = subprocess.run(
                ["docker", "compose", "up", "-d", "--build", svc_dir.name],
                cwd=workspace,
                capture_output=True,
                text=True,
                timeout=180,
            )
            if r.returncode == 0:
                ok(f"  {svc_dir.name}: Docker container started")
            else:
                warn(f"  {svc_dir.name}: Docker start failed — {r.stderr[-200:]}")

    # Brief stabilisation window
    info("Waiting 5s for services to stabilise ...")
    time.sleep(5)

    # ./dev status sanity-check
    status = subprocess.run(
        ["bash", "./dev", "status"],
        cwd=workspace,
        capture_output=True,
        text=True,
    )
    if status.returncode == 0:
        ok("./dev status returned 0")
        if "dead" in status.stdout.lower():
            fail("./dev status reports dead process(es)")
            print(status.stdout[:800])
            return False
        if "aspire" in status.stdout.lower():
            ok("  Aspire dashboard appears in status output")
    else:
        warn("./dev status returned non-zero — continuing")

    return True


# ── Phase 3: Health checks ─────────────────────────────────────────────────────
def _http_get(url: str, timeout: float = 2.0) -> tuple[int, str]:
    """Return (status_code, body). Returns (-1, '') on connection error."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status, resp.read(512).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return -1, ""


def check_health(workspace: Path, services: list[Service]) -> bool:
    section("Phase 3 — Health Checks")

    if not services:
        fail("No services discovered from infrastructure.md")
        return False

    passed = True

    # Aspire dashboard — always at 18888
    info("Checking Aspire dashboard (port 18888) ...")
    aspire_up = False
    for _ in range(30):
        code, _ = _http_get("http://localhost:18888", timeout=3.0)
        if 0 < code < 500:
            aspire_up = True
            break
        time.sleep(1)
    if aspire_up:
        ok("Aspire dashboard reachable at :18888")
    else:
        fail("Aspire dashboard not reachable at :18888 after 30s")
        passed = False

    # Build a map of actual ports from package.json dev scripts (for Next.js services)
    import json as _json2
    actual_ports: dict[str, int] = {}
    for svc_dir in (workspace / "services").iterdir():
        pkg_json = svc_dir / "package.json"
        if not pkg_json.exists() or (svc_dir / "source.config.ts").exists():
            continue
        try:
            pkg = _json2.loads(pkg_json.read_text())
            dev_script = pkg.get("scripts", {}).get("dev", "")
            m = re.search(r"--port[=\s]+(\d+)", dev_script)
            if m:
                actual_ports[svc_dir.name] = int(m.group(1))
        except Exception:
            pass

    # Per-service health endpoints
    for svc in services:
        # Use actual port from package.json if it differs from infrastructure.md
        probe_port = actual_ports.get(svc.name, svc.port)
        if probe_port != svc.port:
            warn(f"  {svc.name}: probing actual port :{probe_port} (infrastructure.md says :{svc.port})")
        url = f"http://localhost:{probe_port}{svc.health_path}"
        log_file = workspace / ".dev" / "logs" / f"{svc.name}.log"
        log_offset = log_file.stat().st_size if log_file.exists() else 0
        info(f"Waiting for {svc.name} on :{probe_port}{svc.health_path} ({svc.language}) ...")
        healthy = False
        for _ in range(60):
            # Fast-fail: check only content written since health polling started (skip old runs)
            if log_file.exists():
                with log_file.open("rb") as fh:
                    fh.seek(log_offset)
                    recent = fh.read().decode("utf-8", errors="replace")
                if "command not found" in recent or "No such file or directory" in recent:
                    break
            code, _ = _http_get(url)
            if code == 200:
                healthy = True
                break
            time.sleep(1)
        if healthy:
            ok(f"{svc.name} :{probe_port} — healthy")
            pid_file = workspace / ".dev" / "pids" / f"{svc.name}.pid"
            if pid_file.exists():
                ok(f"  {svc.name} PID file present — native process managed by ./dev")
        else:
            fail(f"{svc.name} :{probe_port} — never became healthy (url: {url})")
            if log_file.exists():
                print(f"  Last log lines for {svc.name}:")
                lines = log_file.read_text().splitlines()
                for line in lines[-10:]:
                    print(f"    {line}")
            passed = False

    # Docs site: check any service identified as docs-site generator
    for svc in services:
        if "docs" in svc.generator.lower() or "docs" in svc.language.lower():
            url = f"http://localhost:{svc.port}"
            code, _ = _http_get(url, timeout=3.0)
            if 0 < code < 500:
                ok(f"Docs site ({svc.name}) reachable at :{svc.port}")
            else:
                fail(f"Docs site ({svc.name}) not reachable at :{svc.port}")
                passed = False

    return passed


# ── Phase 4: System tests ──────────────────────────────────────────────────────
def check_system_tests(workspace: Path) -> bool:
    section("Phase 4 — System Tests")

    system_dir = workspace / "tests" / "system"
    test_file = system_dir / "test_system.py"
    if not test_file.exists():
        fail("tests/system/test_system.py not found")
        return False

    info("Running inner system tests (isolated Docker topology) ...")
    res = subprocess.run(
        ["uv", "run", "pytest", "test_system.py", "-v", "-s"],
        cwd=system_dir,
        capture_output=True,
        text=True,
        timeout=300,
    )
    # Always print output — helps diagnose failures
    if res.stdout:
        print(res.stdout[-3000:])
    if res.returncode != 0:
        if res.stderr:
            print(res.stderr[-500:])
        fail("System tests failed")
        return False

    ok("All system tests passed")
    return True


# ── Phase 5: Teardown ──────────────────────────────────────────────────────────
def teardown(workspace: Path) -> None:
    section("Phase 5 — Teardown")
    res = subprocess.run(
        ["bash", "./dev", "clean", "--hard"],
        cwd=workspace,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if res.returncode == 0:
        ok("./dev clean --hard — environment torn down")
    else:
        warn(f"Teardown returned {res.returncode} — manual cleanup may be needed")
        print(res.stderr[-300:])


# ── Workspace resolver ─────────────────────────────────────────────────────────
def resolve_workspace(suite: str | None, workspace_arg: str | None) -> Path | None:
    if workspace_arg:
        p = Path(workspace_arg).resolve()
        if not p.exists():
            fail(f"Workspace path does not exist: {p}")
            return None
        return p

    if suite:
        runs_dir = RUNS_BASE / suite
        if runs_dir.exists():
            candidates = sorted(
                runs_dir.iterdir(),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            for run in candidates:
                candidate = run / "workspace"
                if candidate.exists() and (candidate / "docker-compose.yml").exists():
                    info(f"Using workspace from {run.name}")
                    return candidate
        print(f"  {R}✘{NC} No scaffold workspace found in tests/evals/runs/{suite}/")
        print(f"      Run:  ./dev eval run {suite} 04_scaffold")
        return None

    # Last resort: live sandbox
    if LIVE_SANDBOX.exists() and (LIVE_SANDBOX / "docker-compose.yml").exists():
        info(f"Using live sandbox at {LIVE_SANDBOX}")
        return LIVE_SANDBOX

    print(f"  {R}✘{NC} No workspace found.")
    print("      Provide --suite <name> or --workspace <path>.")
    print("      Or run the scaffold eval first: ./dev eval run <suite> 04_scaffold")
    return None


# ── Main ───────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate an eval sandbox scaffold end-to-end",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python validate_scaffold.py --suite storytelling_engine
  python validate_scaffold.py --workspace .sandboxes/evals
  python validate_scaffold.py --suite storytelling_engine --skip-boot
  python validate_scaffold.py --suite storytelling_engine --no-teardown
        """,
    )
    parser.add_argument("--suite", help="Suite name (finds the latest run workspace)")
    parser.add_argument("--workspace", help="Direct path to the scaffold workspace")
    parser.add_argument(
        "--skip-boot",
        action="store_true",
        help="Run structure checks only — do not start Docker or probe health",
    )
    parser.add_argument(
        "--no-teardown",
        action="store_true",
        help="Leave the environment running after checks (useful for debugging)",
    )
    args = parser.parse_args()

    workspace = resolve_workspace(args.suite, args.workspace)
    if not workspace:
        sys.exit(1)

    print(f"\n{B}GroundWork Scaffold Validation{NC}")
    print(f"  Workspace : {workspace}")
    print(f"  Skip boot : {args.skip_boot}")

    # ── Phase 1: Structure ──────────────────────────────────────────────────────
    structure_ok = check_structure(workspace)
    if not structure_ok:
        section("Result")
        fail("Structure checks failed — cannot proceed to boot")
        sys.exit(1)

    if args.skip_boot:
        section("Result")
        ok("Structure checks passed (--skip-boot: boot skipped)")
        sys.exit(0)

    # Discover services before booting
    services = parse_infrastructure_md(workspace)
    if services:
        info(f"Discovered {len(services)} service(s) from infrastructure.md:")
        for svc in services:
            print(f"    {svc.name:30s} :{svc.port}  {svc.health_path}  ({svc.language})")
    else:
        fail("Could not parse service table from docs/infrastructure.md")
        sys.exit(1)

    # ── Phase 2: Boot ───────────────────────────────────────────────────────────
    boot_ok = check_boot(workspace)
    if not boot_ok:
        section("Result")
        fail("Boot failed")
        if not args.no_teardown:
            teardown(workspace)
        sys.exit(1)

    # ── Phase 3: Health ─────────────────────────────────────────────────────────
    health_ok = check_health(workspace, services)

    # ── Phase 4: System tests ───────────────────────────────────────────────────
    system_ok = check_system_tests(workspace)

    # ── Phase 5: Teardown ───────────────────────────────────────────────────────
    if not args.no_teardown:
        teardown(workspace)

    # ── Summary ─────────────────────────────────────────────────────────────────
    section("Summary")
    results = [
        ("Structure", structure_ok),
        ("Boot", boot_ok),
        ("Health", health_ok),
        ("System Tests", system_ok),
    ]
    for label, passed in results:
        (ok if passed else fail)(f"{label}")

    if _failures:
        print(f"\n  {R}Failures:{NC}")
        for f_msg in _failures:
            print(f"    • {f_msg}")

    all_passed = all(r for _, r in results)
    if all_passed:
        print(f"\n{G}{B}All checks passed.{NC}\n")
        sys.exit(0)
    else:
        print(f"\n{R}{B}Validation failed.{NC}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
