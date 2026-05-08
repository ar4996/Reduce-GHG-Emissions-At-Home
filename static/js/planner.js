/* ============================================================
   Planner SPA — planner.js
   ============================================================ */
'use strict';

let config = { budget: 0, goal: 0 };
let state  = {
    budget       : 0,
    co2          : 0,
    currentRoom  : '',
    applied      : [],
    goalEverMet  : false,
    maxImpact    : 0,
    currentBtnTier: null,
};

const itemsById  = {};
const db         = {};
const roomColors = {};
const roomList   = [];

// ── Fisher-Yates shuffle ──────────────────────────────────────
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Build data maps ───────────────────────────────────────────
(function buildDataMaps() {
    const { items, rooms } = window.INITIAL_STATE;
    rooms.forEach(room => {
        db[room.key]         = [];
        roomColors[room.key] = room.color;
        roomList.push(room.key);
    });
    items.forEach(item => {
        itemsById[item.id] = item;
        if (db[item.room]) db[item.room].push(item);
    });
    roomList.forEach(key => { db[key] = shuffle(db[key]); });
})();

// ── Max achievable impact ─────────────────────────────────────
function computeMaxImpact(budget) {
    const freeItems = Object.values(itemsById).filter(i => i.cost === 0);
    const paidItems = Object.values(itemsById).filter(i => i.cost > 0);
    const freeTotal = Math.round(freeItems.reduce((s, i) => s + i.impact, 0) * 100) / 100;
    let best = freeTotal;
    const n = paidItems.length;
    for (let mask = 0; mask < (1 << n); mask++) {
        let cost = 0, impact = 0;
        for (let j = 0; j < n; j++) {
            if (mask & (1 << j)) { cost += paidItems[j].cost; impact += paidItems[j].impact; }
        }
        if (cost <= budget) {
            const total = Math.round((freeTotal + impact) * 100) / 100;
            if (total > best) best = total;
        }
    }
    return best;
}

// ── Goal formula ──────────────────────────────────────────────
function computeMaxAchievable(budget) {
    const allItems = Object.values(itemsById).slice().sort((a, b) => a.cost - b.cost);
    let remaining = budget, total = 0;
    for (const item of allItems) {
        if (item.cost <= remaining) { remaining -= item.cost; total = Math.round((total + item.impact) * 100) / 100; }
    }
    return total;
}
function computeGoal(budget) {
    const formulaGoal   = 1.8 + budget / 3250;
    const maxAchievable = computeMaxAchievable(budget);
    const safeCap       = Math.round(maxAchievable * 0.85 * 10) / 10;
    return Math.max(0.5, Math.min(formulaGoal, safeCap));
}

// ── Shared audio helper ───────────────────────────────────────
function playNote(ctx, freq, delay, duration, type = 'sine', vol = 0.25) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t); osc.stop(t + duration);
}

function playDropSound() {
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); playNote(ctx, 528, 0, 0.50); } catch (_) {}
}
function playCelebrationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [[523,0,.14],[587,.13,.14],[659,.26,.14],[698,.39,.14],[784,.52,.14],[880,.65,.14],[1047,.78,1.2]].forEach(([f,d,dur]) => playNote(ctx, f, d, dur, 'sine', 0.22));
    } catch (_) {}
}
function playDrumRoll() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume().then(() => { for (let i = 0; i < 22; i++) playNote(ctx, 160 + Math.random() * 30, i * (0.85 / 22), 0.035, 'triangle', 0.04 + (i / 22) * 0.13); });
    } catch (_) {}
}
function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:3500;';
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const cx = canvas.getContext('2d');
    const colors = ['#d4a017','#fff0a0','#2ecc71','#ffffff','#f9e04b'];
    const count = 130;
    const pieces = Array.from({ length: count }, () => ({ x: Math.random() * canvas.width, y: -20 - Math.random() * 80, w: Math.random() * 7 + 3, h: Math.random() * 18 + 7, col: colors[Math.floor(Math.random() * colors.length)], vx: (Math.random() - 0.5) * 2.5, vy: Math.random() * 3.5 + 1.5, ang: Math.random() * Math.PI * 2, av: (Math.random() - 0.5) * 0.12 }));
    let start = null;
    (function draw(ts) { if (!start) start = ts; const pct = Math.min((ts - start) / 4000, 1); cx.clearRect(0, 0, canvas.width, canvas.height); pieces.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.ang += p.av; cx.save(); cx.globalAlpha = Math.max(0, 1 - pct * 1.5); cx.translate(p.x, p.y); cx.rotate(p.ang); cx.fillStyle = p.col; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore(); }); if (pct < 1) requestAnimationFrame(draw); else canvas.remove(); })(performance.now());
}

// ── PDF certificate ───────────────────────────────────────────
async function downloadCertPDF() {
    if (!window.jspdf || !window.html2canvas) { alert('PDF libraries still loading — try again.'); return; }
    const { jsPDF } = window.jspdf;
    const certCard = document.querySelector('.cert-card');
    if (!certCard) return;

    const clone = certCard.cloneNode(true);
    const impact = clone.querySelector('.cert-impact-section');
    if (impact) impact.remove();
    Object.assign(clone.style, { position:'fixed', top:'-99999px', left:'0', width:'820px', maxWidth:'none', height:'auto', overflow:'visible', background:'#ffffff', padding:'32px 44px 40px', boxSizing:'border-box', borderRadius:'0', boxShadow:'none' });
    document.body.appendChild(clone);
    await new Promise(r => setTimeout(r, 80));
    const canvas1 = await html2canvas(clone, { scale:1.7, useCORS:true, backgroundColor:'#ffffff', logging:false, width:820, windowWidth:1200 });
    document.body.removeChild(clone);

    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 10;
    const maxW = pageW - 2 * margin, maxH = pageH - 2 * margin;
    const aspect = canvas1.height / canvas1.width;
    let imgW = maxW, imgH = maxW * aspect; if (imgH > maxH) { imgH = maxH; imgW = maxH / aspect; }
    doc.addImage(canvas1.toDataURL('image/jpeg', 0.82), 'JPEG', margin + (maxW - imgW) / 2, margin, imgW, imgH);

    doc.addPage();
    const impactSection = certCard.querySelector('.cert-impact-section');
    if (impactSection) {
        const ic = impactSection.cloneNode(true);
        Object.assign(ic.style, { position:'fixed', top:'-99999px', left:'0', width:'820px', maxWidth:'none', height:'auto', overflow:'visible', background:'#f7fbf6', padding:'32px 44px 40px', boxSizing:'border-box', borderRadius:'0', boxShadow:'none' });
        document.body.appendChild(ic); await new Promise(r => setTimeout(r, 80));
        const canvas2 = await html2canvas(ic, { scale:1.7, useCORS:true, backgroundColor:'#f7fbf6', logging:false, width:820, windowWidth:1200 });
        document.body.removeChild(ic);
        const a2 = canvas2.height / canvas2.width; let w2 = maxW, h2 = maxW * a2; if (h2 > maxH) { h2 = maxH; w2 = maxH / a2; }
        doc.addImage(canvas2.toDataURL('image/jpeg', 0.82), 'JPEG', margin + (maxW - w2) / 2, margin, w2, h2);
    }
    doc.save('home-carbon-certificate.pdf');
}

// ── Drag guide ────────────────────────────────────────────────
let _guideActive = false, _guideEl = null, _guideTimer = null;
function startDragGuide() {
    stopDragGuide();
    // Don't run while housing selection screen is active
    if (document.getElementById('setup-overlay').style.display !== 'none') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!document.querySelector('#card-container .change-card')) return;
        _guideActive = true;
        _guideEl = document.createElement('div'); _guideEl.id = 'drag-guide-anim';
        _guideEl.style.position = 'fixed';
        _guideEl.innerHTML = '<div class="drag-guide-card"><span class="drag-guide-hand">🫳</span><span class="drag-guide-label">drag to room window</span></div>';
        document.body.appendChild(_guideEl); _runGuideLoop();
    }));
}
function stopDragGuide() { _guideActive = false; if (_guideTimer) { clearTimeout(_guideTimer); _guideTimer = null; } if (_guideEl) { _guideEl.remove(); _guideEl = null; } }
function _runGuideLoop() {
    if (!_guideActive || !_guideEl) return;
    const fc = document.querySelector('#card-container .change-card'), dz = document.getElementById('drop-zone');
    if (!fc || !dz) return;
    const sr = fc.getBoundingClientRect(), dr = dz.getBoundingClientRect();
    // If elements have no layout yet, retry after a frame
    if (sr.width === 0 || dr.width === 0) {
        _guideTimer = setTimeout(_runGuideLoop, 200);
        return;
    }
    const sx = sr.left + sr.width * 0.5, sy = sr.top + sr.height * 0.5, ex = dr.left + dr.width * 0.24, ey = dr.top + dr.height * 0.28;
    const el = _guideEl, set = p => Object.assign(el.style, p);
    set({ transition:'none', opacity:'0', left:sx+'px', top:sy+'px', transform:'translate(-50%,-50%) scale(1) rotate(0deg)' });
    _guideTimer = setTimeout(() => { if (!_guideActive) return; set({ transition:'opacity 0.28s ease' }); el.style.opacity = '0.70'; }, 120);
    _guideTimer = setTimeout(() => { if (!_guideActive) return; set({ transition:'transform 0.22s ease' }); el.style.transform = 'translate(-50%,-50%) scale(1.2) rotate(-14deg)'; }, 540);
    _guideTimer = setTimeout(() => { if (!_guideActive) return; set({ transition:'left 0.72s cubic-bezier(.4,0,.2,1),top 0.72s cubic-bezier(.4,0,.2,1),transform 0.72s ease', left:ex+'px', top:ey+'px', transform:'translate(-50%,-50%) scale(1.06) rotate(0deg)' }); }, 860);
    _guideTimer = setTimeout(() => { if (!_guideActive) return; set({ transition:'transform 0.18s ease' }); el.style.transform = 'translate(-50%,-50%) scale(0.80)'; }, 1680);
    _guideTimer = setTimeout(() => { if (!_guideActive) return; set({ transition:'opacity 0.30s ease' }); el.style.opacity = '0'; }, 1940);
    _guideTimer = setTimeout(() => { if (!_guideActive) return; _runGuideLoop(); }, 2900);
}

// ── API helpers ───────────────────────────────────────────────
function apiSaveBudget(b, g) { return fetch('/api/budget', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({budget:b, goal:g}) }); }
function apiAddItem(id)      { return fetch('/api/items', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) }); }
function apiRemoveItem(id)   { return fetch(`/api/items/${encodeURIComponent(id)}`, {method:'DELETE'}); }

// ── Render sidebar cards ──────────────────────────────────────
function render() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';
    (db[state.currentRoom] || []).forEach(item => {
        if (state.applied.find(a => a.id === item.id)) return;
        const card = document.createElement('div');
        card.className = 'change-card'; card.draggable = true;
        card.innerHTML = `<div class="card-header"><h4>${item.name}</h4></div>
            <div class="card-footer-row"><span class="cost-pill ${item.cost === 0 ? 'cost-pill-free' : 'cost-pill-paid'}">${item.cost === 0 ? 'FREE' : '$' + item.cost.toLocaleString()}</span></div>`;
        card.ondragstart = e => e.dataTransfer.setData('application/json', JSON.stringify({...item}));
        container.appendChild(card);
    });
}

// ── Room switching ────────────────────────────────────────────
function setRoom(name, color) {
    state.currentRoom = name;
    document.getElementById('room-display-title').textContent = `Map: ${name}`;
    document.getElementById('sidebar-title').textContent      = `${name} Changes`;
    document.querySelectorAll('.room-nav-btn').forEach(btn => {
        const active = btn.dataset.room === name;
        btn.classList.toggle('active', active);
        btn.style.background  = active ? '#691F3D' : '';
        btn.style.borderColor = active ? '#691F3D' : '';
        btn.style.color       = active ? '#ffffff'  : '';
    });
    render();
}

// ── Drop zone ─────────────────────────────────────────────────
const dz = document.getElementById('drop-zone');
dz.ondragover  = e => { e.preventDefault(); dz.classList.add('drag-over'); };
dz.ondragleave = () => dz.classList.remove('drag-over');
dz.ondrop      = e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    let item; try { item = JSON.parse(e.dataTransfer.getData('application/json')); } catch { return; }
    if (!item || state.applied.find(a => a.id === item.id)) return;
    state.budget -= item.cost;
    state.co2 = Math.round((state.co2 + item.impact) * 100) / 100;
    state.applied.push(item);
    apiAddItem(item.id);
    stopDragGuide();
    document.getElementById('drag-hint').style.display = 'none';
    playDropSound();
    updateStats(); addAppliedCard(item); render();
};

// ── Applied cards ─────────────────────────────────────────────
function addAppliedCard(item) {
    const card = document.createElement('div'); card.className = 'applied-card'; card.id = `applied-${item.id}`;
    card.innerHTML = `<div class="applied-card-top"><span class="applied-card-name">${item.name}</span><button class="applied-remove">&times;</button></div>
        <div class="card-footer-row"><span class="cost-pill ${item.cost === 0 ? 'cost-pill-free' : 'cost-pill-paid'}">${item.cost === 0 ? 'FREE' : '$' + item.cost.toLocaleString()}</span></div>`;
    card.querySelector('.applied-remove').onclick = () => removeItem(item.id);
    dz.appendChild(card);
}

function removeItem(id) {
    const idx = state.applied.findIndex(i => i.id === id); if (idx === -1) return;
    const item = state.applied.splice(idx, 1)[0];
    state.budget += item.cost;
    state.co2 = Math.max(0, Math.round((state.co2 - item.impact) * 100) / 100);
    apiRemoveItem(id);
    const el = document.getElementById(`applied-${id}`); if (el) el.remove();
    if (state.applied.length === 0) { const dh = document.getElementById('drag-hint'); if (dh) dh.style.display = 'flex'; }
    updateStats(); render();
}

// ── Reset / Restart ───────────────────────────────────────────
function resetItems() {
    Promise.all(state.applied.map(i => apiRemoveItem(i.id)));
    state.applied = []; state.budget = config.budget; state.co2 = 0; state.goalEverMet = false;
    document.querySelectorAll('.applied-card').forEach(el => el.remove());
    document.getElementById('budget-empty-hint').style.display = 'none';
    document.getElementById('congrats-overlay').style.display = 'none';
    state.currentBtnTier = null;
    const dh = document.getElementById('drag-hint'); if (dh) dh.style.display = 'flex';
    updateStats(); render(); startDragGuide();
}
function restartPlanner() {
    const form = document.createElement('form'); form.method = 'POST'; form.action = '/start';
    document.body.appendChild(form); form.submit();
}
function tryDifferentBudget() {
    stopDragGuide();
    document.getElementById('congrats-overlay').style.display = 'none';
    Promise.all(state.applied.map(i => apiRemoveItem(i.id)));
    document.querySelectorAll('.applied-card').forEach(el => el.remove());
    state.applied = []; state.budget = 0; state.co2 = 0; state.goalEverMet = false; state.currentBtnTier = null;
    config.budget = 0; config.goal = 0;
    document.getElementById('budget-empty-hint').style.display = 'none';
    const dh = document.getElementById('drag-hint'); if (dh) dh.style.display = 'none';
    updateStats(); render();
    document.getElementById('setup-overlay').style.display = 'flex';
}

// ── Badge helpers ─────────────────────────────────────────────
function isPlanAccepted(co2) {
    if (co2 >= state.maxImpact) return true;
    return null;
}
function updateCertPlanList() {
    const el = document.getElementById('cert-plan-list'); if (!el) return;
    if (!state.applied.length) { el.innerHTML = '<p class="cert-empty">No items in your plan.</p>'; return; }
    let html = '';
    roomList.forEach(roomKey => {
        const ri = state.applied.filter(i => i.room === roomKey); if (!ri.length) return;
        html += `<div class="cert-plan-room"><strong>${roomKey}</strong><ul>`;
        ri.forEach(item => { const cost = item.cost === 0 ? 'FREE' : '$' + item.cost.toLocaleString(); html += `<li><span class="cert-item-name">${item.name}</span><span class="cert-item-meta">${cost} · −${item.impact}T CO₂</span></li>`; });
        html += '</ul></div>';
    });
    el.innerHTML = html;
}

// ── Show / Reject overlays ────────────────────────────────────
function showCertOverlay() {
    const ov = document.getElementById('congrats-overlay');
    ov.classList.remove('rejected'); ov.style.display = 'flex';
    const cc = ov.querySelector('.cert-card'); if (cc) cc.scrollTop = 0;
    document.getElementById('email-cert-btn').style.display = '';
    document.getElementById('restart-budget-btn').style.display = '';
    document.getElementById('reject-try-again-btn').style.display = 'none';
    document.getElementById('cert-title').textContent = 'Goal Reached!';
    document.getElementById('cert-title').style.color = '';
    document.getElementById('congrats-text').style.color = '';
    document.querySelector('.cert-globe').style.display = '';
    document.getElementById('rejected-stamp-wrap').style.display = 'none';
    updateCertPlanList();
    playCelebrationSound();
    launchConfetti();
}
function showRejectionOverlay() {
    const ov = document.getElementById('congrats-overlay');
    ov.classList.add('rejected'); ov.style.display = 'flex';
    const cc = ov.querySelector('.cert-card'); if (cc) cc.scrollTop = 0;
    document.getElementById('email-cert-btn').style.display = 'none';
    document.getElementById('restart-budget-btn').style.display = 'none';
    document.getElementById('reject-try-again-btn').style.display = '';
    document.getElementById('cert-title').textContent = 'Plan Rejected';
    document.getElementById('cert-title').style.color = '#cc1111';
    document.getElementById('congrats-text').style.color = '#cc1111';
    document.querySelector('.cert-globe').style.display = 'none';
    document.getElementById('rejected-stamp-wrap').style.display = 'flex';
    const stamp = document.querySelector('.rejected-stamp');
    if (stamp) stamp.textContent = 'REJECTED';
    updateCertPlanList();
    const sub = document.getElementById('cert-budget-sub');
    if (sub) sub.textContent = `$${state.budget.toLocaleString()} remaining`;
}

// ── Reveal overlay ────────────────────────────────────────────
function showRevealOverlay() {
    const rv = document.getElementById('reveal-overlay');
    rv.style.transition = 'none'; rv.style.background = '#000'; rv.style.opacity = '1'; rv.style.display = 'block'; rv.style.pointerEvents = 'all';
}
function fadeRevealOut(targetOpacity, duration) {
    const rv = document.getElementById('reveal-overlay');
    requestAnimationFrame(() => { rv.style.transition = `opacity ${duration}ms ease`; rv.style.opacity = String(targetOpacity); setTimeout(() => { if (targetOpacity === 0) { rv.style.display = 'none'; rv.style.pointerEvents = 'none'; } }, duration); });
}
function submitPlan() {
    if (!state.applied.length || state.budget < 0) return;
    const accepted = isPlanAccepted(state.co2);
    showRevealOverlay();
    if (accepted) {
        playDrumRoll();
        setTimeout(() => { showCertOverlay(); fadeRevealOut(0, 800); }, 1050);
    } else {
        showRejectionOverlay();
        fadeRevealOut(0, 380);
    }
}

// ── Stats update ──────────────────────────────────────────────
function updateStats() {
    document.getElementById('total-budget-val').textContent = `$${config.budget.toLocaleString()}`;
    document.getElementById('budget-val').textContent       = `$${state.budget.toLocaleString()}`;
    document.getElementById('co2-val').textContent          = `${config.goal}T`;

    const overBudget = state.budget < 0;
    const hint = document.getElementById('budget-empty-hint');
    if (overBudget) {
        hint.innerHTML = `<strong>⚠ Over budget by $${Math.abs(state.budget).toLocaleString()}.</strong> Remove items to get back in range — Submit is blocked while you're over.`;
        hint.style.display = 'block';
    } else { hint.style.display = 'none'; }

    const cd = document.getElementById('cert-co2-display');
    if (cd) cd.innerHTML = `${state.co2.toFixed(1)}<span class="cert-score-unit">T CO<sub>2</sub></span>`;
    const cs = document.getElementById('cert-budget-sub');
    if (cs) cs.textContent = `reduced per year · $${state.budget.toLocaleString()} remaining under budget`;
    document.getElementById('congrats-text').innerHTML = `You reduced <strong>${state.co2.toFixed(1)} tons of CO₂</strong> within your $${config.budget.toLocaleString()} budget!`;

    const canSubmit = config.goal > 0 && state.applied.length > 0 && state.budget >= 0;
    const sb = document.getElementById('goal-btn');
    if (sb) { sb.disabled = !canSubmit; sb.classList.toggle('topnav-btn-goal-unmet', !canSubmit); sb.classList.toggle('topnav-btn-submit-ready', canSubmit); }
}

// ── Init from housing selection ───────────────────────────────
function initPlanner(budget) {
    config.budget    = budget;
    state.budget     = budget;
    state.co2        = 0;
    state.applied    = [];
    state.goalEverMet = false;
    state.maxImpact = computeMaxImpact(budget);
    config.goal      = state.maxImpact;
    document.getElementById('setup-overlay').style.display = 'none';
    apiSaveBudget(config.budget, config.goal);
    updateStats();
    setRoom(roomList[0], roomColors[roomList[0]]);
    setTimeout(startDragGuide, 300);
}

function restoreFromBackend(savedPlan) {
    config.budget    = savedPlan.budget;
    state.maxImpact = computeMaxImpact(config.budget);
    config.goal      = state.maxImpact;
    const applied = (savedPlan.applied || []).map(id => itemsById[id]).filter(Boolean);
    state.budget  = config.budget - applied.reduce((s, i) => s + i.cost, 0);
    state.co2     = Math.round(applied.reduce((s, i) => s + i.impact, 0) * 100) / 100;
    state.applied = applied;
    state.goalEverMet = false;
    state.currentBtnTier = null;
    document.getElementById('setup-overlay').style.display = 'none';
    document.getElementById('congrats-overlay').style.display = 'none';
    applied.forEach(addAppliedCard);
    if (applied.length > 0) document.getElementById('drag-hint').style.display = 'none';
    updateStats();
    setRoom(roomList[0], roomColors[roomList[0]]);
}

// ── DOMContentLoaded ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.housing-option').forEach(btn => {
        btn.addEventListener('click', () => initPlanner(parseInt(btn.dataset.budget, 10)));
    });
    document.getElementById('reset-items-btn').addEventListener('click', resetItems);
    document.getElementById('restart-btn').addEventListener('click', tryDifferentBudget);
    document.getElementById('goal-btn').addEventListener('click', submitPlan);
    document.getElementById('email-cert-btn').addEventListener('click', downloadCertPDF);
    document.getElementById('restart-budget-btn').addEventListener('click', tryDifferentBudget);
    document.getElementById('reject-try-again-btn').addEventListener('click', tryDifferentBudget);
    document.querySelectorAll('.room-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => setRoom(btn.dataset.room, btn.dataset.color));
    });

    const savedPlan = window.INITIAL_STATE.plan || {};
    if (savedPlan.budget) {
        restoreFromBackend(savedPlan);
        if (!(savedPlan.applied && savedPlan.applied.length)) startDragGuide();
    } else {
        document.getElementById('congrats-overlay').style.display = 'none';
    }
});
