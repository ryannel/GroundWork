"""Contract tests for `groundwork design` — the rendered sheet the owner seals.

This verb replaced an INSTRUCTION. Two skill files used to tell the agent to
hand-author `.groundwork/cache/visual/token-sheet.html` from the token file,
which produced a different page every run with no schema and no way to fail.
These tests are the "way to fail" that was missing. Load-bearing behaviors:

  * the sheet is a PROJECTION, never a painting — mutating one palette role
    moves that role in tokens.css and the rendered page, and nothing else.
    This is the test that proves the page is wired; without it a sheet full of
    plausible hand-written colours would pass every other check here;
  * `check` exits 1 on any value that traces to no token, so a neutral fallback
    can never quietly read as an approved design decision;
  * a missing or malformed token file still renders a sheet, and says so — a
    page that fails to open teaches the owner nothing;
  * no critique file is produced and every card id is legible on the page —
    the owner reacts in conversation, naming the card they mean;
  * the bundle carries `@dsCard` on line 1 of every card plus a manifest, which
    is the shape an optional design-canvas push consumes unchanged.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

VISUAL_DIR = Path(".groundwork") / "cache" / "visual"
SHEET = VISUAL_DIR / "token-sheet.html"
BUNDLE = VISUAL_DIR / "design-sheet"

TOKENS = {
    "schema": "groundwork.brand-tokens",
    "version": 1,
    "tier": 2,
    "identity": {"appName": "Test Product", "primary": "#3969e0"},
    "visual": {
        "palette": {
            "primary": {"light": "oklch(52% 0.16 235)", "dark": "oklch(70% 0.13 235)"},
            "surface": {"light": "oklch(99% 0.002 235)", "dark": "oklch(16% 0.006 235)"},
            "surfaceAlt": {"light": "oklch(96% 0.004 235)", "dark": "oklch(21% 0.008 235)"},
            "textBody": {"light": "oklch(22% 0.01 235)", "dark": "oklch(92% 0.004 235)"},
        },
        "typography": {
            "body": {"family": "Inter", "weight": 400},
            "roles": {
                "body": {"size": "1rem", "lineHeight": 1.6, "weight": 400, "tracking": "0"},
                "title": {"size": "1.5rem", "lineHeight": 1.25, "weight": 600, "tracking": "-0.01em"},
            },
        },
        "shape": {"radiusBase": "10px"},
        "motion": {
            "easeStandard": "cubic-bezier(0.2, 0, 0, 1)",
            "durationBaseMs": 150,
            "interactions": {"hover": {"durationMs": 150, "ease": "cubic-bezier(0.2, 0, 0, 1)"}},
        },
        "elevation": {
            "low": [{"y": "1px", "blur": "1px", "color": "oklch(0% 0 0 / 0.04)"}],
            "mid": [{"y": "2px", "blur": "4px", "color": "oklch(0% 0 0 / 0.05)"}],
            "high": [{"y": "4px", "blur": "6px", "color": "oklch(0% 0 0 / 0.06)"}],
        },
    },
}


def gw(args, cwd, *, check_returncode=None):
    proc = subprocess.run(
        ["node", str(CLI), *args],
        cwd=cwd, capture_output=True, text=True,
        env={"GROUNDWORK_NO_UPDATE_CHECK": "1", "PATH": os.environ["PATH"]},
    )
    if check_returncode is not None:
        assert proc.returncode == check_returncode, f"args={args}\nstdout={proc.stdout}\nstderr={proc.stderr}"
    return proc


def seed(tmp_path, tokens=TOKENS):
    cfg = tmp_path / ".groundwork" / "config"
    cfg.mkdir(parents=True)
    if tokens is not None:
        (cfg / "brand-tokens.json").write_text(json.dumps(tokens, indent=2))
    return tmp_path


def css_vars(root, theme="light"):
    """Parse tokens.css into {var: value} for one theme — the projection under test.

    The blocks must be read separately: every palette role appears in both
    `:root` and the dark override, so a naive whole-file parse silently returns
    the dark value for every colour.
    """
    text = (root / BUNDLE / "tokens.css").read_text()
    light_block, dark_block = text.split('[data-theme="dark"]')
    block = light_block if theme == "light" else dark_block
    return dict(re.findall(r"^\s*--([\w-]+):\s*(.+);$", block, re.M))


# ── the propagation test — the one that proves wiring ────────────────────────

def test_token_change_propagates(tmp_path):
    """Mutate one palette role: that role moves, and nothing else does.

    A sheet whose values were typed by hand would pass every structural test in
    this file. Only this one separates a projection from a picture.
    """
    root = seed(tmp_path)
    gw(["design", "build"], root, check_returncode=0)
    before = css_vars(root)
    before_dark = css_vars(root, "dark")
    sheet_before = (root / SHEET).read_text()

    mutated = json.loads(json.dumps(TOKENS))
    mutated["visual"]["palette"]["primary"] = {
        "light": "oklch(55% 0.25 350)",
        "dark": "oklch(72% 0.20 350)",
    }
    (root / ".groundwork" / "config" / "brand-tokens.json").write_text(json.dumps(mutated, indent=2))
    gw(["design", "build"], root, check_returncode=0)
    after = css_vars(root)

    assert set(before) == set(after), "the variable set must not change when a value changes"
    moved = {k for k in before if before[k] != after[k]}
    assert moved == {"color-primary"}, f"expected only color-primary to move, got {sorted(moved)}"
    assert after["color-primary"] == "oklch(55% 0.25 350)"

    # the dark block moved too, and only there
    moved_dark = {k for k, val in css_vars(root, "dark").items() if before_dark.get(k) != val}
    assert moved_dark == {"color-primary"}, f"dark block: {sorted(moved_dark)}"

    # and the rendered page moved with it — the sheet, not just the stylesheet
    sheet_after = (root / SHEET).read_text()
    assert "oklch(55% 0.25 350)" in sheet_after
    assert "oklch(72% 0.20 350)" in sheet_after, "the dark variant must move too"
    assert sheet_before != sheet_after


def test_dark_value_differs_from_light_in_the_sheet(tmp_path):
    """Both themes are rendered, and they are rendered with their own values."""
    root = seed(tmp_path)
    gw(["design", "build"], root, check_returncode=0)
    v = css_vars(root)
    # tokens.css carries light in :root; the dark block overrides it
    text = (root / BUNDLE / "tokens.css").read_text()
    light_block, dark_block = text.split('[data-theme="dark"]')
    assert "oklch(52% 0.16 235)" in light_block
    assert "oklch(70% 0.13 235)" in dark_block
    assert v  # parsed something


# ── check: honest green ──────────────────────────────────────────────────────

def test_check_passes_when_every_value_traces_to_the_token_file(tmp_path):
    root = seed(tmp_path)
    gw(["design", "build"], root, check_returncode=0)
    proc = gw(["design", "check", "--json"], root, check_returncode=0)
    result = json.loads(proc.stdout)
    assert result["ok"] is True
    assert result["untraceable"] == []
    assert result["source"] == "visual-block"


def test_check_flags_neutral_fallbacks_as_untraceable(tmp_path):
    """A slot the token file does not fill renders from the neutral starter.

    That is correct behaviour for the sheet — it must still open — but it must
    never read as an approved decision, so `check` exits non-zero and names it.
    """
    thin = json.loads(json.dumps(TOKENS))
    del thin["visual"]["elevation"]
    root = seed(tmp_path, thin)
    gw(["design", "build"], root, check_returncode=0)
    proc = gw(["design", "check", "--json"], root, check_returncode=1)
    result = json.loads(proc.stdout)
    assert result["ok"] is False
    assert any(u["name"].startswith("shadow-") for u in result["untraceable"])
    assert result["fromTokens"].get("elevation") is not True


def test_build_warns_when_a_slot_fell_back(tmp_path):
    thin = json.loads(json.dumps(TOKENS))
    del thin["visual"]["elevation"]
    root = seed(tmp_path, thin)
    proc = gw(["design", "build"], root, check_returncode=0)
    assert "elevation" in proc.stdout + proc.stderr
    assert "neutral starter" in proc.stdout + proc.stderr


# ── degradation: the sheet always opens ──────────────────────────────────────

def test_missing_token_file_still_renders_and_says_so(tmp_path):
    root = seed(tmp_path, tokens=None)
    proc = gw(["design", "build"], root, check_returncode=0)
    assert (root / SHEET).exists()
    out = proc.stdout + proc.stderr
    assert "neutral starter" in out
    assert "not your design system" in out
    result = json.loads(gw(["design", "build", "--json"], root, check_returncode=0).stdout)
    assert result["source"] == "default"


def test_malformed_token_file_still_renders(tmp_path):
    root = tmp_path
    cfg = root / ".groundwork" / "config"
    cfg.mkdir(parents=True)
    (cfg / "brand-tokens.json").write_text("{ this is not json")
    gw(["design", "build"], root, check_returncode=0)
    assert (root / SHEET).exists()


def test_identity_only_tokens_report_no_visual_system(tmp_path):
    """A cli/agentic-protocol product has no graphical system to render."""
    root = seed(tmp_path, {"identity": {"appName": "CLI Thing", "primary": "#3969e0"}})
    result = json.loads(gw(["design", "build", "--json"], root, check_returncode=0).stdout)
    assert result["source"] == "identity-only"
    assert "no \"visual\" block" in result["warning"]


def test_a_single_malformed_token_degrades_only_its_own_slot(tmp_path):
    broken = json.loads(json.dumps(TOKENS))
    broken["visual"]["shape"]["radiusBase"] = "wide-ish"
    root = seed(tmp_path, broken)
    gw(["design", "build"], root, check_returncode=0)
    v = css_vars(root)
    assert v["color-primary"] == "oklch(52% 0.16 235)"   # untouched
    assert v["radius-base"] == "10px"                     # neutral, not "wide-ish"


# ── feedback happens in the conversation, not in a file ─────────────────────

def test_no_critique_file_is_produced(tmp_path):
    """The owner reacts in chat; the agent is already there.

    A file would add a round trip to the case that matters, and duplicate the
    decisions queue in the case where feedback has to outlive the session.
    """
    root = seed(tmp_path)
    gw(["design", "build"], root, check_returncode=0)
    assert not (root / VISUAL_DIR / "critique.md").exists()
    result = json.loads(gw(["design", "build", "--json"], root, check_returncode=0).stdout)
    assert "critique" not in result


def test_every_card_id_is_visible_on_the_page(tmp_path):
    """The owner names a card when they react, so every id has to be readable
    on the page itself — that is what replaces a keyed critique file."""
    root = seed(tmp_path)
    gw(["design", "build"], root, check_returncode=0)
    html = (root / SHEET).read_text()
    manifest = json.loads((root / BUNDLE / "_ds_manifest.json").read_text())
    for card in manifest:
        assert f"<code>{card['id']}</code>" in html, f"id not shown for {card['id']}"


# ── the bundle shape (what an optional canvas push consumes) ─────────────────

def test_every_card_carries_a_dscard_marker_on_line_one(tmp_path):
    root = seed(tmp_path)
    gw(["design", "build"], root, check_returncode=0)
    manifest = json.loads((root / BUNDLE / "_ds_manifest.json").read_text())
    assert manifest, "no cards in the manifest"
    for card in manifest:
        first = (root / BUNDLE / card["path"]).read_text().split("\n", 1)[0]
        assert re.match(r'^<!--\s*@dsCard\s+group="[^"]*"\s*-->$', first), \
            f"{card['path']} line 1 is not a @dsCard marker: {first!r}"


def test_manifest_cards_declare_a_viewport(tmp_path):
    """A fixed card height clipped the type card in the Phase-0 spike, and the
    hosted pane keys its card frame off this field."""
    root = seed(tmp_path)
    gw(["design", "build"], root, check_returncode=0)
    manifest = json.loads((root / BUNDLE / "_ds_manifest.json").read_text())
    for card in manifest:
        assert card["viewport"]["width"] > 0
        assert card["viewport"]["height"] > 0


def test_sheet_is_self_contained(tmp_path):
    """It is opened by double-click from file:// — a fetch or an external asset
    would leave the owner looking at a broken page."""
    root = seed(tmp_path)
    gw(["design", "build"], root, check_returncode=0)
    html = (root / SHEET).read_text()
    assert "<script" not in html.lower()
    assert not re.search(r'src="(?!data:)(https?:)?//', html)
    assert not re.search(r'<link[^>]+stylesheet', html, re.I)


def test_component_previews_are_picked_up(tmp_path):
    root = seed(tmp_path)
    previews = root / ".groundwork" / "design" / "previews"
    previews.mkdir(parents=True)
    (previews / "Button.html").write_text(
        '<button style="background:var(--color-primary);border-radius:var(--radius-base)">Go</button>'
    )
    gw(["design", "build"], root, check_returncode=0)
    manifest = json.loads((root / BUNDLE / "_ds_manifest.json").read_text())
    ids = [c["id"] for c in manifest]
    assert "components/Button" in ids
    card = next(c for c in manifest if c["id"] == "components/Button")
    assert card["group"] == "Components"
    assert card["owned"] is True


def test_open_reports_the_sheet_path_and_fails_before_a_build(tmp_path):
    root = seed(tmp_path)
    gw(["design", "open"], root, check_returncode=1)
    gw(["design", "build"], root, check_returncode=0)
    proc = gw(["design", "open"], root, check_returncode=0)
    assert proc.stdout.strip().endswith("token-sheet.html")


def test_unknown_subcommand_exits_one(tmp_path):
    root = seed(tmp_path)
    gw(["design", "frobnicate"], root, check_returncode=1)


def test_elevation_block_replaces_the_neutral_set_rather_than_merging(tmp_path):
    """A design system with two elevation levels must not sprout a third.

    Merging the token file's levels into the neutral starter would show the owner
    a `high` elevation nobody chose, and `check` would then flag a value the
    design system is not responsible for. Replacement keeps the sheet honest
    about what the system actually defines.
    """
    two_levels = json.loads(json.dumps(TOKENS))
    two_levels["visual"]["elevation"] = {
        "low": [{"y": "1px", "blur": "1px", "color": "oklch(0% 0 0 / 0.04)"}],
        "mid": [{"y": "2px", "blur": "4px", "color": "oklch(0% 0 0 / 0.05)"}],
    }
    root = seed(tmp_path, two_levels)
    gw(["design", "build"], root, check_returncode=0)
    v = css_vars(root)
    assert "shadow-low" in v and "shadow-mid" in v
    assert "shadow-high" not in v, "invented an elevation level the design system does not define"
    gw(["design", "check"], root, check_returncode=0)
