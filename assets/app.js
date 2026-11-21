const icons = {
  assembly: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
  networks: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 7v5M5 16v-4h14v4"/>',
  applications: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 13h4m-4 3h4m4-3h2m-2 3h2"/>',
  fundamentals: '<rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8 21h8m-4-4.5V21"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8m-8 4h6"/>',
  exam: '<path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 11h8m-8 5h5"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M5 12h14"/><path class="vertical-stroke" d="M12 5v14"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>'
};

const subjectIcons = {
  "computer-assembly": "assembly",
  "communications-networks": "networks",
  "computer-applications": "applications",
  "computer-fundamentals": "fundamentals"
};

const unavailableFile = "Ø§Ù„Ù…Ù„Ù ØºÙŠØ± Ù…ØªØ§Ø­ Ø­Ø§Ù„ÙŠØ§Ù‹";
const unavailableGrades = "Ø§Ù„Ø¯Ø±Ø¬Ø§Øª ØºÙŠØ± Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠØ§Ù‹";
const siteRoot = new URL("../", import.meta.url);
const subjectList = document.querySelector("#subject-list");
const subjectDetail = document.querySelector("#subject-detail");
const loadMessage = document.querySelector("#load-message");
let selectedCard = null;

function element(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label) node.textContent = label;
  return node;
}

function icon(name, size = 22, extraClass = "") {
  const container = element("span");
  container.innerHTML = `<svg class="icon ${extraClass}" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  return container.firstElementChild;
}

function subjectIcon(id, size) {
  const tile = element("span", "subject-icon");
  tile.append(icon(subjectIcons[id] ?? "book", size));
  return tile;
}

function byNumber(entries) {
  return [...entries].sort((first, second) => first.number - second.number);
}

function disclosure(title, className, iconName) {
  const details = element("details", className);
  const summary = element("summary", "disclosure-summary");
  const label = element("span", "disclosure-label");
  if (iconName) label.append(icon(iconName));
  label.append(title);
  summary.append(label, icon("chevron", 19, "disclosure-chevron"));
  details.append(summary);
  return details;
}

function actionLink(label, url, iconName) {
  const link = element("a", "action-link");
  link.href = url;
  link.append(icon(iconName, 19), label);
  return link;
}

function pdfUrl(path, subjectId, folder) {
  if (typeof path !== "string") return null;
  const parts = path.split("/");
  const [root, subject, directory, filename] = parts;
  if (parts.length !== 4 || root !== "files" || subject !== subjectId || directory !== folder
    || !/^[^\\?#%]+\.pdf$/iu.test(filename)) return null;
  return new URL(parts.map(encodeURIComponent).join("/"), siteRoot);
}

async function servedAsPdf(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let reader;
  try {
    const response = await fetch(url, {
      headers: { Range: "bytes=0-4" },
      cache: "no-cache",
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok || !response.body) return false;

    // Read the signature without buffering the whole file when a server ignores Range.
    reader = response.body.getReader();
    const signature = new Uint8Array(5);
    let offset = 0;
    while (offset < signature.length) {
      const { value, done } = await reader.read();
      if (done) return false;
      const prefix = value.subarray(0, signature.length - offset);
      signature.set(prefix, offset);
      offset += prefix.length;
    }
    return new TextDecoder().decode(signature) === "%PDF-";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    if (reader) void reader.cancel().catch(() => {});
  }
}

async function showPdf(holder, status, path, subjectId, folder, title, downloadLabel) {
  const url = pdfUrl(path, subjectId, folder);
  if (!url || !await servedAsPdf(url) || !holder.isConnected) return;

  const actions = element("span", "pdf-actions");
  const view = actionLink("Ø¹Ø±Ø¶ PDF", url.href, "book");
  view.classList.add("view-link");
  view.target = "_blank";
  view.rel = "noopener";
  view.setAttribute("aria-label", `Ø¹Ø±Ø¶ PDF â€” ${title}`);

  const download = actionLink(downloadLabel, url.href, "download");
  download.setAttribute("download", "");
  actions.append(view, download);
  status.replaceWith(actions);
}

function chapterSection(subject) {
  const section = disclosure("Ù…Ø­Ø§Ø¶Ø±Ø§Øª", "course-section", "book");
  const content = element("div", "disclosure-content");
  section.append(content);
  for (const chapter of byNumber(subject.chapters)) {
    const chapterDetails = disclosure(chapter.title, "chapter");
    const folder = `chapter-${String(chapter.number).padStart(2, "0")}`;

    chapterDetails.addEventListener("toggle", () => {
      if (!chapterDetails.open || chapterDetails.children.length > 1) return;
      const lectures = byNumber(chapter.lectures);
      if (lectures.length === 0) {
        chapterDetails.append(element("p", "empty-message", "Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø­Ø§Ø¶Ø±Ø§Øª Ù…Ø¶Ø§ÙØ© Ø­Ø§Ù„ÙŠØ§Ù‹"));
        return;
      }

      const list = element("ul", "lecture-list");
      chapterDetails.append(list);
      for (const lecture of lectures) {
        const row = element("li", "lecture-row");
        const title = element("span", "lecture-title");
        title.append(icon("file", 19), lecture.title);
        const status = element("span", "resource-status", unavailableFile);
        row.append(title, status);
        list.append(row);
        void showPdf(row, status, lecture.pdf, subject.id, folder, lecture.title, "ØªØ­Ù…ÙŠÙ„ PDF");
      }
    });

    content.append(chapterDetails);
  }

  if (subject.chapters.length === 0) {
    content.append(element("p", "empty-message", "Ù„Ø§ ØªÙˆØ¬Ø¯ ÙØµÙˆÙ„ Ù…Ø¶Ø§ÙØ© Ø­Ø§Ù„ÙŠØ§Ù‹"));
  }
  return section;
}

function questionsSection(subject) {
  const section = disclosure("Ø£Ø³Ø¦Ù„Ø©", "exam-option", "file");
  const list = element("ul", "disclosure-content resource-grid");
  section.append(list);
  const files = [
    { title: "Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ù‡Ø± Ø§Ù„Ø£ÙˆÙ„", label: "ØªØ­Ù…ÙŠÙ„ Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ù‡Ø± Ø§Ù„Ø£ÙˆÙ„", path: subject.exam?.questions },
    { title: "Ø§Ù„Ø£Ø¬ÙˆØ¨Ø© Ø§Ù„Ù†Ù…ÙˆØ°Ø¬ÙŠØ©", label: "ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø£Ø¬ÙˆØ¨Ø© Ø§Ù„Ù†Ù…ÙˆØ°Ø¬ÙŠØ©", path: subject.exam?.answers }
  ];
  for (const file of files) {
    const item = element("li", "resource-item");
    const status = element("span", "resource-status", unavailableFile);
    item.append(element("span", "resource-title", file.title), status);
    list.append(item);
    void showPdf(item, status, file.path, subject.id, "month-01-exam", file.title, file.label);
  }
  return section;
}

function privatePortalUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function gradesSection(subject) {
  const section = disclosure("Ø¯Ø±Ø¬Ø§Øª", "exam-option", "lock");
  const list = element("ul", "disclosure-content resource-grid");
  section.append(list);
  const periods = [
    { title: "Ø¯Ø±Ø¬Ø§Øª Ø§Ù„Ø´Ù‡Ø± Ø§Ù„Ø£ÙˆÙ„", url: subject.grades?.monthOne },
    { title: "Ø¯Ø±Ø¬Ø§Øª Ø§Ù„ÙØµÙ„ Ø§Ù„Ø£ÙˆÙ„", url: subject.grades?.chapterOne }
  ];
  for (const period of periods) {
    const item = element("li", "resource-item");
    const url = privatePortalUrl(period.url);
    if (url) {
      const link = actionLink(period.title, url, "lock");
      link.rel = "noreferrer";
      item.append(link);
    } else {
      item.append(
        element("span", "resource-title", period.title),
        element("span", "resource-status", unavailableGrades)
      );
    }
    list.append(item);
  }
  return section;
}

function examSection(subject) {
  const section = disclosure("Ø§Ù„ØªÙ‚ÙŠÙŠÙ…", "course-section", "exam");
  const content = element("div", "disclosure-content");
  content.append(questionsSection(subject), gradesSection(subject));
  section.append(content);
  return section;
}

function chooseSubject(subject, card) {
  const wasOpen = selectedCard === card;
  if (selectedCard) {
    selectedCard.setAttribute("aria-expanded", "false");
    selectedCard.querySelector(".action-text").textContent = "Ø¹Ø±Ø¶ Ø§Ù„Ù…Ø§Ø¯Ø©";
  }

  if (wasOpen) {
    selectedCard = null;
    subjectDetail.hidden = true;
    subjectDetail.replaceChildren();
    return;
  }

  selectedCard = card;
  card.setAttribute("aria-expanded", "true");
  card.querySelector(".action-text").textContent = "Ø¥Ø®ÙØ§Ø¡ Ø§Ù„Ù…Ø§Ø¯Ø©";

  const banner = element("div", "course-heading");
  const title = element("h2", "", subject.title);
  title.id = "course-title";
  title.tabIndex = -1;
  const close = element("button", "close-course");
  close.type = "button";
  close.setAttribute("aria-label", "Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù…Ø§Ø¯Ø©");
  close.title = "Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù…Ø§Ø¯Ø©";
  close.append(icon("close", 22));
  close.addEventListener("click", () => {
    chooseSubject(subject, card);
    card.focus();
  });
  banner.append(subjectIcon(subject.id, 24), title, close);

  const body = element("div", "course-body");
  body.append(chapterSection(subject), examSection(subject));
  subjectDetail.replaceChildren(banner, body);
  subjectDetail.hidden = false;
  title.focus({ preventScroll: true });
  subjectDetail.scrollIntoView({ block: "start" });
}

function subjectCard(subject) {
  const card = element("button", "subject-card");
  card.type = "button";
  card.setAttribute("aria-expanded", "false");
  card.setAttribute("aria-controls", "subject-detail");

  const action = element("span", "subject-action");
  const mark = element("span", "disclosure-mark");
  mark.append(icon("plus", 16));
  action.append(element("span", "action-text", "Ø¹Ø±Ø¶ Ø§Ù„Ù…Ø§Ø¯Ø©"), mark);
  action.setAttribute("aria-hidden", "true");

  card.append(subjectIcon(subject.id, 29), element("span", "subject-title", subject.title), action);
  card.addEventListener("click", () => chooseSubject(subject, card));
  return card;
}

try {
  const response = await fetch(new URL("content.json", siteRoot), { cache: "no-cache" });
  if (!response.ok) throw new Error("Could not load content.json");
  const { subjects } = await response.json();
  subjectList.replaceChildren(...subjects.map(subjectCard));
  loadMessage.hidden = true;
} catch (error) {
  loadMessage.textContent = "ØªØ¹Ø°Ù‘Ø± Ø¹Ø±Ø¶ Ø§Ù„Ù…ÙˆØ§Ø¯ Ø§Ù„Ø¯Ø±Ø§Ø³ÙŠØ©. Ø£Ø¹Ø¯ ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙØ­Ø© Ù„Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø¬Ø¯Ø¯Ø§Ù‹.";
  console.error(error);
}
