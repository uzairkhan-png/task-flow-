
"use strict";

/* =========================================================
   TASKFLOW — COMPLETE APP
   Storage, tasks, filters, calendar, focus timer, goals,
   weekly insights, dialogs, and import/export.
   ========================================================= */

const STORAGE_KEY = "taskflow-tasks";
const THEME_KEY = "taskflow-theme";
const WEEKLY_GOAL_KEY = "taskflow-weekly-goal";
const FOCUS_HISTORY_KEY = "taskflow-focus-history";
const SESSION_COUNT_KEY = "taskflow-focus-session-count";

const $ = (id) => document.getElementById(id);

/* ---------- DOM references ---------- */

const taskForm = $("task-form");
const taskInput = $("task-input");
const taskNotes = $("task-notes");
const taskPriority = $("task-priority");
const taskCategory = $("task-category");
const taskDueDate = $("task-due-date");
const taskRepeat = $("task-repeat");
const taskTags = $("task-tags");
const addTaskBtn = $("add-task-btn");
const cancelEditBtn = $("cancel-edit-btn");
const formHeading = $("form-heading");

const searchInput = $("search-input");
const taskList = $("task-list");
const emptyMessage = $("empty-message");
const visibleTaskCount = $("visible-task-count");
const filterButtons = document.querySelectorAll(".filter-btn");
const sortTasks = $("sort-tasks");
const categoryFilter = $("category-filter");
const tagFilter = $("tag-filter");
const clearFiltersBtn = $("clear-filters-btn");

const totalTasksEl = $("total-tasks");
const activeTasksEl = $("active-tasks");
const completedTasksEl = $("completed-tasks");
const progressPercent = $("progress-percent");
const progressTrack = $("progress-track");
const progressFill = $("progress-fill");
const progressMessage = $("progress-message");

const dueTodayCount = $("due-today-count");
const overdueCount = $("overdue-count");
const overdueDetailCount = $("overdue-detail-count");
const upcomingCount = $("upcoming-count");

const themeToggle = $("theme-toggle");
const todayLabel = $("today-label");

const prevMonthBtn = $("prev-month");
const nextMonthBtn = $("next-month");
const calendarMonthLabel = $("calendar-month");
const calendarGrid = $("calendar-grid");
const calendarTasks = $("calendar-tasks");
const calendarTasksHeading = $("calendar-tasks-heading");

const insightCompletion = $("insight-completion");
const insightHigh = $("insight-high");
const insightMedium = $("insight-medium");
const insightLow = $("insight-low");

const weeklySummary = $("weekly-summary");
const weeklyCompletedEl = $("weekly-completed");
const weeklyFocusSessionsEl = $("weekly-focus-sessions");
const weeklyAverageEl = $("weekly-average");
const weeklyChart = $("weekly-chart");

const weeklyGoalInput = $("weekly-goal-input");
const saveWeeklyGoalBtn = $("save-weekly-goal");
const goalProgressText = $("goal-progress-text");
const goalProgressTrack = $("goal-progress-track");
const goalProgressFill = $("goal-progress-fill");
const currentStreakDisplay = $("current-streak");

const focusTaskSelect = $("focus-task-select");
const focusTaskProgress = $("focus-task-progress");
const timerDisplay = $("timer-display");
const timerMode = $("timer-mode");
const timerStart = $("timer-start");
const timerPause = $("timer-pause");
const timerReset = $("timer-reset");
const focusSessionsDisplay = $("focus-sessions");
const timerPresetButtons = document.querySelectorAll("[data-minutes]");

const exportTasksBtn = $("export-tasks-btn");
const importTasksBtn = $("import-tasks-btn");
const importTasksFile = $("import-tasks-file");

const confirmModal = $("confirm-modal");
const confirmMessage = $("confirm-message");
const confirmTitle = $("confirm-title");
const cancelDeleteBtn = $("cancel-delete-btn");
const confirmDeleteBtn = $("confirm-delete-btn");

const importConfirmModal = $("import-confirm-modal");
const importConfirmMessage = $("import-confirm-message");
const confirmImportBtn = $("confirm-import-btn");
const cancelImportBtn = $("cancel-import-btn");

const taskDetailsModal = $("task-details-modal");
const taskDetailsTitle = $("task-details-title");
const taskDetailsContent = $("task-details-content");
const closeTaskDetailsBtn = $("close-task-details");
const detailsCloseBtn = $("details-close-btn");
const detailsEditBtn = $("details-edit-btn");

const toastContainer = $("toast-container");

/* ---------- Application state ---------- */

let tasks = loadTasks();
let currentFilter = "all";
let currentTagFilter = "all";
let draggedTaskId = null;
let editingTaskId = null;
let pendingDeleteTaskId = null;
let pendingImportTasks = null;
let selectedDetailsTaskId = null;
let selectedFocusTaskId = "";
let selectedCalendarDate = dateKey(new Date());
let calendarMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
);

let lastDeleteSnapshot = null;
let deleteDialogFocus = null;
let importDialogFocus = null;
let detailsDialogFocus = null;

let timerDuration = 25 * 60;
let timerRemaining = timerDuration;
let timerDeadline = null;
let timerInterval = null;
let timerIsRunning = false;
let currentTimerMode = "Focus";
let completedFocusSessions = loadNumber(SESSION_COUNT_KEY, 0);
let pendingTimerNotice = null;

let focusHistory = loadFocusHistory();

/* ---------- Safe storage helpers ---------- */

function readStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (error) {
    console.error("Unable to read local storage:", error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Unable to save to local storage:", error);
    showToast(
      "Browser storage could not be updated. Check available storage space.",
      "error"
    );
    return false;
  }
}

function loadNumber(key, fallback) {
  const value = Number(readStorage(key, fallback));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function saveTasks() {
  return writeStorage(STORAGE_KEY, JSON.stringify(tasks));
}

function loadFocusHistory() {
  try {
    const parsed = JSON.parse(readStorage(FOCUS_HISTORY_KEY, "[]"));
    return Array.isArray(parsed)
      ? parsed.filter((item) =>
          item &&
          typeof item.completedAt === "string" &&
          !Number.isNaN(Date.parse(item.completedAt))
        )
      : [];
  } catch {
    return [];
  }
}

function saveFocusHistory() {
  return writeStorage(FOCUS_HISTORY_KEY, JSON.stringify(focusHistory));
}

function saveSessionCount() {
  return writeStorage(SESSION_COUNT_KEY, String(completedFocusSessions));
}

/* ---------- Dates and IDs ---------- */

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDaysToDateKey(value, amount) {
  const date = parseDateKey(value);
  if (!date) return "";

  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function localDateKeyFromTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateKey(date);
}

function formatDate(value, options = {}) {
  const date = parseDateKey(value);
  if (!date) return "No due date";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options
  });
}

function startOfWeek(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function isOverdue(task) {
  return Boolean(
    !task.completed &&
    task.dueDate &&
    task.dueDate < dateKey(new Date())
  );
}

/* ---------- Task data validation and migration ---------- */

function normalizeTask(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title || title.length > 160) return null;

  const allowedPriorities = ["low", "medium", "high"];
  const allowedCategories = ["study", "work", "personal", "other"];
  const allowedRepeats = ["none", "daily", "weekly"];

  let tags = Array.isArray(raw.tags)
    ? raw.tags
    : typeof raw.tags === "string"
      ? raw.tags.split(",")
      : [];

  tags = [...new Set(
    tags
      .filter((tag) => typeof tag === "string")
      .map((tag) => tag.trim().slice(0, 40))
      .filter(Boolean)
  )].slice(0, 20);

  const validDueDate = raw.dueDate === "" ||
    raw.dueDate == null ||
    Boolean(parseDateKey(raw.dueDate));

  const completedAt =
    typeof raw.completedAt === "string" &&
    !Number.isNaN(Date.parse(raw.completedAt))
      ? raw.completedAt
      : null;

  return {
    id: String(raw.id || createId()),
    title,
    completed: Boolean(raw.completed),
    priority: allowedPriorities.includes(raw.priority)
      ? raw.priority
      : "medium",
    category: allowedCategories.includes(raw.category)
      ? raw.category
      : "other",
    dueDate: validDueDate ? (raw.dueDate || "") : "",
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 1000) : "",
    tags,
    repeat: allowedRepeats.includes(raw.repeat) ? raw.repeat : "none",
    createdAt:
      typeof raw.createdAt === "string" &&
      !Number.isNaN(Date.parse(raw.createdAt))
        ? raw.createdAt
        : new Date().toISOString(),
    completedAt: raw.completed ? completedAt : null,
    focusSessions:
      Number.isInteger(raw.focusSessions) && raw.focusSessions >= 0
        ? raw.focusSessions
        : 0
  };
}

function loadTasks() {
  try {
    const raw = readStorage(STORAGE_KEY, "[]");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    const normalized = parsed.map(normalizeTask).filter(Boolean);
    const seen = new Set();

    return normalized.map((task) => {
      if (seen.has(task.id)) task.id = createId();
      seen.add(task.id);
      return task;
    });
  } catch (error) {
    console.error("Unable to load saved tasks:", error);
    return [];
  }
}

/* ---------- Notifications ---------- */

function showToast(message, type = "success", action = null) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);

  if (action && typeof action.onClick === "function") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      action.onClick();
      toast.remove();
    });
    toast.appendChild(button);
  }

  toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 5500);
}

/* ---------- Form and editing ---------- */

function resetTaskForm() {
  taskForm.reset();
  taskPriority.value = "medium";
  taskCategory.value = "other";
  taskRepeat.value = "none";
  taskDueDate.value = "";
  taskNotes.value = "";
  taskTags.value = "";
}

function cancelEditing() {
  editingTaskId = null;
  resetTaskForm();
  formHeading.textContent = "Create a task";
  addTaskBtn.textContent = "＋ Add task";
  cancelEditBtn.hidden = true;
}

function getFormTags() {
  return [...new Set(
    taskTags.value
      .split(",")
      .map((tag) => tag.trim().slice(0, 40))
      .filter(Boolean)
  )].slice(0, 20);
}

function editTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    showToast("That task could not be found.", "error");
    return;
  }

  editingTaskId = taskId;
  taskInput.value = task.title;
  taskNotes.value = task.notes || "";
  taskPriority.value = task.priority || "medium";
  taskCategory.value = task.category || "other";
  taskDueDate.value = task.dueDate || "";
  taskRepeat.value = task.repeat || "none";
  taskTags.value = (task.tags || []).join(", ");

  formHeading.textContent = "Edit task";
  addTaskBtn.textContent = "Save changes";
  cancelEditBtn.hidden = false;

  $("task-form").scrollIntoView({ behavior: "smooth", block: "start" });
  taskInput.focus();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    showToast("Please enter a task title.", "error");
    return;
  }

  if (title.length > 160) {
    showToast("Task titles must be 160 characters or fewer.", "error");
    return;
  }

  if (taskDueDate.value && !parseDateKey(taskDueDate.value)) {
    showToast("Please choose a valid due date.", "error");
    return;
  }

  const wasEditing = editingTaskId !== null;
  const existingTask = wasEditing
    ? tasks.find((task) => task.id === editingTaskId)
    : null;

  if (wasEditing && !existingTask) {
    cancelEditing();
    showToast("That task no longer exists. Please try again.", "error");
    return;
  }

  const previousTasks = tasks;
  const now = new Date().toISOString();

  if (existingTask) {
    tasks = tasks.map((task) => task.id === editingTaskId
      ? {
          ...task,
          title,
          notes: taskNotes.value.trim().slice(0, 1000),
          priority: taskPriority.value,
          category: taskCategory.value,
          dueDate: taskDueDate.value,
          repeat: taskRepeat.value,
          tags: getFormTags()
        }
      : task
    );
  } else {
    const newTask = normalizeTask({
      id: createId(),
      title,
      completed: false,
      priority: taskPriority.value,
      category: taskCategory.value,
      dueDate: taskDueDate.value,
      notes: taskNotes.value.trim(),
      repeat: taskRepeat.value,
      tags: getFormTags(),
      createdAt: now,
      completedAt: null,
      focusSessions: 0
    });

    tasks = [newTask, ...tasks];
  }

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  cancelEditing();
  renderTasks();
  showToast(wasEditing ? "Task updated!" : "Task added!", "success");
});

cancelEditBtn.addEventListener("click", cancelEditing);

/* ---------- Complete, recurring, and delete tasks ---------- */

function createNextOccurrence(task) {
  if (!task.dueDate || !["daily", "weekly"].includes(task.repeat)) {
    return null;
  }

  const nextDate = addDaysToDateKey(
    task.dueDate,
    task.repeat === "daily" ? 1 : 7
  );

  if (!nextDate) return null;

  return normalizeTask({
    ...task,
    id: createId(),
    dueDate: nextDate,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    focusSessions: 0
  });
}

function toggleTask(taskId) {
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return;

  const previousTasks = tasks;
  const task = tasks[index];
  const wasCompleted = task.completed;

  const updatedTask = {
    ...task,
    completed: !wasCompleted,
    completedAt: !wasCompleted ? new Date().toISOString() : null
  };

  tasks = tasks.map((item) => item.id === taskId ? updatedTask : item);

  let nextOccurrence = null;

  if (!wasCompleted) {
    nextOccurrence = createNextOccurrence(updatedTask);

    if (nextOccurrence) {
      tasks = [nextOccurrence, ...tasks];
    }
  }

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  renderTasks();

  if (wasCompleted) {
    showToast("Task marked active.", "info");
  } else {
    showToast(
      nextOccurrence
        ? "Task completed! Your next occurrence was created."
        : "Task completed!",
      "success"
    );
  }
}

function deleteTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  pendingDeleteTaskId = taskId;
  deleteDialogFocus = document.activeElement;
  confirmTitle.textContent = "Delete this task?";
  confirmMessage.textContent =
    `Are you sure you want to delete "${task.title}"? You can undo this shortly after deleting it.`;

  confirmModal.hidden = false;
  cancelDeleteBtn.focus();
}

function closeDeleteDialog() {
  confirmModal.hidden = true;
  pendingDeleteTaskId = null;

  if (deleteDialogFocus instanceof HTMLElement) {
    deleteDialogFocus.focus();
  }

  deleteDialogFocus = null;
}

cancelDeleteBtn.addEventListener("click", closeDeleteDialog);

confirmDeleteBtn.addEventListener("click", () => {
  if (pendingDeleteTaskId === null) {
    closeDeleteDialog();
    return;
  }

  const taskId = pendingDeleteTaskId;
  const taskToRestore = tasks.find((task) => task.id === taskId);
  if (!taskToRestore) {
    closeDeleteDialog();
    return;
  }

  const previousTasks = tasks;
  const previousEditingId = editingTaskId;
  const previousEditingForm = editingTaskId === taskId
    ? {
        title: taskInput.value,
        notes: taskNotes.value,
        priority: taskPriority.value,
        category: taskCategory.value,
        dueDate: taskDueDate.value,
        repeat: taskRepeat.value,
        tags: taskTags.value
      }
    : null;

  tasks = tasks.filter((task) => task.id !== taskId);

  if (editingTaskId === taskId) {
    cancelEditing();
  }

  if (!saveTasks()) {
    tasks = previousTasks;
    editingTaskId = previousEditingId;

    if (previousEditingForm) {
      taskInput.value = previousEditingForm.title;
      taskNotes.value = previousEditingForm.notes;
      taskPriority.value = previousEditingForm.priority;
      taskCategory.value = previousEditingForm.category;
      taskDueDate.value = previousEditingForm.dueDate;
      taskRepeat.value = previousEditingForm.repeat;
      taskTags.value = previousEditingForm.tags;
      formHeading.textContent = "Edit task";
      addTaskBtn.textContent = "Save changes";
      cancelEditBtn.hidden = false;
    }

    closeDeleteDialog();
    renderTasks();
    return;
  }

  lastDeleteSnapshot = {
    task: taskToRestore,
    index: previousTasks.findIndex((task) => task.id === taskId)
  };

  closeDeleteDialog();
  renderTasks();

  showToast("Task deleted.", "info", {
    label: "Undo",
    onClick: undoDelete
  });
});

function undoDelete() {
  if (!lastDeleteSnapshot) return;

  const snapshot = lastDeleteSnapshot;
  if (tasks.some((task) => task.id === snapshot.task.id)) {
    lastDeleteSnapshot = null;
    return;
  }

  const previousTasks = tasks;
  const restoredTasks = [...tasks];
  const index = Math.max(0, Math.min(snapshot.index, restoredTasks.length));
  restoredTasks.splice(index, 0, snapshot.task);
  tasks = restoredTasks;

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  lastDeleteSnapshot = null;
  renderTasks();
  showToast("Task restored.", "success");
}

/* ---------- Tag filters and task rendering ---------- */

function updateTagFilterOptions() {
  const previousValue = currentTagFilter;

  const allTags = [...new Set(
    tasks.flatMap((task) => Array.isArray(task.tags) ? task.tags : [])
  )].sort((a, b) => a.localeCompare(b));

  tagFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All tags";
  tagFilter.appendChild(allOption);

  allTags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    tagFilter.appendChild(option);
  });

  currentTagFilter = allTags.includes(previousValue) ? previousValue : "all";
  tagFilter.value = currentTagFilter;
}

function matchesCurrentFilters(task) {
  const query = searchInput.value.trim().toLocaleLowerCase();

  const searchable = [
    task.title,
    task.notes,
    task.category,
    task.priority,
    ...(task.tags || [])
  ].join(" ").toLocaleLowerCase();

  const matchesSearch = !query || searchable.includes(query);
  const matchesStatus =
    currentFilter === "all" ||
    (currentFilter === "active" && !task.completed) ||
    (currentFilter === "completed" && task.completed);

  const matchesCategory =
    categoryFilter.value === "all" ||
    task.category === categoryFilter.value;

  const matchesTag =
    currentTagFilter === "all" ||
    (Array.isArray(task.tags) && task.tags.includes(currentTagFilter));

  return matchesSearch && matchesStatus && matchesCategory && matchesTag;
}

function sortTaskList(list) {
  const priorityRank = { high: 0, medium: 1, low: 2 };

  return [...list].sort((a, b) => {
    switch (sortTasks.value) {
      case "priority":
        return (priorityRank[a.priority] ?? 1) -
          (priorityRank[b.priority] ?? 1) ||
          a.title.localeCompare(b.title);

      case "due-date":
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);

      case "alphabetical":
        return a.title.localeCompare(b.title);

      case "default":
      default:
        // Keep the saved array order; new tasks are already prepended.
        // This also allows drag-and-drop ordering to persist.
        return 0;
    }
  });
}

function createMetaPill(text, className = "") {
  const pill = document.createElement("span");
  pill.className = `meta-pill ${className}`.trim();
  pill.textContent = text;
  return pill;
}

function makeTaskButton(text, className, onClick, label = text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `task-action-btn ${className}`.trim();
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";

  if (task.completed) card.classList.add("completed");
  if (isOverdue(task)) card.classList.add("overdue");

  const top = document.createElement("div");
  top.className = "task-card-top";

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "drag-handle";
  dragHandle.textContent = "⠿";
  dragHandle.setAttribute("aria-label", `Drag to reorder "${task.title}"`);
  dragHandle.title = "Drag to reorder tasks";
  dragHandle.draggable = true;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Mark "${task.title}" completed`);
  checkbox.addEventListener("change", () => toggleTask(task.id));

  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;
  main.appendChild(title);

  if (task.notes) {
    const notes = document.createElement("p");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    main.appendChild(notes);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";

  meta.appendChild(createMetaPill(
    `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`,
    `priority-${task.priority}`
  ));

  meta.appendChild(createMetaPill(
    task.category[0].toUpperCase() + task.category.slice(1)
  ));

  if (task.dueDate) {
    let dueClass = "";
    let dueText = formatDate(task.dueDate, { year: undefined });

    if (isOverdue(task)) {
      dueClass = "due-overdue";
      dueText = `Overdue · ${formatDate(task.dueDate)}`;
    } else if (!task.completed && task.dueDate === dateKey(new Date())) {
      dueClass = "due-today";
      dueText = "Due today";
    }

    meta.appendChild(createMetaPill(dueText, dueClass));
  }

  if (task.repeat && task.repeat !== "none") {
    meta.appendChild(createMetaPill(
      task.repeat === "daily" ? "↻ Daily" : "↻ Weekly"
    ));
  }

  if (task.focusSessions > 0) {
    meta.appendChild(createMetaPill(`🍅 ${task.focusSessions} sessions`));
  }

  main.appendChild(meta);

  if (task.tags && task.tags.length) {
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "task-tags";

    task.tags.forEach((tag) => {
      const tagElement = document.createElement("span");
      tagElement.className = "task-tag";
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });

    main.appendChild(tagsContainer);
  }

  top.append(dragHandle, checkbox, main);
  card.appendChild(top);

  card.draggable = true;
  card.addEventListener("dragstart", (event) => {
    const canReorder = sortTasks.value === "default" &&
      currentFilter === "all" &&
      !searchInput.value.trim() &&
      categoryFilter.value === "all" &&
      currentTagFilter === "all";

    if (!canReorder) {
      event.preventDefault();
      showToast("Clear filters and choose Newest first to reorder tasks.", "info");
      return;
    }

    draggedTaskId = task.id;
    card.classList.add("dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
    }
  });

  card.addEventListener("dragover", (event) => {
    if (!draggedTaskId || draggedTaskId === task.id) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    card.classList.add("drag-over");
  });

  card.addEventListener("dragleave", () => {
    card.classList.remove("drag-over");
  });

  card.addEventListener("drop", (event) => {
    event.preventDefault();
    card.classList.remove("drag-over");
    const sourceId = draggedTaskId ||
      (event.dataTransfer && event.dataTransfer.getData("text/plain"));
    if (!sourceId || sourceId === task.id) return;

    const sourceIndex = tasks.findIndex((item) => item.id === sourceId);
    const targetIndex = tasks.findIndex((item) => item.id === task.id);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const previousTasks = tasks;
    const reordered = [...tasks];
    const [movedTask] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, movedTask);
    tasks = reordered;

    if (!saveTasks()) {
      tasks = previousTasks;
      showToast("Could not save the new task order.", "error");
    } else {
      showToast("Task order updated.", "success");
    }
    draggedTaskId = null;
    renderTasks();
  });

  card.addEventListener("dragend", () => {
    draggedTaskId = null;
    card.classList.remove("dragging", "drag-over");
    taskList.querySelectorAll(".task-card").forEach((item) => {
      item.classList.remove("dragging", "drag-over");
    });
  });

  const actions = document.createElement("div");
  actions.className = "task-actions";

  actions.appendChild(makeTaskButton(
    "View details",
    "",
    () => openTaskDetails(task.id)
  ));

  actions.appendChild(makeTaskButton(
    "Edit",
    "",
    () => editTask(task.id)
  ));

  actions.appendChild(makeTaskButton(
    "Delete",
    "delete",
    () => deleteTask(task.id),
    `Delete "${task.title}"`
  ));

  card.appendChild(actions);
  return card;
}

function renderTasks() {
  updateTagFilterOptions();

  const visibleTasks = sortTaskList(tasks.filter(matchesCurrentFilters));
  taskList.replaceChildren();

  visibleTasks.forEach((task) => {
    taskList.appendChild(createTaskCard(task));
  });

  emptyMessage.hidden = visibleTasks.length !== 0;
  taskList.hidden = visibleTasks.length === 0;
  visibleTaskCount.textContent =
    `${visibleTasks.length} task${visibleTasks.length === 1 ? "" : "s"}`;

  if (visibleTasks.length === 0) {
    emptyMessage.textContent = tasks.length === 0
      ? "No tasks yet. Add your first task to get started!"
      : "No tasks match your filters. Try changing your search or filters.";
  }

  renderStatistics();
  renderUpcoming();
  renderInsights();
  renderCalendar();
  renderWeeklyDashboard();
  renderGoals();
  updateFocusTaskOptions();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter || "all";

    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });

    renderTasks();
  });
});

searchInput.addEventListener("input", renderTasks);
sortTasks.addEventListener("change", renderTasks);
categoryFilter.addEventListener("change", renderTasks);

tagFilter.addEventListener("change", () => {
  currentTagFilter = tagFilter.value;
  renderTasks();
});

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", () => {
    currentFilter = "all";
    currentTagFilter = "all";
    searchInput.value = "";
    categoryFilter.value = "all";
    tagFilter.value = "all";
    sortTasks.value = "default";

    filterButtons.forEach((button) => {
      const active = button.dataset.filter === "all";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    renderTasks();
    showToast("Filters cleared.", "success");
  });
}

/* ---------- Statistics and upcoming deadlines ---------- */

function renderStatistics() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const active = total - completed;
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  totalTasksEl.textContent = total;
  activeTasksEl.textContent = active;
  completedTasksEl.textContent = completed;

  progressPercent.textContent = `${percentage}%`;
  progressFill.style.width = `${percentage}%`;
  progressTrack.setAttribute("aria-valuenow", String(percentage));

  progressMessage.textContent = total === 0
    ? "You can do it — start with one task."
    : percentage === 100
      ? "Everything is complete. Great work!"
      : `${completed} of ${total} tasks completed. Keep going!`;
}

function renderUpcoming() {
  const today = dateKey(new Date());
  const nextWeek = addDaysToDateKey(today, 7);

  const overdue = tasks.filter(isOverdue).length;
  const dueToday = tasks.filter((task) =>
    !task.completed && task.dueDate === today
  ).length;
  const upcoming = tasks.filter((task) =>
    !task.completed &&
    task.dueDate > today &&
    task.dueDate <= nextWeek
  ).length;

  dueTodayCount.textContent = dueToday;
  overdueCount.textContent = overdue;
  overdueDetailCount.textContent = overdue;
  upcomingCount.textContent = upcoming;
}

function renderInsights() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  const active = tasks.filter((task) => !task.completed);

  insightCompletion.textContent = `${percentage}%`;
  insightHigh.textContent = active.filter((task) => task.priority === "high").length;
  insightMedium.textContent = active.filter((task) => task.priority === "medium").length;
  insightLow.textContent = active.filter((task) => task.priority === "low").length;
}

/* ---------- Calendar ---------- */

function renderCalendar() {
  calendarMonthLabel.textContent = calendarMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  calendarGrid.replaceChildren();

  const firstDay = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1
  );

  const mondayOffset = (firstDay.getDay() + 6) % 7;

  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - mondayOffset);

  for (let index = 0; index < 42; index++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);

    const key = dateKey(day);
    const dayTasks = tasks.filter((task) => task.dueDate === key);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.setAttribute("aria-label",
      `${day.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      })}, ${dayTasks.length} tasks`
    );

    if (day.getMonth() !== calendarMonth.getMonth()) {
      button.classList.add("outside-month");
    }

    if (key === dateKey(new Date())) button.classList.add("today");
    if (key === selectedCalendarDate) button.classList.add("selected");

    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = day.getDate();
    button.appendChild(number);

    if (dayTasks.length > 0) {
      const dot = document.createElement("span");
      dot.className = "calendar-day-dot";
      dot.setAttribute("aria-hidden", "true");
      button.appendChild(dot);
    }

    button.addEventListener("click", () => {
      selectedCalendarDate = key;

      if (day.getMonth() !== calendarMonth.getMonth()) {
        calendarMonth = new Date(day.getFullYear(), day.getMonth(), 1);
      }

      renderCalendar();
    });

    calendarGrid.appendChild(button);
  }

  renderCalendarTasks();
}

function renderCalendarTasks() {
  calendarTasksHeading.textContent =
    `Tasks for ${formatDate(selectedCalendarDate, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    })}`;

  calendarTasks.replaceChildren();

  const dayTasks = tasks.filter((task) => task.dueDate === selectedCalendarDate);

  if (dayTasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No tasks due on this date.";
    calendarTasks.appendChild(empty);
    return;
  }

  dayTasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "calendar-task-item";

    const title = document.createElement("span");
    title.textContent = `${task.completed ? "✓ " : ""}${task.title}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-action-btn";
    button.textContent = "Details";
    button.addEventListener("click", () => openTaskDetails(task.id));

    row.append(title, button);
    calendarTasks.appendChild(row);
  });
}

prevMonthBtn.addEventListener("click", () => {
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

/* ---------- Task details dialog ---------- */

function openTaskDetails(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  selectedDetailsTaskId = taskId;
  detailsDialogFocus = document.activeElement;
  taskDetailsTitle.textContent = task.title;
  taskDetailsContent.replaceChildren();

  function addDetail(label, value) {
    const row = document.createElement("div");
    row.className = "task-detail-row";

    const heading = document.createElement("strong");
    heading.textContent = label;

    const content = document.createElement("p");
    content.textContent = value || "Not set";

    row.append(heading, content);
    taskDetailsContent.appendChild(row);
  }

  addDetail("Status", task.completed ? "Completed" : "Active");
  addDetail("Priority", task.priority);
  addDetail("Category", task.category);
  addDetail("Due date", task.dueDate ? formatDate(task.dueDate) : "No due date");
  addDetail("Repeat", {
    none: "Does not repeat",
    daily: "Every day",
    weekly: "Every week"
  }[task.repeat] || "Does not repeat");
  addDetail("Notes", task.notes || "No notes");
  addDetail("Tags", task.tags.length ? task.tags.join(", ") : "No tags");
  addDetail("Focus sessions", String(task.focusSessions || 0));
  addDetail("Created", formatTimestamp(task.createdAt));
  addDetail("Completed", task.completedAt ? formatTimestamp(task.completedAt) : "Not completed");

  taskDetailsModal.hidden = false;
  closeTaskDetailsBtn.focus();
}

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });
}

function closeTaskDetails() {
  taskDetailsModal.hidden = true;
  selectedDetailsTaskId = null;

  if (detailsDialogFocus instanceof HTMLElement) {
    detailsDialogFocus.focus();
  }

  detailsDialogFocus = null;
}

closeTaskDetailsBtn.addEventListener("click", closeTaskDetails);
detailsCloseBtn.addEventListener("click", closeTaskDetails);

taskDetailsModal.addEventListener("click", (event) => {
  if (event.target === taskDetailsModal) closeTaskDetails();
});

detailsEditBtn.addEventListener("click", () => {
  if (selectedDetailsTaskId === null) return;

  const id = selectedDetailsTaskId;
  closeTaskDetails();
  editTask(id);
});

/* ---------- Dark mode ---------- */

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );
  themeToggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
}

const storedTheme = readStorage(THEME_KEY, "");
const prefersDark = window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

applyTheme(storedTheme || (prefersDark ? "dark" : "light"));

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-mode")
    ? "light"
    : "dark";

  if (writeStorage(THEME_KEY, nextTheme)) {
    applyTheme(nextTheme);
  }
});

/* ---------- Weekly productivity dashboard ---------- */

function getCompletedDateKeys() {
  return new Set(
    tasks
      .filter((task) => task.completedAt)
      .map((task) => localDateKeyFromTimestamp(task.completedAt))
      .filter(Boolean)
  );
}

function renderWeeklyDashboard() {
  const monday = startOfWeek(new Date());
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });

  const completedPerDay = days.map((day) => {
    const key = dateKey(day);

    return tasks.filter((task) =>
      task.completedAt &&
      localDateKeyFromTimestamp(task.completedAt) === key
    ).length;
  });

  const totalCompleted = completedPerDay.reduce((sum, count) => sum + count, 0);

  const weeklySessions = focusHistory.filter((session) => {
    const date = new Date(session.completedAt);
    return !Number.isNaN(date.getTime()) &&
      date >= monday &&
      date <= today;
  }).length;

  const elapsedDays = Math.min(
    7,
    Math.max(1, Math.floor((Date.now() - monday.getTime()) / 86400000) + 1)
  );

  weeklyCompletedEl.textContent = totalCompleted;
  weeklyFocusSessionsEl.textContent = weeklySessions;
  weeklyAverageEl.textContent = (totalCompleted / elapsedDays).toFixed(1);

  weeklySummary.textContent =
    `You've completed ${totalCompleted} task${totalCompleted === 1 ? "" : "s"} this week.`;

  weeklyChart.replaceChildren();
  const maxCount = Math.max(1, ...completedPerDay);

  days.forEach((day, index) => {
    const column = document.createElement("div");
    column.className = "weekly-day";

    const count = document.createElement("span");
    count.className = "weekly-day-count";
    count.textContent = completedPerDay[index];

    const track = document.createElement("div");
    track.className = "weekly-bar-track";
    track.setAttribute("role", "img");
    track.setAttribute(
      "aria-label",
      `${day.toLocaleDateString(undefined, { weekday: "long" })}: ${completedPerDay[index]} tasks completed`
    );

    const bar = document.createElement("div");
    bar.className = "weekly-bar";
    bar.style.height = `${(completedPerDay[index] / maxCount) * 100}%`;
    track.appendChild(bar);

    const label = document.createElement("span");
    label.className = "weekly-day-label";
    label.textContent = day.toLocaleDateString(undefined, { weekday: "short" });

    column.append(count, track, label);
    weeklyChart.appendChild(column);
  });
}

/* ---------- Weekly goal and streak ---------- */

function getWeeklyGoal() {
  const value = Number(readStorage(WEEKLY_GOAL_KEY, "20"));
  return Number.isInteger(value) && value >= 1 && value <= 500 ? value : 20;
}

function calculateCurrentStreak(completedDates) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!completedDates.has(dateKey(today))) {
    today.setDate(today.getDate() - 1);
  }

  let streak = 0;

  while (completedDates.has(dateKey(today))) {
    streak++;
    today.setDate(today.getDate() - 1);
  }

  return streak;
}

function renderGoals() {
  const goal = getWeeklyGoal();
  weeklyGoalInput.value = goal;

  const monday = startOfWeek(new Date());
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  const completedThisWeek = tasks.filter((task) => {
    if (!task.completedAt) return false;

    const date = new Date(task.completedAt);
    return !Number.isNaN(date.getTime()) &&
      date >= monday &&
      date < nextMonday;
  }).length;

  const percentage = Math.min(100, (completedThisWeek / goal) * 100);

  goalProgressText.textContent =
    `${completedThisWeek} of ${goal} tasks completed this week`;

  goalProgressFill.style.width = `${percentage}%`;
  goalProgressTrack.setAttribute("aria-valuemax", String(goal));
  goalProgressTrack.setAttribute(
    "aria-valuenow",
    String(Math.min(completedThisWeek, goal))
  );

  const streak = calculateCurrentStreak(getCompletedDateKeys());

  currentStreakDisplay.textContent =
    `${streak} day${streak === 1 ? "" : "s"}`;
}

saveWeeklyGoalBtn.addEventListener("click", () => {
  const goal = Number(weeklyGoalInput.value);

  if (!Number.isInteger(goal) || goal < 1 || goal > 500) {
    showToast("Choose a weekly goal between 1 and 500.", "error");
    return;
  }

  if (writeStorage(WEEKLY_GOAL_KEY, String(goal))) {
    renderGoals();
    showToast("Weekly goal saved!", "success");
  }
});

/* ---------- Focus task selector and Pomodoro timer ---------- */

function updateFocusTaskOptions() {
  const previousValue = selectedFocusTaskId;

  focusTaskSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a task...";
  focusTaskSelect.appendChild(placeholder);

  tasks.filter((task) => !task.completed).forEach((task) => {
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.title;
    focusTaskSelect.appendChild(option);
  });

  selectedFocusTaskId = tasks.some((task) =>
    !task.completed && task.id === previousValue
  ) ? previousValue : "";

  focusTaskSelect.value = selectedFocusTaskId;
  updateFocusTaskProgress();
}

function updateFocusTaskProgress() {
  const task = tasks.find((item) => item.id === selectedFocusTaskId);

  if (!task) {
    focusTaskProgress.textContent = "Select a task to track its focus sessions.";
    return;
  }

  const count = Number(task.focusSessions) || 0;

  focusTaskProgress.textContent =
    `${count} completed focus session${count === 1 ? "" : "s"} for "${task.title}".`;
}

focusTaskSelect.addEventListener("change", () => {
  selectedFocusTaskId = focusTaskSelect.value;
  updateFocusTaskProgress();
});

function renderTimer() {
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;

  timerDisplay.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  timerDisplay.setAttribute(
    "aria-label",
    `${minutes} minutes and ${seconds} seconds remaining`
  );

  focusSessionsDisplay.textContent = completedFocusSessions;
}

function stopTimerInterval() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerIsRunning = false;
  timerDeadline = null;
}

function tickTimer() {
  if (!timerIsRunning || timerDeadline === null) return;

  timerRemaining = Math.max(
    0,
    Math.ceil((timerDeadline - Date.now()) / 1000)
  );

  renderTimer();

  if (timerRemaining === 0) finishTimer();
}

function finishTimer() {
  stopTimerInterval();
  timerRemaining = 0;
  renderTimer();

  if (currentTimerMode === "Focus") {
    completedFocusSessions++;
    saveSessionCount();

    const timestamp = new Date().toISOString();
    const focusedTask = tasks.find((task) =>
      task.id === selectedFocusTaskId && !task.completed
    );

    if (focusedTask) {
      const previousTasks = tasks;

      tasks = tasks.map((task) => task.id === focusedTask.id
        ? { ...task, focusSessions: (Number(task.focusSessions) || 0) + 1 }
        : task
      );

      if (!saveTasks()) {
        tasks = previousTasks;
      }

      focusHistory.push({
        id: createId(),
        taskId: focusedTask.id,
        taskTitle: focusedTask.title,
        completedAt: timestamp,
        mode: "Focus"
      });

      if (!saveFocusHistory()) {
        focusHistory.pop();
      }
    } else {
      focusHistory.push({
        id: createId(),
        taskId: null,
        taskTitle: "",
        completedAt: timestamp,
        mode: "Focus"
      });

      if (!saveFocusHistory()) {
        focusHistory.pop();
      }
    }

    timerMode.textContent = "Focus session complete! Take a break.";
    showToast("Focus session complete!", "success");
    renderTasks();
  } else {
    timerMode.textContent = "Break finished. Ready for another session?";
    showToast("Break finished!", "info");
  }

  renderTimer();
}

function startTimer() {
  if (timerIsRunning) return;

  if (timerRemaining <= 0) {
    timerRemaining = timerDuration;
  }

  timerIsRunning = true;
  timerDeadline = Date.now() + timerRemaining * 1000;
  timerMode.textContent = `${currentTimerMode} in progress`;

  timerInterval = window.setInterval(tickTimer, 250);
  tickTimer();
}

function pauseTimer() {
  if (!timerIsRunning) return;

  tickTimer();

  if (timerIsRunning) {
    stopTimerInterval();
    timerMode.textContent = `${currentTimerMode} paused`;
  }
}

function resetTimer() {
  stopTimerInterval();
  timerRemaining = timerDuration;
  timerMode.textContent = `${currentTimerMode} ready`;
  renderTimer();
}

function selectTimerPreset(minutes, mode) {
  stopTimerInterval();

  currentTimerMode = mode;
  timerDuration = minutes * 60;
  timerRemaining = timerDuration;

  timerMode.textContent = `${mode} ready`;
  renderTimer();
}

timerStart.addEventListener("click", startTimer);
timerPause.addEventListener("click", pauseTimer);
timerReset.addEventListener("click", resetTimer);

timerPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const minutes = Number(button.dataset.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    const mode = minutes === 25
      ? "Focus"
      : minutes === 5
        ? "Short break"
        : minutes === 15
          ? "Long break"
          : "Focus";

    selectTimerPreset(minutes, mode);
  });
});

/* ---------- Export and import ---------- */

function exportTasks() {
  const exportData = {
    app: "TaskFlow",
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks
  };

  const blob = new Blob(
    [JSON.stringify(exportData, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `taskflow-backup-${dateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Task export downloaded.", "success");
}

exportTasksBtn.addEventListener("click", exportTasks);

importTasksBtn.addEventListener("click", () => {
  importTasksFile.click();
});

function openImportDialog(importedTasks) {
  pendingImportTasks = importedTasks;
  importDialogFocus = document.activeElement;

  importConfirmMessage.textContent =
    `This will replace your current ${tasks.length} task(s) with ${importedTasks.length} imported task(s). A current export is a good backup if you need one.`;

  importConfirmModal.hidden = false;
  cancelImportBtn.focus();
}

function closeImportDialog() {
  importConfirmModal.hidden = true;
  pendingImportTasks = null;
  importTasksFile.value = "";

  if (importDialogFocus instanceof HTMLElement) {
    importDialogFocus.focus();
  }

  importDialogFocus = null;
}

cancelImportBtn.addEventListener("click", closeImportDialog);

importTasksFile.addEventListener("change", async () => {
  const file = importTasksFile.files && importTasksFile.files[0];
  if (!file) return;

  try {
    if (file.size > 5 * 1024 * 1024) {
      showToast("The import file is too large (maximum 5 MB).", "error");
      importTasksFile.value = "";
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text);

    const rawTasks = Array.isArray(parsed)
      ? parsed
      : parsed && parsed.app === "TaskFlow" && Array.isArray(parsed.tasks)
        ? parsed.tasks
        : null;

    if (!rawTasks) {
      throw new Error("This file does not contain a valid TaskFlow task list.");
    }

    if (rawTasks.length > 10000) {
      throw new Error("This file contains too many tasks to import.");
    }

    const importedTasks = rawTasks.map(normalizeTask).filter(Boolean);

    if (rawTasks.length > 0 && importedTasks.length === 0) {
      throw new Error("No valid tasks were found in this file.");
    }

    if (importedTasks.length !== rawTasks.length) {
      showToast(
        `${rawTasks.length - importedTasks.length} invalid task(s) were skipped.`,
        "info"
      );
    }

    const seen = new Set();

    importedTasks.forEach((task) => {
      if (seen.has(task.id)) task.id = createId();
      seen.add(task.id);
    });

    openImportDialog(importedTasks);
  } catch (error) {
    console.error("Import error:", error);
    showToast(error.message || "Unable to read this import file.", "error");
    importTasksFile.value = "";
  }
});

confirmImportBtn.addEventListener("click", () => {
  if (!Array.isArray(pendingImportTasks)) {
    closeImportDialog();
    return;
  }

  const previousTasks = tasks;
  tasks = pendingImportTasks;

  if (!saveTasks()) {
    tasks = previousTasks;
    renderTasks();
    closeImportDialog();
    showToast("Import failed. Your previous task list was restored.", "error");
    return;
  }

  cancelEditing();
  selectedFocusTaskId = "";
  lastDeleteSnapshot = null;

  closeImportDialog();
  renderTasks();
  showToast("Tasks imported successfully!", "success");
});

importConfirmModal.addEventListener("click", (event) => {
  if (event.target === importConfirmModal) closeImportDialog();
});

/* ---------- Keyboard shortcuts and modal handling ---------- */

function closeTopmostDialog() {
  if (!taskDetailsModal.hidden) {
    closeTaskDetails();
    return true;
  }

  if (!importConfirmModal.hidden) {
    closeImportDialog();
    return true;
  }

  if (!confirmModal.hidden) {
    closeDeleteDialog();
    return true;
  }

  return false;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (closeTopmostDialog()) return;

    if (editingTaskId !== null) {
      cancelEditing();
      showToast("Editing cancelled.", "info");
    }

    return;
  }

  const target = event.target;
  const typing = target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

  if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key === "/") {
    event.preventDefault();
    searchInput.focus();
  }

  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    cancelEditing();
    taskInput.focus();
    taskForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

/* ---------- Initial page setup ---------- */

todayLabel.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric"
});

renderTimer();
renderTasks();
