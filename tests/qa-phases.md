## Phase reports

### Phase 0: test harness and the first baseline

- **Tested:** every route at 390×844 and 1280×720 in Chromium (layout and axe).
- **Found:** 99 failing checks. 217 tap-spacing and 127 tap-target misses, 24 colour-contrast, 11 text spilling, 10 invalid ARIA, 7 scroll areas not reachable by keyboard, 2 malformed lists.
- **Fixed:**
  - **Touch:** 44px targets and 8px spacing everywhere. Touch sizing now follows the input device (`pointer-coarse:`), not screen width, so tablets get it too.
  - **Contrast:** product covers pick a readable text colour automatically, and the admin sidebar labels were too faint.
  - **ARIA:** filter tabs without panels became a proper segmented control, and a breadcrumb item was misplaced.
  - **Scrolling:** overflowing scroll areas became focusable, labelled regions.
  - **Layout:** the highlights strip wraps with auto-fit, and the page editor's title field shrank to 43px on phones.
  - **Errors:** a hydration error in the countdown timer (fixed with a shared clock).
- **Also added:** a rem type scale with fluid headings, Noto Sans for Hindi, Tamil, Telugu and Kannada, zero-total checkout ("Get it now") and a fixed Pay bar on phones.

### Phase 4A: global search

- **Tested:** search API unit tests (patterns, masking, scopes, filters, reveal and audit, quick actions); the palette flow in four browser/size combinations.
- **Found:**
  - The palette lost its side gutter at exactly 640px.
  - Content in the grid dialog could widen it.
  - Buttons inside listbox options would be inaccessible, so actions moved to a bar opened with Ctrl+Enter.
  - The platform order list only showed one store, so search links from other stores led nowhere.
- **Fixed:** all of the above.

### Phase 4B: deal paths

- **Tested:** 36 engine unit tests (every rule type, stacking, floors, gifts once per order, offers, determinism); the buyer and creator flows in four combinations.
- **Found:**
  - Pick-a-gift rules never appeared as offers, because a gift saves nothing until it's chosen.
  - Rule chips named in-cart products as "a product".
  - The seeded gifts were expensive.
  - Gift options squeezed into two narrow columns.
  - On phones the Pay bar grew by one line when savings appeared.
- **Fixed:** the engine values a gift that an addition would unlock at its best option. The others were fixed directly.

### Phase 4C: visual page editor

- **Tested:** schema, rich text, media limits, editor store (undo, coalesced typing, moves, limits) and every template; the editor flow to publish and restore, plus the template and 5 MB limit flow in four combinations.
- **Found:**
  - Templates produced an invalid `product:` link in stores with no products.
  - The deal wizard's switch row was too small to tap.
  - The disabled Publish button said "Publish changes" when nothing had changed.
- **Fixed:** all of the above.

### Phase 5: stress data and the full matrix

- **Tested:** 25 routes against the stress dataset in six browser/size combinations, plus the slow, failing and empty states.
- **Found 69 failing checks:**
  - Long unbroken titles, emails and coupon codes widened pages; on mobile Chrome that pushed the fixed Pay bar under the content.
  - Stat values and quick-action tiles overflowed at 320px.
  - 5,000 reviews rendered at once and timed out.
  - Tablet touch targets were too small: table links, list rows, back links, the currency picker and store search.
- **Fixed:**
  - A zero-specificity wrap-anywhere rule for creator-entered text.
  - Coupon and email cells wrap.
  - Reviews page 10 or 20 at a time.
  - Pointer-based sizing for small selects, and table-cell links get full touch targets on touch screens.
- **Helper fixes:** the layout checker now skips elements scrolled out of view inside a scroll container, and the "under a fixed bar" rule checks horizontal overlap. Both were false alarms, not UI problems.
