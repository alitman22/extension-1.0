document.addEventListener("DOMContentLoaded", () => {
  const ui = {
    groupInput: document.getElementById("group-input"),
    groupWeightInput: document.getElementById("group-weight-input"),
    keywordInput: document.getElementById("keyword-input"),
    keywordWeightInput: document.getElementById("keyword-weight-input"),
    addKeywordButton: document.getElementById("add-keyword"),
    scanTechPage: document.getElementById("scan-tech-page"),
    scanTechOutput: document.getElementById("scan-tech-output"),
    groupsList: document.getElementById("groups-list"),
    badgeMode: document.getElementById("badge-mode"),
    alertThreshold: document.getElementById("alert-threshold"),
    showBar: document.getElementById("show-bar"),
    rescore: document.getElementById("rescore"),
    llmSuggest: document.getElementById("llm-suggest"),
    actionOutput: document.getElementById("action-output"),
    openSettings: document.getElementById("open-settings"),
    openSettings2: document.getElementById("open-settings-2"),
    autosaveBadge: document.getElementById("autosave-badge")
  };

  const state = {
    groups: [],
    settings: {
      badgeMode: "score",
      alertThreshold: 80,
      showAnalyticsBar: true,
      gradeThresholds: { A: 120, B: 80, C: 45 }
    },
    lastAnalysis: null
  };

  function uid() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function parseList(raw) {
    return String(raw || "")
      .split(/[\n,;|]+/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 1);
  }

  function sanitizeKeyword(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function saveAll() {
    chrome.runtime.sendMessage({
      action: "saveAll",
      payload: {
        groups: state.groups,
        settings: state.settings
      }
    });
  }

  function addKeywordsToGroup(groupName, groupWeight, keywords, keywordWeight) {
    const cleanGroup = String(groupName || "").trim();
    if (!cleanGroup) {
      return 0;
    }

    let group = state.groups.find((item) => item.name.toLowerCase() === cleanGroup.toLowerCase());
    if (!group) {
      group = { id: uid(), name: cleanGroup, weight: groupWeight, keywords: [] };
      state.groups.push(group);
    }
    group.name = cleanGroup;
    group.weight = groupWeight;

    let added = 0;
    const seen = new Set(group.keywords.map((item) => item.keyword.toLowerCase()));
    keywords.forEach((item) => {
      const keyword = sanitizeKeyword(item);
      if (!keyword || seen.has(keyword)) {
        return;
      }
      group.keywords.push({ id: uid(), keyword, weight: keywordWeight, enabled: true });
      seen.add(keyword);
      added += 1;
    });
    return added;
  }

  function renderGroups() {
    ui.groupsList.innerHTML = "";
    state.groups.slice(0, 4).forEach((group) => {
      const li = document.createElement("li");
      li.className = "group-item";

      const header = document.createElement("div");
      header.className = "group-header";
      header.innerHTML = `<strong>${group.name}</strong><span>W:${group.weight}</span>`;

      const actions = document.createElement("span");
      const editButton = document.createElement("button");
      editButton.className = "small-button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => {
        ui.groupInput.value = group.name;
        ui.groupWeightInput.value = group.weight;
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "small-button danger";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        state.groups = state.groups.filter((item) => item.id !== group.id);
        saveAll();
        render();
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      header.appendChild(actions);
      li.appendChild(header);

      const preview = document.createElement("div");
      preview.className = "group-preview";
      preview.textContent = group.keywords.slice(0, 4).map((item) => item.keyword).join(", ") || "No keywords yet";
      li.appendChild(preview);
      ui.groupsList.appendChild(li);
    });
  }

  function showAutoSaveBadge() {
    if (!ui.autosaveBadge) { return; }
    ui.autosaveBadge.classList.remove("hidden");
    clearTimeout(ui._autosaveHideTimer);
    ui._autosaveHideTimer = setTimeout(() => ui.autosaveBadge.classList.add("hidden"), 2200);
  }

  let autoSaveTimer = null;
  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      state.settings.badgeMode = ui.badgeMode.value;
      state.settings.alertThreshold = parseInt(ui.alertThreshold.value, 10) || 80;
      state.settings.showAnalyticsBar = ui.showBar.checked;
      saveAll();
      showAutoSaveBadge();
    }, 700);
  }

  function renderInsights() {
    const analysis = state.lastAnalysis;
    const arc = document.getElementById("score-arc");
    const ringScore = document.getElementById("ring-score");
    const gradeBadge = document.getElementById("grade-badge");
    const skillsChips = document.getElementById("skills-chips");
    const signalsList = document.getElementById("signals-list");
    const urlTag = document.getElementById("url-tag");
    const resumePct = document.getElementById("resume-pct");
    const resumeBar = document.getElementById("resume-pct-bar");
    const resumeLabel = document.getElementById("resume-pct-label");

    if (!analysis) {
      if (arc) { arc.style.strokeDashoffset = "314"; }
      if (ringScore) { ringScore.textContent = "—"; }
      if (gradeBadge) { gradeBadge.textContent = "—"; gradeBadge.className = "grade-badge grade-none"; }
      if (skillsChips) { skillsChips.innerHTML = "<span class='empty-hint'>Scan a job page to see matched keywords</span>"; }
      if (signalsList) { signalsList.innerHTML = "<span class='empty-hint'>No signals detected yet</span>"; }
      if (urlTag) { urlTag.textContent = "—"; }
      if (resumePct) { resumePct.classList.add("hidden"); }
      return;
    }

    // Score ring
    const score = analysis.totalScore || 0;
    const maxScore = (state.settings.gradeThresholds && state.settings.gradeThresholds.A) || 120;
    const pct = Math.min(100, Math.round(score / maxScore * 100));
    const circumference = 314;
    if (arc) { arc.style.strokeDashoffset = String(circumference - (circumference * pct / 100)); }
    if (ringScore) { ringScore.textContent = score; }

    // Grade
    const grade = analysis.grade || "D";
    if (gradeBadge) {
      gradeBadge.textContent = grade;
      gradeBadge.className = `grade-badge grade-${grade}`;
    }

    // URL
    if (urlTag) {
      try {
        urlTag.textContent = analysis.url ? new URL(analysis.url).hostname.replace(/^www\./, "") : location.hostname.replace(/^www\./, "");
      } catch { urlTag.textContent = "—"; }
    }

    // Resume match
    if (Number.isFinite(analysis.resumeMatchPercent) && resumePct && resumeBar && resumeLabel) {
      resumePct.classList.remove("hidden");
      resumeBar.style.width = `${Math.max(0, Math.min(100, analysis.resumeMatchPercent))}%`;
      resumeLabel.textContent = `${analysis.resumeMatchPercent}% resume match`;
    } else if (resumePct) {
      resumePct.classList.add("hidden");
    }

    // Matched Skills chips
    const topKeywords = [];
    (analysis.groupBreakdown || []).forEach((group) => {
      (group.keywords || []).slice().sort((a, b) => b.score - a.score).slice(0, 3).forEach((kw) => {
        topKeywords.push(kw.keyword);
      });
    });
    if (skillsChips) {
      skillsChips.innerHTML = topKeywords.length
        ? topKeywords.slice(0, 12).map((kw) => `<span class="skill-chip">${kw}</span>`).join("")
        : "<span class='empty-hint'>No keyword matches found</span>";
    }

    // Flagged Signals
    const phrases = analysis.phraseBreakdown || [];
    if (signalsList) {
      signalsList.innerHTML = phrases.length
        ? phrases.slice(0, 6).map((p) =>
            `<div class="signal-item"><div class="signal-dot"></div><span class="signal-label">${p.phrase}</span><span class="signal-score">${Math.round(p.score)}</span></div>`
          ).join("")
        : "<span class='empty-hint'>No phrase signals detected</span>";
    }
  }

  function renderSettings() {
    ui.badgeMode.value = state.settings.badgeMode || "score";
    ui.alertThreshold.value = state.settings.alertThreshold || 80;
    ui.showBar.checked = state.settings.showAnalyticsBar !== false;
  }

  function render() {
    renderGroups();
    renderInsights();
    renderSettings();
  }

  function wireActions() {
    ui.addKeywordButton.addEventListener("click", () => {
      const groupName = ui.groupInput.value.trim();
      const keywords = parseList(ui.keywordInput.value.trim());
      const groupWeight = parseFloat(ui.groupWeightInput.value);
      const keywordWeight = parseFloat(ui.keywordWeightInput.value);
      if (!groupName || !keywords.length || Number.isNaN(groupWeight) || Number.isNaN(keywordWeight)) {
        ui.scanTechOutput.textContent = "Provide a group, at least one keyword, and valid weights.";
        return;
      }
      const added = addKeywordsToGroup(groupName, groupWeight, keywords, keywordWeight);
      saveAll();
      ui.keywordInput.value = "";
      ui.scanTechOutput.textContent = added ? `Added ${added} keyword(s) to ${groupName}.` : "No new keywords were added.";
      render();
    });

    ui.scanTechPage.addEventListener("click", () => {
      ui.scanTechOutput.textContent = "Scanning page for IT terms...";
      chrome.runtime.sendMessage({ action: "scanTechKeywordsFromActiveTab" }, (response) => {
        if (!response || !response.ok) {
          ui.scanTechOutput.textContent = (response && response.error) || "Could not scan current page.";
          return;
        }
        const preview = (response.suggestions || []).slice(0, 8).map((item) => item.keyword).join(", ");
        ui.scanTechOutput.textContent = preview || "No strong IT terms found.";
      });
    });

    // Auto-save quick settings on any change
    [ui.badgeMode, ui.alertThreshold, ui.showBar].forEach((el) => {
      if (el) { el.addEventListener("change", scheduleAutoSave); }
    });

    ui.rescore.addEventListener("click", () => {
      ui.actionOutput.textContent = "Rescanning...";
      ui.actionOutput.classList.remove("hidden");
      chrome.runtime.sendMessage({ action: "rescoreActiveTab" }, (response) => {
        ui.actionOutput.textContent = (response && response.ok)
          ? "Rescan triggered."
          : ((response && response.error) || "Could not rescan current page.");
      });
    });

    ui.llmSuggest.addEventListener("click", () => {
      ui.actionOutput.textContent = "Fetching LLM suggestions...";
      ui.actionOutput.classList.remove("hidden");
      chrome.runtime.sendMessage({ action: "llmSuggestKeywords" }, (response) => {
        if (!response || !response.ok) {
          ui.actionOutput.textContent = (response && response.error) || "LLM suggestion failed. Check settings.";
          return;
        }
        const suggestions = (response.suggestions || []).slice(0, 5);
        if (!suggestions.length) {
          ui.actionOutput.textContent = "No keyword suggestions from LLM.";
          return;
        }
        const summary = suggestions.map((item) => item.keyword).join(", ");
        ui.actionOutput.textContent = `Suggested: ${summary}. Check full settings to review and import.`;
      });
    });

    const openSettingsPage = () => { chrome.runtime.openOptionsPage(); window.close(); };
    if (ui.openSettings)  { ui.openSettings.addEventListener("click", openSettingsPage); }
    if (ui.openSettings2) { ui.openSettings2.addEventListener("click", openSettingsPage); }
  }

  chrome.runtime.sendMessage({ action: "getPopupState" }, (response) => {
    if (!response || !response.ok) {
      ui.actionOutput.textContent = "Could not load extension state.";
      return;
    }
    state.groups = response.groups || [];
    state.settings = {
      ...state.settings,
      ...(response.settings || {})
    };
    state.lastAnalysis = response.lastAnalysis || null;
    render();
  });

  wireActions();
});
