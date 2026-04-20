/* ============================================================
   Test-knowledge phase — per room, drag the items you picked
   into order from Highest Impact (top) to Lowest (bottom).
   Logic mirrors Victor's HW9 showTestRoom / nextTestRoom.
   ============================================================ */

const { applied, rooms } = window.TEST_STATE;
const roomList = rooms.map(r => r.key);

let testRoomIndex = 0;
let totalScore    = 0;

function showTestRoom() {
    const roomName = roomList[testRoomIndex];
    document.getElementById('test-room-title').innerText = 'Test Knowledge: ' + roomName;

    const chosen   = applied.filter(a => a.room === roomName);
    const listCont = document.getElementById('test-rank-list');
    listCont.innerHTML = '';

    if (chosen.length === 0) {
        listCont.innerHTML =
            '<p style="color:#636E72">You didn\'t choose any changes for this room. Proceed to the next.</p>';
    } else {
        [...chosen].sort(() => Math.random() - 0.5).forEach(item => {
            const div = document.createElement('div');
            div.className      = 'rank-item';
            div.draggable      = true;
            div.innerText      = item.name;
            div.dataset.impact = item.impact;
            listCont.appendChild(div);
        });
    }

    document.getElementById('test-next-btn').innerText =
        testRoomIndex === roomList.length - 1 ? 'Submit Final Answers' : 'Next Room';
}

function nextTestRoom() {
    const items = [...document.querySelectorAll('.rank-item')];
    if (items.length > 1) {
        let correct = true;
        for (let i = 0; i < items.length - 1; i++) {
            if (parseFloat(items[i].dataset.impact) < parseFloat(items[i + 1].dataset.impact)) {
                correct = false;
            }
        }
        if (correct) totalScore++;
    } else {
        // 0 or 1 items: trivially correct.
        totalScore++;
    }

    if (testRoomIndex < roomList.length - 1) {
        testRoomIndex++;
        showTestRoom();
    } else {
        finishTest();
    }
}

function finishTest() {
    fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: totalScore, total: roomList.length })
    }).then(() => {
        window.location.href = '/result';
    });
}

// ── DRAG RANKING ──
const ranker = document.getElementById('test-rank-list');
let dragEl = null;

ranker.addEventListener('dragstart', e => {
    dragEl = e.target;
    dragEl.classList.add('dragging');
});
ranker.addEventListener('dragend', () => {
    if (dragEl) dragEl.classList.remove('dragging');
});
ranker.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragEl) return;
    const after = [...ranker.querySelectorAll('.rank-item:not(.dragging)')].reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - box.top - box.height / 2;
        return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY });
    if (after.element) ranker.insertBefore(dragEl, after.element);
    else ranker.appendChild(dragEl);
});

// Wire the Next button and kick off room 1.
document.getElementById('test-next-btn').addEventListener('click', nextTestRoom);
showTestRoom();
