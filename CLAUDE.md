# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Gold IRA Blueprint" — single-page marketing/lead-gen landing page built from a Figma design. No build step, no package manager, no tests, not a git repo. Three files: `index.html` (markup + inline SVG icon sprite), `css/styles.css`, `js/main.js` (loaded at end of `<body>`). CSS `url()`s are relative to `css/`, so they use `../images/`.

Run: open `index.html` in a browser, or serve the folder (e.g. `npx serve .` / `python -m http.server`) so relative image paths and `ResizeObserver`/`dialog` behave like production.

## Images

All images live in `images/`, kebab-case, prefixed by the page section they belong to (`hero-*`, `step-*`, `portfolio-*`). When new Figma exports arrive with raw names, rename to this convention. `initImageFallbacks()` adds `.is-missing` to any broken `<img>` so layout holds.

## Code structure

**CSS** (`css/styles.css`) is split into numbered sections that mirror page order (`/* ===== N. Name ===== */`): 1 design tokens (`:root` custom properties from Figma — colors, three font stacks `--font-display`/`--font-body`/`--font-ui`, radii, `--container`, `--gutter`, `--section-y`, `--shell-max`/`--shell-gutter` for header+footer, `--error`, `--hover-warm`), 2 base, 3 shared components, then 4–16 one per page section (header, hero+quiz, what-is, how-it-works+situation check, next-step band, compare, why, protection, knowledge base, guide, FAQ, team, footer+policy dialog). Add new styles to the matching section; use existing tokens rather than raw values. Breakpoints in use: 1100, 1024, 900, 768, 640, 560px (desktop-first `max-width`). Nav collapses to mobile menu at ≤900px (JS matches `min-width: 901px`).

**JS** (`js/main.js`) is one IIFE with `$`/`$$` query helpers and one `initX()` per feature, called at the bottom:
- `initHeader` — solid header after 40px scroll (rAF-throttled), mobile menu toggle swapping sprite `#i-menu`/`#i-close`, Esc closes.
- `initQuiz` — hero readiness quiz driven by the `QUIZ` array (Q1 from Figma; Q2–Q4 are placeholders). On finish, hides `#quiz-form` and reveals `#quiz-lead` with answers JSON in hidden `quiz_answers`.
- `initSituation` — checkbox picks render cards from `SUGGESTIONS` map; submit copies picks into `#guide-form`'s hidden `situation` field and scrolls to `#guide`.
- `initLeadForms` — generic handler for every `form[data-lead-form]` (quiz, next-step, guide, footer). Custom accessible validation (`novalidate` + `checkValidity`, `.field__error` injected with `aria-describedby`/`aria-invalid`); inputs must have class `.field__input` inside a `.field`. On success hides form and focuses the **next sibling** `.form-success`. Network call is isolated in `submitLead(payload)` — currently only `console.info`s; wire the real endpoint (e.g. GHL webhook) there and throw on failure (the handler re-enables the button).
- `initTablist` — shared ARIA tabs (roving tabindex, Arrow/Home/End) used by both knowledge base and FAQ.
- `initKnowledgeBase` — filters `.kb-card` by space-separated `data-topics` against tab `data-filter`; prev/next arrows for the tab strip (prev overlays left edge, shown only once scrolled).
- `initReadMore` / `refreshReadMore` — `[data-readmore="<id>"]` buttons expand line-clamped text; buttons auto-hide when text doesn't overflow. Re-run `refreshReadMore()` after anything that changes visibility/layout.
- `initStatCounters` — hero stats count up from 0 when scrolled into view (parses prefix/number/suffix from each `<strong>`, so edit the numbers in HTML only). Width locked after `document.fonts.ready`; skipped under `prefers-reduced-motion`.
- `initPolicies` — footer `[data-policy]` buttons open the native `<dialog>`; `POLICIES` copy is a TODO.

JS style: every `initX()` returns early if its root elements are missing (one removed section must not break the rest); build DOM with the `createEl(tag, props, children)` helper; name magic numbers as constants at the top. Base resets use `:where()` (zero specificity) so component class rules always override them — keep new resets that way. Conventions: toggle visibility with the `hidden` attribute (CSS forces `[hidden]{display:none!important}`), build dynamic DOM with `textContent` (never interpolate data into `innerHTML`), semantic landmarks with `aria-labelledby` on each section, icons via the inline Lucide SVG sprite (`<use href="#i-...">`).

## Open placeholders (confirm with client before changing)

Quiz Q2–Q4, three of four `SUGGESTIONS` entries, `POLICIES` text, and the lead-form endpoint in `submitLead()`.
