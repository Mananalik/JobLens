# Job Board & Application Tracker

Premium job hunt command center built with React, Tailwind CSS, Framer Motion, and DnD Kit. It ingests LinkedIn job JSON, normalizes it, scores matches against a hardware + full-stack skill profile, and tracks applications in a Kanban pipeline. All tracker data persists in localStorage.

## Highlights

- Discovery feed with search, filters, sorting, grid/list toggle
- Smart match scoring with weighted ML/CV/FastAPI skills
- Kanban drag-and-drop pipeline with autosaved notes
- Dev Tools JSON ingestion for Apify `linkedin-jobs-scraper` arrays
- Top matches and match score distribution insights

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Data Ingestion

Use the Dev Tools panel in the UI to paste a JSON array from Apify. The app will normalize fields into the internal `Job` schema and refresh the feed.

## Daily Jobs Pipeline (Option A)

The app now supports a daily automated feed at `public/data/jobs.json`.

### Local refresh

```bash
npm run jobs:refresh
```

This runs `scripts/update-jobs-feed.mjs`, which:

- Reads domain keywords + synonym/skill boost rules from `scripts/domains.json`
- Fetches jobs from Remotive for each domain
- Optionally fetches jobs from Apify (if token + actor ID are provided)
- Filters to the last `lastHours` window
- Scores and boosts jobs by matched domain terms and boost skills
- Deduplicates and caps to `maxJobs`
- Writes output to `public/data/jobs.json`

### Customize domains

Edit `scripts/domains.json`:

- `domains`: list of objects with `name`, `synonyms`, and `boostSkills`
- `lastHours`: freshness window (e.g. `24`)
- `maxJobs`: final number of jobs in feed

Example entry:

```json
{
	"name": "machine learning engineer",
	"synonyms": ["ml engineer", "ai engineer"],
	"boostSkills": ["python", "pytorch", "tensorflow"]
}
```

### Apify setup (optional but recommended)

1. Copy `.env.example` to `.env`
2. Add your values:

```env
APIFY_TOKEN=your_apify_api_token_here
APIFY_ACTOR_ID=your-actor-id-here
```

3. Run `npm run jobs:refresh`

If either value is missing, the script will continue with free public sources only.

### GitHub Actions automation

Workflow file: `.github/workflows/daily-jobs-feed.yml`

- Scheduled daily at midnight UTC
- Can also run manually via `workflow_dispatch`
- Commits updated `public/data/jobs.json` back to the repo

For Apify in GitHub Actions, add repository secrets:

- `APIFY_TOKEN`: your Apify API token
- `APIFY_ACTOR_ID`: actor id used for scraping

When deployed (Vercel/Netlify/GitHub Pages), the frontend auto-loads `/data/jobs.json` on startup and falls back to local/mock data if unavailable.

## Local Storage

The tracker state, notes, and applied timestamps persist automatically in the browser. Clearing localStorage resets the tracker.
