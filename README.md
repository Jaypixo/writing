# The Jaypix Anthology

A lightweight, zero-build literature engine that runs entirely in the browser. It transforms a GitHub folder of Markdown files into a categorized, navigable anthology without a server or build step.

### How It Works
The application is a pure client-side SPA that leverages the GitHub API as a headless CMS:

1.  **Discovery**: On initialization, `app.js` hits the GitHub Contents API to map out the `literature/` directory.
2.  **Ingestion**: It fetches the raw content for every `.md` file discovered.
3.  **Parsing**: A custom regex-based parser extracts frontmatter metadata (title, date, category) while the body is passed through `marked.js` for HTML rendering.
4.  **State & Indexing**: Stories are indexed by slug and grouped by category in memory. Slugs are automatically derived from filenames.
5.  **Routing**: Navigation is handled via hash routing (`#/story/slug` or `#/category/name`), triggering DOM re-renders without page refreshes.

### Data Schema
The engine expects a standard frontmatter block at the top of each Markdown file to drive the UI:

```md
---
title: "The Quiet Library"
date: 2026-06-01
category: "Literary Fiction"
---

Story content begins here...
```

## What The App Does

- fetches Markdown files from a GitHub repository folder
- filters for `.md` files only
- reads frontmatter from the top of each file
- sorts stories by `date` newest first
- groups the homepage by `category`
- routes via URL hash, for example `#/story/my-first-story`
- renders Markdown with `marked.parse()`
- shows clean errors for missing files and GitHub API rate limits

## Setup

### 1. Put your stories in the folder

Store stories in the folder named in `app.js`:

```js
markdownFolder: "literature"
```

Each story file should look like this:

```md
---
title: "My Story Title"
date: 2026-06-01
category: "Sci-Fi"
---

Your Markdown body goes here.
```

### 2. Update the config

Open [`app.js`](./app.js) and change:

```js
githubUsername: "YOUR_GITHUB_USERNAME",
repositoryName: "YOUR_REPOSITORY_NAME",
markdownFolder: "literature",
```

### 3. Commit to GitHub

Push these files to your repository.

### 4. Deploy with Cloudflare Pages

In Cloudflare Pages:

1. Create a new Pages project
2. Connect it to this GitHub repository
3. Set the build command to empty
4. Set the output directory to `/` or leave it blank if the UI allows it
5. Deploy

Because this site is just static files, Cloudflare Pages does not need a build step.

## Usage

### Add a new story

1. Create a new `.md` file inside `literature/`
2. Add frontmatter at the top
3. Commit and push to GitHub
4. Refresh the site

### Link directly to a story

The app uses hash routing:

```text
#/story/my-first-story
```

The slug is derived from the filename, so:

```text
my-first-story.md -> #/story/my-first-story
```

### Browse by category

From the homepage, click a category title or navigate to:

```text
#/category/Sci-Fi
```

## Notes

- For public repositories, unauthenticated GitHub API requests are subject to rate limits.
- If you expect a lot of traffic, consider adding authenticated API access later.
- The homepage groups stories by the `category` frontmatter field.
- The app assumes the Markdown folder contains files directly, not nested subfolders.

## Example Story Template

```md
---
title: "A New Story"
date: 2026-06-01
category: "Uncategorized"
---

Write your Markdown here.
```
