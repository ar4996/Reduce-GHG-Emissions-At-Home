/* Planner SPA behavior. */

let config = { budget: 0, goal: 0 };
let state = { budget: 0, co2: 0, currentRoom: 'Kitchen', applied: [] };

const itemsById = {};
const db = {};
const roomColors = {};
const roomList = [];

(function buildDataMaps() {
    const { items, rooms } = window.INITIAL_STATE;
    rooms.forEach((room) => {
        db[room.key] = [];
        roomColors[room.key] = room.color;
        roomList.push(room.key);
    });
    items.forEach((item) => {
        itemsById[item.id] = item;
        if (db[item.room]) db[item.room].push(item);
    });
})();

function getBadge(cost, impact) {
    if (cost === 0) return { label: 'Free', cls: 'free' };
    if (impact >= 1.0) return { label: 'High Impact', cls: 'high' };
    if (impact >= 0.4) return { label: 'Good Value', cls: 'medium' };
    return { label: 'Small Gain', cls: 'low' };
}

function computeMaxAchievable(budget) {
    const allItems = Object.values(db).flat().sort((a, b) => a.cost - b.cost);
    let remaining = budget;
    let total = 0;
    for (const item of allItems) {
        if (item.cost <= remaining) {
            remaining -= item.cost;
            total = Math.round((total + item.impact) * 100) / 100;
        }
    }
    return total;
}

function computeGoal(budget) {
    const formulaGoal = 1.8 + budget / 3000;
    const maxAchievable = computeMaxAchievable(budget);
    const safeCap = Math.round(maxAchievable * 0.85 * 10) / 10;
    return Math.max(0.5, Math.min(formulaGoal, safeCap));
}

function apiSaveBudget(budget, goal) {
    return fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, goal }),
    });
}

function apiAddItem(id) {
    return fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
}

function apiRemoveItem(id) {
    return fetch(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

function initPlanner() {
    const value = parseInt(document.getElementById('budget-input').value, 10) || 5000;
    config.budget = value;
    config.goal = parseFloat(computeGoal(value).toFixed(1));
    state.budget = value;
    state.co2 = 0;
    state.applied = [];
    document.getElementById('setup-overlay').style.display = 'none';
    apiSaveBudget(config.budget, config.goal);
    updateStats();
    render();
}

function restoreFromBackend(savedPlan) {
    config.budget = savedPlan.budget;
    config.goal = parseFloat((savedPlan.goal || 0).toFixed(1));

    const applied = (savedPlan.applied || [])
        .map((id) => itemsById[id])
        .filter(Boolean);

    state.budget = config.budget - applied.reduce((sum, item) => sum + item.cost, 0);
    state.co2 = Math.round(applied.reduce((sum, item) => sum + item.impact, 0) * 100) / 100;
    state.applied = applied;

    document.getElementById('setup-overlay').style.display = 'none';

    applied.forEach(addAppliedCard);
    if (applied.length > 0) {
        const hint = document.getElementById('drag-hint');
        if (hint) hint.style.display = 'none';
    }

    updateStats();
    render();
}

function adjustBudget(delta) {
    const spent = config.budget - state.budget;
    const newTotal = config.budget + delta;
    if (newTotal < 0) return;
    if (newTotal < spent) {
        alert(`You've already spent $${spent.toLocaleString()}. Remove some items first before lowering your budget that much.`);
        return;
    }
    config.budget = newTotal;
    state.budget = newTotal - spent;
    config.goal = parseFloat(computeGoal(newTotal).toFixed(1));
    apiSaveBudget(config.budget, config.goal);
    updateStats();
}

function setRoom(name, color) {
    state.currentRoom = name;
    document.getElementById('room-display-title').innerText = `Map: ${name}`;
    document.getElementById('sidebar-title').innerText = `${name} Changes`;
    document.getElementById('drop-zone').style.backgroundColor = color;
    document.querySelectorAll('.room-nav-btn').forEach((button) => button.classList.remove('active'));
    const button = document.querySelector(`.room-nav-btn[data-room="${name}"]`);
    if (button) button.classList.add('active');
    button.style.background = color;
    render();
}

function render() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';
    (db[state.currentRoom] || []).forEach((item) => {
        if (state.applied.find((appliedItem) => appliedItem.id === item.id)) return;
        const badge = getBadge(item.cost, item.impact);
        const hint = item.hint || '';
        const card = document.createElement('div');
        card.className = 'change-card';
        card.draggable = true;
        card.innerHTML = `
            <div class="card-header">
                <h4>${item.name}</h4>
                <span class="impact-badge ${badge.cls}">${badge.label}</span>
            </div>
            ${hint ? `<div class="card-hint">${hint}</div>` : ''}
            <div class="card-stats">
                <span style="color:${item.cost === 0 ? 'var(--accent-dark)' : 'var(--rita-red)'}">
                    ${item.cost === 0 ? 'FREE' : '$' + item.cost.toLocaleString()}
                </span>
                <span style="color:var(--accent-green)">-${item.impact}T CO<sub>2</sub></span>
            </div>`;
        card.ondragstart = (event) => {
            event.dataTransfer.setData('application/json', JSON.stringify({ ...item }));
        };
        container.appendChild(card);
    });
}

const dz = document.getElementById('drop-zone');
dz.ondragover = (event) => {
    event.preventDefault();
    dz.classList.add('drag-over');
};
dz.ondragleave = () => dz.classList.remove('drag-over');
dz.ondrop = (event) => {
    event.preventDefault();
    dz.classList.remove('drag-over');
    let item;
    try {
        item = JSON.parse(event.dataTransfer.getData('application/json'));
    } catch {
        return;
    }
    if (!item || state.applied.find((appliedItem) => appliedItem.id === item.id)) return;
    if (state.budget < item.cost) {
        document.getElementById('budget-empty-hint').style.display = 'block';
        return;
    }
    state.budget -= item.cost;
    state.co2 = Math.round((state.co2 + item.impact) * 100) / 100;
    state.applied.push(item);

    apiAddItem(item.id);

    const hint = document.getElementById('drag-hint');
    if (hint) hint.style.display = 'none';
    document.getElementById('budget-empty-hint').style.display = 'none';

    updateStats();
    addAppliedCard(item);
    render();
};

function addAppliedCard(item) {
    const card = document.createElement('div');
    card.className = 'applied-card';
    card.id = `applied-${item.id}`;
    card.innerHTML = `
        <div class="applied-card-top">
            <span class="applied-card-name">${item.name}</span>
            <button class="applied-remove" data-item-id="${item.id}" title="Undo - remove this item">&times;</button>
        </div>
        <div class="applied-card-stats">
            <span style="color:${item.cost === 0 ? 'var(--accent-dark)' : 'var(--rita-red)'}">
                ${item.cost === 0 ? 'FREE' : '$' + item.cost.toLocaleString()}
            </span>
            <span style="color:var(--accent-green)">-${item.impact}T CO2</span>
        </div>`;
    card.querySelector('.applied-remove').onclick = () => removeItem(item.id);
    dz.appendChild(card);
}

function removeItem(id) {
    const index = state.applied.findIndex((item) => item.id === id);
    if (index === -1) return;
    const item = state.applied.splice(index, 1)[0];
    state.budget += item.cost;
    state.co2 = Math.max(0, Math.round((state.co2 - item.impact) * 100) / 100);

    apiRemoveItem(id);

    const element = document.getElementById(`applied-${id}`);
    if (element) element.remove();

    if (state.applied.length === 0) {
        const hint = document.getElementById('drag-hint');
        if (hint) hint.style.display = 'flex';
    }

    if (parseFloat(state.co2) < parseFloat(config.goal)) {
        document.getElementById('congrats-overlay').style.display = 'none';
    }

    updateStats();
    render();
}

function resetItems() {
    const ids = state.applied.map((item) => item.id);
    Promise.all(ids.map((id) => apiRemoveItem(id)));

    state.applied = [];
    state.budget = config.budget;
    state.co2 = 0;

    dz.innerHTML = '';
    const hint = document.createElement('div');
    hint.id = 'drag-hint';
    hint.innerHTML = `
        <div class="drag-arrow">Add</div>
        <div class="drag-text">Drag items here to add them to your plan</div>
        <div class="drag-sub">Pick from the left panel and drop them into this room</div>`;
    dz.appendChild(hint);

    document.getElementById('budget-empty-hint').style.display = 'none';
    document.getElementById('congrats-overlay').style.display = 'none';

    updateStats();
    render();
}

function restartPlanner() {
    fetch('/start', { method: 'POST' }).then(() => location.reload());
}

function updateStats() {
    document.getElementById('total-budget-val').innerText = `$${config.budget.toLocaleString()}`;
    document.getElementById('budget-val').innerText = `$${state.budget.toLocaleString()}`;
    document.getElementById('co2-val').innerText = `${state.co2.toFixed(1)} / ${config.goal}T`;

    if (state.budget === 0 && parseFloat(state.co2) < parseFloat(config.goal)) {
        document.getElementById('budget-empty-hint').style.display = 'block';
    }

    if (parseFloat(state.co2) >= parseFloat(config.goal) && config.goal > 0) {
        document.getElementById('congrats-text').innerText =
            `You reduced ${state.co2.toFixed(1)} tons of CO2 within your $${config.budget.toLocaleString()} budget!`;
        document.getElementById('congrats-overlay').style.display = 'flex';
    }
}

function buildCertificateText() {
    const applied = state.applied;
    const totalCost = applied.reduce((sum, item) => sum + item.cost, 0);
    const remaining = config.budget - totalCost;

    const lines = [
        '===========================================',
        '   SUSTAINABILITY CERTIFICATE',
        '===========================================',
        '',
        'Congratulations!',
        '',
        `You reduced ${state.co2.toFixed(1)} tons of CO2 per year,`,
        `within your $${config.budget.toLocaleString()} budget.`,
        '',
        '-------------------------------------------',
        'YOUR PLAN',
        '-------------------------------------------',
        '',
    ];

    roomList.forEach((roomKey) => {
        const roomItems = applied
            .filter((item) => item.room === roomKey)
            .sort((a, b) => b.impact - a.impact);
        if (roomItems.length === 0) return;
        lines.push(roomKey);
        roomItems.forEach((item) => {
            const cost = item.cost === 0 ? 'FREE  ' : `$${item.cost.toLocaleString().padStart(5)}`;
            lines.push(`  - ${item.name.padEnd(32)} ${cost}   -${item.impact}T CO2`);
        });
        lines.push('');
    });

    lines.push('-------------------------------------------');
    lines.push('SUMMARY');
    lines.push('-------------------------------------------');
    lines.push('');
    lines.push(`  Budget:       $${config.budget.toLocaleString()}`);
    lines.push(`  Plan cost:    $${totalCost.toLocaleString()}`);
    lines.push(`  Remaining:    $${remaining.toLocaleString()}`);
    lines.push(`  CO2 reduced:  ${state.co2.toFixed(1)} T / year`);
    lines.push(`  CO2 goal:     ${config.goal} T / year`);
    lines.push('');
    lines.push('===========================================');
    lines.push('Generated by Reducing Greenhouse Gas');
    lines.push('Emissions at Home.');
    lines.push('===========================================');

    return lines.join('\n');
}

function emailCertificate() {
    const body = buildCertificateText();
    const subject = 'My Home Emissions Reduction Plan - Certificate';
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('start-planner-btn').addEventListener('click', initPlanner);

    document.getElementById('budget-minus').addEventListener('click', () => adjustBudget(-500));
    document.getElementById('budget-plus').addEventListener('click', () => adjustBudget(500));
    document.getElementById('reset-items-btn').addEventListener('click', resetItems);
    document.getElementById('restart-btn').addEventListener('click', restartPlanner);

    document.getElementById('email-cert-btn').addEventListener('click', emailCertificate);
    document.getElementById('restart-budget-btn').addEventListener('click', restartPlanner);
    document.getElementById('close-congrats-btn').addEventListener('click', () => {
        document.getElementById('congrats-overlay').style.display = 'none';
    });

    document.querySelectorAll('.room-nav-btn').forEach((button) => {
        button.addEventListener('click', () => setRoom(button.dataset.room, button.dataset.color));
    });

    const savedPlan = window.INITIAL_STATE.plan || {};
    if (savedPlan.budget) {
        restoreFromBackend(savedPlan);
    } else {
        setRoom(roomList[0], roomColors[roomList[0]]);
    }
});
