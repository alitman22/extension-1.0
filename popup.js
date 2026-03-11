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
    gradeA: document.getElementById("grade-a"),
    gradeB: document.getElementById("grade-b"),
    gradeC: document.getElementById("grade-c"),
    showBar: document.getElementById("show-bar"),
    saveSettings: document.getElementById("save-settings"),
    rescore: document.getElementById("rescore"),
    llmSuggest: document.getElementById("llm-suggest"),
    actionOutput: document.getElementById("action-output"),
    scoreCards: document.getElementById("score-cards"),
    openSettings: document.getElementById("open-settings")
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

  function renderInsights() {
    const analysis = state.lastAnalysis;
    if (!analysis) {
      ui.scoreCards.innerHTML = "<div class='card full'>No scan yet. Open a LinkedIn job page and rescan.</div>";
      return;
    }
    const signals = Object.entries(analysis.phraseByCategory || {})
      .map(([key, value]) => `${key}: ${Math.round(value)}`)
      .join(" | ") || "No key phrases detected";
    ui.scoreCards.innerHTML = `
      <div class="card">Score <strong>${analysis.totalScore || 0}</strong></div>
      <div class="card">Grade <strong>${analysis.grade || "-"}</strong></div>
      <div class="card full">Signals <strong>${signals}</strong></div>
    `;
  }

  function renderSettings() {
    ui.badgeMode.value = state.settings.badgeMode || "score";
    ui.alertThreshold.value = state.settings.alertThreshold || 80;
    ui.showBar.checked = state.settings.showAnalyticsBar !== false;
    const thresholds = state.settings.gradeThresholds || { A: 120, B: 80, C: 45 };
    ui.gradeA.value = thresholds.A || 120;
    ui.gradeB.value = thresholds.B || 80;
    ui.gradeC.value = thresholds.C || 45;
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
      chrome.runtime.sendMessage({ action: "scanTechKeywordsFromActiveTab" }, (response) => {
        if (!response || !response.ok) {
          ui.scanTechOutput.textContent = (response && response.error) || "Could not scan current page.";
          return;
        }
        const preview = (response.suggestions || []).slice(0, 8).map((item) => item.keyword).join(", ");
        ui.scanTechOutput.textContent = preview || "No strong IT terms found.";
      });
    });

    ui.saveSettings.addEventListener("click", () => {
      state.settings.badgeMode = ui.badgeMode.value;
      state.settings.alertThreshold = parseInt(ui.alertThreshold.value, 10) || 80;
      state.settings.showAnalyticsBar = ui.showBar.checked;
      state.settings.gradeThresholds = {
        A: parseInt(ui.gradeA.value, 10) || 120,
        B: parseInt(ui.gradeB.value, 10) || 80,
        C: parseInt(ui.gradeC.value, 10) || 45
      };
      saveAll();
      ui.actionOutput.textContent = "Settings saved.";
    });

    ui.rescore.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "rescoreActiveTab" }, (response) => {
        ui.actionOutput.textContent = (response && response.ok)
          ? "Rescan triggered."
          : ((response && response.error) || "Could not rescan current page.");
      });
    });

    ui.llmSuggest.addEventListener("click", () => {
      ui.actionOutput.textContent = "Fetching LLM suggestions...";
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

    ui.openSettings.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
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
