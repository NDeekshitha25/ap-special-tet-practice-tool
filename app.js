/**
 * AP Special TET 2026 Interactive Practice Tool - Main Engine
 */

(function () {
  'use strict';

  // State
  const state = {
    manifest: window.TET_MANIFEST || [],
    currentSubId: 'cdp',
    questions: [],
    currentIndex: 0,
    mode: 'practice', // 'practice' | 'test'
    lang: 'both',     // 'both' | 'te' | 'en'
    theme: 'light',   // 'light' | 'dark'
    filter: 'all',    // 'all' | 'unanswered' | 'correct' | 'wrong' | 'bookmarked'
    rangeStart: 1,
    rangeEnd: 50,
    rangeAll: true,
    userAnswers: {},  // { [subId]: { [qId]: { selected: num, isCorrect: bool } } }
    bookmarks: {},    // { [subId]: [qIds...] }
    sidebarOpen: true,
    searchQuery: '',
    testStartTime: null,
    testTimerInterval: null,
    testElapsedSeconds: 0
  };

  // DOM Elements
  const el = {
    subjectSelect: document.getElementById('subjectSelect'),
    rangeSelect: document.getElementById('rangeSelect'),
    filterChips: document.querySelectorAll('.filter-chip'),
    modePracticeBtn: document.getElementById('modePracticeBtn'),
    modeTestBtn: document.getElementById('modeTestBtn'),
    langSelect: document.getElementById('langSelect'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    paletteToggleBtn: document.getElementById('paletteToggleBtn'),
    resetBtn: document.getElementById('resetBtn'),
    searchBtn: document.getElementById('searchBtn'),
    
    // Stats
    statAttempted: document.getElementById('statAttempted'),
    statCorrect: document.getElementById('statCorrect'),
    statWrong: document.getElementById('statWrong'),
    statScore: document.getElementById('statScore'),
    progressBar: document.getElementById('progressBar'),
    testTimerPill: document.getElementById('testTimerPill'),
    testTimerText: document.getElementById('testTimerText'),

    // Question
    mainWrapper: document.getElementById('mainWrapper'),
    qCard: document.getElementById('qCard'),
    qBadge: document.getElementById('qBadge'),
    subTag: document.getElementById('subTag'),
    secTag: document.getElementById('secTag'),
    starBtn: document.getElementById('starBtn'),
    passageBox: document.getElementById('passageBox'),
    qEn: document.getElementById('qEn'),
    qTe: document.getElementById('qTe'),
    optionsGrid: document.getElementById('optionsGrid'),
    explCard: document.getElementById('explCard'),
    explEn: document.getElementById('explEn'),
    explTe: document.getElementById('explTe'),

    // Navigation
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    clearBtn: document.getElementById('clearBtn'),
    submitTestBtn: document.getElementById('submitTestBtn'),
    jumpInput: document.getElementById('jumpInput'),

    // Palette
    sidebar: document.getElementById('sidebar'),
    paletteGrid: document.getElementById('paletteGrid'),
    paletteCount: document.getElementById('paletteCount'),

    // Modals
    modalContainer: document.getElementById('modalContainer')
  };

  // 1. Storage Helpers
  const STORAGE_KEY = 'ap_tet_practice_store_v1';
  function loadStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.userAnswers) state.userAnswers = parsed.userAnswers;
        if (parsed.bookmarks) state.bookmarks = parsed.bookmarks;
        if (parsed.theme) state.theme = parsed.theme;
        if (parsed.lang) state.lang = parsed.lang;
        if (parsed.mode) state.mode = parsed.mode;
        if (parsed.currentSubId) state.currentSubId = parsed.currentSubId;
      }
    } catch (e) {
      console.warn('LocalStorage error', e);
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const urlSub = params.get('sub');
      const urlQ = parseInt(params.get('q'), 10);
      if (urlSub && state.manifest.some(m => m.id === urlSub)) {
        state.currentSubId = urlSub;
      }
      if (urlQ && !isNaN(urlQ)) {
        state.initialTargetQ = urlQ;
      }
    } catch (_) {}
  }

  function saveStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        userAnswers: state.userAnswers,
        bookmarks: state.bookmarks,
        theme: state.theme,
        lang: state.lang,
        mode: state.mode,
        currentSubId: state.currentSubId
      }));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }

  // 2. Data Loading
  async function loadSubjectData(subId) {
    state.currentSubId = subId;
    const subInfo = state.manifest.find(m => m.id === subId) || { count: 0 };
    
    // Check if global variable already loaded
    const varName = `TET_DATA_${subId.toUpperCase()}`;
    if (window[varName] && Array.isArray(window[varName])) {
      state.questions = window[varName];
      onDataLoaded();
      return;
    }

    // Otherwise load dynamic script or fetch
    const scriptId = `script-data-${subId}`;
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `data/${subId}.js`;
      script.onload = () => {
        state.questions = window[varName] || [];
        onDataLoaded();
      };
      script.onerror = async () => {
        // Fallback to fetch
        try {
          const res = await fetch(`data/${subId}.json`);
          state.questions = await res.json();
          onDataLoaded();
        } catch (err) {
          console.error('Failed to load dataset for', subId, err);
          alert('Failed to load questions. Please check files in data/ directory.');
        }
      };
      document.body.appendChild(script);
    }
  }

  function onDataLoaded() {
    if (!state.userAnswers[state.currentSubId]) {
      state.userAnswers[state.currentSubId] = {};
    }
    if (!state.bookmarks[state.currentSubId]) {
      state.bookmarks[state.currentSubId] = [];
    }

    populateRangeSelect();
    if (state.initialTargetQ) {
      const targetIdx = state.questions.findIndex(q => q.id === state.initialTargetQ);
      if (targetIdx !== -1) {
        state.currentIndex = targetIdx;
      } else {
        state.currentIndex = 0;
      }
      state.initialTargetQ = null;
    } else {
      state.currentIndex = 0;
    }
    renderAll();
  }

  function populateRangeSelect() {
    el.rangeSelect.innerHTML = '';
    const total = state.questions.length;
    
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = `All Questions (1 - ${total})`;
    el.rangeSelect.appendChild(allOpt);

    const step = 50;
    for (let s = 1; s <= total; s += step) {
      const e = Math.min(s + step - 1, total);
      const opt = document.createElement('option');
      opt.value = `${s}-${e}`;
      opt.textContent = `Questions ${s} - ${e}`;
      el.rangeSelect.appendChild(opt);
    }
    el.rangeSelect.value = state.rangeAll ? 'all' : `${state.rangeStart}-${state.rangeEnd}`;
  }

  // 3. Filtering and Question Navigation
  function getFilteredQuestions() {
    let list = state.questions.map((q, idx) => ({ ...q, originalIndex: idx }));

    // Apply Range
    if (!state.rangeAll) {
      list = list.filter(q => q.id >= state.rangeStart && q.id <= state.rangeEnd);
    }

    // Apply Status Filter
    const answers = state.userAnswers[state.currentSubId] || {};
    const bookmarks = state.bookmarks[state.currentSubId] || [];

    if (state.filter === 'unanswered') {
      list = list.filter(q => !answers[q.id]);
    } else if (state.filter === 'correct') {
      list = list.filter(q => answers[q.id] && answers[q.id].isCorrect);
    } else if (state.filter === 'wrong') {
      list = list.filter(q => answers[q.id] && !answers[q.id].isCorrect);
    } else if (state.filter === 'bookmarked') {
      list = list.filter(q => bookmarks.includes(q.id));
    }

    return list;
  }

  function getCurrentQuestion() {
    const list = getFilteredQuestions();
    if (list.length === 0) return null;
    if (state.currentIndex >= list.length) {
      state.currentIndex = list.length - 1;
    }
    if (state.currentIndex < 0) {
      state.currentIndex = 0;
    }
    return list[state.currentIndex];
  }

  // 4. Rendering Functions
  function renderAll() {
    renderStats();
    renderQuestion();
    renderPalette();
    updateTheme();
    updateModeUI();
  }

  function renderStats() {
    const total = state.questions.length;
    const answers = state.userAnswers[state.currentSubId] || {};
    
    let correctCount = 0;
    let wrongCount = 0;
    let attemptedCount = 0;

    Object.values(answers).forEach(a => {
      attemptedCount++;
      if (a.isCorrect) correctCount++;
      else wrongCount++;
    });

    el.statAttempted.textContent = `${attemptedCount} / ${total}`;
    el.statCorrect.textContent = correctCount;
    el.statWrong.textContent = wrongCount;
    el.statScore.textContent = `${correctCount} pts`;

    const pct = total > 0 ? (attemptedCount / total) * 100 : 0;
    el.progressBar.style.width = `${pct}%`;
  }

  function renderQuestion() {
    const q = getCurrentQuestion();
    const filtered = getFilteredQuestions();

    if (!q) {
      el.qCard.style.display = 'none';
      el.paletteCount.textContent = `0 of ${state.questions.length}`;
      return;
    }

    el.qCard.style.display = 'flex';
    el.paletteCount.textContent = `${state.currentIndex + 1} of ${filtered.length}`;
    el.jumpInput.value = q.id;

    // Badges
    el.qBadge.textContent = `Q. ${q.id}`;
    const subInfo = state.manifest.find(m => m.id === state.currentSubId);
    el.subTag.textContent = subInfo ? (subInfo.name_te || subInfo.name_en) : state.currentSubId;
    if (el.secTag) {
      if (q.sec && q.sec.trim().length > 0) {
        el.secTag.textContent = q.sec;
        el.secTag.title = q.sec;
        el.secTag.style.display = 'inline-block';
      } else {
        el.secTag.style.display = 'none';
      }
    }

    // Bookmark
    const bookmarks = state.bookmarks[state.currentSubId] || [];
    const isBookmarked = bookmarks.includes(q.id);
    el.starBtn.classList.toggle('bookmarked', isBookmarked);
    el.starBtn.textContent = isBookmarked ? '★' : '☆';

    // Passage / Comprehension
    if (q.passage && q.passage.trim().length > 0) {
      el.passageBox.style.display = 'block';
      el.passageBox.innerHTML = formatRichText(q.passage);
    } else {
      el.passageBox.style.display = 'none';
      el.passageBox.innerHTML = '';
    }

    // Language display with intelligent fallbacks
    const hasEn = Boolean(q.q_en && q.q_en.trim().length > 0);
    const hasTe = Boolean(q.q_te && q.q_te.trim().length > 0);

    if (state.lang === 'en') {
      el.qEn.style.display = hasEn ? 'block' : (hasTe ? 'block' : 'none');
      el.qTe.style.display = 'none';
      if (!hasEn && hasTe) el.qEn.innerHTML = formatRichText(q.q_te);
      else el.qEn.innerHTML = formatRichText(q.q_en || '');
    } else if (state.lang === 'te') {
      el.qEn.style.display = 'none';
      el.qTe.style.display = hasTe ? 'block' : (hasEn ? 'block' : 'none');
      if (!hasTe && hasEn) el.qTe.innerHTML = formatRichText(q.q_en);
      else el.qTe.innerHTML = formatRichText(q.q_te || '');
    } else {
      // Both
      el.qEn.style.display = hasEn ? 'block' : 'none';
      el.qEn.innerHTML = formatRichText(q.q_en || '');

      if (hasTe && q.q_te !== q.q_en) {
        el.qTe.style.display = 'block';
        el.qTe.innerHTML = formatRichText(q.q_te);
      } else if (!hasEn && hasTe) {
        el.qTe.style.display = 'block';
        el.qTe.innerHTML = formatRichText(q.q_te);
      } else {
        el.qTe.style.display = 'none';
        el.qTe.innerHTML = '';
      }
    }

    // Options
    el.optionsGrid.innerHTML = '';
    const answers = state.userAnswers[state.currentSubId] || {};
    const currentAnswer = answers[q.id];

    q.opts.forEach((opt, idx) => {
      const optNum = idx + 1;
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.type = 'button';

      let stateBadge = '';
      if (state.mode === 'practice' && currentAnswer) {
        btn.disabled = true;
        if (optNum === q.ans) {
          btn.classList.add('correct');
          stateBadge = '<span class="state-badge">&#10004; Correct</span>';
        } else if (currentAnswer.selected === optNum) {
          btn.classList.add('wrong');
          stateBadge = '<span class="state-badge">&#10008; Incorrect</span>';
        }
      } else if (state.mode === 'test' && currentAnswer) {
        if (currentAnswer.selected === optNum) {
          btn.classList.add('selected-test');
        }
      }

      // Bilingual option text
      let bodyHtml = '';
      if (state.lang === 'en') {
        bodyHtml = `<div class="opt-en">${formatRichText(opt.en)}</div>`;
      } else if (state.lang === 'te') {
        bodyHtml = `<div class="opt-en">${formatRichText(opt.te || opt.en)}</div>`;
      } else {
        if (opt.te && opt.te !== opt.en) {
          bodyHtml = `<div class="opt-en">${formatRichText(opt.en)}</div><div class="opt-te">${formatRichText(opt.te)}</div>`;
        } else {
          bodyHtml = `<div class="opt-en">${formatRichText(opt.en)}</div>`;
        }
      }

      btn.innerHTML = `
        <span class="opt-num">(${optNum})</span>
        <div class="opt-body">${bodyHtml}</div>
        ${stateBadge}
      `;

      btn.addEventListener('click', () => onOptionSelected(q, optNum));
      el.optionsGrid.appendChild(btn);
    });

    // Explanation Card
    if (state.mode === 'practice' && currentAnswer) {
      el.explCard.style.display = 'flex';
      el.explEn.innerHTML = q.exp_en ? `<strong>English:</strong> ${formatRichText(q.exp_en)}` : '';
      el.explTe.innerHTML = q.exp_te ? `<strong>వివరణ (తెలుగు):</strong> ${formatRichText(q.exp_te)}` : '';
    } else {
      el.explCard.style.display = 'none';
      el.explEn.innerHTML = '';
      el.explTe.innerHTML = '';
    }

    // Prev / Next button states
    el.prevBtn.disabled = state.currentIndex === 0;
    el.nextBtn.disabled = state.currentIndex === filtered.length - 1;
    el.clearBtn.disabled = !currentAnswer;
  }

  function renderPalette() {
    const filtered = getFilteredQuestions();
    const answers = state.userAnswers[state.currentSubId] || {};
    const bookmarks = state.bookmarks[state.currentSubId] || [];

    el.paletteGrid.innerHTML = '';
    filtered.forEach((q, idx) => {
      const cell = document.createElement('div');
      cell.className = 'palette-cell';
      cell.textContent = q.id;

      if (idx === state.currentIndex) {
        cell.classList.add('current');
      }

      const ans = answers[q.id];
      if (ans) {
        if (state.mode === 'practice') {
          cell.classList.add(ans.isCorrect ? 'answered-correct' : 'answered-wrong');
        } else {
          cell.classList.add('answered-test');
        }
      }

      if (bookmarks.includes(q.id)) {
        cell.classList.add('is-bookmark');
      }

      cell.addEventListener('click', () => {
        state.currentIndex = idx;
        renderQuestion();
        renderPalette();
      });

      el.paletteGrid.appendChild(cell);
    });
  }

  // 5. Interaction Handlers
  function onOptionSelected(q, selectedNum) {
    if (!state.userAnswers[state.currentSubId]) {
      state.userAnswers[state.currentSubId] = {};
    }

    const isCorrect = (selectedNum === q.ans);
    state.userAnswers[state.currentSubId][q.id] = {
      selected: selectedNum,
      isCorrect: isCorrect,
      timestamp: Date.now()
    };

    saveStorage();
    renderStats();
    renderQuestion();
    renderPalette();

    // Haptic feedback
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(isCorrect ? 40 : [60, 40, 60]);
    }
  }

  function toggleBookmark() {
    const q = getCurrentQuestion();
    if (!q) return;

    if (!state.bookmarks[state.currentSubId]) {
      state.bookmarks[state.currentSubId] = [];
    }
    const list = state.bookmarks[state.currentSubId];
    const idx = list.indexOf(q.id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(q.id);
    }

    saveStorage();
    renderQuestion();
    renderPalette();
  }

  function clearCurrentAnswer() {
    const q = getCurrentQuestion();
    if (!q) return;

    if (state.userAnswers[state.currentSubId] && state.userAnswers[state.currentSubId][q.id]) {
      delete state.userAnswers[state.currentSubId][q.id];
      saveStorage();
      renderStats();
      renderQuestion();
      renderPalette();
    }
  }

  // 6. Navigation Controls
  function nextQuestion() {
    const list = getFilteredQuestions();
    if (state.currentIndex < list.length - 1) {
      state.currentIndex++;
      renderQuestion();
      renderPalette();
    }
  }

  function prevQuestion() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderQuestion();
      renderPalette();
    }
  }

  function jumpToQuestion(qNum) {
    const list = getFilteredQuestions();
    const idx = list.findIndex(q => q.id === parseInt(qNum, 10));
    if (idx >= 0) {
      state.currentIndex = idx;
      renderQuestion();
      renderPalette();
    } else {
      // If not in current filter/range, reset filter to 'all' and range to 'all'
      state.filter = 'all';
      state.rangeAll = true;
      el.rangeSelect.value = 'all';
      el.filterChips.forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));

      const allList = getFilteredQuestions();
      const allIdx = allList.findIndex(q => q.id === parseInt(qNum, 10));
      if (allIdx >= 0) {
        state.currentIndex = allIdx;
        renderQuestion();
        renderPalette();
      } else {
        alert(`Question #${qNum} not found in this subject.`);
      }
    }
  }

  // 7. Test Mode and Timer
  function setMode(mode) {
    state.mode = mode;
    saveStorage();
    updateModeUI();
    renderQuestion();
    renderPalette();

    if (mode === 'test') {
      startTestTimer();
    } else {
      stopTestTimer();
    }
  }

  function updateModeUI() {
    el.modePracticeBtn.classList.toggle('active', state.mode === 'practice');
    el.modeTestBtn.classList.toggle('active', state.mode === 'test');
    el.submitTestBtn.style.display = (state.mode === 'test') ? 'flex' : 'none';
    el.testTimerPill.style.display = (state.mode === 'test') ? 'flex' : 'none';
  }

  function startTestTimer() {
    stopTestTimer();
    state.testStartTime = Date.now();
    state.testElapsedSeconds = 0;
    updateTimerText();

    state.testTimerInterval = setInterval(() => {
      state.testElapsedSeconds++;
      updateTimerText();
    }, 1000);
  }

  function stopTestTimer() {
    if (state.testTimerInterval) {
      clearInterval(state.testTimerInterval);
      state.testTimerInterval = null;
    }
  }

  function updateTimerText() {
    const mins = Math.floor(state.testElapsedSeconds / 60);
    const secs = state.testElapsedSeconds % 60;
    el.testTimerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function submitTest() {
    stopTestTimer();
    const total = state.questions.length;
    const answers = state.userAnswers[state.currentSubId] || {};

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    state.questions.forEach(q => {
      const a = answers[q.id];
      if (!a) {
        unattempted++;
      } else if (a.isCorrect) {
        correct++;
      } else {
        wrong++;
      }
    });

    const accuracy = (correct + wrong > 0) ? Math.round((correct / (correct + wrong)) * 100) : 0;
    const timeStr = el.testTimerText.textContent;

    const modalHtml = `
      <div class="modal-card">
        <h2>🎉 Test Submitted Successfully!</h2>
        <p style="color: var(--text-sub); font-size: 13.5px;">Here is your complete performance report for <strong>${state.currentSubId.toUpperCase()}</strong>:</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0;">
          <div style="background: var(--bg); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: #059669;">${correct}</div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-sub);">Correct Answers</div>
          </div>
          <div style="background: var(--bg); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: #dc2626;">${wrong}</div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-sub);">Wrong Answers</div>
          </div>
          <div style="background: var(--bg); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: var(--text-sub);">${unattempted}</div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-sub);">Unattempted</div>
          </div>
          <div style="background: var(--bg); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: var(--primary);">${accuracy}%</div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-sub);">Accuracy Rate</div>
          </div>
        </div>
        <div style="font-size: 13px; color: var(--text-sub); text-align: center;">Time Taken: <strong>${timeStr}</strong></div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="modalReviewBtn" class="btn-nav primary" style="flex: 1; justify-content: center;">Review Explanations (Practice Mode)</button>
          <button id="modalCloseBtn" class="btn-nav" style="justify-content: center;">Close</button>
        </div>
      </div>
    `;

    showModal(modalHtml, () => {
      document.getElementById('modalReviewBtn').onclick = () => {
        closeModal();
        setMode('practice');
      };
      document.getElementById('modalCloseBtn').onclick = closeModal;
    });
  }

  // 8. Search Modal
  function openSearchModal() {
    const modalHtml = `
      <div class="modal-card" style="max-width: 600px;">
        <h2>🔍 Search Question Bank</h2>
        <input type="text" id="searchInput" placeholder="Search keywords in English or తెలుగు, or enter Question #..." 
          style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1.5px solid var(--border); font-size: 14px; outline: none; background: var(--bg); color: var(--text-main);">
        <div id="searchResults" style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-top: 6px;"></div>
        <button id="searchCloseBtn" class="btn-nav" style="align-self: flex-end;">Close</button>
      </div>
    `;

    showModal(modalHtml, () => {
      const input = document.getElementById('searchInput');
      const resultsContainer = document.getElementById('searchResults');
      input.focus();

      input.oninput = () => {
        const query = input.value.trim().toLowerCase();
        if (!query) {
          resultsContainer.innerHTML = '';
          return;
        }

        const matches = state.questions.filter(q => {
          if (q.id.toString() === query) return true;
          if (q.q_en && q.q_en.toLowerCase().includes(query)) return true;
          if (q.q_te && q.q_te.toLowerCase().includes(query)) return true;
          return false;
        }).slice(0, 30);

        if (matches.length === 0) {
          resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-sub);">No questions found matching your search.</div>';
          return;
        }

        resultsContainer.innerHTML = matches.map(m => `
          <div class="search-item" data-id="${m.id}" style="padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; background: var(--card-bg);">
            <div style="font-weight: 800; color: var(--primary); font-size: 12px;">Q. ${m.id}</div>
            <div style="font-size: 13.5px; font-weight: 600; margin-top: 2px;">${escapeHtml(stripHtml(m.q_en || m.q_te))}</div>
          </div>
        `).join('');

        resultsContainer.querySelectorAll('.search-item').forEach(item => {
          item.onclick = () => {
            const qId = item.dataset.id;
            closeModal();
            jumpToQuestion(qId);
          };
        });
      };

      document.getElementById('searchCloseBtn').onclick = closeModal;
    });
  }

  // 9. Reset Modal
  function openResetModal() {
    const modalHtml = `
      <div class="modal-card">
        <h2>⚠️ Reset Practice Progress</h2>
        <p style="color: var(--text-sub); font-size: 13.5px;">Choose what you would like to reset:</p>
        <div style="display: flex; flex-direction: column; gap: 8px; margin: 10px 0;">
          <button id="resetSubjectBtn" class="btn-nav" style="justify-content: center; color: #dc2626;">Reset Current Subject (${state.currentSubId.toUpperCase()})</button>
          <button id="resetAllBtn" class="btn-nav" style="justify-content: center; color: #dc2626;">Reset All Subjects &amp; Bookmarks</button>
        </div>
        <button id="resetCancelBtn" class="btn-nav" style="align-self: flex-end;">Cancel</button>
      </div>
    `;

    showModal(modalHtml, () => {
      document.getElementById('resetSubjectBtn').onclick = () => {
        delete state.userAnswers[state.currentSubId];
        delete state.bookmarks[state.currentSubId];
        saveStorage();
        closeModal();
        renderAll();
      };
      document.getElementById('resetAllBtn').onclick = () => {
        state.userAnswers = {};
        state.bookmarks = {};
        saveStorage();
        closeModal();
        renderAll();
      };
      document.getElementById('resetCancelBtn').onclick = closeModal;
    });
  }

  function showModal(html, onMounted) {
    el.modalContainer.innerHTML = `<div class="modal-overlay">${html}</div>`;
    el.modalContainer.style.display = 'block';
    if (onMounted) onMounted();
  }

  function closeModal() {
    el.modalContainer.style.display = 'none';
    el.modalContainer.innerHTML = '';
  }

  // 10. Theme and Utilities
  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    saveStorage();
    updateTheme();
  }

  function updateTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    el.themeToggleBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  }

  function renderLatex(str) {
    if (!str) return '';
    const s = String(str);
    if (!s.includes('$')) return s;

    return s.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g).map(part => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2).trim();
        if (window.katex && typeof window.katex.renderToString === 'function') {
          try {
            return window.katex.renderToString(math, { displayMode: true, throwOnError: false });
          } catch (_) {}
        }
        return `<div class="math-display">${renderFallbackMath(math)}</div>`;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1).trim();
        if (window.katex && typeof window.katex.renderToString === 'function') {
          try {
            return window.katex.renderToString(math, { displayMode: false, throwOnError: false });
          } catch (_) {}
        }
        return `<span class="math-inline">${renderFallbackMath(math)}</span>`;
      }
      return part;
    }).join('');
  }

  function renderFallbackMath(math) {
    let m = math;
    m = m.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="fr"><span class="nu">$1</span><span class="de">$2</span></span>');
    m = m.replace(/\\sqrt\[(\d+)\]\{([^{}]+)\}/g, '<sup style="font-size:0.75em;">$1</sup>&radic;<span style="border-top:1.5px solid currentColor;padding-top:1px;margin-left:1px;">$2</span>');
    m = m.replace(/\\sqrt\{([^{}]+)\}/g, '&radic;<span style="border-top:1.5px solid currentColor;padding-top:1px;margin-left:1px;">$1</span>');
    m = m.replace(/\\sqrt\s*([0-9a-zA-Z]+)/g, '&radic;<span style="border-top:1.5px solid currentColor;padding-top:1px;margin-left:1px;">$1</span>');
    m = m.replace(/\\times/g, '&times;');
    m = m.replace(/\\div/g, '&divide;');
    m = m.replace(/\\pm/g, '&plusmn;');
    m = m.replace(/\\approx/g, '&asymp;');
    m = m.replace(/\\pi/g, '&pi;');
    m = m.replace(/\\theta/g, '&theta;');
    m = m.replace(/\\circ/g, '&deg;');
    m = m.replace(/\\ldots/g, '&hellip;');
    m = m.replace(/\\cdot/g, '&bull;');
    m = m.replace(/\\text\{([^{}]+)\}/g, '$1');
    m = m.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
    m = m.replace(/\^([0-9a-zA-Z]+)/g, '<sup>$1</sup>');
    m = m.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
    m = m.replace(/_([0-9a-zA-Z]+)/g, '<sub>$1</sub>');
    return m;
  }

  function formatRichText(str) {
    if (!str) return '';
    let s = String(str).trim();
    // Normalize newlines
    s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // If text does not contain block HTML tags, convert newlines to <br>
    if (!/<(?:table|tr|td|th|div|p|ul|ol|li)\b/i.test(s)) {
      s = s.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    }
    // Render LaTeX Math formulas ($...$ or $$...$$) AFTER newlines to preserve SVG paths
    s = renderLatex(s);
    return s;
  }

  function stripHtml(str) {
    if (!str) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = str;
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 11. Event Listeners Setup
  function initEvents() {
    // Subject change
    el.subjectSelect.addEventListener('change', (e) => {
      loadSubjectData(e.target.value);
    });

    // Range change
    el.rangeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'all') {
        state.rangeAll = true;
      } else {
        state.rangeAll = false;
        const [s, end] = val.split('-').map(Number);
        state.rangeStart = s;
        state.rangeEnd = end;
      }
      state.currentIndex = 0;
      renderQuestion();
      renderPalette();
    });

    // Filter chips
    el.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        el.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.filter = chip.dataset.filter;
        state.currentIndex = 0;
        renderQuestion();
        renderPalette();
      });
    });

    // Mode buttons
    el.modePracticeBtn.onclick = () => setMode('practice');
    el.modeTestBtn.onclick = () => setMode('test');

    // Language
    el.langSelect.addEventListener('change', (e) => {
      state.lang = e.target.value;
      saveStorage();
      renderQuestion();
    });

    // Theme
    el.themeToggleBtn.onclick = toggleTheme;

    // Palette toggle
    el.paletteToggleBtn.onclick = () => {
      state.sidebarOpen = !state.sidebarOpen;
      el.mainWrapper.classList.toggle('sidebar-open', state.sidebarOpen);
      el.sidebar.style.display = state.sidebarOpen ? 'flex' : 'none';
    };

    // Reset & Search
    el.resetBtn.onclick = openResetModal;
    el.searchBtn.onclick = openSearchModal;

    // Navigation
    el.prevBtn.onclick = prevQuestion;
    el.nextBtn.onclick = nextQuestion;
    el.clearBtn.onclick = clearCurrentAnswer;
    el.starBtn.onclick = toggleBookmark;
    el.submitTestBtn.onclick = submitTest;

    // Jump Input
    el.jumpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        jumpToQuestion(el.jumpInput.value);
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'n') {
        nextQuestion();
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        prevQuestion();
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const q = getCurrentQuestion();
        if (q) onOptionSelected(q, parseInt(e.key, 10));
      } else if (e.key === 'b') {
        toggleBookmark();
      }
    });
  }

  // 12. Initialization
  function init() {
    loadStorage();
    initEvents();

    // Populate subject select from manifest
    el.subjectSelect.innerHTML = '';
    state.manifest.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = `${sub.name_en} (${sub.count} Qs)`;
      el.subjectSelect.appendChild(opt);
    });

    el.subjectSelect.value = state.currentSubId;
    el.langSelect.value = state.lang;
    updateTheme();
    updateModeUI();

    // Load initial subject
    loadSubjectData(state.currentSubId);
  }

  // Start app when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
