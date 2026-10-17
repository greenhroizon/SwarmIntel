# Swarm Signal 

This directory is a standalone deployment bundle for the Swarm Signal research
workspace. **Upload the contents of this directory as the root of a new GitHub
repository. Do not upload its parent directory.** Vercel should be pointed at
that new repository with its project root left at the repository root.

The bundle deliberately has no root `server.py`, `app.py`, `main.py`, or
`index.py`; those names can be auto-detected as a Python application entrypoint
by Vercel. The browser files are at the repository root:

- `index.html`
- `app.js`
- `styles.css`

## Requirements

- Python 3.12 (pinned by `.python-version`)
- `.gitignore` keeps local Python caches out of the uploaded repository
- No third-party Python packages; `requirements.lock` is intentionally
  dependency-free
- `make` is optional and only wraps the local checks/server commands

## Local setup and run

From the repository root after uploading this directory:

```bash
python3 --version
python3 -m venv .venv
.venv/bin/python -m pip install --requirement requirements.txt
make PYTHON=.venv/bin/python run
```

The dependency file contains only a comment, so the project-local virtual
environment has nothing to download or install. Keeping the environment inside
the repository directory avoids global package changes.
The local server listens on `http://127.0.0.1:8000/` and serves the root
`index.html`, `app.js`, and `styles.css` files directly. The API endpoints are
same-origin under `/api/`.

## Offline check

Run the one bundle-local test/check command:

```bash
make test
```

It validates the deployment shape, JSON configuration, root asset links, and
Python syntax/import loading without making network requests or creating cache
files. The check implementation is `validate_bundle.py`; it is not needed by
Vercel at runtime.

## Deploy to Vercel from GitHub

1. Create a new GitHub repository.
2. Upload **the files inside this directory** to that repository's root. The
   GitHub repository should contain `index.html`, `app.js`, `styles.css`,
   `vercel.json`, and `api/` directly at its top level.
3. In Vercel, choose **Add New… → Project → Import Git Repository** and select
   the new repository.
4. Keep the project root at the repository root. Leave the build command and
   output directory blank, then deploy.

Vercel's default filesystem routing serves root static files and turns each
`.py` file under `api/` into a Python Function. `vercel.json` only configures
those file-based Python functions to exclude development tests and bytecode
caches; it does not rewrite root static assets into a `/static` directory.

Current function routes are:

- `GET /api` (`api/index.py`)
- `GET /api/health` (`api/health.py`)
- `GET /api/providers` (`api/providers.py`)
- `POST /api/providers/test` (`api/providers/test.py`)
- `POST /api/simulate` (`api/simulate.py`)
- `POST /api/research` (`api/research.py`)
- `GET /api/research/limits` (`api/research/limits.py`)
- `POST /api/live-simulate` (`api/live-simulate.py`)

The API functions reuse the copied standard-library modules at the repository
root. No provider credentials are stored in this bundle. Configure a provider
in the browser's Settings panel; the key is held for that page session and sent
only with the live request.

## Optional Docker run

The included Dockerfile uses the pinned Python 3.12 image and serves the same
root layout:

```bash
docker build -t swarm-signal-vercel-bundle .
docker run --rm -p 8000:8000 swarm-signal-vercel-bundle
```

## Caveat

Live runs perform bounded public research and a bounded provider panel. They are
subject to the selected Vercel plan's function duration and provider timeout;
the output is an evidence-aware research aid, not a real-world guarantee or a
comprehensive web search.
