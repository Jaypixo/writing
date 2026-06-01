// set this fucking shit up so it actually works for once
const CONFIG = {
  githubUsername: "Jaypixo",
  repositoryName: "writing",
  markdownFolder: "literature",
  siteTitle: "The Jaypix Anthology"
};

// global variables because i'm too fucking stupid to learn actual state management
const state = {
  stories: [],
  storyBySlug: new Map(),
  categoryIndex: new Map(),
  errors: []
};

// grabbing elements because document.getElementById is a goddamn pain in the ass
const els = {
  status: document.getElementById("status"),
  content: document.getElementById("content"),
  themeToggle: document.getElementById("theme-toggle")
};

async function init() {
  initTheme();

  // let the user know we're doing something besides jack shit
  setStatus("Hold your fucking horses, loading bullshit...");

  try {
    await loadStories(); // fetch all the goddamn files
    clearStatus(); // wipe that loading message off the screen
    renderRoute(); // figure out where the hell we are
  } catch (error) {
    // everything exploded
    showError(formatFriendlyError(error));
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("theme") || 
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  
  applyTheme(savedTheme);

  els.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  
  if (els.themeToggle) {
    // show the opposite of the current theme as the action
    els.themeToggle.textContent = theme === "dark" 
      ? "☀️ Light Mode" 
      : "🌙 Dark Mode";
  }
}

async function loadStories() {
  // build a massive url because github's api is a needy bitch
  const folderUrl = `https://api.github.com/repos/${encodeURIComponent(
    CONFIG.githubUsername
  )}/${encodeURIComponent(CONFIG.repositoryName)}/contents/${encodeURIComponent(
    CONFIG.markdownFolder
  )}`;

  // pray to the github gods that we don't get a 403
  const folderResponse = await fetch(folderUrl, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!folderResponse.ok) {
    // if github says no, we're fucked
    throw await toApiError(folderResponse, "Github hates us today. Big surprise.");
  }

  const files = await folderResponse.json(); // turn that json into something we can use

  if (!Array.isArray(files)) {
    // sometimes github returns garbage and i don't know why
    throw new Error("Github sent back some weird-ass data. Fuck me.");
  }

  // ignore all the non-markdown trash that doesn't belong here
  const markdownFiles = files.filter((file) => {
    return file &&
      file.type === "file" &&
      typeof file.name === "string" &&
      file.name.toLowerCase().endsWith(".md") &&
      file.download_url;
  });

  // load all the files at once and hope the browser doesn't fucking crash
  const results = await Promise.allSettled(
    markdownFiles.map((file) => loadMarkdownFile(file))
  );

  const loadedStories = [];
  const loadErrors = [];

  // loop through the wreckage of our promises
  for (const result of results) {
    if (result.status === "fulfilled") {
      loadedStories.push(result.value); // yay it worked
    } else {
      loadErrors.push(result.reason); // another one bites the dust
    }
  }

  // sort by date because otherwise the homepage looks like a fucking yard sale
  loadedStories.sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime(); // parse this shitty date
    const dateB = new Date(b.date || 0).getTime(); // parse this other shitty date
    return dateB - dateA; // newest shit first, obviously
  });

  // dump everything into the state like a dumpster fire
  state.stories = loadedStories; 
  state.storyBySlug = new Map(loadedStories.map((story) => [story.slug, story]));
  state.categoryIndex = buildCategoryIndex(loadedStories); // index the categories i guess
  state.errors = loadErrors;

  if (loadedStories.length === 0) {
    setStatus("Empty folder. Great fucking job, genius.");
  }

  if (loadErrors.length > 0) {
    console.warn("Some files were absolutely fucked:", loadErrors);
  }
}

async function loadMarkdownFile(file) {
  // get the raw text from the download url
  const response = await fetch(file.download_url);

  if (!response.ok) {
    // if this fails i'm literally going to jump out a window
    throw await toApiError(response, `Couldn't get "${file.name}". Fucking FML.`);
  }

  const markdown = await response.text(); // gimme the words
  const parsed = parseFrontmatter(markdown); // pull out the headers
  const slug = slugify(stripExtension(file.name)); // make the filename look not-shitty

  // return a giant object of doom
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

function parseFrontmatter(source) {
  // regex is a fucking nightmare but here we go
  const frontmatterPattern = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
  const match = source.match(frontmatterPattern); // check if the file even has frontmatter

  if (!match) {
    // no frontmatter? cool, the whole file is the body. dumbass.
    return {
      meta: {},
      body: source.trim()
    };
  }

  const frontmatterBlock = match[1]; // the raw block of yaml-ish crap
  const body = source.slice(match[0].length).trim(); // the actual story text
  const meta = {};

  // split it up and try to find key:value pairs
  for (const line of frontmatterBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue; // skip comments or empty lines

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue; // no colon? skip it, i don't care

    const key = trimmed.slice(0, colonIndex).trim(); // property name
    let value = trimmed.slice(colonIndex + 1).trim(); // property value
    value = value.replace(/^"'["']$/, "$1"); // strip quotes because i hate them
    meta[key] = value; // stick it in the meta object
  }

  return { meta, body };
}

function renderRoute() {
  // where the fuck are we supposed to be?
  const route = parseHashRoute(window.location.hash || "#/"); 

  if (route.type === "story") {
    renderStory(route.slug); // show the story
    return;
  }

  if (route.type === "category") {
    renderCategory(route.category); // show the category
    return;
  }

  renderHome(); // go back home to mommy
}

function parseHashRoute(hash) {
  const clean = hash.replace(/^#\/?/, ""); // strip the hash like a cheap stripper
  const parts = clean.split("/").filter(Boolean); // split into pieces

  if (parts.length === 0) return { type: "home" }; // empty? home.

  if (parts[0] === "story" && parts[1]) {
    // it's a story. hope the slug isn't broken.
    return { type: "story", slug: decodeURIComponent(parts.slice(1).join("/")) }; 
  }

  if (parts[0] === "category" && parts[1]) {
    // it's a category. whatever.
    return { type: "category", category: decodeURIComponent(parts.slice(1).join("/")) }; 
  }

  return { type: "home" }; // default to home if everything else fails
}

function goToStory(slug) {
  window.location.hash = `#/story/${encodeURIComponent(slug)}`; // set the hash and hope the browser notices
}

function goToCategory(category) {
  window.location.hash = `#/category/${encodeURIComponent(category)}`; // more shitty hash navigation
}

function goHome() {
  window.location.hash = "#/"; // back to start
}

function renderHome() {
  clearContent(); // nuke the old content

  if (state.stories.length === 0) {
    els.content.appendChild(makeEmptyState("No stories found. Fuck."));
    return;
  }

  // create a header because users are idiots and need context
  const headingRow = document.createElement("section");
  headingRow.className = "status";
  headingRow.innerHTML = `
    <strong>${escapeHtml(CONFIG.siteTitle)}</strong><br />
    <span>Browse stories by category or some shit.</span>
  `;
  els.content.appendChild(headingRow);

  // loop through categories like a fucking robot
  for (const [category, stories] of state.categoryIndex.entries()) {
    const section = document.createElement("section"); // new section
    section.className = "category-group"; // class name for css i'll never write

    const heading = document.createElement("h2"); // category header
    heading.className = "category-title";

    const categoryButton = document.createElement("button"); // button to view category
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
        const meta = document.createElement("span"); // show the date so we know how old this shit is
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
    const note = document.createElement("div"); // some files were broken
    note.className = "status";
    note.textContent = `Some files were fucking broken. ${state.errors.length} error(s) happened, but who cares.`;
    els.content.appendChild(note);
  }
}

function renderCategory(categoryName) {
  clearContent(); // nuke it

  const stories = state.categoryIndex.get(categoryName) || []; // get the list or an empty array

  els.content.appendChild(makeBackButton()); // add the back button

  const heading = document.createElement("h2");
  heading.textContent = categoryName;
  els.content.appendChild(heading);

  if (stories.length === 0) {
    els.content.appendChild(makeEmptyState(`Nothing here in "${categoryName}". Fucking boring.`));
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
  clearContent(); // wipe the screen

  const story = state.storyBySlug.get(slug); // find the fucking story

  els.content.appendChild(makeBackButton()); // put the back button in

  if (!story) {
    els.content.appendChild(makeErrorState(`That story is fucking missing, just like my self-esteem: ${slug}`));
    return;
  }

  const article = document.createElement("article");
  article.className = "article-view";

  const title = document.createElement("h2"); // big ass title
  title.textContent = story.title;

  const meta = document.createElement("p"); // date and category
  meta.className = "story-meta";
  meta.textContent = [story.date ? formatDate(story.date) : "", story.category || ""]
    .filter(Boolean)
    .join(" · ");

  // injecting raw html because i like living dangerously (and marked gets me off)
  const body = document.createElement("div");
  body.className = "article-body";
  body.innerHTML = marked.parse(story.body);

  article.appendChild(title); // throw the title in
  if (meta.textContent) article.appendChild(meta); // throw the meta in if it exists
  article.appendChild(body); // throw the body in
  els.content.appendChild(article);
}

function buildCategoryIndex(stories) {
  const map = new Map(); // create a new map

  for (const story of stories) {
    const category = story.category || "Uncategorized"; // use the category or a default
    if (!map.has(category)) {
      map.set(category, []); // create the array if it's new
    }
    map.get(category).push(story); // shove the story in
  }

  return map;
}

function makeBackButton() {
  const button = document.createElement("button");
  button.className = "back-link";
  button.type = "button";
  button.textContent = "← Back";
  button.addEventListener("click", goHome); // home button
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
  els.status.hidden = false; // show it
  els.status.className = "status";
  els.status.textContent = message;
}

function clearStatus() {
  els.status.hidden = true; // hide it
  els.status.textContent = "";
  els.status.className = "status";
}

function showError(message) {
  els.status.hidden = false; // show the error
  els.status.className = "error";
  els.status.textContent = message;
}

function clearContent() {
  els.content.replaceChildren(); // wheres CPS?
}

function stripExtension(filename) {
  return filename.replace(/\.md$/i, ""); // kill the .md extension
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "") // remove quotes
    .replace(/[^a-z0-9]+/g, "-") // replace weird shit with hyphens
    .replace(/^-+|-+$/g, ""); // trim hyphens
}

function prettifySlug(slug) {
  // make it not look like a robot wrote it
  return String(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(dateValue) {
  const date = new Date(dateValue); // try to parse the date
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(undefined, {
    // make it look pretty for humans
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

async function toApiError(response, fallbackMessage) {
  let details = fallbackMessage; // start with the fallback

  try {
    const data = await response.json(); // try to get json error details
    if (data && data.message) {
      details = data.message; // github error message
    }
  } catch {
    try {
      const text = await response.text(); // try raw text
      if (text) details = text;
    } catch {
      // double error? just fucking give up.
    }
  }

  // check if github is throttling us
  const isRateLimit =
    response.status === 403 ||
    response.status === 429 ||
    /rate limit/i.test(details);

  if (isRateLimit) {
    return new Error("Github's being an asshole about rate limits. Come back later.");
  }

  return new Error(`${fallbackMessage} ${details}`.trim()); // return the error
}

function formatFriendlyError(error) {
  // turn error into a string
  return error instanceof Error ? error.message : "Everything is fucked and i don't know why.";
}

function escapeHtml(value) {
  // don't let people hack our shitty site
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// actual event listeners because i forgot them earlier, fuck
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", renderRoute);
