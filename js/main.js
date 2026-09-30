(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const createEl = (tag, props = {}, children = []) => {
    const el = Object.assign(document.createElement(tag), props);
    el.append(...children);
    return el;
  };

  const HEADER_SOLID_OFFSET = 40; // px scrolled before the header gets its solid background
  const DESKTOP_NAV_QUERY = '(min-width: 901px)'; // keep in sync with the 900px nav breakpoint in styles.css
  const RESIZE_DEBOUNCE_MS = 150;

  /* ---------- Header: solid after scrolling, mobile menu ---------- */
  function initHeader() {
    const header = $('#site-header');
    const toggle = $('.nav-toggle', header);
    const nav = $('#site-nav');
    if (!header || !toggle || !nav) return;
    const icon = $('use', toggle);

    let ticking = false;
    const updateSolid = () => {
      header.classList.toggle('is-solid', window.scrollY > HEADER_SOLID_OFFSET);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateSolid);
    }, { passive: true });
    updateSolid();

    const setOpen = (open) => {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      icon.setAttribute('href', open ? '#i-close' : '#i-menu');
    };
    const isOpen = () => header.classList.contains('is-open');

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      toggle.focus();
    });
    window.matchMedia(DESKTOP_NAV_QUERY).addEventListener('change', (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ---------- Hero readiness quiz ---------- */
  // Q1 is from the Figma design. Q2–Q4 are placeholders — replace with the client's real questions.
  const QUIZ = [
    { id: 'money', q: 'Where is most of your retirement money today?', options: [['401k', '401(k) or workplace plan'], ['ira', 'Traditional / Roth IRA'], ['cash', 'Taxable cash / brokerage']] },
    { id: 'amount', q: 'Roughly how much are you thinking of moving?', options: [['lt50', 'Under $50,000'], ['50-150', '$50,000 – $150,000'], ['gt150', 'Over $150,000']] },
    { id: 'timeline', q: 'When do you plan to retire?', options: [['retired', "I'm already retired"], ['lt5', 'Within 5 years'], ['gt5', '5+ years from now']] },
    { id: 'goal', q: 'What matters most to you right now?', options: [['protect', 'Protecting what I have'], ['diversify', 'Diversifying my portfolio'], ['learn', 'Just learning, for now']] }
  ];

  function createQuizOption(value, label, checked) {
    const dot = createEl('span', { className: 'quiz-option__dot' });
    dot.setAttribute('aria-hidden', 'true');
    return createEl('label', { className: 'quiz-option' }, [
      createEl('input', { type: 'radio', name: 'q', value, checked }),
      createEl('span', { textContent: label }),
      dot
    ]);
  }

  function initQuiz() {
    const form = $('#quiz-form');
    const lead = $('#quiz-lead');
    const options = $('#quiz-options');
    const back = $('#quiz-back');
    if (!form || !lead || !options || !back) return;

    const answers = {};
    let step = 0;
    const isLastStep = () => step === QUIZ.length - 1;

    const render = () => {
      const item = QUIZ[step];
      $('#quiz-step').textContent = `${step + 1} of ${QUIZ.length}`;
      $('#quiz-bar').style.width = `${((step + 1) / QUIZ.length) * 100}%`;
      $('#quiz-question').textContent = item.q;
      $('#quiz-next').textContent = isLastStep() ? 'See my result' : 'Continue';
      back.hidden = step === 0;

      const saved = answers[item.id];
      options.replaceChildren(...item.options.map(([value, label], i) =>
        createQuizOption(value, label, saved ? saved === value : i === 0)
      ));
    };

    const saveAnswer = () => {
      answers[QUIZ[step].id] = new FormData(form).get('q');
    };

    const showLead = () => {
      form.hidden = true;
      $('#quiz-foot').hidden = true;
      lead.hidden = false;
      lead.elements.quiz_answers.value = JSON.stringify(answers);
      $('#quiz-lead-title').focus();
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveAnswer();
      if (isLastStep()) {
        showLead();
        return;
      }
      step += 1;
      render();
      $('input:checked', options)?.focus();
    });
    back.addEventListener('click', () => {
      saveAnswer();
      step -= 1;
      render();
    });
    $('#quiz-skip')?.addEventListener('click', showLead);

    render();
  }

  /* ---------- Situation checker ---------- */
  const SUGGESTIONS = {
    rollover: { title: 'Map the rollover path', text: 'Custodian → dealer → depository before funds move.', href: '#kb-rollover', link: 'How IRA money moves into gold ↓' },
    // The three below are written from the page's own copy — confirm wording with the client.
    fees: { title: 'Get the full fee stack', text: 'Setup, annual, storage, and metal premiums — ask for all of it in writing.', href: '#compare', link: 'How we compare companies ↓' },
    shortlist: { title: 'Compare on the same five points', text: 'Fees, spreads, buyback, minimums, and storage — not signup bonuses.', href: '#compare', link: 'See the criteria ↓' },
    metals: { title: 'Check purity and eligibility', text: 'Most gold bullion must be .995+ fine, with specific coin exceptions.', href: '#kb-purity', link: 'What purity is required ↓' }
  };

  function createSuggestion({ title, text, href, link }) {
    return createEl('li', { className: 'suggestion' }, [
      createEl('div', { className: 'suggestion__body' }, [
        createEl('h4', { textContent: title }),
        createEl('p', { textContent: text }),
        createEl('a', { href, textContent: link })
      ])
    ]);
  }

  function initSituation() {
    const form = $('#situation-form');
    const list = $('#suggestions-list');
    const empty = $('#suggestions-empty');
    if (!form || !list || !empty) return;

    const selected = () => $$('input[name="situation"]:checked', form).map((input) => input.value);

    const render = () => {
      const picks = selected().map((key) => SUGGESTIONS[key]).filter(Boolean);
      list.replaceChildren(...picks.map(createSuggestion));
      empty.hidden = picks.length > 0;
    };

    form.addEventListener('change', render);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const guide = $('#guide-form');
      if (!guide) return;
      guide.elements.situation.value = selected().join(',');
      $('#guide').scrollIntoView();
      guide.elements.first_name.focus({ preventScroll: true });
    });
    render();
  }

  /* ---------- Lead forms (quiz, next step, guide, footer) ---------- */
  // TODO: send to the real endpoint (e.g. GHL webhook) — POST `payload` as JSON and throw on a non-OK response.
  async function submitLead(payload) {
    console.info('[lead]', payload);
  }

  function fieldLabel(input) {
    const label = input.labels?.[0]?.textContent.replace(/\(optional\)/i, '').trim();
    return (label || input.name).toLowerCase();
  }

  function errorMessage(input) {
    if (input.validity.valueMissing) return `Please enter your ${fieldLabel(input)}.`;
    if (input.validity.typeMismatch) return 'Please enter a valid email address.';
    return input.validationMessage;
  }

  function showError(input) {
    const field = input.closest('.field');
    let msg = $('.field__error', field);
    if (!msg) {
      msg = createEl('p', { className: 'field__error', id: `${input.id}-error` });
      field.append(msg);
      input.setAttribute('aria-describedby', msg.id);
    }
    msg.textContent = errorMessage(input);
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError(input) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    input.closest('.field')?.querySelector('.field__error')?.remove();
  }

  // The success message is the element right after the form
  function showSuccess(form) {
    form.hidden = true;
    const success = form.nextElementSibling;
    if (!success?.classList.contains('form-success')) return;
    success.hidden = false;
    success.tabIndex = -1;
    success.focus();
  }

  function initLeadForm(form) {
    const inputs = $$('.field__input', form);
    inputs.forEach((input) => input.addEventListener('input', () => {
      if (input.checkValidity()) clearError(input);
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const invalid = inputs.filter((input) => !input.checkValidity());
      inputs.forEach(clearError);
      invalid.forEach(showError);
      if (invalid.length) {
        invalid[0].focus();
        return;
      }

      const button = $('[type="submit"]', form);
      button.disabled = true;
      try {
        await submitLead({ source: form.dataset.leadForm, ...Object.fromEntries(new FormData(form)) });
        showSuccess(form);
      } catch (err) {
        console.error(err);
        button.disabled = false;
      }
    });
  }

  function initLeadForms() {
    $$('[data-lead-form]').forEach(initLeadForm);
  }

  /* ---------- Accessible tabs (shared) ---------- */
  function initTablist(tablist, onSelect) {
    const tabs = $$('[role="tab"]', tablist);

    const select = (tab, focus = false) => {
      tabs.forEach((t) => {
        const isSelected = t === tab;
        t.setAttribute('aria-selected', String(isSelected));
        t.tabIndex = isSelected ? 0 : -1;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      onSelect(tab, tabs);
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const targets = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in targets)) return;
        e.preventDefault();
        select(tabs[(targets[e.key] + tabs.length) % tabs.length], true);
      });
    });
  }

  /* ---------- Knowledge base: filter + scroll arrows ---------- */
  function initKnowledgeBase() {
    const tablist = $('#kb-tabs');
    if (!tablist) return;
    const cards = $$('.kb-card');
    const empty = $('#kb-empty');

    initTablist(tablist, (tab) => {
      const filter = tab.dataset.filter;
      let shown = 0;
      cards.forEach((card) => {
        const match = filter === 'all' || card.dataset.topics.split(' ').includes(filter);
        card.hidden = !match;
        if (match) shown += 1;
      });
      if (empty) empty.hidden = shown > 0;
      refreshReadMore();
    });

    initTabScroll(tablist, $('#kb-tabs-prev'), $('#kb-tabs-next'));
  }

  function initTabScroll(tablist, prev, next) {
    if (!prev || !next) return;

    const updateArrows = () => {
      const overflow = tablist.scrollWidth > tablist.clientWidth + 1;
      const atStart = tablist.scrollLeft <= 1;
      const atEnd = tablist.scrollLeft + tablist.clientWidth >= tablist.scrollWidth - 1;
      next.hidden = !overflow;
      next.disabled = atEnd;
      prev.hidden = !overflow || atStart;
    };
    const scrollTabs = (direction) => {
      tablist.scrollBy({ left: direction * tablist.clientWidth * 0.6, behavior: 'smooth' });
    };

    next.addEventListener('click', () => scrollTabs(1));
    prev.addEventListener('click', () => scrollTabs(-1));
    tablist.addEventListener('scroll', updateArrows, { passive: true });
    new ResizeObserver(updateArrows).observe(tablist);
  }

  /* ---------- Read more (expands clamped text in place) ---------- */
  const readMoreTarget = (btn) => document.getElementById(btn.dataset.readmore);

  // Hide "Read more" where the text already fits; skips expanded and hidden (filtered-out) targets
  function refreshReadMore() {
    $$('[data-readmore]').forEach((btn) => {
      const target = readMoreTarget(btn);
      if (!target || target.classList.contains('is-expanded') || !target.offsetParent) return;
      btn.hidden = target.scrollHeight <= target.clientHeight + 1;
    });
  }

  function initReadMore() {
    $$('[data-readmore]').forEach((btn) => {
      const target = readMoreTarget(btn);
      if (!target) return;
      btn.addEventListener('click', () => {
        const expanded = target.classList.toggle('is-expanded');
        btn.setAttribute('aria-expanded', String(expanded));
        btn.firstElementChild.textContent = expanded ? 'Show less' : 'Read more';
        btn.lastElementChild.textContent = expanded ? '↑' : '↓';
      });
    });

    refreshReadMore();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refreshReadMore, RESIZE_DEBOUNCE_MS);
    });
    document.fonts?.ready.then(refreshReadMore);
  }

  /* ---------- FAQ tabs ---------- */
  function initFaq() {
    const tablist = $('#faq-tabs');
    if (!tablist) return;
    initTablist(tablist, (selected, tabs) => {
      tabs.forEach((tab) => {
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = tab !== selected;
      });
    });
  }

  /* ---------- Policy dialog ---------- */
  // TODO: replace with the client's real policy copy.
  const POLICIES = {};

  function initPolicies() {
    const dialog = $('#policy-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    $$('[data-policy]').forEach((btn) => btn.addEventListener('click', () => {
      const name = btn.dataset.policy;
      $('#policy-title').textContent = name;
      $('#policy-body').textContent = POLICIES[name] || `${name} content coming soon.`;
      dialog.showModal();
    }));
    // Close when clicking the backdrop
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  /* ---------- Images not yet exported from Figma ---------- */
  function initImageFallbacks() {
    $$('img').forEach((img) => {
      const markMissing = () => img.classList.add('is-missing');
      if (img.complete && img.naturalWidth === 0) markMissing();
      else img.addEventListener('error', markMissing, { once: true });
    });
  }

  /* ---------- Hero stats: count up from 0 ---------- */
  function initStatCounters() {
    const stats = $('.hero__stats');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!stats || reduceMotion || !('IntersectionObserver' in window)) return;

    const DURATION_MS = 1600;
    const format = new Intl.NumberFormat('en-US');
    const easeOut = (t) => 1 - (1 - t) ** 3;

    // Split "$320M" / "5,734+" into prefix, number, suffix; skip anything without a number
    const counters = $$('strong', stats).map((el) => {
      const match = el.textContent.trim().match(/^(\D*)([\d,]+)(.*)$/);
      if (!match) return null;
      const [, prefix, digits, suffix] = match;
      return { el, prefix, suffix, target: Number(digits.replace(/,/g, '')) };
    }).filter(Boolean);
    if (!counters.length) return;

    const render = (progress) => counters.forEach(({ el, prefix, suffix, target }) => {
      el.textContent = `${prefix}${format.format(Math.round(target * progress))}${suffix}`;
    });

    const run = () => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / DURATION_MS, 1);
        render(easeOut(t));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      run();
    }, { threshold: 0.5 });

    // Lock each number's width to its final value (in the loaded webfont) so labels don't shift while counting
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      counters.forEach(({ el }) => {
        el.style.minWidth = `${el.getBoundingClientRect().width}px`;
      });
      render(0);
      observer.observe(stats);
    });
  }

  function initFooterYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  initHeader();
  initQuiz();
  initSituation();
  initLeadForms();
  initKnowledgeBase();
  initReadMore();
  initFaq();
  initPolicies();
  initImageFallbacks();
  initStatCounters();
  initFooterYear();
})();
