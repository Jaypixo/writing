/* =========================
   CONFIGURATION
   ========================= */
const CONFIG = {
  githubUsername: "Jaypixo",
  repositoryName: "writing",
  markdownFolder: "literature",
  siteTitle: "My Literature"
};

const state = {
  stories: [],
  storyBySlug: new Map(),
  categoryIndex: new Map(),
  errors: []
};

const els = {
  status: document.getElementById("status"),
  content: document.getElementById("content")
};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", renderRoute);

async function init() {
  setStatus("Loading stories...");

  try {
    await loadStories();
    clearStatus();
    renderRoute();
  } catch (error) {
    showError(formatFriendlyError(error));
  }
}

/* =========================
   DATA LOADING
   ========================= */
async function loadStories() {
  const folderUrl = `https://api.github.com/repos/${encodeURIComponent(CONFIG.githubUsername)}/${encodeURIComponent(CONFIG.repositoryName)}/contents/${encodeURIComponent(CONFIG.markdownFolder)}`;

  const folderResponse = await fetch(folderUrl, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!folderResponse.ok) {
    throw await toApiError(folderResponse, "Failed to load the story folder.");
  }

  const files = await folderResponse.json();

  if (!Array.isArray(files)) {
    throw new Error("GitHub Contents API did not return a file list.");
  }

  const markdownFiles = files.filter((file) => {
    return file &&
      file.type === "file" &&
      typeof file.name === "string" &&
      file.name.toLowerCase().endsWith(".md") &&
      file.download_url;
  });

  const results = await Promise.allSettled(
    markdownFiles.map((file) => loadMarkdownFile(file))
  );

  const loadedStories = [];
  const loadErrors = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      loadedStories.push(result.value);
    } else {
      loadErrors.push(result.reason);
    }
  }

  loadedStories.sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    return dateB - dateA;
  });

  state.stories = loadedStories;
  state.storyBySlug = new Map(loadedStories.map((story) => [story.slug, story]));
  state.categoryIndex = buildCategoryIndex(loadedStories);
  state.errors = loadErrors;

  if (loadedStories.length === 0) {
    setStatus("No Markdown stories were found in the configured folder.");
  }

  if (loadErrors.length > 0) {
    console.warn("Some stories failed to load:", loadErrors);
  }
}

async function loadMarkdownFile(file) {
  const response = await fetch(file.download_url);

  if (!response.ok) {
    throw await toApiError(response, `Failed to load "${file.name}".`);
  }

  const markdown = await response.text();
  const parsed = parseFrontmatter(markdown);
  const slug = slugify(stripExtension(file.name));

  return {
    slug,
    title: parsed.meta.title || prettifySlug(slug),
    date: parsed.meta.date || "",
    category: parsed.meta.category || "Uncategorized",
    body: parsed.body,
    raw: markdown,
    sourceFile: file.name
  };
}

/* =========================
   FRONTMATTER PARSING
   ========================= */
function parseFrontmatter(source) {
  const frontmatterPattern = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
  const match = source.match(frontmatterPattern);

  if (!match) {
    return {
      meta: {},
      body: source.trim()
    };
  }

  const frontmatterBlock = match[1];
  const body = source.slice(match[0].length).trim();
  const meta = {};

  for (const line of frontmatterBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();
    value = value.replace(/^["'](.*)["']$/, "$1");
    meta[key] = value;
  }

  return { meta, body };
}

/* =========================
   ROUTING
   ========================= */
function renderRoute() {
  const route = parseHashRoute(window.location.hash || "#/");

  if (route.type === "story") {
    renderStory(route.slug);
    return;
  }

  if (route.type === "category") {
    renderCategory(route.category);
    return;
  }

  renderHome();
}

function parseHashRoute(hash) {
  const clean = hash.replace(/^#\/?/, "");
  const parts = clean.split("/").filter(Boolean);

  if (parts.length === 0) return { type: "home" };
  if (parts[0] === "story" && parts[1]) {
    return { type: "story", slug: decodeURIComponent(parts.slice(1).join("/")) };
  }
  if (parts[0] === "category" && parts[1]) {
    return { type: "category", category: decodeURIComponent(parts.slice(1).join("/")) };
  }

  return { type: "home" };
}

function goToStory(slug) {
  window.location.hash = `#/story/${encodeURIComponent(slug)}`;
}

function goToCategory(category) {
  window.location.hash = `#/category/${encodeURIComponent(category)}`;
}

function goHome() {
  window.location.hash = "#/";
}

/* =========================
   RENDERING
   ========================= */
function renderHome() {
  clearContent();

  if (state.stories.length === 0) {
    els.content.appendChild(makeEmptyState("No stories found."));
    return;
  }

  const headingRow = document.createElement("section");
  headingRow.className = "status";
  headingRow.innerHTML = `
    <strong>${escapeHtml(CONFIG.siteTitle)}</strong><br />
    <span>Browse stories by category or open one directly from the URL hash.</span>
  `;
  els.content.appendChild(headingRow);

  for (const [category, stories] of state.categoryIndex.entries()) {
    const section = document.createElement("section");
    section.className = "category-group";

    const heading = document.createElement("h2");
    heading.className = "category-title";

    const categoryButton = document.createElement("button");
    categoryButton.className = "category-link";
    categoryButton.type = "button";
    categoryButton.textContent = category;
    categoryButton.addEventListener("click", () => goToCategory(category));

    heading.appendChild(categoryButton);
    section.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "story-list";

    for (const story of stories) {
      const item = document.createElement("li");
      item.className = "story-item";

      const link = document.createElement("button");
      link.className = "story-link";
      link.type = "button";
      link.textContent = story.title;
      link.addEventListener("click", () => goToStory(story.slug));

      item.appendChild(link);

      if (story.date) {
        const meta = document.createElement("span");
        meta.className = "story-meta";
        meta.textContent = formatDate(story.date);
        item.appendChild(meta);
      }

      list.appendChild(item);
    }

    section.appendChild(list);
    els.content.appendChild(section);
  }

  if (state.errors.length > 0) {
    const note = document.createElement("div");
    note.className = "status";
    note.textContent = `Some files could not be loaded. ${state.errors.length} error(s) were skipped, but the page is still available.`;
    els.content.appendChild(note);
  }
}

function renderCategory(categoryName) {
  clearContent();

  const stories = state.categoryIndex.get(categoryName) || [];

  els.content.appendChild(makeBackButton());

  const heading = document.createElement("h2");
  heading.textContent = categoryName;
  els.content.appendChild(heading);

  if (stories.length === 0) {
    els.content.appendChild(makeEmptyState(`No stories found in "${categoryName}".`));
    return;
  }

  const list = document.createElement("ul");
  list.className = "story-list";

  for (const story of stories) {
    const item = document.createElement("li");
    item.className = "story-item";

    const link = document.createElement("button");
    link.className = "story-link";
    link.type = "button";
    link.textContent = story.title;
    link.addEventListener("click", () => goToStory(story.slug));

    item.appendChild(link);

    if (story.date) {
      const meta = document.createElement("span");
      meta.className = "story-meta";
      meta.textContent = formatDate(story.date);
      item.appendChild(meta);
    }

    list.appendChild(item);
  }

  els.content.appendChild(list);
}

function renderStory(slug) {
  clearContent();

  const story = state.storyBySlug.get(slug);

  els.content.appendChild(makeBackButton());

  if (!story) {
    els.content.appendChild(makeErrorState(`Story not found: ${slug}`));
    return;
  }

  const article = document.createElement("article");
  article.className = "article-view";

  const title = document.createElement("h2");
  title.textContent = story.title;

  const meta = document.createElement("p");
  meta.className = "story-meta";
  meta.textContent = [story.date ? formatDate(story.date) : "", story.category || ""]
    .filter(Boolean)
    .join(" · ");

  const body = document.createElement("div");
  body.className = "article-body";
  body.innerHTML = marked.parse(story.body);

  article.appendChild(title);
  if (meta.textContent) article.appendChild(meta);
  article.appendChild(body);
  els.content.appendChild(article);
}

/* =========================
   HELPERS
   ========================= */
function buildCategoryIndex(stories) {
  const map = new Map();

  for (const story of stories) {
    const category = story.category || "Uncategorized";
    if (!map.has(category)) {
      map.set(category, []);
    }
    map.get(category).push(story);
  }

  return map;
}

function makeBackButton() {
  const button = document.createElement("button");
  button.className = "back-link";
  button.type = "button";
  button.textContent = "Back to Home";
  button.addEventListener("click", goHome);
  return button;
}

function makeEmptyState(message) {
  const box = document.createElement("div");
  box.className = "empty-state";
  box.textContent = message;
  return box;
}

function makeErrorState(message) {
  const box = document.createElement("div");
  box.className = "error";
  box.textContent = message;
  return box;
}

function setStatus(message) {
  els.status.hidden = false;
  els.status.className = "status";
  els.status.textContent = message;
}

function clearStatus() {
  els.status.hidden = true;
  els.status.textContent = "";
  els.status.className = "status";
}

function showError(message) {
  els.status.hidden = false;
  els.status.className = "error";
  els.status.textContent = message;
}

function clearContent() {
  els.content.replaceChildren();
}

function stripExtension(filename) {
  return filename.replace(/\.md$/i, "");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettifySlug(slug) {
  return String(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

async function toApiError(response, fallbackMessage) {
  let details = fallbackMessage;

  try {
    const data = await response.json();
    if (data && data.message) {
      details = data.message;
    }
  } catch {
    try {
      const text = await response.text();
      if (text) details = text;
    } catch {
      // Ignore secondary parsing failures.
    }
  }

  const isRateLimit =
    response.status === 403 ||
    response.status === 429 ||
    /rate limit/i.test(details);

  if (isRateLimit) {
    return new Error(
      "GitHub API rate limit reached. Please try again later, or add authentication for higher limits."
    );
  }

  return new Error(`${fallbackMessage} ${details}`.trim());
}

function formatFriendlyError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred while loading the site.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
