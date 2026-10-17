"""Offline shape and import check for the self-contained Vercel bundle."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
EXPECTED_ROUTES = {
    "api/index.py",
    "api/health.py",
    "api/providers.py",
    "api/providers/test.py",
    "api/simulate.py",
    "api/research.py",
    "api/research/limits.py",
    "api/live-simulate.py",
}
RUNTIME_MODULES = {
    "local_http_server.py",
    "live_orchestration.py",
    "provider_adapters.py",
    "research_collector.py",
    "swarm_engine.py",
    "argument_engine.py",
}


def fail(message: str) -> None:
    raise SystemExit(f"bundle validation failed: {message}")


def load_route(path: Path, index: int) -> None:
    spec = importlib.util.spec_from_file_location(f"bundle_route_{index}", path)
    if spec is None or spec.loader is None:
        fail(f"could not load {path.relative_to(ROOT)}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    handler = getattr(module, "handler", None)
    if handler is None:
        fail(f"{path.relative_to(ROOT)} does not define handler")


def main() -> None:
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(ROOT))

    forbidden_root_files = {"server.py", "app.py", "main.py", "index.py"}
    present_forbidden = sorted(
        path.name for path in ROOT.iterdir() if path.is_file() and path.name in forbidden_root_files
    )
    if present_forbidden:
        fail(f"forbidden root Python entrypoint(s): {', '.join(present_forbidden)}")

    required_files = {
        "index.html",
        "app.js",
        "styles.css",
        ".python-version",
        "requirements.txt",
        "requirements.lock",
        ".vercelignore",
        "vercel.json",
        *RUNTIME_MODULES,
        *EXPECTED_ROUTES,
    }
    missing = sorted(relative for relative in required_files if not (ROOT / relative).is_file())
    if missing:
        fail(f"missing required file(s): {', '.join(missing)}")

    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    for asset in ("/app.js", "/styles.css"):
        if asset not in index_html:
            fail(f"index.html does not link {asset}")

    try:
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"vercel.json is not valid JSON: {error}")
    function_config = config.get("functions", {}).get("api/**/*.py")
    if not isinstance(function_config, dict):
        fail("vercel.json must configure api/**/*.py file-based functions")

    for index, relative in enumerate(sorted(RUNTIME_MODULES | EXPECTED_ROUTES)):
        path = ROOT / relative
        try:
            source = path.read_text(encoding="utf-8")
            compile(source, str(path), "exec")
        except (OSError, SyntaxError) as error:
            fail(f"Python compile failed for {relative}: {error}")
        if relative in EXPECTED_ROUTES:
            load_route(path, index)

    for path in ROOT.rglob("*"):
        relative = path.relative_to(ROOT).as_posix()
        if path.is_dir() and (path.name == "__pycache__" or path.name == ".git"):
            fail(f"cache/repository directory present: {relative}")
        if path.is_file() and (path.suffix in {".pyc", ".pyo"} or relative.startswith("tests/")):
            fail(f"development artifact present: {relative}")

    print("bundle validation passed")


if __name__ == "__main__":
    main()
