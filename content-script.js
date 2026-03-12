(function () {
  const BAR_ID = "keyword-scorer-analytics-bar";
  const STYLE_ID = "keyword-scorer-analytics-style";
  const SPACER_ID = "keyword-scorer-analytics-spacer";
  const TOP_SHIFT_ATTR = "data-ks-top-shift";
  const TOP_ORIGINAL_ATTR = "data-ks-original-top";
  const DEFAULT_ALLOWED_URL_PATTERNS = [
    "https://www.linkedin.com/jobs/*",
    "https://linkedin.com/jobs/*"
  ];
  let observer = null;
  let debounceTimer = null;
  let lastUrl = location.href;
  let barExpanded = true;

  function isExtensionContextAlive() {
    try {
      return Boolean(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function isContextInvalidationError(errorLike) {
    const message = String(
      (errorLike && errorLike.message) ||
      (errorLike && errorLike.reason && errorLike.reason.message) ||
      errorLike ||
      ""
    );
    return message.includes("Extension context invalidated");
  }

  window.addEventListener("error", (event) => {
    if (isContextInvalidationError(event.error || event.message)) {
      if (observer) {
        observer.disconnect();
      }
      removeBar();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    if (isContextInvalidationError(event.reason)) {
      if (observer) {
        observer.disconnect();
      }
      removeBar();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  function safeDom(action) {
    try {
      action();
    } catch {
      // Ignore teardown errors from stale content-script contexts.
    }
  }

  function isLinkedInJobContext() {
    const href = location.href;
    return href.includes("/jobs/") || href.includes("/job/") || href.includes("currentJobId=") || href.includes("/jobs/search");
  }

  function patternToRegex(pattern) {
    const normalized = String(pattern || "").trim();
    if (!normalized) {
      return null;
    }
    const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    try {
      return new RegExp(`^${escaped}$`, "i");
    } catch {
      return null;
    }
  }

  function matchesAllowedUrl(url, patterns) {
    const list = Array.isArray(patterns) && patterns.length ? patterns : DEFAULT_ALLOWED_URL_PATTERNS;
    return list.some((pattern) => {
      const regex = patternToRegex(pattern);
      return regex ? regex.test(String(url || "")) : false;
    });
  }

  function getAllowedPatterns(callback) {
    if (!isExtensionContextAlive()) {
      callback(DEFAULT_ALLOWED_URL_PATTERNS);
      return;
    }
    chrome.storage.sync.get(["settings"], (result) => {
      if (chrome.runtime.lastError) {
        callback(DEFAULT_ALLOWED_URL_PATTERNS);
        return;
      }
      const patterns = result && result.settings && Array.isArray(result.settings.allowedUrlPatterns)
        ? result.settings.allowedUrlPatterns
        : DEFAULT_ALLOWED_URL_PATTERNS;
      callback(patterns);
    });
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BAR_ID} {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2147483646;
        background: linear-gradient(90deg, #0b1220, #0d2940 45%, #0f4b61);
        color: #f5f8fb;
        font-family: "Segoe UI", Tahoma, sans-serif;
        border-bottom: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      }
      #${BAR_ID}.collapsed .ks-content {
        display: none;
      }
      #${BAR_ID} .ks-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 14px;
      }
      #${BAR_ID} .ks-title {
        font-weight: 700;
        letter-spacing: 0.4px;
        font-size: 13px;
      }
      #${BAR_ID} .ks-statline {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
      }
      #${BAR_ID} .ks-chip {
        background: rgba(255,255,255,0.14);
        padding: 3px 8px;
        border-radius: 999px;
      }
      #${BAR_ID} .ks-progress {
        width: 140px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.16);
        overflow: hidden;
      }
      #${BAR_ID} .ks-progress > span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #29c36a, #5ee3a1);
      }
      #${BAR_ID} .ks-btns {
        display: flex;
        gap: 6px;
      }
      #${BAR_ID} button {
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(255,255,255,0.08);
        color: #fff;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
      }
      #${BAR_ID} .ks-content {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        padding: 0 14px 8px;
      }
      #${BAR_ID} .ks-box {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        padding: 6px 8px;
        min-height: 56px;
      }
      #${BAR_ID} .ks-box h4 {
        margin: 0 0 4px;
        font-size: 11px;
        opacity: 0.9;
        text-transform: uppercase;
      }
      #${BAR_ID} .ks-list {
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 11px;
      }
      #${BAR_ID} .ks-list li {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        margin-bottom: 2px;
      }
      @media (max-width: 1000px) {
        #${BAR_ID} .ks-content {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureSpacer() {
    if (!document.body) {
      return null;
    }
    let spacer = document.getElementById(SPACER_ID);
    if (!spacer) {
      spacer = document.createElement("div");
      spacer.id = SPACER_ID;
      spacer.style.width = "100%";
      spacer.style.height = "0px";
      spacer.style.pointerEvents = "none";
      spacer.setAttribute("aria-hidden", "true");
      document.body.insertBefore(spacer, document.body.firstChild);
    }
    return spacer;
  }

  function syncPageOffset() {
    const bar = document.getElementById(BAR_ID);
    const spacer = ensureSpacer();
    if (!bar || !spacer) {
      return;
    }
    const height = Math.max(0, Math.ceil(bar.getBoundingClientRect().height));
    spacer.style.height = `${height}px`;
    shiftTopAnchoredElements(height);
  }

  function shouldShiftElement(el) {
    if (!el || el.id === BAR_ID || el.id === SPACER_ID) {
      return false;
    }
    if (el.closest(`#${BAR_ID}`)) {
      return false;
    }
    const computed = window.getComputedStyle(el);
    if (!(computed.position === "fixed" || computed.position === "sticky")) {
      return false;
    }
    const topValue = parseFloat(computed.top || "0");
    if (!Number.isFinite(topValue)) {
      return false;
    }
    return topValue <= 140;
  }

  function shiftTopAnchoredElements(offset) {
    if (!document.body) {
      return;
    }

    // First, re-apply the new offset to elements we already shifted earlier.
    // This prevents stale large gaps when the analytics bar collapses.
    const alreadyShifted = document.querySelectorAll(`[${TOP_SHIFT_ATTR}='1']`);
    alreadyShifted.forEach((el) => {
      const originalTop = parseFloat(el.getAttribute(TOP_ORIGINAL_ATTR) || "0");
      const nextTop = originalTop + offset;
      el.style.top = `${nextTop}px`;
    });

    const candidates = document.querySelectorAll("header, nav, div, section, aside");
    candidates.forEach((el) => {
      if (!shouldShiftElement(el)) {
        return;
      }

      if (el.getAttribute(TOP_SHIFT_ATTR) === "1") {
        return;
      }

      if (!el.hasAttribute(TOP_ORIGINAL_ATTR)) {
        const currentTop = parseFloat(window.getComputedStyle(el).top || "0");
        el.setAttribute(TOP_ORIGINAL_ATTR, String(Number.isFinite(currentTop) ? currentTop : 0));
      }

      const originalTop = parseFloat(el.getAttribute(TOP_ORIGINAL_ATTR) || "0");
      const shifted = originalTop + offset;
      el.style.top = `${shifted}px`;
      el.setAttribute(TOP_SHIFT_ATTR, "1");
    });
  }

  function restoreShiftedElements() {
    const shifted = document.querySelectorAll(`[${TOP_SHIFT_ATTR}='1']`);
    shifted.forEach((el) => {
      const originalTop = el.getAttribute(TOP_ORIGINAL_ATTR);
      if (originalTop !== null) {
        el.style.top = `${originalTop}px`;
      } else {
        el.style.removeProperty("top");
      }
      el.removeAttribute(TOP_SHIFT_ATTR);
      el.removeAttribute(TOP_ORIGINAL_ATTR);
    });
  }

  function extractJobText() {
    const selectors = [
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".jobs-description-content__text",
      ".jobs-search__job-details--container"
    ];

    const chunks = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        const text = (el.innerText || "").trim();
        if (text) {
          chunks.push(text);
        }
      });
    });

    if (!chunks.length) {
      chunks.push((document.body && document.body.innerText) ? document.body.innerText.slice(0, 20000) : "");
    }

    return chunks.join("\n\n");
  }

  function getJobTitle() {
    const titleEl = document.querySelector("h1") || document.querySelector(".top-card-layout__title");
    const title = titleEl ? titleEl.textContent : document.title;
    return (title || "LinkedIn Job").trim();
  }

  function renderList(items, formatter) {
    if (!Array.isArray(items) || !items.length) {
      return "<li><span>none</span><span>-</span></li>";
    }
    return items.slice(0, 5).map(formatter).join("");
  }

  function ensureBar() {
    ensureStyle();
    let bar = document.getElementById(BAR_ID);
    if (bar) {
      return bar;
    }

    bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.innerHTML = `
      <div class="ks-head">
        <div class="ks-title">Job Match Insights</div>
        <div class="ks-statline" id="ks-statline"></div>
        <div class="ks-btns">
          <button id="ks-rescan">Rescan</button>
          <button id="ks-toggle">Collapse</button>
        </div>
      </div>
      <div class="ks-content">
        <div class="ks-box"><h4>Groups</h4><ul class="ks-list" id="ks-groups"></ul></div>
        <div class="ks-box"><h4>Important Phrases</h4><ul class="ks-list" id="ks-phrases"></ul></div>
        <div class="ks-box"><h4>Suggested Keywords</h4><ul class="ks-list" id="ks-suggestions"></ul></div>
      </div>
    `;

    document.documentElement.appendChild(bar);
    ensureSpacer();
    syncPageOffset();

    bar.querySelector("#ks-rescan").addEventListener("click", () => {
      runScan();
    });
    bar.querySelector("#ks-toggle").addEventListener("click", (event) => {
      barExpanded = !barExpanded;
      bar.classList.toggle("collapsed", !barExpanded);
      event.currentTarget.textContent = barExpanded ? "Collapse" : "Expand";
      syncPageOffset();
    });

    window.requestAnimationFrame(syncPageOffset);

    return bar;
  }

  function removeBar() {
    safeDom(() => {
      const bar = document.getElementById(BAR_ID);
      const style = document.getElementById(STYLE_ID);
      if (bar) {
        bar.remove();
      }
      if (style) {
        style.remove();
      }
      const spacer = document.getElementById(SPACER_ID);
      if (spacer) {
        spacer.remove();
      }
      restoreShiftedElements();
    });
  }

  function updateBar(payload) {
    safeDom(() => {
      if (!isExtensionContextAlive() || !payload || !payload.analysis) {
        return;
      }
      if (payload.settings && payload.settings.showAnalyticsBar === false) {
        removeBar();
        return;
      }

      const bar = ensureBar();
      if (!bar) {
        return;
      }
      const analysis = payload.analysis;

      const statline = bar.querySelector("#ks-statline");
      const groupsList = bar.querySelector("#ks-groups");
      const phrasesList = bar.querySelector("#ks-phrases");
      const suggestionsList = bar.querySelector("#ks-suggestions");
      if (!statline || !groupsList || !phrasesList || !suggestionsList) {
        return;
      }
      statline.innerHTML = `
        <span class="ks-chip">Score: ${analysis.totalScore}</span>
        <span class="ks-chip">Grade: ${analysis.grade}</span>
        ${Number.isFinite(analysis.resumeMatchPercent) ? `<span class="ks-chip">Resume Match: ${analysis.resumeMatchPercent}%</span><span class="ks-progress" title="Resume match ${analysis.resumeMatchPercent}%"><span style="width:${Math.max(0, Math.min(100, analysis.resumeMatchPercent))}%"></span></span>` : ""}
        <span class="ks-chip">URL: ${location.hostname.replace(/^www\./, "")}</span>
      `;

      groupsList.innerHTML = renderList(analysis.groupBreakdown, (item) =>
        `<li><span>${item.groupName}</span><span>${Math.round(item.score)}</span></li>`
      );

      phrasesList.innerHTML = renderList(analysis.phraseBreakdown, (item) =>
        `<li><span>${item.phrase}</span><span>${Math.round(item.score)}</span></li>`
      );

      suggestionsList.innerHTML = renderList(analysis.keywordSuggestions, (item) =>
        `<li><span>${item.keyword}</span><span>${item.occurrences}</span></li>`
      );

      syncPageOffset();
    });
  }

  function runScan() {
    if (!isExtensionContextAlive()) {
      removeBar();
      if (observer) {
        observer.disconnect();
      }
      return;
    }

    getAllowedPatterns((patterns) => {
      if (!matchesAllowedUrl(location.href, patterns)) {
        removeBar();
        return;
      }

      const text = extractJobText();
      chrome.runtime.sendMessage(
        {
          action: "analyzePage",
          text,
          url: location.href,
          title: getJobTitle()
        },
        (response) => {
          if (!isExtensionContextAlive()) {
            removeBar();
            return;
          }
          if (chrome.runtime.lastError || !response || !response.ok) {
            return;
          }
          updateBar(response);
        }
      );
    });
  }

  function debouncedScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runScan, 900);
  }

  function startObserver() {
    if (observer) {
      observer.disconnect();
    }
    const root = document.body || document.documentElement;
    if (!root) {
      return;
    }
    observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        debouncedScan();
        return;
      }
      debouncedScan();
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: false
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!isExtensionContextAlive()) {
      return;
    }
    if (message.action === "forceRescan") {
      runScan();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      runScan();
      startObserver();
    });
  } else {
    if (document.body || document.documentElement) {
      runScan();
      startObserver();
    } else {
      window.addEventListener("load", () => {
        runScan();
        startObserver();
      }, { once: true });
    }
  }
})();
