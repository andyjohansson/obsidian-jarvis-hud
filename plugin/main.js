/*
 * Jarvis HUD FX
 * Companion to the Jarvis HUD snippets. Does not modify Claudian.
 *
 * 1. Completion effect. Claudian rebuilds its session list on every status
 *    change, so CSS alone cannot tell a session that just finished from one
 *    that finished earlier. This plugin remembers which rows were running and
 *    adds the class "jarvis-just-completed" only when a row goes from running
 *    to done. The effect itself lives in jarvis-claudian.css.
 *
 * 2. Greetings. Replaces the welcome screen's "Claudian" with "J.A.R.V.I.S."
 *    and its greeting with a Jarvis line picked from the time of day, the day
 *    of the week and the calendar. Secret: clicking "J.A.R.V.I.S." gives a
 *    new line.
 *
 * 3. Reactor. Marks the welcome screen "jarvis-charging" while you type, so
 *    the arc reactor behind it powers up. Claudian hides the welcome screen
 *    at once when you send, so the plugin lays a copy over it, adds the
 *    ignition layers (flash and shockwave) and removes it when the animation
 *    is done. Visual only.
 *
 * 4. Archive effect. On Archive the row hides at once and a copy takes its
 *    place that "closes itself" (jarvis-claudian.css). Claudian rebuilds
 *    the list right after, so the copy is put back where the row was on
 *    every rebuild until the animation is done. The real row stays hidden
 *    through re-renders until Claudian drops it. If Claudian has not dropped
 *    it after ARCHIVE_TIMEOUT_MS, the row comes back, so a failed archive is
 *    never hidden for good.
 */
const { Plugin } = require("obsidian");

const CLAUDIAN = '[class^="claudian-"], [class*=" claudian-"]';
const ROW = ".claudian-history-item[data-conversation-id]";
const DONE_CLASS = "jarvis-just-completed";
const ERROR_INDICATOR = ".claudian-session-status-indicator--error";
// Must cover the longest completion animation in jarvis-claudian.css.
const EFFECT_MS = 1500;

const BRAND = ".claudian-welcome-brand";
const GREETING = ".claudian-welcome-greeting";
const BRAND_TEXT = "J.A.R.V.I.S.";
const REBOOT_CLASS = "jarvis-reboot";

const ARCHIVE_BUTTON = ".claudian-archive-btn";
const RESTORE_BUTTON = ".claudian-restore-btn";
const ARCHIVED_CLASS = "jarvis-archived"; // the real row, hidden
const ARCHIVE_GHOST_CLASS = "jarvis-archive-ghost"; // the copy that animates
// Must cover the archive animation in jarvis-claudian.css.
const ARCHIVE_OUT_MS = 800;
const ARCHIVE_TIMEOUT_MS = 20000;

const WELCOME = ".claudian-welcome";
const MESSAGES_WRAPPER = ".claudian-messages-wrapper";
const CONTAINER = ".claudian-container";
const ACTIVE_WELCOME = ".claudian-tab-content:not(.claudian-hidden) .claudian-welcome";
const INPUT = ".claudian-input";
const HIDDEN_CLASS = "claudian-hidden";
const CHARGING_CLASS = "jarvis-charging";
const EXIT_CLASS = "jarvis-welcome-exit";
// Must cover the longest exit animation in jarvis-claudian.css.
const EXIT_MS = 950;

// ---------- Greetings ----------
// {time} is replaced with the current time, e.g. 01:42.

const GENERAL = [
  "Online and ready, sir. Try not to break anything today.",
  "Welcome back, sir. Everything is exactly where you left it, unfortunately.",
  "All systems nominal. Your to-do list, however, is not.",
  "I've run the numbers, sir. You should probably start.",
  "Ready when you are. I've been ready for some time, actually.",
  "Shall we make something brilliant today, or just something on time?",
  "Your vault is indexed, your notes are waiting, and I am, as ever, delighted.",
  "Good to see you, sir. The backlog missed you more than I did.",
  "Another day, another opportunity to overengineer something.",
  "I've prepared a list of excuses, should we need them.",
  "Diagnostics complete. The weakest component remains the coffee supply.",
  "Standing by, sir. Do try to phrase it as a question this time.",
  "At your service. Within reason, and occasionally beyond it.",
  "I took the liberty of not touching anything. You're welcome.",
  "Power at one hundred percent. Patience at roughly eighty.",
  "Shall I pretend this is the last change today, sir?",
  "Systems online. Sarcasm module fully calibrated.",
  "Ah, sir. I was just tidying up your markdown.",
  "What are we building today? Please say it's not another meeting note.",
  "Ready to assist, sir. My schedule is remarkably open.",
];

// [first hour, last hour, lines]
const TIME_OF_DAY = [
  [0, 4, [
    "Working past midnight again, sir. I'll alert the authorities.",
    "It's {time}, sir. Even the servers are asleep.",
    "Burning the midnight oil? I'd recommend a smaller fire.",
    "Shall I dim the lights, or are we pretending this is productive?",
    "Night shift it is. I'll leave a note for your future, very tired self.",
  ]],
  [5, 7, [
    "Up before the sun, sir. Either ambitious or something has gone terribly wrong.",
    "An early start. I've taken the liberty of not judging you.",
    "Good morning, sir. The coffee machine and I are both still warming up.",
  ]],
  [8, 10, [
    "Good morning, sir. Shall we get the hard thing done first?",
    "Morning, sir. Your calendar looks optimistic again.",
    "A fresh morning, a clean slate, and only slightly fewer unread messages.",
  ]],
  [11, 12, [
    "Nearly lunch, sir. I recommend food over another quick fix.",
    "Midday report: halfway through the day, roughly a third through the plan.",
  ]],
  [13, 16, [
    "Good afternoon, sir. The post-lunch slump has been noted and logged.",
    "Afternoon, sir. Plenty of daylight left for scope creep.",
    "Still going strong, sir. Well, still going.",
  ]],
  [17, 21, [
    "Good evening, sir. Shall we finish something, or start something new and regret it?",
    "Evening, sir. Most sensible people have logged off. I admire the commitment.",
    "The day is winding down. Your ideas, apparently, are not.",
  ]],
  [22, 23, [
    "It's getting late, sir. One more thing, I presume?",
    "It's {time} and all is well. Mostly.",
  ]],
];

// Index 0 is Sunday, like Date.getDay().
const WEEKDAY = [
  [
    "Sunday, sir. Even Mr. Stark took the occasional day off. Occasionally.",
    "A quiet Sunday. Perfect for planning a week you'll ignore by Tuesday.",
  ],
  [
    "Monday, sir. I've taken the liberty of lowering expectations.",
    "A new week. The backlog has been breeding over the weekend.",
    "Monday. Shall I fetch the motivational posters?",
  ],
  ["Tuesday, sir. Monday's sequel, with better production values."],
  ["Wednesday. Halfway there, as they say. Whoever they are."],
  ["Thursday, sir. Close enough to Friday to start making promises."],
  [
    "Friday, sir. A splendid day to deploy nothing at all.",
    "That Friday feeling. I'll be monitoring it closely.",
    "Friday. Shall I start the weekly report, or will you be heroically last minute again?",
  ],
  ["Working on a Saturday, sir? I'll keep it between us."],
];

// Calendar events. Each test gets the date and returns true on the day(s).
const EVENTS = [
  [(d) => is(d, 1, 1), [
    "Happy New Year, sir. I've archived last year's resolutions for safekeeping.",
    "A brand new year. Same vault, same ambition, slightly more snow.",
  ]],
  [(d) => is(d, 2, 14), [
    "Happy Valentine's Day, sir. Your notes have never felt so loved.",
    "Valentine's Day. I've prepared nothing, as instructed by nobody.",
  ]],
  [(d) => is(d, 2, 29), ["Leap day, sir. An entire bonus day. Please don't spend it on email."]],
  [(d) => sameDay(d, addDays(easter(d.getFullYear()), -47)), [
    "Fettisdagen, sir. I'm told the semla is mandatory. I won't argue.",
  ]],
  [(d) => is(d, 3, 14), ["Happy Pi Day, sir. 3.14159 reasons to take a break."]],
  [(d) => is(d, 4, 1), [
    "April Fools' Day, sir. I've deleted your vault. Just kidding. Probably.",
    "Today, sir, I'd double check anything I say.",
  ]],
  [(d) => between(d, addDays(easter(d.getFullYear()), -2), addDays(easter(d.getFullYear()), 1)), [
    "Happy Easter, sir. I've hidden the eggs in your backlog.",
    "Easter, sir. Statistically the best weekend for chocolate and poor decisions.",
  ]],
  [(d) => is(d, 5, 4), ["May the Fourth be with you, sir. Wrong franchise, but I'll allow it."]],
  [(d) => is(d, 5, 29), ["Mr. Stark's birthday, sir. Some suits deserve a little cake."]],
  [(d) => d.getMonth() === 5 && d.getDay() === 5 && d.getDate() >= 19 && d.getDate() <= 25, [
    "Midsommar, sir. Herring, schnapps and frog dances. I'll hold down the fort.",
    "Happy midsommar, sir. Close the laptop. The maypole won't raise itself.",
  ]],
  [(d) => dayOfYear(d) === 256, ["Happy Programmer's Day, sir. Day 256, a nicely round number."]],
  [(d) => is(d, 10, 4), ["Kanelbullens dag, sir. I've calculated the optimal number of buns. It's one more."]],
  [(d) => d.getDay() === 5 && d.getDate() === 13, ["Friday the 13th, sir. I'd avoid force pushing today."]],
  [(d) => d.getMonth() === 9 && d.getDate() >= 24 && d.getDate() <= 30, [
    "Halloween approaches, sir. The scariest thing here is still your inbox.",
  ]],
  [(d) => is(d, 10, 31), [
    "Happy Halloween, sir. I'm dressed as a slightly more cheerful AI.",
    "Trick or treat, sir. I'd go with treat. The trick is your backlog.",
  ]],
  [(d) => d.getMonth() === 11 && d.getDate() <= 12, [
    "Advent season, sir. One door a day, one task a day. Ambitious, I know.",
  ]],
  [(d) => is(d, 12, 13), ["Happy Lucia, sir. Saffron buns detected in the vicinity."]],
  [(d) => d.getMonth() === 11 && d.getDate() >= 14 && d.getDate() <= 23, [
    "Christmas is almost here, sir. Shall I start a list? Checking it twice is optional.",
  ]],
  [(d) => is(d, 12, 24), [
    "God jul, sir. Kalle Anka at three. I've cleared your schedule.",
    "Christmas Eve, sir. Close the laptop. That's an order, politely phrased.",
  ]],
  [(d) => is(d, 12, 25) || is(d, 12, 26), [
    "Merry Christmas, sir. The only thing that should be running today is the oven.",
  ]],
  [(d) => d.getMonth() === 11 && d.getDate() >= 27 && d.getDate() <= 30, [
    "The quiet days between the holidays, sir. Ideal for the projects you swore you'd finish.",
  ]],
  [(d) => is(d, 12, 31), [
    "New Year's Eve, sir. Shall I prepare a summary of the year, or would you rather not know?",
  ]],
];

// How often each kind of line is picked when it applies.
const WEIGHTS = { event: 6, timeOfDay: 2, weekday: 1, general: 2 };

function is(d, month, day) {
  return d.getMonth() === month - 1 && d.getDate() === day;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d, days) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function between(d, from, to) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return day >= from && day <= to;
}

function dayOfYear(d) {
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 864e5);
}

// Easter Sunday, Gregorian calendar (anonymous algorithm).
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Picks a kind of line by weight, then a line within it, avoiding the last one shown.
function pickGreeting(now, last) {
  const hour = now.getHours();
  const pools = [
    [WEIGHTS.event, EVENTS.filter(([test]) => test(now)).flatMap(([, lines]) => lines)],
    [WEIGHTS.timeOfDay, TIME_OF_DAY.find(([from, to]) => hour >= from && hour <= to)[2]],
    [WEIGHTS.weekday, WEEKDAY[now.getDay()]],
    [WEIGHTS.general, GENERAL],
  ].filter(([, lines]) => lines.length > 0);

  let roll = Math.random() * pools.reduce((sum, [weight]) => sum + weight, 0);
  let lines = pools[pools.length - 1][1];
  for (const [weight, pool] of pools) {
    if ((roll -= weight) < 0) {
      lines = pool;
      break;
    }
  }
  const fresh = lines.filter((line) => line !== last);
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return pick(fresh.length > 0 ? fresh : lines).replace("{time}", time);
}

// Extra layers for the ignition: a core flash and a shockwave.
function burst(doc) {
  const el = doc.createElement("div");
  el.className = "jarvis-burst";
  for (const name of ["flash", "wave"]) {
    const layer = doc.createElement("div");
    layer.className = `jarvis-burst-${name}`;
    el.appendChild(layer);
  }
  return el;
}

// Claudian's composer is a CodeMirror editor that shows a placeholder when empty.
function hasText(input) {
  const content = input.querySelector(".cm-content") ?? input;
  if (content.querySelector(".cm-placeholder")) return false;
  return content.textContent.trim().length > 0;
}

module.exports = class JarvisHudFx extends Plugin {
  onload() {
    this.running = new Map(); // conversation id -> was running at last scan
    this.completedAt = new Map(); // conversation id -> time it finished
    this.scheduled = false;
    this.lastGreeting = null;
    this.welcomes = new WeakMap(); // welcome element -> time it was last shown
    this.archiving = new Set(); // conversation ids clicked to archive, not yet gone
    this.ghosts = new Map(); // conversation id -> { el, start, list, prevId, nextId }

    this.welcomeObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const el = m.target;
        const wasHidden = (m.oldValue ?? "").split(" ").includes(HIDDEN_CLASS);
        const isHidden = el.classList.contains(HIDDEN_CLASS);
        if (wasHidden && !isHidden) this.welcomes.set(el, performance.now());
        if (!wasHidden && isHidden) this.launch(el);
      }
    });

    this.observers = new Map(); // document -> its mutation observer
    this.attach(document);
    this.registerEvent(this.app.workspace.on("window-open", (win) => this.attach(win.doc)));
    this.registerEvent(this.app.workspace.on("window-close", (win) => this.detach(win.doc)));
    this.app.workspace.onLayoutReady(() => {
      // Popouts restored with the layout may open before the plugin loads.
      this.app.workspace.iterateAllLeaves((leaf) => this.attach(leaf.view.containerEl.ownerDocument));
      this.greet();
      this.watchWelcomes();
      this.scan();
    });
  }

  onunload() {
    this.welcomeObserver?.disconnect();
    this.all(`.${EXIT_CLASS}`).forEach((el) => el.remove());
    this.all(`.${ARCHIVED_CLASS}`).forEach((el) => el.classList.remove(ARCHIVED_CLASS));
    this.all(`.${ARCHIVE_GHOST_CLASS}`).forEach((el) => el.remove());
    this.all(`.${CHARGING_CLASS}`).forEach((el) => el.classList.remove(CHARGING_CLASS));
    this.all(`.${DONE_CLASS}`).forEach((el) => el.classList.remove(DONE_CLASS));
    for (const doc of [...this.observers.keys()]) this.detach(doc);
  }

  // Popout windows have their own document, so each window gets its own
  // observer and listeners.
  attach(doc) {
    if (this.observers.has(doc)) return;
    const observer = new MutationObserver((mutations) => {
      if (!mutations.some((m) => m.target.closest?.(CLAUDIAN))) return;
      // Swap the welcome text right away, before the next paint, so
      // Claudian's own greeting never flashes on screen.
      this.greet();
      this.watchWelcomes();
      // Hide re-rendered rows before the next paint, so they never flash back.
      this.hideArchiving();
      this.schedule();
    });
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-running"],
    });
    this.registerDomEvent(doc, "click", (event) => {
      const brand = event.target.closest?.(BRAND);
      const greeting = brand?.parentElement?.querySelector(GREETING);
      if (greeting) this.setGreeting(greeting, true);
    });
    // Capture phase, so it runs even if Claudian stops the click on the button.
    this.registerDomEvent(
      doc,
      "click",
      (event) => {
        const row = event.target.closest?.(ARCHIVE_BUTTON)?.closest(ROW);
        // Claudian refuses to archive running sessions, so leave those alone.
        if (!row || row.dataset.running === "true") return;
        const id = row.dataset.conversationId;
        this.archiving.add(id);
        this.addGhost(row);
        row.classList.add(ARCHIVED_CLASS);
        doc.win.setTimeout(() => this.releaseArchiving(id), ARCHIVE_TIMEOUT_MS);
      },
      { capture: true },
    );
    this.registerDomEvent(doc, "input", (event) => {
      const input = event.target.closest?.(INPUT);
      // Claudian moves the active tab's input box into a shared slot, so
      // find the welcome screen through the visible tab instead.
      const welcome = input?.closest(CONTAINER)?.querySelector(ACTIVE_WELCOME);
      welcome?.classList.toggle(CHARGING_CLASS, hasText(input));
    });
    this.observers.set(doc, observer);
  }

  detach(doc) {
    this.observers.get(doc)?.disconnect();
    this.observers.delete(doc);
  }

  // Every element matching the selector, across all open windows.
  all(selector) {
    return [...this.observers.keys()].flatMap((doc) => [...doc.querySelectorAll(selector)]);
  }

  // Batches bursts of mutations into one scan per frame.
  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.scan();
    });
  }

  // Claudian builds a new welcome screen for every new chat. Elements already
  // swapped are skipped, unless Claudian has written its own text back.
  greet() {
    for (const el of this.all(BRAND)) {
      if (el.textContent !== BRAND_TEXT) el.textContent = BRAND_TEXT;
    }
    for (const el of this.all(GREETING)) {
      if (el.dataset.jarvisGreeting && el.textContent === el.dataset.jarvisGreeting) continue;
      this.setGreeting(el, false);
    }
  }

  setGreeting(el, reboot) {
    const line = pickGreeting(new Date(), this.lastGreeting);
    this.lastGreeting = line;
    el.dataset.jarvisGreeting = line;
    el.textContent = line;
    if (!reboot) return;
    // Restart the flicker even on rapid repeat clicks.
    el.classList.remove(REBOOT_CLASS);
    void el.offsetWidth;
    el.classList.add(REBOOT_CLASS);
  }

  // Rows for a session being archived, outside the archived list.
  archivingRows(id) {
    return this.all(ROW).filter(
      (row) => row.dataset.conversationId === id && !row.querySelector(RESTORE_BUTTON),
    );
  }

  // Keeps rows hidden through Claudian's re-renders. Once Claudian has
  // dropped the session from the list, the archive is done.
  hideArchiving() {
    for (const id of this.archiving) {
      const rows = this.archivingRows(id);
      if (rows.length === 0) this.archiving.delete(id);
      for (const row of rows) row.classList.add(ARCHIVED_CLASS);
    }
    this.placeGhosts();
  }

  // A copy of the row, without state classes, that plays the animation.
  addGhost(row) {
    const el = row.cloneNode(true);
    el.classList.remove(DONE_CLASS, "claudian-history-item--attention");
    el.classList.add(ARCHIVE_GHOST_CLASS);
    el.removeAttribute("data-conversation-id");
    el.setAttribute("aria-hidden", "true");
    const rowId = (r) => (r?.matches(ROW) ? r.dataset.conversationId : null);
    const id = row.dataset.conversationId;
    this.ghosts.set(id, {
      el,
      start: performance.now(),
      list: row.parentElement.className,
      prevId: rowId(row.previousElementSibling),
      nextId: rowId(row.nextElementSibling),
    });
    row.after(el);
    window.setTimeout(() => {
      el.remove();
      this.ghosts.delete(id);
    }, ARCHIVE_OUT_MS);
  }

  // Claudian's rebuild throws the copy away, so put it back where the row
  // was: next to the hidden row if it is still there, otherwise between its
  // old neighbours. The animation continues where it was.
  placeGhosts() {
    for (const [id, ghost] of this.ghosts) {
      if (ghost.el.isConnected) continue;
      const find = (rowId) =>
        rowId &&
        this.all(ROW).find(
          (r) => r.dataset.conversationId === rowId && r.parentElement.className === ghost.list,
        );
      ghost.el.style.setProperty("--jarvis-fx-offset", `-${Math.round(performance.now() - ghost.start)}ms`);
      const self = find(id);
      const next = find(ghost.nextId);
      const prev = find(ghost.prevId);
      if (self) self.after(ghost.el);
      else if (next) next.before(ghost.el);
      else if (prev) prev.after(ghost.el);
    }
  }

  // Shows the row again if Claudian never dropped it, for example if the
  // archive failed.
  releaseArchiving(id) {
    if (!this.archiving.delete(id)) return;
    for (const row of this.archivingRows(id)) row.classList.remove(ARCHIVED_CLASS);
  }

  // Notes when each welcome screen appeared, so the exit copy can continue
  // the reactor's rotation instead of jumping back to the start.
  watchWelcomes() {
    for (const el of this.all(WELCOME)) {
      if (this.welcomes.has(el) || el.classList.contains(EXIT_CLASS)) continue;
      this.welcomes.set(el, performance.now());
      this.welcomeObserver.observe(el, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
    }
  }

  // Plays the exit only when the welcome screen goes away while you were
  // typing, so opening an existing chat does not fire the reactor.
  launch(welcome) {
    if (!welcome.classList.contains(CHARGING_CLASS)) return;
    welcome.classList.remove(CHARGING_CLASS);
    const wrapper = welcome.closest(MESSAGES_WRAPPER);
    if (!wrapper) return;
    const ghost = welcome.cloneNode(true);
    ghost.classList.remove(HIDDEN_CLASS);
    ghost.classList.add(EXIT_CLASS);
    ghost.setAttribute("aria-hidden", "true");
    const shown = this.welcomes.get(welcome) ?? performance.now();
    ghost.style.setProperty("--jarvis-fx-offset", `-${Math.round(performance.now() - shown)}ms`);
    ghost.appendChild(burst(wrapper.ownerDocument));
    wrapper.appendChild(ghost);
    window.setTimeout(() => ghost.remove(), EXIT_MS);
  }

  scan() {
    const now = performance.now();
    // The same conversation can be listed in several views, so collect
    // state per id before comparing with the previous scan.
    const rows = new Map();
    for (const row of this.all(ROW)) {
      const id = row.dataset.conversationId;
      if (!rows.has(id)) rows.set(id, []);
      rows.get(id).push(row);
    }

    for (const [id, els] of rows) {
      const isRunning = els.some((el) => el.dataset.running === "true");
      const failed = els.some((el) => el.querySelector(ERROR_INDICATOR));
      if (this.running.get(id) && !isRunning && !failed) this.completedAt.set(id, now);
      this.running.set(id, isRunning);

      const at = this.completedAt.get(id);
      if (at === undefined) continue;
      const elapsed = now - at;
      if (elapsed >= EFFECT_MS) {
        this.completedAt.delete(id);
        continue;
      }
      // A re-render mid-effect gets a fresh row, so continue the animation
      // where it was instead of restarting it.
      for (const el of els) {
        if (el.classList.contains(DONE_CLASS)) continue;
        el.style.setProperty("--jarvis-fx-offset", `-${Math.round(elapsed)}ms`);
        el.classList.add(DONE_CLASS);
        window.setTimeout(() => el.classList.remove(DONE_CLASS), EFFECT_MS - elapsed);
      }
    }
  }
};
