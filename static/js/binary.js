/* ============================================================
   Stage 1 Quiz — Version 2 (slide-14 grid)
   - Build one row per question
   - Each row must have a selection before Submit activates
   - Wrong: shake and fully reset (no per-row feedback)
   - Correct: lock all rows, reveal "Go to Planner →" link
   ============================================================ */
(function () {
    const questions    = window.BINARY_QUESTIONS || [];
    const rowsEl       = document.getElementById('rows');
    const submitBtn    = document.getElementById('submit-btn');
    const submitHint   = document.getElementById('submit-hint');
    const toPlannerLnk = document.getElementById('to-planner-link');

    let selections = Object.create(null);
    let locked = false;

    // ── Build rows ──────────────────────────────────────────
    questions.forEach(q => {
        const row = document.createElement('div');
        row.className   = 'v2-row';
        row.dataset.qid = q.id;
        row.innerHTML = `
            <div class="v2-row-title">${q.title}</div>
            ${q.options.map(opt => `
                <button type="button" class="v2-opt" data-answer="${opt}">${opt}</button>
            `).join('')}
        `;
        rowsEl.appendChild(row);

        row.querySelectorAll('.v2-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                if (locked) return;
                selections[q.id] = btn.dataset.answer;
                row.querySelectorAll('.v2-opt').forEach(b => b.classList.remove('is-chosen'));
                btn.classList.add('is-chosen');
                row.classList.add('has-choice');
                refreshSubmitState();
            });
        });
    });

    // ── UI helpers ──────────────────────────────────────────
    function refreshSubmitState() {
        const ready = Object.keys(selections).length === questions.length;
        submitBtn.disabled = !ready;
        submitHint.classList.remove('is-error');
        submitHint.textContent = ready
            ? 'Looks good — hit Submit.'
            : 'Make a choice in every row to activate submit.';
    }

    function resetSelections() {
        selections = Object.create(null);
        document.querySelectorAll('.v2-row').forEach(row => {
            row.classList.remove('has-choice', 'is-locked');
            row.querySelectorAll('.v2-opt').forEach(btn => {
                btn.classList.remove('is-chosen');
                btn.disabled = false;
            });
        });
        refreshSubmitState();
    }

    function lockCorrect() {
        locked = true;
        document.querySelectorAll('.v2-row').forEach(row => {
            row.classList.add('is-locked');
            row.querySelectorAll('.v2-opt').forEach(btn => { btn.disabled = true; });
        });
        submitBtn.disabled = true;
        submitBtn.textContent = 'Unlocked ✓';
        submitHint.classList.remove('is-error');
        submitHint.textContent = 'All correct — the planner link is now in the nav bar above.';
        if (toPlannerLnk) toPlannerLnk.classList.remove('nav-hidden');
    }

    function onWrong() {
        rowsEl.classList.add('shake');
        submitBtn.disabled = true;
        submitHint.classList.add('is-error');
        submitHint.textContent = 'Not quite — resetting. Try again.';
        setTimeout(() => {
            rowsEl.classList.remove('shake');
            resetSelections();
        }, 650);
    }

    // ── Submit handler ──────────────────────────────────────
    submitBtn.addEventListener('click', () => {
        if (submitBtn.disabled || locked) return;

        const submission = Object.keys(selections).map(qid => ({
            question_id: qid,
            answer: selections[qid],
        }));

        submitBtn.disabled = true;
        submitHint.classList.remove('is-error');
        submitHint.textContent = 'Checking…';

        fetch('/api/binary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submission }),
        })
        .then(r => r.json())
        .then(data => {
            if (data && data.all_correct) {
                lockCorrect();
            } else {
                onWrong();
            }
        })
        .catch(() => {
            submitHint.classList.add('is-error');
            submitHint.textContent = 'Network error. Try again.';
            submitBtn.disabled = false;
        });
    });

    // Initial state.
    refreshSubmitState();
})();
