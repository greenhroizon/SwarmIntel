# Swarm Signal

### Multi-agent research, debate, and argument mapping from one question

Swarm Signal is a local-first research workspace that turns a single question
into a bounded, evidence-aware investigation. It discovers a small public source
packet, asks multiple AI agents to examine the question from different roles,
compares their claims and counterclaims, and presents the result as structured
reports, a debate transcript, a local argument map, and transparent scores.

The project is designed to be easy to run locally and easy to deploy from
GitHub to Vercel. This directory is the standalone Vercel upload bundle.

## Features

- **Question-first workflow** — enter a question and choose between 2 and 12
  bounded live agents.
- **Automatic public research** — derives up to four search variants, deduplicates
  results, and fetches a small HTTPS-only evidence packet.
- **Structured agent reports** — every agent can return its question, answer,
  stance, confidence, claim, counterclaim, rebuttal, citations, and open
  questions.
- **Debate trace** — keeps the individual role reports and returned synthesis
  rounds visible instead of hiding the reasoning behind one number.
- **Local argument analysis** — builds the argument map and scoring locally from
  evidence citations and structured reports. Provider-generated graph data does
  not control local scores.
- **Multiple provider options** — supports OpenAI, Anthropic, Google Gemini,
  OpenRouter, and custom OpenAI-compatible endpoints.
- **Offline gallery** — includes bundled demo examples that do not require an API
  key or network access.
- **Privacy-conscious defaults** — provider keys stay in the browser session and
  are not stored in GitHub, local history, URLs, or result payloads.
- **Vercel-ready layout** — `index.html`, `app.js`, and `styles.css` are at the
  repository root, while Python functions live under `api/`.

## How it works

1. The user enters a research question and selects the live agent count.
2. Swarm Signal runs bounded public discovery unless research is explicitly
   disabled.
3. The evidence packet is passed to independent role agents as untrusted input.
4. Each agent returns a bounded structured report.
5. A synthesis provider compares the reports and produces the outcome signal.
6. The local argument engine creates the map and calculates evidence coverage,
   support, opposition, consensus, disagreement, and per-agent quality.

The research process is intentionally bounded. It is a research aid, not a
comprehensive web search or a substitute for human judgment.

## Quick start locally

The application uses Python's standard library and has no third-party runtime
dependencies.

```bash
python3 --version
make test
make run
```

Open:

http://127.0.0.1:8000/

The pinned runtime is Python 3.12, recorded in `.python-version`. If your
machine has Python 3.12 available, you can optionally use a project-local
virtual environment:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install --requirement requirements.txt
make PYTHON=.venv/bin/python test
make PYTHON=.venv/bin/python run
```

`requirements.txt` is intentionally empty apart from documentation because the
application uses only the Python standard library.

## Deploy from GitHub to Vercel

### Important: upload this directory's contents

Upload the **contents of `vercel-upload/`** to the root of a new GitHub
repository. The GitHub repository should look like this:

```text
index.html
app.js
styles.css
vercel.json
requirements.txt
.python-version
api/
  index.py
  health.py
  providers.py
  providers/
    test.py
  simulate.py
  research.py
  research/
    limits.py
local_http_server.py
live_orchestration.py
provider_adapters.py
research_collector.py
swarm_engine.py
argument_engine.py
```

Do not upload the parent directory as an extra nesting level. If the files are
instead kept in a subdirectory of an existing GitHub repository, set Vercel's
**Root Directory** to that subdirectory.

### GitHub command-line upload

From a terminal:

```bash
cd vercel-upload
git init
git add .
git commit -m "Initial Swarm Signal deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Then in Vercel:

1. Choose **Add New → Project → Import Git Repository**.
2. Select the new GitHub repository.
3. Keep the project root at the repository root.
4. Leave the Build Command blank.
5. Leave the Output Directory blank.
6. Deploy.

Vercel's default filesystem routing serves the root static files directly. No
`/static` rewrite is required:

- `/` → `index.html`
- `/app.js` → `app.js`
- `/styles.css` → `styles.css`
- `/api/health` → `api/health.py`

After deployment, open the site, go to **Settings**, select a provider, enter a
model and API key, test the connection, and choose **Use for live runs**. Do not
commit an API key or add it to a public GitHub repository.

## API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/health` | `GET` | Deployment health check |
| `/api/providers` | `GET` | Public provider catalog |
| `/api/providers/test` | `POST` | Test a provider configuration |
| `/api/simulate` | `POST` | Run the deterministic offline simulation |
| `/api/research` | `POST` | Collect a bounded evidence packet |
| `/api/research/limits` | `GET` | Show research limits |
| `/api/live-simulate` | `POST` | Run the bounded provider panel |

The smallest live request contains a question, an agent count, and provider
configuration. Context, domains, objectives, source URLs, and legacy virtual
swarm metadata are optional.

## Research limits

Automatic discovery is deliberately constrained:

- Up to 4 derived search queries.
- Up to 5 discovered URLs.
- Up to 8 total source URLs.
- HTTPS-only source collection.
- Redirects, credentials, unsafe hosts, queries, and fragments are rejected.
- Bounded response sizes and per-source timeouts.
- At most 12 live role calls plus one synthesis call.

Partial research failures are surfaced as evidence limitations. The panel can
continue with an explicitly evidence-limited packet when discovery is
unavailable.

## Project structure

```text
index.html                 Browser entry point
app.js                     Frontend state, requests, and rendering
styles.css                 Workspace styling
api/                       Vercel Python Function handlers
local_http_server.py       Local development HTTP server
live_orchestration.py      Provider panel and synthesis orchestration
provider_adapters.py       Provider-specific request/response adapters
research_collector.py      Bounded public source discovery and collection
argument_engine.py         Deterministic local graph and scoring engine
swarm_engine.py            Offline deterministic simulation engine
vercel.json                Vercel Function configuration
validate_bundle.py         Offline deployment-shape validation
```

## Testing

Run the bundle-local check command:

```bash
make test
```

The check validates:

- Required root static assets.
- Vercel configuration.
- Every Python Function route.
- Python syntax and import loading.
- Absence of root entrypoint collisions.
- Absence of test files and bytecode caches in the bundle.

## Built with OmniRush.ai

OmniRush.ai helped build and verify Swarm Signal across the full development
workflow. It was used to shape the question-first product flow, integrate live
AI providers, add bounded public research, structure agent reports and debate
transcripts, implement deterministic local argument mapping and scoring, create
offline tests, repair the Vercel entrypoint issue, and prepare this standalone
GitHub/Vercel upload bundle.

## Limitations

- Live results depend on the selected provider, model availability, network
  access, and provider response quality.
- Vercel Functions have plan-specific duration limits. A slow provider or a
  larger agent count may exceed a short function timeout.
- Public discovery is bounded and is not comprehensive internet research.
- Results are decision-support material, not guaranteed predictions.
- No provider credentials are included in this repository.

## License

No license has been selected for this project yet. Add a `LICENSE` file before
publishing it for broad reuse.
