const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".nav-link");
const welcomePanel = document.getElementById("welcome");
const mainNav = document.getElementById("mainNav");
const toast = document.getElementById("toast");
const profileMenu = document.getElementById("profileMenu");
const profileTrigger = document.getElementById("profileTrigger");
const lightModeButton = document.getElementById("lightMode");
const darkModeButton = document.getElementById("darkMode");
const offlineLimit = 30_000;
let hiddenSince = null;
let offlineTimer = null;
let endingOfflineSession = false;

const student = window.ClassHubAuth.currentStudent();
if (!student) window.location.replace("index.html");
else {
  document.getElementById("profileName").textContent = student.name;
  document.getElementById("profileSection").textContent = student.courseSection;
  const initials = student.name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  document.querySelectorAll(".profile-avatar").forEach(avatar => {
    avatar.textContent = initials || "S";
  });
}

document.getElementById("year").textContent = new Date().getFullYear();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function showPage(pageName) {
  pages.forEach(page => page.classList.toggle("active-page", page.id === pageName));
  navLinks.forEach(link => link.classList.toggle("active", link.dataset.page === pageName));
  welcomePanel.hidden = pageName !== "home";
  mainNav.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navLinks.forEach(link => link.addEventListener("click", () => showPage(link.dataset.page)));
document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});
document.getElementById("menuToggle").addEventListener("click", () => mainNav.classList.toggle("open"));

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  lightModeButton.setAttribute("aria-pressed", String(theme === "light"));
  darkModeButton.setAttribute("aria-pressed", String(theme === "dark"));
  try {
    localStorage.setItem("classhub-theme", theme);
  } catch {
    // Keep the selected theme for this page view if browser storage is unavailable.
  }
}

let savedTheme = "light";
try {
  savedTheme = localStorage.getItem("classhub-theme") === "dark" ? "dark" : "light";
} catch {
  savedTheme = "light";
}
setTheme(savedTheme);

profileTrigger.addEventListener("click", () => {
  const isOpen = profileMenu.classList.toggle("open");
  profileTrigger.setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("click", event => {
  if (!profileMenu.contains(event.target)) {
    profileMenu.classList.remove("open");
    profileTrigger.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    profileMenu.classList.remove("open");
    profileTrigger.setAttribute("aria-expanded", "false");
    profileTrigger.focus();
  }
});

lightModeButton.addEventListener("click", () => setTheme("light"));
darkModeButton.addEventListener("click", () => setTheme("dark"));

function terminateOfflineSession() {
  if (endingOfflineSession) return;
  endingOfflineSession = true;
  window.clearTimeout(offlineTimer);
  window.ClassHubAuth.logout();
  window.alert("Session Terminated: Offline for 30 seconds.\nLogging out...");
  window.location.replace("index.html");
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenSince = Date.now();
    window.clearTimeout(offlineTimer);
    offlineTimer = window.setTimeout(() => {
      if (document.hidden && Date.now() - hiddenSince >= offlineLimit) {
        terminateOfflineSession();
      }
    }, offlineLimit);
    return;
  }

  if (hiddenSince === null) return;
  const awayDuration = Date.now() - hiddenSince;
  hiddenSince = null;
  window.clearTimeout(offlineTimer);
  if (awayDuration >= offlineLimit) terminateOfflineSession();
});

const defaultAnnouncements = [
  { title: "Welcome to our class website", text: "Explore the subject pages and check back for class updates.", date: new Date().toLocaleDateString() },
  { title: "Keep your work organized", text: "Remember to follow your instructor's submission instructions and deadlines.", date: new Date().toLocaleDateString() }
];
let announcements = [...defaultAnnouncements];

function renderAnnouncements() {
  const markup = announcements.map(item => `
    <article class="announcement-item">
      <span class="item-date">${escapeHTML(item.date)}</span>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.text)}</p>
    </article>`).join("");
  document.getElementById("announcementList").innerHTML = markup || "<p>No announcements yet.</p>";
  document.getElementById("homeAnnouncements").innerHTML = markup || "<p>No announcements yet.</p>";
}

document.getElementById("announcementForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = document.getElementById("announcementTitle").value.trim();
  const text = document.getElementById("announcementText").value.trim();
  if (!title || !text) return;
  announcements.unshift({ title, text, date: new Date().toLocaleDateString() });
  renderAnnouncements();
  event.target.reset();
  showToast("Announcement added in this demo.");
});

const subjectData = {
  "Programming": [
    ["Week 1", "Introduction to programming", "Learn what programs are, how algorithms work, and how to solve problems step by step."],
    ["Week 2", "Variables and data types", "Practice declaring variables and using strings, integers, decimals, and booleans."],
    ["Week 3", "Input, output, and conditions", "Use input and output statements, if/else conditions, and comparison operators."],
    ["Week 4", "Loops and functions", "Explore repetition with loops and organize code using functions."]
  ],
  "Web Development": [
    ["Week 1", "HTML foundations", "Create page structure with headings, paragraphs, links, images, and lists."],
    ["Week 2", "CSS styling", "Use selectors, colors, spacing, borders, and typography to style a page."],
    ["Week 3", "JavaScript basics", "Respond to events and update page content using JavaScript."],
    ["Week 4", "Responsive layouts", "Use Flexbox, Grid, and media queries to support different screen sizes."]
  ],
  "Computer Systems": [
    ["Week 1", "Computer components", "Identify the roles of the CPU, memory, storage, and input/output devices."],
    ["Week 2", "Operating systems", "Understand how an operating system manages hardware and applications."],
    ["Week 3", "Data representation", "Explore binary numbers and how computers represent information."],
    ["Week 4", "Networks and security", "Learn basic networking concepts and safe computing practices."]
  ]
};

function renderSubject(subject) {
  document.getElementById("subjectTitle").textContent = subject;
  const weeks = subjectData[subject] || [];
  const weekList = document.getElementById("weekList");
  weekList.innerHTML = weeks.map((week, index) =>
    `<button class="week-btn ${index === 0 ? "active" : ""}" data-week-index="${index}">${escapeHTML(week[0])}</button>`
  ).join("");
  weekList.querySelectorAll(".week-btn").forEach(button => {
    button.addEventListener("click", () => {
      weekList.querySelectorAll(".week-btn").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      renderWeek(subject, Number(button.dataset.weekIndex));
    });
  });
  renderWeek(subject, 0);
}

function renderWeek(subject, index) {
  const week = subjectData[subject][index];
  document.getElementById("weekDetails").innerHTML =
    `<h3>${escapeHTML(week[0])}: ${escapeHTML(week[1])}</h3><p>${escapeHTML(week[2])}</p>`;
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    tab.classList.add("active");
    renderSubject(tab.dataset.subject);
  });
});

let projects = [];
function renderProjects() {
  const list = document.getElementById("projectList");
  if (!projects.length) {
    list.innerHTML = '<div class="content-card"><p>No projects submitted yet. Be the first to share one!</p></div>';
    return;
  }
  list.innerHTML = projects.map(project => `
    <article class="project-item">
      <h3>${escapeHTML(project.title)}</h3>
      <p>Submitted by ${escapeHTML(project.name)}</p>
      ${project.link ? `<p><a href="${safeURL(project.link)}" target="_blank" rel="noopener noreferrer">Open project link ↗</a></p>` : ""}
    </article>`).join("");
}

document.getElementById("projectForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("studentName").value.trim();
  const title = document.getElementById("projectTitle").value.trim();
  const link = document.getElementById("projectLink").value.trim();
  if (!name || !title) return;
  projects.unshift({ name, title, link });
  renderProjects();
  event.target.reset();
  showToast("Project added in this browser.");
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  window.ClassHubAuth.logout();
  window.location.assign("index.html");
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function safeURL(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

renderAnnouncements();
renderSubject("Programming");
renderProjects();
showPage("home");
