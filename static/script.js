
let allTasks = [];
let currentFilter = 'all';
const CHEER_MESSAGES = [
  { emoji: '🎉', title: 'Task Crushed!', msg: "You're on a roll — keep going!" },
  { emoji: '🔥', title: 'On Fire!',      msg: 'Nothing can stop you today!' },
  { emoji: '⚡', title: 'Lightning Fast!', msg: 'You make this look easy!' },
  { emoji: '🌟', title: 'Star Move!',    msg: 'Excellence is your habit.' },
  { emoji: '✅', title: 'Done & Done!',  msg: 'One step closer to the finish!' },
];
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();
  startClock();
  setInterval(checkDeadlines, 60_000); 
});

function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById('clock').textContent =
      now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      return err;
    }
    return res.json();
  } catch (e) {
    console.error('API Error:', e);
    return { error: 'Network error. Please check your connection.' };
  }
}

async function loadTasks() {
  const sort = document.getElementById('sortSelect').value;
  const data = await api(`/api/tasks?sort=${sort}`);
  allTasks = data.tasks || [];
  renderTasks();
  renderNextTask(data.next_task);
  updateStats();
  checkDeadlines();
}

function renderTasks() {
  const list = document.getElementById('taskList');

  let filtered = allTasks;
  if (currentFilter === 'pending') filtered = allTasks.filter(t => !t.completed);
  if (currentFilter === 'done')    filtered = allTasks.filter(t => t.completed);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span style="font-size:2rem">🧞</span>
        <p>No tasks here. Your Genie awaits!</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map((t, i) => buildTaskCard(t, i)).join('');
}

function buildTaskCard(task, idx) {
  const level = (task.priority_level || 'Medium').toLowerCase();
  const levelDisplay = task.priority_level || 'Medium';
  const nearClass = task.near_deadline && !task.completed ? 'near-deadline' : '';
  const doneClass  = task.completed ? 'completed' : '';

  const deadline = new Date(task.deadline);
  const deadlineStr = deadline.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const diffDots = Array.from({ length: 5 }, (_, i) =>
    `<span class="diff-dot ${i < task.difficulty ? 'filled' : ''}"></span>`
  ).join('');

  const remarkHtml = task.remark
    ? `<div class="task-remark">"${escHtml(task.remark)}"</div>`
    : '';

  const nearTag = task.near_deadline && !task.completed
    ? `<span class="near-tag">⚠ Due Soon</span>`
    : '';

  return `
    <div class="task-card ${level} ${nearClass} ${doneClass}"
         id="task-${task.id}"
         style="animation-delay:${idx * 0.04}s">

      <div class="task-check ${task.completed ? 'checked' : ''}"
           onclick="toggleComplete(${task.id}, ${!task.completed})"></div>

      <div class="task-body">
        <div class="task-title-row">
          <span class="task-title">${escHtml(task.title)}</span>
          <span class="priority-badge ${level}">${levelDisplay}</span>
          ${nearTag}
        </div>
        <div class="task-meta">
          <span>📅 ${deadlineStr}</span>
          <div class="diff-dots">${diffDots}</div>
          <span style="font-family:'Space Mono',monospace;font-size:0.7rem;color:var(--text-muted)">
            Score ${task.priority_score}
          </span>
        </div>
        ${remarkHtml}
      </div>

      <div class="task-actions">
        <button class="btn-icon-sm" onclick="deleteTask(${task.id})" title="Delete">🗑</button>
      </div>
    </div>`;
}

function renderNextTask(task) {
  const el = document.getElementById('nextTaskContent');
  if (!task) {
    el.innerHTML = `<p class="empty-hint">Add tasks to get a recommendation.</p>`;
    return;
  }

  const deadline = new Date(task.deadline);
  const deadlineStr = deadline.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  el.innerHTML = `
    <div class="next-task-display">
      <div class="task-title" style="font-size:1.05rem;font-weight:700;color:#fff">
        ${escHtml(task.title)}
      </div>
      <div class="next-task-meta">
        <span class="meta-chip">📅 ${deadlineStr}</span>
        <span class="meta-chip">⚡ Diff ${task.difficulty}/5</span>
        <span class="meta-chip priority-badge ${task.priority_level}">${task.priority_level}</span>
      </div>
      <div class="next-arrow">▶ Focus on this first</div>
    </div>`;
}

function updateStats() {
  const total = allTasks.length;
  const done  = allTasks.filter(t => t.completed).length;
  animateNum('statTotal', total);
  animateNum('statDone', done);
  animateNum('statLeft', total - done);
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const step = target > start ? 1 : -1;
  if (start === target) return;
  let cur = start;
  const timer = setInterval(() => {
    cur += step;
    el.textContent = cur;
    if (cur === target) clearInterval(timer);
  }, 30);
}

async function addTask() {
  const title     = document.getElementById('taskTitle').value.trim();
  const deadline  = document.getElementById('taskDeadline').value;
  const difficulty = parseInt(document.getElementById('taskDifficulty').value);
  const remark    = document.getElementById('taskRemark').value.trim();

  if (!title)    return shake('taskTitle');
  if (!deadline) return shake('taskDeadline');

  const btn = document.getElementById('addTaskBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Adding…';

  const res = await api('/api/tasks', 'POST', { title, deadline, difficulty, remark });

  btn.disabled = false;
  btn.innerHTML = '<span class="btn-icon">⚡</span> Add Task';

  if (res.error) {
    alert(res.error);
    return;
  }

  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDeadline').value = '';
  document.getElementById('taskDifficulty').value = 3;
  document.getElementById('diffLabel').textContent = '3';
  document.getElementById('taskRemark').value = '';

  await loadTasks();
}

async function toggleComplete(id, completed) {
  await api(`/api/tasks/${id}`, 'PATCH', { completed });
  if (completed) showCheer();
  await loadTasks();
}

async function deleteTask(id) {
  const card = document.getElementById(`task-${id}`);
  if (card) {
    card.style.transition = 'all 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateX(20px)';
    await sleep(250);
  }
  await api(`/api/tasks/${id}`, 'DELETE');
  await loadTasks();
}

function setFilter(filter, el) {
  currentFilter = filter;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  renderTasks();
}

function checkDeadlines() {
  const near = allTasks.filter(t => t.near_deadline && !t.completed);
  if (near.length > 0) {
    showAlert(`⚠ ${near.length} task${near.length > 1 ? 's are' : ' is'} due within 3 hours!`);
  }
}

function showAlert(msg) {
  const banner = document.getElementById('alertBanner');
  document.getElementById('alertMsg').textContent = msg;
  banner.classList.remove('hidden');
  setTimeout(dismissAlert, 8000);
}
function dismissAlert() {
  document.getElementById('alertBanner').classList.add('hidden');
}

function showCheer() {
  const pick = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
  document.getElementById('cheerEmoji').textContent = pick.emoji;
  document.getElementById('cheerTitle').textContent = pick.title;
  document.getElementById('cheerMsg').textContent   = pick.msg;
  document.getElementById('cheerModal').classList.remove('hidden');
  launchConfetti();
}
function closeCheer() {
  document.getElementById('cheerModal').classList.add('hidden');
}

function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#3e87ff','#ff4d4d','#f5a623','#27c97a','#c0c0ff','#fff'];
  const pieces = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    r: Math.random() * 6 + 3,
    d: Math.random() * 120 + 60,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt: Math.random() * 10 - 5,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.1 + 0.05,
    vx: Math.random() * 2 - 1,
    vy: Math.random() * 4 + 2,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.tilt, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.vy;
      p.x += p.vx;
      p.tiltAngle += p.tiltSpeed;
      p.tilt = Math.sin(p.tiltAngle) * 12;
    });
    frame++;
    if (frame < 150) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shake(id) {
  const el = document.getElementById(id);
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease';
  el.focus();
}

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(8px); }
  60%      { transform: translateX(-6px); }
  80%      { transform: translateX(6px); }
}`;
document.head.appendChild(shakeStyle);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'taskTitle') addTask();
  if (e.key === 'Escape') { closeCheer(); dismissAlert(); }
});
