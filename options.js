document.addEventListener("DOMContentLoaded", () => {
  const DEFAULT_SETTINGS = {
    badgeMode: "score",
    showAnalyticsBar: true,
    alertThreshold: 80,
    gradeThresholds: { A: 120, B: 80, C: 45 },
    maxHistory: 20,
    allowedUrlPatterns: ["https://www.linkedin.com/jobs/*", "https://linkedin.com/jobs/*"],
    llmConfig: {
      provider: "github",
      endpoint: "",
      apiKey: "",
      model: "",
      enabled: false
    },
    resumeDefaultsLoaded: false
  };

  const PROVIDER_PRESETS = {
    github: {
      endpoint: "https://models.github.ai/inference/chat/completions",
      models: ["openai/gpt-5-mini", "openai/gpt-4.1-mini", "openai/gpt-4o-mini", "openai/gpt-5", "microsoft/phi-4"],
      help: "Use a GitHub personal access token. Good default picks are openai/gpt-5-mini or openai/gpt-4.1-mini for efficient keyword enrichment."
    },
    gemini: {
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
      models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
      help: "Use a Google AI Studio API key. The extension appends /{model}:generateContent automatically when calling Gemini."
    },
    "openai-compatible": {
      endpoint: "",
      models: ["gpt-4.1-mini", "gpt-4o-mini", "custom-model"],
      help: "Use any OpenAI-compatible chat completions endpoint. Provide a full endpoint URL, API key, and model name."
    }
  };

  const ui = {
    saveStatus: document.getElementById("save-status"),
    badgeMode: document.getElementById("badge-mode"),
    alertThreshold: document.getElementById("alert-threshold"),
    showBar: document.getElementById("show-bar"),
    activeUrlPatterns: document.getElementById("active-url-patterns"),
    gradeA: document.getElementById("grade-a"),
    gradeB: document.getElementById("grade-b"),
    gradeC: document.getElementById("grade-c"),
    saveDisplaySettings: document.getElementById("save-display-settings"),
    llmProvider: document.getElementById("llm-provider"),
    llmModelPreset: document.getElementById("llm-model-preset"),
    llmHelp: document.getElementById("llm-help"),
    llmEndpoint: document.getElementById("llm-endpoint"),
    llmApiKey: document.getElementById("llm-api-key"),
    llmModel: document.getElementById("llm-model"),
    saveLlmSettings: document.getElementById("save-llm-settings"),
    chooseResume: document.getElementById("choose-resume"),
    resumeFileInput: document.getElementById("resume-file-input"),
    resumeFileName: document.getElementById("resume-file-name"),
    evaluateResumeMatch: document.getElementById("evaluate-resume-match"),
    buildResumeKeywords: document.getElementById("build-resume-keywords"),
    resumeLlmOutput: document.getElementById("resume-llm-output"),
    groupInput: document.getElementById("group-input"),
    groupWeightInput: document.getElementById("group-weight-input"),
    keywordInput: document.getElementById("keyword-input"),
    keywordWeightInput: document.getElementById("keyword-weight-input"),
    addKeywordButton: document.getElementById("add-keyword"),
    importKeywordsFile: document.getElementById("import-keywords-file"),
    scanTechOutput: document.getElementById("scan-tech-output"),
    groupsList: document.getElementById("groups-list"),
    phraseInput: document.getElementById("phrase-input"),
    phraseCategoryInput: document.getElementById("phrase-category-input"),
    phraseWeightInput: document.getElementById("phrase-weight-input"),
    addPhraseButton: document.getElementById("add-phrase"),
    phrasesList: document.getElementById("phrases-list"),
    exportJson: document.getElementById("export-json"),
    restoreJson: document.getElementById("restore-json"),
    resetAll: document.getElementById("reset-all"),
    importJson: document.getElementById("import-json")
  };

  const state = {
    groups: [],
    phrases: [],
    settings: {
      badgeMode: "score",
      alertThreshold: 80,
      showAnalyticsBar: true,
      allowedUrlPatterns: ["https://www.linkedin.com/jobs/*", "https://linkedin.com/jobs/*"],
      gradeThresholds: { A: 120, B: 80, C: 45 },
      llmConfig: { provider: "github", endpoint: "", apiKey: "", model: "", enabled: false },
      resumeMatchLastEvaluation: null,
    },
    scanHistory: [],
    lastAnalysis: null,
    resumeText: "",
    resumeFileName: ""
  };

  function uid() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function setStatus(message) {
    ui.saveStatus.textContent = message;
  }

  let autoSaveTimer = null;
  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      state.settings.badgeMode = ui.badgeMode.value;
      state.settings.alertThreshold = parseInt(ui.alertThreshold.value, 10) || 80;
      state.settings.showAnalyticsBar = ui.showBar.checked;
      state.settings.allowedUrlPatterns = parsePatterns(ui.activeUrlPatterns.value);
      state.settings.gradeThresholds = {
        A: parseInt(ui.gradeA.value, 10) || 120,
        B: parseInt(ui.gradeB.value, 10) || 80,
        C: parseInt(ui.gradeC.value, 10) || 45
      };
      state.settings.llmConfig = {
        provider: ui.llmProvider.value,
        endpoint: ui.llmEndpoint.value.trim(),
        apiKey: ui.llmApiKey.value.trim(),
        model: ui.llmModel.value.trim(),
        enabled: Boolean(ui.llmEndpoint.value.trim() && ui.llmApiKey.value.trim() && ui.llmModel.value.trim())
      };
      saveAll();
    }, 900);
  }

  function parsePatterns(raw) {
    return String(raw || "")
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function saveAll() {
    chrome.runtime.sendMessage({
      action: "saveAll",
      payload: {
        groups: state.groups,
        phrases: state.phrases,
        settings: state.settings,
        scanHistory: state.scanHistory
      }
    }, (response) => {
      if (response && response.ok) {
        setStatus("✓ Auto-saved");
        clearTimeout(ui._statusClearTimer);
        ui._statusClearTimer = setTimeout(() => setStatus(""), 2500);
      }
    });
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

  function getGroupByName(groupName) {
    return state.groups.find((item) => item.name.toLowerCase() === String(groupName || "").trim().toLowerCase());
  }

  function addKeywordsToGroup(groupName, groupWeight, keywords, keywordWeight) {
    const cleanGroup = String(groupName || "").trim();
    if (!cleanGroup) {
      return 0;
    }

    let group = getGroupByName(cleanGroup);
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

  function addCategorizedKeywords(items, fallbackGroupName, fallbackGroupWeight, keywordWeight) {
    const summary = {};
    (items || []).forEach((item) => {
      const keyword = sanitizeKeyword(item && item.keyword);
      if (!keyword) {
        return;
      }
      const requestedGroup = String((item && item.group) || "").trim();
      const resolvedName = requestedGroup || fallbackGroupName;
      const existingGroup = getGroupByName(resolvedName);
      const targetGroupName = existingGroup ? existingGroup.name : resolvedName;
      const targetWeight = existingGroup ? existingGroup.weight : fallbackGroupWeight;
      const added = addKeywordsToGroup(targetGroupName, targetWeight, [keyword], keywordWeight);
      if (added) {
        summary[targetGroupName] = (summary[targetGroupName] || 0) + added;
      }
    });
    return summary;
  }

  function extractPdfTextFallback(arrayBuffer) {
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(arrayBuffer);

    const streamChunks = [];
    const streamRegex = /stream([\s\S]*?)endstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(raw)) !== null) {
      streamChunks.push(streamMatch[1]);
    }

    const source = streamChunks.length ? streamChunks.join("\n") : raw;
    const pieces = [];
    const textRegex = /\(([^()]{2,300})\)/g;
    let match;
    while ((match = textRegex.exec(source)) !== null) {
      const cleaned = match[1]
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned.length > 2) {
        pieces.push(cleaned);
      }
    }

    const combined = pieces.join(" ").replace(/\s+/g, " ").trim();
    if (combined.length >= 200) {
      return combined;
    }

    return raw
      .replace(/[^\x20-\x7E\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20000);
  }

  async function extractResumeTextFromFile(file) {
    const lower = String(file && file.name || "").toLowerCase();
    if (lower.endsWith(".pdf")) {
      const buffer = await file.arrayBuffer();
      return extractPdfTextFallback(buffer);
    }
    return await file.text();
  }

  function hydrateProviderControls(provider, overwriteFields) {
    const config = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.github;
    ui.llmModelPreset.innerHTML = "";
    config.models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      ui.llmModelPreset.appendChild(option);
    });
    ui.llmHelp.textContent = config.help;
    if (overwriteFields) {
      ui.llmEndpoint.value = config.endpoint;
      ui.llmModel.value = config.models[0] || "";
      ui.llmModelPreset.value = config.models[0] || "";
    }
  }

  function renderGroups() {
    ui.groupsList.innerHTML = "";
    state.groups.forEach((group) => {
      const li = document.createElement("li");
      li.className = "group-item";

      const head = document.createElement("div");
      head.className = "group-header";
      head.innerHTML = `<strong>${group.name}</strong><span>Group W: ${group.weight}</span>`;

      const editGroupBtn = document.createElement("button");
      editGroupBtn.textContent = "Edit";
      editGroupBtn.className = "edit-button";
      editGroupBtn.addEventListener("click", () => {
        ui.groupInput.value = group.name;
        ui.groupWeightInput.value = group.weight;
      });

      const removeGroupBtn = document.createElement("button");
      removeGroupBtn.textContent = "Delete";
      removeGroupBtn.className = "remove-button";
      removeGroupBtn.addEventListener("click", () => {
        state.groups = state.groups.filter((g) => g.id !== group.id);
        saveAll();
        render();
      });

      head.appendChild(editGroupBtn);
      head.appendChild(removeGroupBtn);
      li.appendChild(head);

      const keywords = document.createElement("ul");
      keywords.className = "keywords-list";

      group.keywords.forEach((kw) => {
        const kwLi = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = `${kw.keyword} (W:${kw.weight})`;
        kwLi.appendChild(label);

        const kwActions = document.createElement("span");
        const kwEdit = document.createElement("button");
        kwEdit.className = "small-button";
        kwEdit.textContent = "Edit";
        kwEdit.addEventListener("click", () => {
          ui.groupInput.value = group.name;
          ui.groupWeightInput.value = group.weight;
          ui.keywordInput.value = kw.keyword;
          ui.keywordWeightInput.value = kw.weight;
        });

        const kwDelete = document.createElement("button");
        kwDelete.className = "small-button danger";
        kwDelete.textContent = "X";
        kwDelete.addEventListener("click", () => {
          group.keywords = group.keywords.filter((item) => item.id !== kw.id);
          saveAll();
          render();
        });

        kwActions.appendChild(kwEdit);
        kwActions.appendChild(kwDelete);
        kwLi.appendChild(kwActions);
        keywords.appendChild(kwLi);
      });

      li.appendChild(keywords);
      ui.groupsList.appendChild(li);
    });
  }

  function renderPhrases() {
    ui.phrasesList.innerHTML = "";
    state.phrases.forEach((phrase) => {
      const li = document.createElement("li");
      li.className = "phrase-item";
      li.innerHTML = `<span>${phrase.phrase} [${phrase.category}] (W:${phrase.weight})</span>`;

      const actions = document.createElement("span");
      const edit = document.createElement("button");
      edit.textContent = "Edit";
      edit.className = "small-button";
      edit.addEventListener("click", () => {
        ui.phraseInput.value = phrase.phrase;
        ui.phraseCategoryInput.value = phrase.category;
        ui.phraseWeightInput.value = phrase.weight;
      });

      const del = document.createElement("button");
      del.textContent = "X";
      del.className = "small-button danger";
      del.addEventListener("click", () => {
        state.phrases = state.phrases.filter((p) => p.id !== phrase.id);
        saveAll();
        render();
      });

      actions.appendChild(edit);
      actions.appendChild(del);
      li.appendChild(actions);
      ui.phrasesList.appendChild(li);
    });
  }

  function renderSettings() {
    ui.badgeMode.value = state.settings.badgeMode || "score";
    ui.alertThreshold.value = state.settings.alertThreshold || 80;
    ui.showBar.checked = state.settings.showAnalyticsBar !== false;
    ui.activeUrlPatterns.value = (state.settings.allowedUrlPatterns || []).join("\n");
    ui.gradeA.value = (state.settings.gradeThresholds && state.settings.gradeThresholds.A) || 120;
    ui.gradeB.value = (state.settings.gradeThresholds && state.settings.gradeThresholds.B) || 80;
    ui.gradeC.value = (state.settings.gradeThresholds && state.settings.gradeThresholds.C) || 45;
    ui.llmProvider.value = (state.settings.llmConfig && state.settings.llmConfig.provider) || "github";
    hydrateProviderControls(ui.llmProvider.value, false);
    ui.llmEndpoint.value = (state.settings.llmConfig && state.settings.llmConfig.endpoint) || "";
    ui.llmApiKey.value = (state.settings.llmConfig && state.settings.llmConfig.apiKey) || "";
    ui.llmModel.value = (state.settings.llmConfig && state.settings.llmConfig.model) || "";
    if (ui.llmModel.value) {
      ui.llmModelPreset.value = ui.llmModel.value;
    }
    if (state.resumeFileName) {
      ui.resumeFileName.textContent = `Loaded: ${state.resumeFileName}`;
    }
    const lastEval = state.settings.resumeMatchLastEvaluation;
    if (lastEval && Number.isFinite(lastEval.scorePercent)) {
      ui.resumeLlmOutput.textContent = `Last match: ${lastEval.scorePercent}% for ${lastEval.title || "current job"}. ${lastEval.summary || ""}`.trim();
    }
  }

  function render() {
    renderGroups();
    renderPhrases();
    renderSettings();
  }

  function addOrUpdateKeyword() {
    const groupName = ui.groupInput.value.trim();
    const rawKeywords = ui.keywordInput.value.trim();
    const groupWeight = parseFloat(ui.groupWeightInput.value);
    const keywordWeight = parseFloat(ui.keywordWeightInput.value);

    if (!groupName || !rawKeywords || Number.isNaN(groupWeight) || Number.isNaN(keywordWeight)) {
      setStatus("Please provide group, keywords, and valid weights.");
      return;
    }

    const added = addKeywordsToGroup(groupName, groupWeight, parseList(rawKeywords), keywordWeight);
    if (!added) {
      setStatus("No new keywords were added. They may already exist.");
      return;
    }

    saveAll();
    ui.keywordInput.value = "";
    ui.keywordWeightInput.value = "1";
    ui.scanTechOutput.textContent = `Added ${added} keyword(s) to ${groupName}.`;
    render();
  }

  function addOrUpdatePhrase() {
    const phrase = ui.phraseInput.value.trim();
    const category = ui.phraseCategoryInput.value.trim() || "general";
    const weight = parseFloat(ui.phraseWeightInput.value);
    if (!phrase || Number.isNaN(weight)) {
      setStatus("Please provide phrase and valid weight.");
      return;
    }

    const existing = state.phrases.find((item) => item.phrase.toLowerCase() === phrase.toLowerCase());
    if (existing) {
      existing.category = category;
      existing.weight = weight;
    } else {
      state.phrases.push({ id: uid(), phrase, category, weight, enabled: true });
    }
    saveAll();
    ui.phraseInput.value = "";
    ui.phraseCategoryInput.value = "";
    ui.phraseWeightInput.value = "3";
    render();
  }


  function importKeywordsFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      let imported = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            imported = parsed.map((item) => String(item));
          } else if (Array.isArray(parsed.keywords)) {
            imported = parsed.keywords.map((item) => String(item));
          }
        } catch {
          imported = [];
        }
      } else {
        imported = parseList(text);
      }

      if (!imported.length) {
        setStatus("No valid keywords found in file.");
        return;
      }

      const groupName = ui.groupInput.value.trim() || "Imported Keywords";
      const groupWeight = parseFloat(ui.groupWeightInput.value) || 1;
      const keywordWeight = parseFloat(ui.keywordWeightInput.value) || 1;
      const added = addKeywordsToGroup(groupName, groupWeight, imported, keywordWeight);
      saveAll();
      render();
      ui.scanTechOutput.textContent = `Imported ${added} keyword(s) into ${groupName}.`;
    };
    reader.readAsText(file);
  }

  function saveDisplaySettings() {
    state.settings.badgeMode = ui.badgeMode.value;
    state.settings.alertThreshold = parseInt(ui.alertThreshold.value, 10) || 80;
    state.settings.showAnalyticsBar = ui.showBar.checked;
    state.settings.allowedUrlPatterns = parsePatterns(ui.activeUrlPatterns.value);
    state.settings.gradeThresholds = {
      A: parseInt(ui.gradeA.value, 10) || 120,
      B: parseInt(ui.gradeB.value, 10) || 80,
      C: parseInt(ui.gradeC.value, 10) || 45
    };
    saveAll();
  }

  function saveLlmSettings() {
    state.settings.llmConfig = {
      provider: ui.llmProvider.value,
      endpoint: ui.llmEndpoint.value.trim(),
      apiKey: ui.llmApiKey.value.trim(),
      model: ui.llmModel.value.trim(),
      enabled: Boolean(ui.llmEndpoint.value.trim() && ui.llmApiKey.value.trim() && ui.llmModel.value.trim())
    };
    saveAll();
  }

  async function loadResumeFromPicker(file) {
    if (!file) {
      return;
    }
    ui.resumeLlmOutput.textContent = "Parsing resume...";
    try {
      const parsed = await extractResumeTextFromFile(file);
      const cleaned = String(parsed || "").replace(/\s+/g, " ").trim();
      if (cleaned.length < 120) {
        ui.resumeLlmOutput.textContent = "Could not extract enough text from this file. Try another PDF/text file.";
        return;
      }
      state.resumeText = cleaned.slice(0, 30000);
      state.resumeFileName = file.name;
      ui.resumeFileName.textContent = `Loaded: ${file.name}`;
      ui.resumeLlmOutput.textContent = "Resume loaded. You can now run manual match evaluation or generate keywords.";
    } catch {
      ui.resumeLlmOutput.textContent = "Failed to parse resume file.";
    }
  }

  function runResumeMatchEvaluation() {
    if (!state.resumeText) {
      ui.resumeLlmOutput.textContent = "Please choose and load a resume first.";
      return;
    }
    ui.resumeLlmOutput.textContent = "Evaluating match against current page...";
    chrome.runtime.sendMessage({ action: "evaluateResumeMatchFromActiveTab", resumeText: state.resumeText }, (response) => {
      if (!response || !response.ok) {
        ui.resumeLlmOutput.textContent = (response && response.error) || "Resume match evaluation failed.";
        return;
      }
      const matched = Array.isArray(response.matchedKeywords) ? response.matchedKeywords.slice(0, 8).join(", ") : "";
      const missing = Array.isArray(response.missingKeywords) ? response.missingKeywords.slice(0, 8).join(", ") : "";
      ui.resumeLlmOutput.textContent = [
        `Resume match: ${response.scorePercent}%`,
        response.summary || "",
        matched ? `Matched: ${matched}` : "",
        missing ? `Missing: ${missing}` : ""
      ].filter(Boolean).join(" | ");

      state.settings.resumeMatchLastEvaluation = {
        scorePercent: response.scorePercent,
        summary: response.summary || "",
        updatedAt: Date.now()
      };
    });
  }

  function generateKeywordsFromResume() {
    if (!state.resumeText) {
      ui.resumeLlmOutput.textContent = "Please choose and load a resume first.";
      return;
    }

    ui.resumeLlmOutput.textContent = "Generating grouped keywords from resume...";
    chrome.runtime.sendMessage({ action: "buildKeywordsFromResume", resumeText: state.resumeText }, (response) => {
      if (!response || !response.ok) {
        ui.resumeLlmOutput.textContent = (response && response.error) || "Could not generate keywords from resume.";
        return;
      }

      const summary = addCategorizedKeywords(
        response.items || [],
        ui.groupInput.value.trim() || "Resume Profile",
        parseFloat(ui.groupWeightInput.value) || 1.8,
        parseFloat(ui.keywordWeightInput.value) || 1.2
      );
      const totalAdded = Object.values(summary).reduce((sum, count) => sum + count, 0);
      saveAll();
      render();
      ui.resumeLlmOutput.textContent = totalAdded
        ? `Added ${totalAdded} keyword(s) from resume. ${Object.entries(summary).map(([name, count]) => `${name}: ${count}`).join(" | ")}`
        : "No new resume-based keywords were added.";
    });
  }

  function resetAllData() {
    const confirmMessage = "All stored settings will be removed. Are you sure? Unless you have a backup, this cannot be reversed.";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    state.groups = [];
    state.phrases = [];
    state.scanHistory = [];
    state.lastAnalysis = null;
    state.settings = {
      ...DEFAULT_SETTINGS,
      gradeThresholds: { ...DEFAULT_SETTINGS.gradeThresholds },
      llmConfig: { ...DEFAULT_SETTINGS.llmConfig },
      allowedUrlPatterns: [...DEFAULT_SETTINGS.allowedUrlPatterns]
    };

    chrome.runtime.sendMessage({
      action: "saveAll",
      payload: {
        groups: state.groups,
        phrases: state.phrases,
        settings: state.settings,
        scanHistory: state.scanHistory
      }
    }, (response) => {
      if (!response || !response.ok) {
        setStatus("Reset failed. Please try again.");
        return;
      }
      render();
      setStatus("All data reset to defaults.");
    });
  }

  function wireActions() {
    ui.addKeywordButton.addEventListener("click", addOrUpdateKeyword);
    ui.addPhraseButton.addEventListener("click", addOrUpdatePhrase);
    ui.saveDisplaySettings.addEventListener("click", saveDisplaySettings);
    ui.saveLlmSettings.addEventListener("click", saveLlmSettings);

    // Auto-save: fire whenever any settings field is changed
    [
      ui.badgeMode, ui.alertThreshold, ui.showBar, ui.activeUrlPatterns,
      ui.gradeA, ui.gradeB, ui.gradeC
    ].forEach((el) => { if (el) { el.addEventListener("change", scheduleAutoSave); } });
    [ui.alertThreshold, ui.activeUrlPatterns, ui.gradeA, ui.gradeB, ui.gradeC]
      .forEach((el) => { if (el) { el.addEventListener("input", scheduleAutoSave); } });
    [ui.llmEndpoint, ui.llmApiKey, ui.llmModel]
      .forEach((el) => { if (el) { el.addEventListener("input", scheduleAutoSave); } });

    ui.importKeywordsFile.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        importKeywordsFromFile(file);
      }
    });


    ui.llmProvider.addEventListener("change", () => {
      hydrateProviderControls(ui.llmProvider.value, true);
    });

    ui.llmModelPreset.addEventListener("change", () => {
      ui.llmModel.value = ui.llmModelPreset.value;
    });

    ui.chooseResume.addEventListener("click", () => {
      ui.resumeFileInput.value = "";
      ui.resumeFileInput.click();
    });

    ui.resumeFileInput.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        loadResumeFromPicker(file);
      }
    });

    ui.evaluateResumeMatch.addEventListener("click", runResumeMatchEvaluation);
    ui.buildResumeKeywords.addEventListener("click", generateKeywordsFromResume);

    ui.exportJson.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ groups: state.groups, phrases: state.phrases, settings: state.settings }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "keyword-bank.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    ui.restoreJson.addEventListener("click", () => {
      ui.importJson.value = "";
      ui.importJson.click();
    });

    ui.resetAll.addEventListener("click", resetAllData);

    ui.importJson.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"));
          state.groups = Array.isArray(parsed.groups) ? parsed.groups : state.groups;
          state.phrases = Array.isArray(parsed.phrases) ? parsed.phrases : state.phrases;
          state.settings = {
            ...state.settings,
            ...(parsed.settings || {}),
            allowedUrlPatterns: Array.isArray(parsed.settings && parsed.settings.allowedUrlPatterns)
              ? parsed.settings.allowedUrlPatterns
              : state.settings.allowedUrlPatterns,
            gradeThresholds: {
              ...(state.settings.gradeThresholds || {}),
              ...((parsed.settings && parsed.settings.gradeThresholds) || {})
            },
            llmConfig: {
              ...(state.settings.llmConfig || {}),
              ...((parsed.settings && parsed.settings.llmConfig) || {})
            }
          };
          saveAll();
          render();
        } catch {
          setStatus("Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    });
  }

  chrome.runtime.sendMessage({ action: "getPopupState" }, (response) => {
    if (!response || !response.ok) {
      setStatus("Could not load extension settings.");
      return;
    }
    state.groups = response.groups || [];
    state.phrases = response.phrases || [];
    state.settings = {
      ...state.settings,
      ...(response.settings || {}),
      allowedUrlPatterns: Array.isArray(response.settings && response.settings.allowedUrlPatterns)
        ? response.settings.allowedUrlPatterns
        : state.settings.allowedUrlPatterns,
      gradeThresholds: {
        ...(state.settings.gradeThresholds || {}),
        ...((response.settings && response.settings.gradeThresholds) || {})
      },
      llmConfig: {
        ...(state.settings.llmConfig || {}),
        ...((response.settings && response.settings.llmConfig) || {})
      }
    };
    state.scanHistory = response.scanHistory || [];
    state.lastAnalysis = response.lastAnalysis || null;
    render();
    setStatus("Settings loaded. Use the popup for quick changes and this page for deeper setup.");
  });

  wireActions();
});
