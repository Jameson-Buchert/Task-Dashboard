// Browser: dashboard application. Node.js: regression checks.

if (typeof document === 'undefined') {
  
// Run with Node.js and Playwright installed (uses Microsoft Edge).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

(async () => {
  const server = http.createServer((req, res) => {
    const name = req.url === '/' ? 'index.html' : req.url.slice(1);
    if (!['index.html', 'node.js', 'style.css'].includes(name)) {
      res.writeHead(404).end(); return;
    }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(path.join(__dirname, name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    const rows = page.locator('#taskRows tr');
    assert.equal(await rows.count(), 6);
    assert.equal(await page.locator('#taskCount').textContent(), '6');
    await page.click('[data-view=today]');
    assert.equal(await rows.count(), 1);
    await page.click('[data-view=upcoming]');
    assert.equal(await rows.count(), 3);
    await page.click('[data-view=all]');
    await page.click('#addTask');
    await page.fill('[name=title]', 'Dashboard regression task');
    await page.fill('[name=description]', 'Persistence check');
    await page.selectOption('[name=status]', 'progress');
    await page.click('#saveTask');
    assert.equal(await rows.count(), 7);
    await page.reload();
    assert.equal(await rows.count(), 7);
    let row = rows.filter({ hasText: 'Dashboard regression task' });
    await row.getByRole('button', { name: 'Edit Dashboard regression task', exact: true }).click();
    await page.fill('[name=title]', 'Edited regression task');
    await page.click('#saveTask');
    row = rows.filter({ hasText: 'Edited regression task' });
    await row.locator('input').check();
    assert.equal(await page.locator('#completedStat').textContent(), '3');
    await page.click('[data-status=todo]');
    await page.fill('#search', 'no match');
    await page.click('[data-view=completed]');
    assert.equal(await rows.count(), 3);
    assert.equal(await page.locator('.crumb strong').textContent(), 'Completed');
    await page.click('[data-view=all]');
    await page.fill('#search', 'Persistence check');
    assert.equal(await rows.count(), 1);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete Edited regression task', exact: true }).click();
    assert.equal(await rows.count(), 0);
    assert.equal(await page.locator('#empty').isVisible(), true);
    await page.click('[data-view=all]');
    await page.selectOption('#sort', 'priority');
    assert.equal(await rows.first().locator('td').nth(1).textContent(), 'high');
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    assert.equal(await rows.count(), 2);
    await page.reload();
    assert.equal(await rows.count(), 6);
    await page.evaluate(() => localStorage.setItem('taskflow.tasks.v1', '[null]'));
    await page.reload();
    assert.equal(await rows.count(), 6);
    assert.match(await page.locator('#storageMessage').textContent(), /could not be loaded/);
    await page.evaluate(() => localStorage.setItem('taskflow.tasks.v1', '[]'));
    await page.reload();
    assert.equal(await rows.count(), 0);
    assert.equal(await page.locator('#percent').textContent(), '0%');
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); }; });
    await page.click('#emptyAdd');
    await page.fill('[name=title]', 'Unsaved task');
    await page.click('#saveTask');
    assert.match(await page.locator('#storageMessage').textContent(), /only available in this tab/);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('PASS: rendering, CRUD, persistence, navigation, search, sorting, categories, empty state, invalid storage, failed saves, mobile width, and no JavaScript errors.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

} else {


/* Task Storage */

const STORAGE_KEY = "taskflow.tasks.v1";
const select = (element) => document.querySelector(element);

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dayOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDay(date);
}

function formatDate(value) {
  const date = new Date(value + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* Sample Tasks */

const sampleTasks = [
  { id: "sample-1", title: "Design landing page mockup", description: "Create initial layout and visual direction", category: "Design", priority: "high", due: dayOffset(1), status: "progress", created: 1 },
  { id: "sample-2", title: "Build responsive navigation", description: "Make the header work on smaller screens", category: "Development", priority: "high", due: dayOffset(0), status: "todo", created: 2 },
  { id: "sample-3", title: "Review project requirements", description: "Confirm deliverables and timeline", category: "Work", priority: "medium", due: dayOffset(3), status: "todo", created: 3 },
  { id: "sample-4", title: "Update GitHub portfolio", description: "Polish project descriptions", category: "Personal", priority: "low", due: dayOffset(6), status: "todo", created: 4 },
  { id: "sample-5", title: "Set up project structure", description: "Create files and folder organization", category: "Development", priority: "medium", due: dayOffset(-2), status: "done", created: 5 },
  { id: "sample-6", title: "Research UI inspiration", description: "Collect dashboard design references", category: "Design", priority: "low", due: dayOffset(-1), status: "done", created: 6 }
];

function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (savedTasks !== null) {
      const parsedTasks = JSON.parse(savedTasks);

      if (Array.isArray(parsedTasks) && parsedTasks.every(isValidTask) &&
          new Set(parsedTasks.map((task) => task.id)).size === parsedTasks.length) {
        return parsedTasks;
      }
      throw new Error("Saved task data has an invalid format.");
    }
  } catch (error) {
    console.warn("Unable to load saved tasks:", error);
    select("#storageMessage").textContent = "Saved tasks could not be loaded. Sample tasks are shown; browser data has not been changed.";
  }

  return sampleTasks.map((task) => ({ ...task }));
}

function isValidTask(task) {
  return task && typeof task === "object" && typeof task.id === "string" && task.id &&
    typeof task.title === "string" && task.title.trim() &&
    (task.description === undefined || typeof task.description === "string") &&
    ["Work", "Personal", "Design", "Development"].includes(task.category) &&
    ["high", "medium", "low"].includes(task.priority) &&
    ["todo", "progress", "done"].includes(task.status) &&
    (task.due === "" || (typeof task.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.due) &&
      Number.isFinite(new Date(task.due + "T12:00:00").getTime()))) &&
    (task.created === undefined || Number.isFinite(task.created));
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    select("#storageMessage").textContent = "Data saved locally in your browser";
  } catch (error) {
    console.warn("Unable to save tasks:", error);
    select("#storageMessage").textContent = "Changes are only available in this tab. Browser storage is unavailable; keep this tab open to retain your work.";
  }
}

let tasks = loadTasks();
let currentView = "all";
let statusFilter = "all";
let categoryFilter = "all";
let editingId = null;

const priorityRank = { high: 0, medium: 1, low: 2 };

function isOverdue(task) {
  return task.status !== "done" && task.due && task.due < localDay();
}

/* Dashboard Statistics */

function updateStatistics() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.filter((task) => task.status === "progress").length;
  const overdue = tasks.filter(isOverdue).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  select("#totalStat").textContent = total;
  select("#progressStat").textContent = progress;
  select("#completedStat").textContent = completed;
  select("#overdueStat").textContent = overdue;
  select("#percent").textContent = percent + "%";
  select("#progressFraction").textContent = `${completed} / ${total}`;
  select("#progressFill").style.width = percent + "%";
  select("#donut").style.background = `conic-gradient(#006eff ${percent}%, #26344b ${percent}%)`;
}

/* Quick Focus */

function updateFocus() {
  const focusList = select("#focusList");
  focusList.replaceChildren();

  const focusTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.due || "9999").localeCompare(b.due || "9999"))
    .slice(0, 2);

  if (!focusTasks.length) {
    const message = document.createElement("p");
    message.textContent = "All caught up! Add a new task to get started.";
    focusList.append(message);
    return;
  }

  focusTasks.forEach((task) => {
    const item = document.createElement("div");
    item.className = "focus-item";

    const icon = document.createElement("span");
    icon.className = "focus-icon";
    icon.textContent = "✦";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    const date = document.createElement("small");
    title.textContent = task.title;
    date.textContent = task.due ? `Due ${formatDate(task.due)}` : "No due date";
    info.append(title, date);

    const priority = document.createElement("span");
    priority.className = "tag " + task.priority;
    priority.textContent = task.priority;

    item.append(icon, info, priority);
    focusList.append(item);
  });
}

/* Category Navigation */

function updateCategories() {
  const categoryNav = select("#categoryNav");
  categoryNav.replaceChildren();

  ["Work", "Personal", "Design", "Development"].forEach((category) => {
    const button = document.createElement("button");
    const dot = document.createElement("span");

    button.className = "category-btn" + (categoryFilter === category ? " active" : "");
    dot.className = "category-dot";
    button.append(dot, document.createTextNode(category));

    button.addEventListener("click", () => {
      categoryFilter = categoryFilter === category ? "all" : category;
      currentView = "all";
      statusFilter = "all";
      updateNavigation();
      render();
    });

    categoryNav.append(button);
  });
}

function updateNavigation() {
  const viewNames = { all: "Overview", today: "Due today", upcoming: "Upcoming", completed: "Completed" };
  select(".crumb strong").textContent = categoryFilter === "all" ? viewNames[currentView] : categoryFilter;
  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.toggle("active", categoryFilter === "all" && button.dataset.view === currentView);
  });
  document.querySelectorAll("#tabs button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.status === statusFilter);
  });
}

/* Task List */

function getVisibleTasks() {
  const search = select("#search").value.trim().toLowerCase();
  const sort = select("#sort").value;

  const visibleTasks = tasks.filter((task) => {
    if (currentView === "today" && task.due !== localDay()) return false;
    if (currentView === "upcoming" && (!task.due || task.due <= localDay() || task.status === "done")) return false;
    if (currentView === "completed" && task.status !== "done") return false;
    if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
    if (statusFilter !== "all" && task.status !== statusFilter) return false;

    const details = `${task.title} ${task.description || ""} ${task.category}`.toLowerCase();
    return details.includes(search);
  });

  visibleTasks.sort((a, b) => {
    if (sort === "due") return (a.due || "9999").localeCompare(b.due || "9999");
    if (sort === "priority") return priorityRank[a.priority] - priorityRank[b.priority];
    if (sort === "oldest") return (a.created || 0) - (b.created || 0);
    return (b.created || 0) - (a.created || 0);
  });

  return visibleTasks;
}

function makeTaskRow(task) {
  const row = document.createElement("tr");

  const nameCell = document.createElement("td");
  const nameWrapper = document.createElement("div");
  const checkbox = document.createElement("input");
  const textWrapper = document.createElement("div");
  const title = document.createElement("strong");
  const description = document.createElement("small");

  nameWrapper.className = "task-name";
  checkbox.type = "checkbox";
  checkbox.className = "task-check";
  checkbox.checked = task.status === "done";
  checkbox.setAttribute("aria-label", "Mark " + task.title + " completed");

  checkbox.addEventListener("change", () => {
    task.status = checkbox.checked ? "done" : "todo";
    saveTasks();
    render();
  });

  textWrapper.className = "task-text" + (task.status === "done" ? " done-text" : "");
  title.textContent = task.title;
  description.textContent = task.category + (task.description ? " · " + task.description : "");
  textWrapper.append(title, description);
  nameWrapper.append(checkbox, textWrapper);
  nameCell.append(nameWrapper);

  const priorityCell = document.createElement("td");
  const priority = document.createElement("span");
  priority.className = "tag " + task.priority;
  priority.textContent = task.priority;
  priorityCell.append(priority);

  const dateCell = document.createElement("td");
  dateCell.textContent = task.due ? formatDate(task.due) : "No date";
  if (isOverdue(task)) dateCell.className = "overdue";

  const statusCell = document.createElement("td");
  const status = document.createElement("span");
  const statusNames = { todo: "To do", progress: "In progress", done: "Completed" };
  status.className = "tag " + task.status;
  status.textContent = statusNames[task.status];
  statusCell.append(status);

  const actionCell = document.createElement("td");
  const actions = document.createElement("div");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  actions.className = "row-actions";
  editButton.className = "icon-btn";
  editButton.textContent = "✎";
  editButton.title = "Edit task";
  editButton.setAttribute("aria-label", "Edit " + task.title);
  editButton.addEventListener("click", () => openTaskForm(task));

  deleteButton.className = "icon-btn";
  deleteButton.textContent = "×";
  deleteButton.title = "Delete task";
  deleteButton.setAttribute("aria-label", "Delete " + task.title);
  deleteButton.addEventListener("click", () => {
    if (confirm(`Delete "${task.title}"?`)) {
      tasks = tasks.filter((item) => item.id !== task.id);
      saveTasks();
      render();
    }
  });

  actions.append(editButton, deleteButton);
  actionCell.append(actions);
  row.append(nameCell, priorityCell, dateCell, statusCell, actionCell);
  return row;
}

function render() {
  updateNavigation();
  updateStatistics();
  updateFocus();
  updateCategories();

  const visibleTasks = getVisibleTasks();
  select("#taskCount").textContent = visibleTasks.length;
  select("#empty").hidden = visibleTasks.length !== 0;
  select("#taskRows").replaceChildren(...visibleTasks.map(makeTaskRow));
}

/* Task Form */

function openTaskForm(task = null) {
  editingId = task ? task.id : null;
  const form = select("#taskForm");
  form.reset();

  select("#dialogTitle").textContent = task ? "Edit task" : "Create a new task";
  select("#saveTask").textContent = task ? "Save changes" : "Create task";

  if (task) {
    ["title", "description", "category", "priority", "due", "status"].forEach((field) => {
      form.elements.namedItem(field).value = task[field] || "";
    });
  }

  select("#taskDialog").showModal();
}

select("#taskForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(event.currentTarget));
  data.title = data.title.trim();
  data.description = data.description.trim();
  if (!data.title) return;

  if (editingId) {
    const existingTask = tasks.find((task) => task.id === editingId);
    if (existingTask) Object.assign(existingTask, data);
  } else {
    tasks.unshift({
      ...data,
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      created: Date.now()
    });
  }

  saveTasks();
  select("#taskDialog").close();
  render();
});

/* Buttons and Filters */

select("#addTask").addEventListener("click", () => openTaskForm());
select("#emptyAdd").addEventListener("click", () => openTaskForm());
select("#closeDialog").addEventListener("click", () => select("#taskDialog").close());
select("#cancelDialog").addEventListener("click", () => select("#taskDialog").close());
select("#search").addEventListener("input", render);
select("#sort").addEventListener("change", render);

document.querySelectorAll(".nav").forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    categoryFilter = "all";
    statusFilter = "all";
    select("#search").value = "";
    updateNavigation();
    render();
  });
});

document.querySelectorAll("#tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    statusFilter = button.dataset.status;

    document.querySelectorAll("#tabs button").forEach((item) => {
      item.classList.toggle("selected", item === button);
    });

    render();
  });
});

/* Start Dashboard */

select("#todayLabel").textContent = new Date().toLocaleDateString("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

render();

}
