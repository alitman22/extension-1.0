# Job Match Radar (Chrome Extension)

A Chrome Extension (Manifest V3) for scoring job pages against your own weighted keyword bank, highlighting important hiring signals (visa, relocation, remote/hybrid), and accelerating decision-making while browsing roles.

## Why This Exists

Job listings are noisy. You may scan dozens of pages where only a few are relevant to your technical profile.

This extension helps by:

- Maintaining a structured keyword taxonomy (groups + individual keyword weights)
- Scoring page content with additive weighted logic
- Surfacing critical phrases like visa sponsorship and relocation
- Showing score/grade signals quickly in popup, badge, and optional analytics bar
- Supporting AI-assisted keyword suggestions from current pages

## Core Idea

Build a "personal job relevance radar" that can be tuned over time:

- Your taxonomy evolves: groups and phrases are editable
- Your scoring thresholds are configurable
- Your browsing context is controlled with URL allow patterns
- Your provider stack (Gemini/GitHub Models/custom) is configurable

## Current Feature Set

### 1) Weighted Keyword Bank

- Create and edit keyword groups
- Assign group-level weights
- Assign individual keyword weights
- Bulk keyword input support (comma/newline/semicolon/pipe)
- Import keywords from file

### 2) Phrase Intelligence

Default phrase categories include:

- `visa sponsorship`
- `relocation assistance`
- `work authorization`
- `remote` / `hybrid`

You can add/edit/remove phrase rules and weights.

### 3) Scoring and Grades

- Additive weighted scoring model
- Grade thresholds configurable (`A/B/C` cutoffs)
- Badge display mode: `score`, `grade`, or `off`
- Alert threshold configurable

### 4) Popup (Quick Actions)

Designed for speed while browsing:

- Quick keyword/group edits
- Scan page technical terms
- Rescan current page
- LLM suggest keywords (from current page)
- Quick threshold + badge toggles
- Open full settings page

### 5) Settings Page (Deep Configuration)

Organized into collapsible sections:

- Display and Alerts
- LLM Provider setup
- Keyword Groups
- Important Phrases
- Backup and Restore

Includes top "Start Here Guide" for usage guidance.

### 6) Backup / Restore / Reset

- Export full configuration JSON
- Restore from backup file (button-triggered file picker)
- Reset all with confirmation warning

Reset clears stored keywords, groups, phrases, scan history, and LLM settings, then restores default scoring and display settings.

### 7) URL Activation Control

The extension runs only on configured URL patterns (`allowedUrlPatterns`), even though content scripts are declared on `<all_urls>`.

### 8) LLM Provider Options

Supported setup profiles:

- GitHub Models
- Google Gemini
- OpenAI-compatible custom endpoint

## Architecture

### `manifest.json`

Defines:

- MV3 service worker (`background.js`)
- Popup (`popup.html`)
- Options page (`options.html`)
- Content script (`content-script.js`)
- Required permissions and host permissions

### `background.js`

Main orchestration layer:

- Normalizes stored state
- Computes scores and grades
- Handles runtime messages
- Applies badge values
- Stores history and analysis snapshots
- Handles provider-specific LLM requests
- Enforces URL allow-pattern checks

Primary message actions:

- `analyzePage`
- `scanTechKeywordsFromActiveTab`
- `llmSuggestKeywords`
- `getPopupState`
- `saveAll`
- `rescoreActiveTab`

### `content-script.js`

- Reads on-page text context
- Runs/refreshes analysis flow
- Renders optional top analytics bar
- Handles safe cleanup and stale context edge cases

### `popup.html` / `popup.js` / `styles.css`

Fast interaction surface for in-the-moment actions while browsing job pages.

### `options.html` / `options.js` / `options.css`

Full management UI for durable configuration, provider setup, and data lifecycle controls.

## Storage Model

Uses `chrome.storage.sync` with these keys:

- `groups`
- `phrases`
- `settings`
- `scanHistory`
- `lastAnalysis`

## Scoring Model (High-Level)

For each keyword match:

`match_count * (group_weight + keyword_weight)`

Phrase scores are tracked by category and contribute to insighting and decision signals.

## Setup (Development)

1. Clone/download this folder.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select this folder (`extension-1.0`).

## Packaging for Distribution

Use Chrome's native pack flow:

1. Open `chrome://extensions`.
2. Click `Pack extension`.
3. Extension root directory: this project folder.
4. Private key:
- Leave empty first time to generate `.pem`
- Reuse the same `.pem` for future updates

## Important Note About `create.bat`

`create.bat` is a legacy bootstrap script that writes starter boilerplate files.

- It is **not** a packaging script.
- Running it can overwrite current project files.

Avoid using it for build or release tasks.

## Known Constraints

- Extension behavior depends on allowed URL patterns.
- LLM suggestions require valid endpoint/key/model configuration.
- Browser permission policies may restrict script behavior on some pages.

## Suggested Next Improvements

- Add test coverage for scoring and normalization functions.
- Add import schema validation with clearer restore error reporting.
- Add optional multi-step reset confirmation (e.g., type `RESET`).
- Add release packaging script that safely zips source without overwriting files.

## License

No explicit license file is included yet. Add a `LICENSE` file before open-source distribution.
