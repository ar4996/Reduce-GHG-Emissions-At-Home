/* Stage 1 quiz page behavior. */
(function () {
    const questions = window.BINARY_QUESTIONS || [];
    const rowsEl = document.getElementById('rows');
    const submitBtn = document.getElementById('submit-btn');
    const submitHint = document.getElementById('submit-hint');
    const toSetupLink = document.getElementById('to-planner-link');
    const progressCount = document.getElementById('progress-count');
    const progressFill = document.getElementById('progress-fill');

    let selections = Object.create(null);
    let locked = false;

    function shuffleOptions(options) {
        const shuffled = [...options];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const swapIndex = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
        }
        return shuffled;
    }

    questions.forEach((q, index) => {
        const row = document.createElement('section');
        row.className = 'v2-row';
        row.dataset.qid = q.id;

        const copy = document.createElement('div');
        copy.className = 'v2-row-copy';

        const number = document.createElement('span');
        number.className = 'v2-row-index';
        number.textContent = String(index + 1).padStart(2, '0');

        const copyText = document.createElement('div');

        const eyebrow = document.createElement('span');
        eyebrow.className = 'v2-row-eyebrow';
        eyebrow.textContent = 'Compare';

        const title = document.createElement('div');
        title.className = 'v2-row-title';
        title.textContent = q.title;

        copyText.append(eyebrow, title);
        copy.append(number, copyText);

        const options = document.createElement('div');
        options.className = 'v2-row-options';

        shuffleOptions(q.options || []).forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'v2-opt';
            btn.dataset.answer = opt;
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = opt;

            btn.addEventListener('click', () => {
                if (locked) return;

                selections[q.id] = btn.dataset.answer;
                row.querySelectorAll('.v2-opt').forEach((choiceBtn) => {
                    choiceBtn.classList.remove('is-chosen');
                    choiceBtn.setAttribute('aria-pressed', 'false');
                });

                btn.classList.add('is-chosen');
                btn.setAttribute('aria-pressed', 'true');
                row.classList.add('has-choice');
                refreshSubmitState();
            });

            options.appendChild(btn);
        });

        row.append(copy, options);
        rowsEl.appendChild(row);
    });

    function refreshSubmitState() {
        const answered = Object.keys(selections).length;
        const total = questions.length;
        const ready = total > 0 && answered === total;

        submitBtn.disabled = !ready;
        submitHint.classList.remove('is-error');
        submitHint.textContent = ready
            ? 'Looks good - submit when you are ready.'
            : 'Make a choice in every row to activate submit.';

        if (progressCount) {
            progressCount.textContent = `${answered} / ${total} answered`;
        }

        if (progressFill) {
            progressFill.style.width = total ? `${(answered / total) * 100}%` : '0%';
        }
    }

    function resetSelections() {
        selections = Object.create(null);
        document.querySelectorAll('.v2-row').forEach((row) => {
            row.classList.remove('has-choice', 'is-locked');
            row.querySelectorAll('.v2-opt').forEach((btn) => {
                btn.classList.remove('is-chosen');
                btn.disabled = false;
                btn.setAttribute('aria-pressed', 'false');
            });
        });

        submitBtn.classList.remove('is-complete');
        refreshSubmitState();
    }

    function lockCorrect() {
        locked = true;
        document.querySelectorAll('.v2-row').forEach((row) => {
            row.classList.add('is-locked');
            row.querySelectorAll('.v2-opt').forEach((btn) => {
                btn.disabled = true;
            });
        });

        submitBtn.disabled = false;
        submitBtn.classList.add('is-complete');
        submitBtn.textContent = 'Home Setup Ready';
        submitHint.classList.remove('is-error');
        submitHint.textContent = 'All correct - continue to home setup when you are ready.';

        if (toSetupLink) {
            toSetupLink.classList.remove('nav-hidden');
        }
    }

    function onWrong() {
        rowsEl.classList.add('shake');
        submitBtn.disabled = true;
        submitHint.classList.add('is-error');
        submitHint.textContent = 'Not quite - resetting. Try again.';

        setTimeout(() => {
            rowsEl.classList.remove('shake');
            resetSelections();
        }, 650);
    }

    submitBtn.addEventListener('click', () => {
        if (locked) {
            window.location.href = (toSetupLink && toSetupLink.href) || '/quiz/setup';
            return;
        }

        if (submitBtn.disabled) return;

        const submission = Object.keys(selections).map((qid) => ({
            question_id: qid,
            answer: selections[qid],
        }));

        submitBtn.disabled = true;
        submitHint.classList.remove('is-error');
        submitHint.textContent = 'Checking...';

        fetch('/api/binary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submission }),
        })
            .then((r) => r.json())
            .then((data) => {
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

    refreshSubmitState();
})();
