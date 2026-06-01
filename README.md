# Writing

This repository contains a completely static, browser-only literature site:

- no Jekyll
- no Astro
- no Eleventy
- no local build step
- no framework
- no server

Stories live as plain Markdown files in a GitHub folder. The site uses the GitHub Contents API in the browser, parses simple frontmatter, and renders content with Marked.js.

## Folder Layout

```text
/
├── index.html
├── app.js
├── styles.css
├── literature/
│   └── example-story.md
└── README.md
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
