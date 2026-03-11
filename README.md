# Job Match Radar

Open-source Chrome Extension (Manifest V3) for measuring how relevant a page is against your custom weighted keyword model.

It started as a job-search assistant, but the scoring engine is generic enough for any "is this content relevant to my criteria?" workflow.

## 🌱 How This Idea Started

I always wanted a browser tool that could quickly evaluate the page in front of me based on the keywords I care about.

At first, I built it for job hunting:

- 🔎 Scan job descriptions fast
- 🎯 Focus only on high-relevance roles
- ⏱️ Save time for deeper reading where it actually matters

Then it became part of my personal automation workflow:

- 🤖 While I was studying or busy in the lab, my automation flow browsed jobs and collected high-score pages
- 🗂️ It built a shortlist for me to review later
- 🚀 It helped me apply more efficiently and with less noise

This project is not perfect yet, and that is exactly why it is open source.

- 🛠️ If you want to contribute, your improvements are welcome
- 💡 If you do not want to contribute code, ideas are still highly appreciated
- 🐞 If you find bugs or errors, please open an issue so I can fix them

I may publish the full job-automation stack in a separate repository later.

This extension is shared for people like me who are trying to find their dream role more efficiently. Have fun, make it yours, and improve it for the next person.

### 📬 Contact

If you have ideas, feedback, or bug reports, feel free to reach out:

- Email: `alit.fattahi@gmail.com`

## Open-Source Status

- License: MIT (`LICENSE`)
- Safe-to-share repo defaults: no personal backup exports, private keys, or package artifacts are committed (`.gitignore`)
- Contribution-friendly structure: popup for fast actions, settings for deep configuration, background/content scripts for scoring pipeline

## Problem It Solves

When you scan large volumes of content, most pages are only partially relevant.

This extension lets you define what "relevant" means with:

- keyword groups and weights
- phrase signals and weights
- score thresholds and grades
- optional LLM-assisted keyword expansion

So instead of guessing, you get a consistent, explainable score.

## Core Capabilities

### Weighted relevance model

- Group-level and keyword-level weights
- Additive weighted scoring
- Custom grade thresholds (`A`, `B`, `C`)

### Signal extraction

- Phrase detection for special intent/situations (visa, relocation, work mode, etc.)
- Tech-term scanning from current page

### Fast UX + deep UX

- Popup: quick actions (`rescan`, `LLM suggest`, quick edits)
- Settings: structured, collapsible configuration sections

### Data lifecycle

- Export backup JSON
- Restore from file picker
- Reset all (with irreversible warning)

### Runtime control

- Active URL allow-patterns (wildcard support)
- Badge mode (`score`, `grade`, `off`)
- Optional top analytics bar

## How Scoring Works

High-level formula:

`keyword_matches * (group_weight + keyword_weight)`

Then:

- aggregate total score
- map score to grade using configurable thresholds
- include phrase-category signals for context

## Architecture Overview

### `manifest.json`

- MV3 setup
- service worker: `background.js`
- popup: `popup.html`
- options page: `options.html`
- content script: `content-script.js`

### `background.js`

Core orchestration and logic:

- data normalization/defaulting
- scoring pipeline
- badge updates
- LLM provider adapters
- URL allow-pattern checks
- sync storage persistence

Main runtime actions:

- `analyzePage`
- `scanTechKeywordsFromActiveTab`
- `llmSuggestKeywords`
- `getPopupState`
- `saveAll`
- `rescoreActiveTab`

### `content-script.js`

- extracts page text context
- updates optional analytics bar
- triggers rescans safely
- handles SPA/stale-context edge cases

### `popup.*`

Quick, in-flow controls while browsing.

### `options.*`

Full management surface with collapsible settings sections.

## Privacy and Data Handling

- User configuration/state is stored in `chrome.storage.sync`
- Exported backup JSON can contain your custom keywords/settings
- Backup files are intentionally ignored in Git (`.gitignore`)
- No API keys are hardcoded in source

## Other Practical Use Cases

Beyond job matching, this extension can be adapted for many relevance workflows:

### Research triage

- Score articles/papers/news pages against your topic taxonomy
- Quickly decide "read now" vs "skip"

### Procurement and vendor screening

- Evaluate product/service pages against required capabilities
- Track compliance, security, or integration terms

### Security and policy review

- Detect expected policy language on third-party docs/pages
- Flag missing or weak mandatory terms

### Learning path curation

- Rank tutorials/courses by your skill goals
- Highlight pages that match your current learning stack

### Content operations and editorial QA

- Check if pages include required brand/SEO/legal terms
- Score draft relevance before publication

### Sales and lead qualification

- Evaluate prospect sites by industry/tech signals
- Prioritize leads matching your ideal profile

### Grant/funding opportunity filtering

- Score calls/RFP pages against your organization capabilities
- Surface opportunities with strongest fit first

### Competitive intelligence

- Track competitor pages/releases for strategic keywords
- Compare relevance patterns over time

## Getting Started (Local Development)

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select this project directory

## Packaging

Use Chrome's native pack flow:

1. Open `chrome://extensions`
2. Click `Pack extension`
3. Select extension root directory
4. Reuse the same `.pem` across versions

## Notes

- `create.bat` is a legacy scaffold generator, not a pack/build tool.
- Do not run it on this repo unless you intentionally want to regenerate boilerplate.

## Roadmap Ideas

- Unit tests for scoring and normalization
- Optional typed reset confirmation (`type RESET`)
- Rich backup validation and migration assistant
- Optional CSV export for score history

## License

MIT - see `LICENSE`.
