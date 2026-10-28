"use strict";
/* TaskFlow advanced add-on. Uses the existing taskflow-tasks store without replacing task records. */
(() => {
  const $ = (id) => document.getElementById(id);
  const TASK_KEY = "taskflow-tasks";
  const STAGE_KEY = "taskflow-kanban-stages-v1";
  const XP_KEY = "taskflow-xp-v1";
  const safeRead = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
  let stages = {};
  let tasksSnapshot = [];
  try { stages = JSON.parse(safeRead(STAGE_KEY, "{}")) || {}; } catch { stages = {}; }
  let xp = Math.max(0, Number(safeRead(XP_KEY, "0")) || 0);
  const achievements = [
    { id:"first", icon:"🌱", title:"First step", desc:"Complete your first task", test:(t)=>t>=1 },
    { id:"five", icon:"✨", title:"Getting started", desc:"Complete 5 tasks", test:(t)=>t>=5 },
    { id:"ten", icon:"🔥", title:"On a roll", desc:"Complete 10 tasks", test:(t)=>t>=10 },
    { id:"twentyfive", icon:"🚀", title:"Momentum maker", desc:"Complete 25 tasks", test:(t)=>t>=25 },
    { id:"fifty", icon:"🏅", title:"Task champion", desc:"Complete 50 tasks", test:(t)=>t>=50 },
    { id:"focus", icon:"🎯", title:"Focus finder", desc:"Finish a focus session", test:()=>Number(safeRead("taskflow-focus-session-count","0"))>=1 }
  ];
  function getTasks(){ try { const parsed=JSON.parse(safeRead(TASK_KEY,"[]")); return Array.isArray(parsed)?parsed.filter(t=>t&&t.id):[]; } catch { return []; } }
  function esc(value){ return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function dayKey(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
  function renderAnalytics(tasks){
    const summary=$("analytics-summary"), chart=$("analytics-chart"), categories=$("analytics-categories"); if(!summary||!chart||!categories)return;
    const completed=tasks.filter(t=>t.completed), last7=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const key=dayKey(d);last7.push({key,label:d.toLocaleDateString(undefined,{weekday:"short"}),count:completed.filter(t=>t.completedAt&&dayKey(new Date(t.completedAt))===key).length});}
    const weekTotal=last7.reduce((sum,d)=>sum+d.count,0), max=Math.max(1,...last7.map(d=>d.count));
    summary.innerHTML=`<div class="analytics-metric"><span>Completed this week</span><strong>${weekTotal}</strong></div><div class="analytics-metric"><span>Active tasks</span><strong>${tasks.filter(t=>!t.completed).length}</strong></div><div class="analytics-metric"><span>Completion rate</span><strong>${tasks.length?Math.round(completed.length/tasks.length*100):0}%</strong></div>`;
    chart.innerHTML=last7.map(d=>`<div class="analytics-day"><span class="analytics-day-count">${d.count}</span><div class="analytics-bar-track"><div class="analytics-bar" style="height:${d.count?Math.max(5,d.count/max*100):2}%"></div></div><span class="analytics-day-label">${d.label}</span></div>`).join("");
    const names={study:"Study",work:"Work",personal:"Personal",other:"Other"};
    categories.innerHTML=Object.entries(names).map(([key,label])=>`<div class="category-analytics"><span>${label}</span><strong>${tasks.filter(t=>t.category===key).length}</strong></div>`).join("");
  }
  function stageOf(task){if(task.completed)return "done";const value=stages[task.id];return value==="progress"?"progress":"todo";}
  function setStage(taskId,stage){const tasks=getTasks();const task=tasks.find(t=>String(t.id)===String(taskId));if(!task)return;
    if(stage==="done"){task.completed=true;task.completedAt=task.completedAt||new Date().toISOString();delete stages[taskId];}
    else {task.completed=false;task.completedAt=null;stages[taskId]=stage;}
    safeWrite(TASK_KEY,JSON.stringify(tasks));safeWrite(STAGE_KEY,JSON.stringify(stages));
    // Trigger the main app's existing renderer when available.
    const search=$("search-input"); if(search)search.dispatchEvent(new Event("input",{bubbles:true}));
    renderAll();
  }
  function renderKanban(tasks){const board=$("kanban-board");if(!board)return;
    ["todo","progress","done"].forEach(stage=>{const container=board.querySelector(`[data-stage-cards="${stage}"]`),count=board.querySelector(`[data-stage-count="${stage}"]`);const items=tasks.filter(t=>stageOf(t)===stage);count.textContent=String(items.length);
      container.innerHTML=items.length?items.map(t=>`<article class="kanban-card" draggable="true" data-task-id="${esc(t.id)}"><div class="kanban-card-title">${esc(t.title)}</div><div class="kanban-card-meta"><span>${esc((t.priority||"medium").toUpperCase())}</span><span>${esc(t.category||"other")}</span>${t.dueDate?`<span>Due ${esc(t.dueDate)}</span>`:""}</div><label class="sr-only" for="stage-${esc(t.id)}">Move ${esc(t.title)}</label><select id="stage-${esc(t.id)}" data-move-task="${esc(t.id)}" aria-label="Move task ${esc(t.title)}"><option value="todo" ${stage==="todo"?"selected":""}>To do</option><option value="progress" ${stage==="progress"?"selected":""}>In progress</option><option value="done" ${stage==="done"?"selected":""}>Done</option></select></article>`).join(""):`<p class="kanban-empty">No tasks in this column.</p>`;
    });
    board.querySelectorAll("[data-move-task]").forEach(select=>select.addEventListener("change",()=>setStage(select.dataset.moveTask,select.value)));
    board.querySelectorAll(".kanban-card").forEach(card=>{card.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",card.dataset.taskId);e.dataTransfer.effectAllowed="move";});});
    board.querySelectorAll(".kanban-column").forEach(column=>{column.addEventListener("dragover",e=>{e.preventDefault();column.classList.add("drop-target");});column.addEventListener("dragleave",()=>column.classList.remove("drop-target"));column.addEventListener("drop",e=>{e.preventDefault();column.classList.remove("drop-target");const id=e.dataTransfer.getData("text/plain");if(id)setStage(id,column.dataset.stage);});});
  }
  function renderAchievements(tasks){const grid=$("achievement-grid");if(!grid)return;
    const completed=tasks.filter(t=>t.completed).length;const derivedXP=Math.max(xp,completed*10);if(derivedXP!==xp){xp=derivedXP;safeWrite(XP_KEY,String(xp));}
    const level=Math.floor(xp/100)+1,within=xp%100;
    $("achievement-xp").textContent=`${xp} XP`;$("achievement-level").textContent=`Level ${level}`;$("achievement-xp-fill").style.width=`${within}%`;$("achievement-next-level").textContent=`${within} / 100 XP to next level`;
    grid.innerHTML=achievements.map(a=>{const unlocked=a.test(completed);return `<article class="achievement-card ${unlocked?"unlocked":""}"><span class="achievement-icon">${a.icon}</span><div><strong>${a.title} ${unlocked?"✓":"🔒"}</strong><p>${a.desc}</p></div></article>`;}).join("");
  }
  function renderAll(){const tasks=getTasks();tasksSnapshot=tasks;renderAnalytics(tasks);renderKanban(tasks);renderAchievements(tasks);}
  // Award XP once for each newly completed task, tracked independently of task schema.
  function watchTaskChanges(){const next=getTasks();const previous=new Map(tasksSnapshot.map(t=>[String(t.id),Boolean(t.completed)]));let changed=false;
    next.forEach(t=>{if(t.completed&&!previous.get(String(t.id))){xp+=10;changed=true;}});
    if(changed)safeWrite(XP_KEY,String(xp));
    renderAll();
  }
  document.addEventListener("change",e=>{if(e.target&&e.target.id==="task-form")watchTaskChanges();});
  const originalSetItem=Storage.prototype.setItem;
  // Do not monkey-patch storage: refresh enhancement panels on existing app interactions instead.
  ["task-form","task-list","task-list-panel"].forEach(id=>{const node=$(id);if(node){node.addEventListener("click",()=>setTimeout(watchTaskChanges,0));node.addEventListener("change",()=>setTimeout(watchTaskChanges,0));}});
  document.addEventListener("click",e=>{if(e.target.closest("#task-form")||e.target.closest("#task-list")||e.target.closest("#timer-start")||e.target.closest("#timer-reset"))setTimeout(watchTaskChanges,50);});
  // Watch the task storage key only when the app writes it, without replacing any existing records.
  let lastRaw=safeRead(TASK_KEY,"[]");setInterval(()=>{const raw=safeRead(TASK_KEY,"[]");if(raw!==lastRaw){lastRaw=raw;watchTaskChanges();}},1200);
  renderAll();
})();
