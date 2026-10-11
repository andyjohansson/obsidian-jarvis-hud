/*
 * Jarvis HUD FX
 * Claudian rebuilds its session list on every status change, so CSS alone
 * cannot tell a session that just finished from one that finished earlier.
 * This plugin remembers which rows were running and adds the class
 * "jarvis-just-completed" only when a row goes from running to done.
 * The effect itself lives in jarvis-claudian.css. Does not modify Claudian.
 */
const { Plugin } = require("obsidian");

const CLAUDIAN = '[class^="claudian-"], [class*=" claudian-"]';
const ROW =".claudian-history-item[data-conversation-id]";
const DONE_CLASS = "jarvis-just-completed";
const ERROR_INDICATOR = ".claudian-session-status-indicator--error";
// Must match the longest completion animation in jarvis-claudian.css.
const EFFECT_MS = 1100;

module.exports = class JarvisHudFx extends Plugin {
  onload() {
    this.running = new Map(); // conversation id -> was running at last scan
    this.completedAt = new Map(); // conversation id -> time it finished
    this.scheduled = false;

    this.observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.target.closest?.(CLAUDIAN))) this.schedule();
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-running"],
    });
    this.app.workspace.onLayoutReady(() => this.scan());
  }

  onunload() {
    this.observer?.disconnect();
    document.querySelectorAll(`.${DONE_CLASS}`).forEach((el) => el.classList.remove(DONE_CLASS));
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

  scan() {
    const now = performance.now();
    // The same conversation can be listed in several views, so collect
    // state per id before comparing with the previous scan.
    const rows = new Map();
    for (const row of document.querySelectorAll(ROW)) {
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
