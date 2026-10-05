(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const createEl = (tag, props = {}, children = []) => {
    const el = Object.assign(document.createElement(tag), props);
    el.append(...children);
    return el;
  };

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior = () => (prefersReducedMotion() ? 'auto' : 'smooth');

  // Position of a horizontally scrollable element: does it overflow, and is it at either end?
  const scrollEdges = (el) => ({
    overflow: el.scrollWidth > el.clientWidth + 1,
    atStart: el.scrollLeft <= 1,
    atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
  });

  const HEADER_SOLID_OFFSET = 40; // px scrolled before the header gets its solid background
  const DESKTOP_NAV_QUERY = '(min-width: 901px)'; // keep in sync with the 900px nav breakpoint in styles.css
  const RESIZE_DEBOUNCE_MS = 150;
  const CAROUSEL_MAX_DOTS = 10; // beyond this, dots are noise; a "3 / 59" counter replaces them
  const SCROLL_SETTLE_MS = 120; // scroll counts as finished after this long without a scroll event

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

  /* ---------- Hero growth calculator ---------- */
  // Future value of a monthly contribution, compounded monthly, deposited at the end of each month
  function futureValue(monthly, years, annualRatePct) {
    const months = years * 12;
    const monthlyRate = annualRatePct / 100 / 12;
    if (monthlyRate === 0) return monthly * months;
    return monthly * ((1 + monthlyRate) ** months - 1) / monthlyRate;
  }

  function initGrowthCalc() {
    const form = $('#growth-calc');
    if (!form) return;
    const { monthly, years, rate } = form.elements;
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    const render = () => {
      const m = Number(monthly.value);
      const y = Number(years.value);
      const r = Number(rate.value);
      $('#calc-monthly-out').textContent = `${usd.format(m)}/mo`;
      $('#calc-years-out').textContent = `${y} ${y === 1 ? 'year' : 'years'}`;
      $('#calc-rate-out').textContent = `${r.toFixed(1)}%`;
      $('#calc-balance').textContent = usd.format(futureValue(m, y, r));
      $('#calc-contributed').textContent = usd.format(m * y * 12);
    };

    form.addEventListener('input', render);
    form.addEventListener('submit', (e) => e.preventDefault());
    render();
  }

  /* ---------- Situation checker ---------- */
  const SUGGESTIONS = {
    rollover: { title: 'Map the rollover path', text: 'Custodian → dealer → depository before funds move.', href: '#kb-rollover', link: 'How IRA money moves into gold ↓' },
    // The three below are written from the page's own copy; confirm wording with the client.
    fees: { title: 'Get the full fee stack', text: 'Setup, annual, storage, and metal premiums. Ask for all of it in writing.', href: '#compare', link: 'How we compare companies ↓' },
    shortlist: { title: 'Compare on the same five points', text: 'Fees, spreads, buyback, minimums, and storage, not signup bonuses.', href: '#compare', link: 'See the criteria ↓' },
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

  /* ---------- Lead forms (next step, guide, footer) ---------- */
  // TODO: send to the real endpoint (e.g. GHL webhook): POST `payload` as JSON and throw on a non-OK response.
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
      const { overflow, atStart, atEnd } = scrollEdges(tablist);
      next.hidden = !overflow;
      next.disabled = atEnd;
      prev.hidden = !overflow || atStart;
    };
    const scrollTabs = (direction) => {
      tablist.scrollBy({ left: direction * tablist.clientWidth * 0.6, behavior: scrollBehavior() });
    };

    next.addEventListener('click', () => scrollTabs(1));
    prev.addEventListener('click', () => scrollTabs(-1));
    tablist.addEventListener('scroll', updateArrows, { passive: true });
    new ResizeObserver(updateArrows).observe(tablist);
  }

  /* ---------- Reviews: rating summary, category filter, carousel ---------- */
  // One card per review in REVIEWS (js/reviews.js), cloned from <template id="review-template">.
  // Text goes in via textContent only, so review copy can never inject markup.
  function renderReviewCards(track, template, reviews) {
    const cards = reviews.map((review) => {
      const card = template.content.firstElementChild.cloneNode(true);
      const rating = Math.min(Math.max(Math.round(Number(review.rating)) || 0, 0), 5);
      card.dataset.category = review.category;
      card.dataset.rating = rating;
      const stars = $('.review__stars', card);
      stars.setAttribute('aria-label', `${rating} out of 5 stars`);
      $$('.icon', stars).forEach((star, i) => star.classList.toggle('is-empty', i >= rating));
      $('.review__title', card).textContent = review.title;
      $('.review__quote p', card).textContent = review.text;
      $('.review__avatar', card).textContent = review.author.trim().charAt(0);
      $('.review__name', card).textContent = review.author;
      $('.review__meta', card).textContent = [review.location, review.age && `Age ${review.age}`].filter(Boolean).join(' · ');
      return card;
    });
    track.replaceChildren(...cards);
    return cards;
  }

  // Average and count come from the cards' data-rating, so the summary always matches what's published
  function renderRatingSummary(items) {
    const average = $('#reviews-average');
    const total = $('#reviews-total');
    const ratings = items
      .map((item) => Number(item.dataset.rating))
      .filter((rating) => rating >= 1 && rating <= 5);
    if (!average || !total || !ratings.length) return;

    const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    average.textContent = `${mean.toFixed(1)} out of 5`;
    total.textContent = ratings.length;
  }

  // Scroll-snap carousel: arrows step a page, dots jump to a page (or a "3 / 59" counter when there are
  // too many pages for dots). Returns { reset } for re-layout after filtering.
  function initCarousel(track, prev, next, dotsEl, counterEl) {
    if (!prev || !next || !dotsEl) return null;
    let dots = [];

    const slides = () => [...track.children].filter((slide) => !slide.hidden);
    const perView = () => {
      const first = slides()[0];
      return first ? Math.max(1, Math.floor((track.clientWidth + 1) / first.offsetWidth)) : 1;
    };
    const pageCount = () => Math.ceil(slides().length / perView());

    const currentPage = () => {
      const visible = slides();
      if (!visible.length) return 0;
      if (scrollEdges(track).atEnd) return pageCount() - 1;
      const origin = visible[0].offsetLeft;
      const index = visible.findIndex((slide) => slide.offsetLeft - origin >= track.scrollLeft - 2);
      return Math.floor(Math.max(index, 0) / perView());
    };

    const goTo = (page) => {
      const visible = slides();
      const target = visible[Math.min(Math.max(page, 0), pageCount() - 1) * perView()];
      if (!target) return;
      track.scrollTo({ left: target.offsetLeft - visible[0].offsetLeft, behavior: scrollBehavior() });
    };

    const updateArrows = () => {
      const { overflow, atStart, atEnd } = scrollEdges(track);
      prev.disabled = !overflow || atStart;
      // snap points can stop just short of the pixel end, so also check the page index
      next.disabled = !overflow || atEnd || currentPage() >= pageCount() - 1;
    };
    // Page indicators change layout; with mandatory scroll-snap, a layout change mid-scroll makes the
    // browser re-snap and cancels smooth scrolling, so these only update once scrolling has settled.
    const updatePage = () => {
      const current = currentPage();
      dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
      const label = `${current + 1} / ${dots.length}`;
      if (counterEl && counterEl.textContent !== label) counterEl.textContent = label;
    };
    const update = () => {
      updateArrows();
      updatePage();
    };
    let settleTimer;
    const onScroll = () => {
      updateArrows();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(updatePage, SCROLL_SETTLE_MS);
    };

    const renderDots = (force = false) => {
      const count = pageCount();
      if (!force && count === dots.length) {
        update();
        return;
      }
      dots = Array.from({ length: count }, (_, i) => {
        const dot = createEl('button', { type: 'button', className: 'carousel__dot' });
        dot.setAttribute('aria-label', `Page ${i + 1} of ${count}`);
        dot.addEventListener('click', () => goTo(i));
        return dot;
      });
      dotsEl.replaceChildren(...dots);
      dotsEl.hidden = count <= 1 || count > CAROUSEL_MAX_DOTS;
      if (counterEl) counterEl.hidden = count <= CAROUSEL_MAX_DOTS;
      update();
    };

    prev.addEventListener('click', () => goTo(currentPage() - 1));
    next.addEventListener('click', () => goTo(currentPage() + 1));
    track.addEventListener('scroll', onScroll, { passive: true });
    new ResizeObserver(() => renderDots()).observe(track);
    renderDots(true);

    return {
      reset() {
        track.scrollTo({ left: 0 });
        renderDots(true);
      }
    };
  }

  function initReviews() {
    const track = $('#reviews-track');
    const template = $('#review-template');
    const reviews = typeof REVIEWS === 'undefined' ? [] : REVIEWS;
    if (!track || !template || !reviews.length) return;
    const items = renderReviewCards(track, template, reviews);
    const chips = $$('.review-filter [data-filter]');
    const status = $('#reviews-status');

    renderRatingSummary(items);
    const carousel = initCarousel(track, $('#reviews-prev'), $('#reviews-next'), $('#reviews-dots'), $('#reviews-counter'));

    const matches = (item, filter) => filter === 'all' || item.dataset.category === filter;

    const applyFilter = (active) => {
      const filter = active.dataset.filter;
      chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip === active)));
      let shown = 0;
      items.forEach((item) => {
        item.hidden = !matches(item, filter);
        if (!item.hidden) shown += 1;
      });
      if (status) status.textContent = `Showing ${shown} of ${items.length} reviews`;
      carousel?.reset();
    };

    chips.forEach((chip) => {
      const count = items.filter((item) => matches(item, chip.dataset.filter)).length;
      chip.append(` (${count})`);
      chip.disabled = count === 0;
      chip.addEventListener('click', () => applyFilter(chip));
    });
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
    const tablists = $$('.faq [role="tablist"]');
    if (!tablists.length) return;
    tablists.forEach((tablist) => initTablist(tablist, (selected, tabs) => {
      tabs.forEach((tab) => {
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = tab !== selected;
      });
    }));

    // Links to a tab panel or a question (nav, footer, a shared #hash URL) open its tab and expand its accordion
    const revealTarget = (hash) => {
      const target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
      if (!target) return null;
      const panel = target.closest('[role="tabpanel"]');
      const accordion = target.closest('details');
      const needsTab = Boolean(panel?.hidden);
      const needsOpen = Boolean(accordion && !accordion.open);
      if (!needsTab && !needsOpen) return null;
      if (needsTab) $(`[role="tab"][aria-controls="${panel.id}"]`)?.click();
      if (needsOpen) accordion.open = true;
      return target;
    };
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (link) revealTarget(link.getAttribute('href'));  // the link's own navigation then scrolls to it
    });
    window.addEventListener('hashchange', () => revealTarget(location.hash)?.scrollIntoView());
    // Arriving on a #hash URL: jump (not glide) once layout has settled, as the browser would for a visible target
    const onArrival = () => revealTarget(location.hash)?.scrollIntoView({ behavior: 'instant' });
    if (document.readyState === 'complete') onArrival();
    else window.addEventListener('load', onArrival, { once: true });
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
    if (!stats || prefersReducedMotion() || !('IntersectionObserver' in window)) return;

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

  // Hero stat tooltips: hover and focus are pure CSS; tap toggles aria-expanded, Esc or an outside tap closes
  function initStatTips() {
    const buttons = $$('.stat-tip__btn');
    if (!buttons.length) return;

    const closeAll = (except) => buttons.forEach((btn) => {
      if (btn !== except) btn.setAttribute('aria-expanded', 'false');
    });

    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      closeAll(btn);
      btn.closest('.stat-tip').classList.remove('is-dismissed');
      btn.setAttribute('aria-expanded', String(open));
    }));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.stat-tip')) closeAll();
    });
    // Esc also hides a tip held open by hover or focus, until the pointer or focus leaves it
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeAll();
      $$('.stat-tip').forEach((tip) => tip.classList.add('is-dismissed'));
    });
    $$('.stat-tip').forEach((tip) => {
      const reset = () => tip.classList.remove('is-dismissed');
      tip.addEventListener('mouseleave', reset);
      tip.addEventListener('focusout', reset);
    });
  }

  function initFooterYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  initHeader();
  initGrowthCalc();
  initSituation();
  initReviews();
  initLeadForms();
  initKnowledgeBase();
  initReadMore();
  initFaq();
  initPolicies();
  initImageFallbacks();
  initStatCounters();
  initStatTips();
  initFooterYear();
})();
