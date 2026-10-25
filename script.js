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

      if (Array.isArray(parsedTasks)) {
        return parsedTasks;
      }
    }
  } catch (error) {
    console.warn("Unable to load saved tasks:", error);
  }

  return sampleTasks.map((task) => ({ ...task }));
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn("Unable to save tasks:", error);
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
      updateNavigation();
      render();
    });

    categoryNav.append(button);
  });
}

function updateNavigation() {
  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === currentView);
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
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
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
