const DEFAULT_PHRASES = [
  { id: "p1", phrase: "visa sponsorship", category: "visa", weight: 6, enabled: true },
  { id: "p2", phrase: "sponsorship available", category: "visa", weight: 5, enabled: true },
  { id: "p3", phrase: "work authorization", category: "visa", weight: 3, enabled: true },
  { id: "p4", phrase: "relocation assistance", category: "relocation", weight: 5, enabled: true },
  { id: "p5", phrase: "willing to relocate", category: "relocation", weight: 3, enabled: true },
  { id: "p6", phrase: "remote", category: "work_mode", weight: 2, enabled: true },
  { id: "p7", phrase: "hybrid", category: "work_mode", weight: 2, enabled: true },
  { id: "p8", phrase: "international", category: "abroad", weight: 2, enabled: true },
  { id: "p9", phrase: "english required", category: "language", weight: 1, enabled: true }
];

const DEFAULT_RESUME_GROUPS = [
  {
    name: "DevOps & Automation",
    weight: 2.3,
    keywords: ["ansible", "terraform", "bash", "python", "gitlab", "github actions", "bitbucket", "ci/cd", "automation", "nomad"]
  },
  {
    name: "Cloud & Platform",
    weight: 2.4,
    keywords: ["aws", "kubernetes", "vmware", "linux", "ubuntu", "rhel", "cloud", "virtualization", "high availability"]
  },
  {
    name: "Monitoring & Reliability",
    weight: 2,
    keywords: ["grafana", "prometheus", "zabbix", "percona", "elk", "graylog", "sre", "observability", "monitoring"]
  },
  {
    name: "Data & Middleware",
    weight: 1.9,
    keywords: ["postgresql", "mysql", "mongodb", "redis", "influxdb", "haproxy", "nginx", "apache", "database"]
  },
  {
    name: "Security & Infrastructure",
    weight: 1.9,
    keywords: ["fortinet", "pfsense", "vault", "openldap", "network", "datacenter", "bacula", "veeam", "hpe", "dell", "emc", "truenas"]
  }
];

const TECH_TERMS = [
  "kubernetes", "docker", "linux", "ubuntu", "rhel", "devops", "sre", "ci/cd", "terraform", "ansible", "bash", "python", "aws",
  "azure", "gcp", "prometheus", "grafana", "zabbix", "elk", "elasticsearch", "logstash", "kibana", "graylog", "postgresql",
  "mysql", "mongodb", "redis", "influxdb", "nginx", "apache", "haproxy", "vmware", "vault", "openldap", "fortinet", "pfsense",
  "gitlab", "github actions", "bitbucket", "nomad", "helm", "istio", "microservice", "virtualization", "infrastructure as code",
  "high availability", "load balancer", "container", "orchestration", "automation", "observability", "datacenter"
];

const STOPWORDS = new Set([
  "the", "and", "with", "for", "that", "this", "from", "have", "will", "your", "you", "our", "are", "job", "role", "team",
  "work", "years", "experience", "required", "candidate", "skills", "ability", "good", "excellent", "strong", "must", "using",
  "based", "include", "within", "about", "position", "company", "their", "need", "plus", "nice", "also", "who", "what", "when",
  "where", "they", "them", "into", "through", "more", "less", "than", "across", "should", "could", "would"
]);

const DEFAULT_SETTINGS = {
  badgeMode: "score",
  showAnalyticsBar: true,
  alertThreshold: 80,
  gradeThresholds: { A: 120, B: 80, C: 45 },
  maxHistory: 20,
  allowedUrlPatterns: [
    "https://www.linkedin.com/jobs/*",
    "https://linkedin.com/jobs/*"
  ],
  llmConfig: {
    provider: "github",
    endpoint: "",
    apiKey: "",
    model: "",
    enabled: false
  },
  resumeMatchLastEvaluation: null,
  resumeDefaultsLoaded: false
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function escapeRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternToRegex(pattern) {
  const normalized = String(pattern || "").trim();
  if (!normalized) {
    return null;
  }
  const escaped = normalized.split("*").map(escapeRegex).join(".*");
  try {
    return new RegExp(`^${escaped}$`, "i");
  } catch {
    return null;
  }
}

function matchesAllowedUrl(url, patterns) {
  const list = Array.isArray(patterns) ? patterns : [];
  if (!list.length) {
    return true;
  }
  return list.some((pattern) => {
    const regex = patternToRegex(pattern);
    return regex ? regex.test(String(url || "")) : false;
  });
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z][a-z0-9+./-]{2,}/g) || []);
}

function countMatches(text, term) {
  const cleaned = String(term || "").trim();
  if (!cleaned) {
    return 0;
  }
  const pattern = cleaned.includes(" ") ? escapeRegex(cleaned) : `\\b${escapeRegex(cleaned)}\\b`;
  try {
    const regex = new RegExp(pattern, "gi");
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

function computeGrade(score, thresholds) {
  if (score >= thresholds.A) {
    return "A";
  }
  if (score >= thresholds.B) {
    return "B";
  }
  if (score >= thresholds.C) {
    return "C";
  }
  return "D";
}

function buildDefaultResumeGroups() {
  return DEFAULT_RESUME_GROUPS.map((group) => ({
    id: uid(),
    name: group.name,
    weight: group.weight,
    keywords: group.keywords.map((keyword) => ({ id: uid(), keyword, weight: 1.8, enabled: true }))
  }));
}

function mergeResumeDefaultsIntoGroups(groups) {
  const merged = Array.isArray(groups) ? [...groups] : [];
  DEFAULT_RESUME_GROUPS.forEach((seedGroup) => {
    let target = merged.find((item) => item.name.toLowerCase() === seedGroup.name.toLowerCase());
    if (!target) {
      target = { id: uid(), name: seedGroup.name, weight: seedGroup.weight, keywords: [] };
      merged.push(target);
    }
    if (!Number.isFinite(target.weight)) {
      target.weight = seedGroup.weight;
    }
    const existingKeywords = new Set((target.keywords || []).map((item) => String(item.keyword || "").toLowerCase()));
    seedGroup.keywords.forEach((keyword) => {
      if (existingKeywords.has(keyword.toLowerCase())) {
        return;
      }
      target.keywords.push({ id: uid(), keyword, weight: 1.8, enabled: true });
      existingKeywords.add(keyword.toLowerCase());
    });
  });
  return merged;
}

function parseListInput(rawText) {
  const raw = String(rawText || "");
  return raw
    .split(/[\n,;|]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function normalizeData(raw) {
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  let normalizedGroups = groups.map((group) => ({
    id: group.id || uid(),
    name: group.name || "Unnamed Group",
    weight: Number.isFinite(group.weight) ? Number(group.weight) : 1,
    keywords: Array.isArray(group.keywords)
      ? group.keywords.map((k) => ({
          id: k.id || uid(),
          keyword: k.keyword || "",
          weight: Number.isFinite(k.weight) ? Number(k.weight) : 1,
          enabled: k.enabled !== false
        }))
      : []
  }));

  if (!normalizedGroups.length && !Array.isArray(raw.groups)) {
    normalizedGroups = buildDefaultResumeGroups();
  }

  const phrases = Array.isArray(raw.phrases) && raw.phrases.length ? raw.phrases : DEFAULT_PHRASES;
  const normalizedPhrases = phrases.map((p) => ({
    id: p.id || uid(),
    phrase: p.phrase || "",
    category: p.category || "general",
    weight: Number.isFinite(p.weight) ? Number(p.weight) : 1,
    enabled: p.enabled !== false
  }));

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(raw.settings || {}),
    gradeThresholds: {
      ...DEFAULT_SETTINGS.gradeThresholds,
      ...((raw.settings && raw.settings.gradeThresholds) || {})
    },
    llmConfig: {
      provider: "github",
      ...DEFAULT_SETTINGS.llmConfig,
      ...((raw.settings && raw.settings.llmConfig) || {})
    },
    allowedUrlPatterns: Array.isArray(raw.settings && raw.settings.allowedUrlPatterns)
      ? raw.settings.allowedUrlPatterns.filter((item) => String(item || "").trim())
      : DEFAULT_SETTINGS.allowedUrlPatterns
  };

  const scanHistory = Array.isArray(raw.scanHistory) ? raw.scanHistory : [];
  return { groups: normalizedGroups, phrases: normalizedPhrases, settings, scanHistory };
}

function getExistingKeywordSet(groups) {
  const set = new Set();
  groups.forEach((g) => g.keywords.forEach((k) => set.add(String(k.keyword || "").toLowerCase())));
  return set;
}

function normalizeTerm(term) {
  return String(term || "").trim().toLowerCase();
}

function scoreGroupFit(keyword, group) {
  const normalizedKeyword = normalizeTerm(keyword);
  const keywordTokens = normalizedKeyword.split(/[^a-z0-9+.#/-]+/g).filter(Boolean);
  const groupName = normalizeTerm(group.name);
  let score = 0;

  keywordTokens.forEach((token) => {
    if (groupName.includes(token)) {
      score += 3;
    }
  });

  (group.keywords || []).forEach((item) => {
    const existing = normalizeTerm(item.keyword);
    if (!existing) {
      return;
    }
    if (existing === normalizedKeyword) {
      score += 6;
    }
    keywordTokens.forEach((token) => {
      if (existing.includes(token)) {
        score += 2;
      }
    });
  });

  return score;
}

function resolveBestGroupName(keyword, requestedGroup, groups) {
  const normalizedRequested = normalizeTerm(requestedGroup);
  if (normalizedRequested) {
    const direct = groups.find((group) => normalizeTerm(group.name) === normalizedRequested);
    if (direct) {
      return direct.name;
    }
  }

  let bestGroup = null;
  let bestScore = 0;
  groups.forEach((group) => {
    const score = scoreGroupFit(keyword, group);
    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
    }
  });

  if (bestGroup && bestScore > 0) {
    return bestGroup.name;
  }

  return groups[0] ? groups[0].name : "Scanned IT Terms";
}

function tryParseJsonObject(text) {
  const cleaned = String(text || "").trim();
  const fenced = cleaned.replace(/```json|```/gi, "").trim();
  const firstBrace = fenced.indexOf("{");
  const lastBrace = fenced.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  const candidate = fenced.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function parseCategorizedLLMOutput(raw, groups) {
  const parsed = tryParseJsonObject(raw);
  if (parsed && Array.isArray(parsed.items)) {
    return parsed.items
      .map((item) => ({
        keyword: normalizeTerm(item.keyword),
        group: resolveBestGroupName(item.keyword, item.group, groups)
      }))
      .filter((item) => item.keyword && !STOPWORDS.has(item.keyword));
  }

  return String(raw || "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s[-:|]\s/);
      if (parts.length >= 2) {
        return { keyword: normalizeTerm(parts[0]), group: resolveBestGroupName(parts[0], parts[1], groups) };
      }
      return { keyword: normalizeTerm(line), group: resolveBestGroupName(line, "", groups) };
    })
    .filter((item) => item.keyword && !STOPWORDS.has(item.keyword));
}

function findTechnicalCandidates(text, groups) {
  const plainText = String(text || "").toLowerCase();
  const existing = getExistingKeywordSet(groups);

  const fromKnownTerms = TECH_TERMS
    .map((term) => ({ term, count: countMatches(plainText, term) }))
    .filter((item) => item.count > 0 && !existing.has(item.term.toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((item) => ({ keyword: item.term, occurrences: item.count, source: "termlist" }));

  const tokenFreq = {};
  tokenize(plainText).forEach((token) => {
    if (STOPWORDS.has(token) || existing.has(token)) {
      return;
    }
    tokenFreq[token] = (tokenFreq[token] || 0) + 1;
  });

  const fromTokens = Object.entries(tokenFreq)
    .filter(([token, count]) => count >= 3 && token.length >= 4 && !STOPWORDS.has(token))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([token, count]) => ({ keyword: token, occurrences: count, source: "token" }));

  const merged = [...fromKnownTerms];
  const known = new Set(merged.map((item) => item.keyword.toLowerCase()));
  fromTokens.forEach((item) => {
    if (!known.has(item.keyword.toLowerCase())) {
      merged.push(item);
    }
  });

  return merged.slice(0, 20);
}

function scoreText(text, state) {
  const plainText = String(text || "").toLowerCase();
  const groupBreakdown = [];
  let totalScore = 0;

  state.groups.forEach((group) => {
    let groupScore = 0;
    const keywordBreakdown = [];
    const groupWeight = Number(group.weight || 0);

    group.keywords.forEach((keywordObj) => {
      if (!keywordObj.enabled || !keywordObj.keyword) {
        return;
      }
      const count = countMatches(plainText, keywordObj.keyword);
      if (!count) {
        return;
      }
      const keywordWeight = Number(keywordObj.weight || 0);
      const score = count * (keywordWeight + groupWeight);
      groupScore += score;
      keywordBreakdown.push({ keyword: keywordObj.keyword, count, score });
    });

    if (groupScore > 0) {
      groupBreakdown.push({ groupId: group.id, groupName: group.name, score: groupScore, keywords: keywordBreakdown });
      totalScore += groupScore;
    }
  });

  const phraseBreakdown = [];
  state.phrases.forEach((phraseObj) => {
    if (!phraseObj.enabled || !phraseObj.phrase) {
      return;
    }
    const count = countMatches(plainText, phraseObj.phrase);
    if (!count) {
      return;
    }
    const score = count * Number(phraseObj.weight || 0);
    phraseBreakdown.push({
      phraseId: phraseObj.id,
      phrase: phraseObj.phrase,
      category: phraseObj.category,
      count,
      score
    });
    totalScore += score;
  });

  const phraseByCategory = {};
  phraseBreakdown.forEach((item) => {
    phraseByCategory[item.category] = (phraseByCategory[item.category] || 0) + item.score;
  });

  const technicalCandidates = findTechnicalCandidates(plainText, state.groups);
  const roundedScore = Math.round(totalScore);
  const grade = computeGrade(roundedScore, state.settings.gradeThresholds);

  return {
    totalScore: roundedScore,
    grade,
    groupBreakdown,
    phraseBreakdown,
    phraseByCategory,
    keywordSuggestions: technicalCandidates
  };
}

async function getState() {
  const stored = await chrome.storage.sync.get(["groups", "phrases", "settings", "scanHistory", "lastAnalysis"]);
  const normalized = normalizeData(stored);
  if (!normalized.settings.resumeDefaultsLoaded) {
    normalized.groups = mergeResumeDefaultsIntoGroups(normalized.groups);
    normalized.settings.resumeDefaultsLoaded = true;
  }
  await chrome.storage.sync.set({
    groups: normalized.groups,
    phrases: normalized.phrases,
    settings: normalized.settings,
    scanHistory: normalized.scanHistory
  });
  return { ...normalized, lastAnalysis: stored.lastAnalysis || null };
}

async function applyBadge(tabId, analysis, settings) {
  if (!tabId) {
    return;
  }
  const mode = settings.badgeMode;
  if (mode === "off") {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }
  const text = mode === "grade" ? analysis.grade : String(analysis.totalScore);
  await chrome.action.setBadgeBackgroundColor({ tabId, color: analysis.totalScore >= settings.alertThreshold ? "#0b8f45" : "#234876" });
  await chrome.action.setBadgeText({ tabId, text: text.slice(0, 4) });
}

async function recordHistory(payload, analysis, settings) {
  const state = await getState();
  const entry = {
    id: uid(),
    url: payload.url || "",
    title: payload.title || "Untitled",
    totalScore: analysis.totalScore,
    grade: analysis.grade,
    phraseByCategory: analysis.phraseByCategory,
    timestamp: Date.now()
  };
  const merged = [entry, ...state.scanHistory.filter((item) => item.url !== entry.url)].slice(0, settings.maxHistory || 20);
  await chrome.storage.sync.set({ scanHistory: merged, lastAnalysis: { ...analysis, ...entry } });
  return merged;
}

async function getActiveTabText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    return null;
  }
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ text: document.body ? document.body.innerText : "", title: document.title, url: location.href })
  });
  const data = result && result[0] && result[0].result ? result[0].result : null;
  return data ? { ...data, tabId: tab.id } : null;
}

async function callLLM(llmConfig, pageText, currentGroups) {
  if (!llmConfig || !llmConfig.endpoint || !llmConfig.apiKey || !llmConfig.model) {
    return { ok: false, error: "Missing LLM endpoint/apiKey/model settings." };
  }

  const existing = Array.from(getExistingKeywordSet(currentGroups)).slice(0, 200).join(", ");
  const groupNames = currentGroups.map((group) => group.name).join(", ");
  const prompt = [
    "Extract technical job keywords for IT/DevOps/Linux roles.",
    "Assign each keyword to the most relevant existing group.",
    `Allowed groups: ${groupNames}`,
    "Return strict JSON with schema: {\"items\": [{\"keyword\": \"term1\", \"group\": \"Cloud & Platform\"}] }.",
    "Avoid generic words, soft-skills-only words, and duplicates.",
    `Existing keywords: ${existing}`,
    "Page text:",
    pageText.slice(0, 12000)
  ].join("\n");

  const llmTextResult = await callLLMRawText(
    llmConfig,
    "You are a strict technical keyword extractor.",
    prompt
  );
  if (!llmTextResult.ok) {
    return llmTextResult;
  }

  const categorized = parseCategorizedLLMOutput(llmTextResult.raw, currentGroups)
    .filter((item) => item.keyword.length > 2)
    .slice(0, 30);

  const seen = new Set();
  const deduped = categorized.filter((item) => {
    const key = `${item.group}::${item.keyword}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return { ok: true, items: deduped };
}

async function callLLMRawText(llmConfig, systemPrompt, userPrompt) {
  if (!llmConfig || !llmConfig.endpoint || !llmConfig.apiKey || !llmConfig.model) {
    return { ok: false, error: "Missing LLM endpoint/apiKey/model settings." };
  }

  const provider = llmConfig.provider || "openai-compatible";
  let response;

  if (provider === "github") {
    response = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmConfig.apiKey}`
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2
      })
    });
  } else if (provider === "gemini") {
    const base = llmConfig.endpoint.replace(/\/$/, "");
    const geminiUrl = `${base}/${encodeURIComponent(llmConfig.model)}:generateContent?key=${encodeURIComponent(llmConfig.apiKey)}`;
    response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      })
    });
  } else {
    response = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmConfig.apiKey}`
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2
      })
    });
  }

  if (!response.ok) {
    return { ok: false, error: `LLM request failed (${response.status}).` };
  }

  const payload = await response.json();
  let raw = "";
  if (provider === "gemini") {
    raw = (((payload.candidates || [])[0] || {}).content || {}).parts?.map((part) => part.text || "").join("\n") || "";
  } else {
    raw = payload.choices && payload.choices[0] && payload.choices[0].message ? payload.choices[0].message.content : "";
  }
  return { ok: true, raw };
}

function sanitizePercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(num)));
}

async function evaluateResumeMatch(llmConfig, resumeText, jobText) {
  const prompt = [
    "Evaluate how well this resume matches this job description.",
    "Return strict JSON only with schema:",
    "{\"scorePercent\": 0-100, \"summary\": \"...\", \"matchedKeywords\": [\"...\"], \"missingKeywords\": [\"...\"]}",
    "Keep summary concise (max 2 sentences).",
    "Resume:",
    String(resumeText || "").slice(0, 14000),
    "Job description:",
    String(jobText || "").slice(0, 14000)
  ].join("\n");

  const llmResult = await callLLMRawText(
    llmConfig,
    "You are a strict resume-to-job evaluator that outputs valid JSON only.",
    prompt
  );
  if (!llmResult.ok) {
    return llmResult;
  }

  const parsed = tryParseJsonObject(llmResult.raw);
  if (!parsed) {
    return { ok: false, error: "Could not parse LLM response for resume match score." };
  }

  const scorePercent = sanitizePercent(parsed.scorePercent);
  if (scorePercent === null) {
    return { ok: false, error: "LLM did not return a valid scorePercent." };
  }

  return {
    ok: true,
    scorePercent,
    summary: String(parsed.summary || "").trim(),
    matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords.slice(0, 20).map((item) => String(item)) : [],
    missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords.slice(0, 20).map((item) => String(item)) : []
  };
}

async function buildKeywordsFromResume(llmConfig, resumeText, currentGroups) {
  const existing = Array.from(getExistingKeywordSet(currentGroups)).slice(0, 200).join(", ");
  const groupNames = currentGroups.map((group) => group.name).join(", ");
  const prompt = [
    "Extract practical technical keywords from this resume and assign each to the best existing group.",
    "If no suitable group exists, suggest a concise new group name.",
    `Existing groups: ${groupNames}`,
    "Return strict JSON only with schema: {\"items\":[{\"keyword\":\"...\",\"group\":\"...\"}] }",
    "Avoid duplicates and generic soft skills.",
    `Existing keywords: ${existing}`,
    "Resume:",
    String(resumeText || "").slice(0, 14000)
  ].join("\n");

  const llmResult = await callLLMRawText(
    llmConfig,
    "You are a strict technical keyword extractor that outputs valid JSON only.",
    prompt
  );
  if (!llmResult.ok) {
    return llmResult;
  }

  const parsed = parseCategorizedLLMOutput(llmResult.raw, currentGroups)
    .filter((item) => item.keyword.length > 2)
    .slice(0, 50);

  const seen = new Set();
  const items = parsed.filter((item) => {
    const key = `${item.group}::${item.keyword}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return { ok: true, items };
}

const notifiedUrls = new Set();

function safeSend(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch {
    // Popup/tab may close before async response is returned.
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  await chrome.storage.sync.set({
    groups: state.groups,
    phrases: state.phrases,
    settings: state.settings,
    scanHistory: state.scanHistory
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const state = await getState();

      if (request.action === "analyzePage") {
        const analysis = scoreText(request.text || "", state);
        const lastResumeEval = state.settings && state.settings.resumeMatchLastEvaluation;
        if (lastResumeEval && request.url && lastResumeEval.url === request.url && Number.isFinite(lastResumeEval.scorePercent)) {
          analysis.resumeMatchPercent = lastResumeEval.scorePercent;
        }
        const tabId = sender.tab && sender.tab.id;
        await applyBadge(tabId, analysis, state.settings);
        const history = await recordHistory(request, analysis, state.settings);

        if ((analysis.totalScore >= state.settings.alertThreshold) && request.url && !notifiedUrls.has(request.url)) {
          notifiedUrls.add(request.url);
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "High match job found",
            message: `${request.title || "This job"} scored ${analysis.totalScore} (${analysis.grade}).`
          });
        }

        safeSend(sendResponse, {
          ok: true,
          analysis,
          settings: state.settings,
          compareCandidates: history.slice(0, 8)
        });
        return;
      }

      if (request.action === "scanTechKeywordsFromActiveTab") {
        const tabData = await getActiveTabText();
        if (!tabData) {
          safeSend(sendResponse, { ok: false, error: "Could not access active tab." });
          return;
        }
        if (!matchesAllowedUrl(tabData.url, state.settings.allowedUrlPatterns)) {
          safeSend(sendResponse, { ok: false, error: "This URL is not enabled. Add it in Settings > Active URLs." });
          return;
        }
        const suggestions = findTechnicalCandidates(tabData.text || "", state.groups);
        safeSend(sendResponse, { ok: true, suggestions, title: tabData.title, url: tabData.url });
        return;
      }

      if (request.action === "llmSuggestKeywords") {
        const tabData = await getActiveTabText();
        if (!tabData) {
          safeSend(sendResponse, { ok: false, error: "Could not access active tab." });
          return;
        }
        if (!matchesAllowedUrl(tabData.url, state.settings.allowedUrlPatterns)) {
          safeSend(sendResponse, { ok: false, error: "This URL is not enabled. Add it in Settings > Active URLs." });
          return;
        }
        const result = await callLLM(state.settings.llmConfig, tabData.text || "", state.groups);
        safeSend(sendResponse, result);
        return;
      }

      if (request.action === "evaluateResumeMatchFromActiveTab") {
        const resumeText = String((request && request.resumeText) || "").trim();
        if (!resumeText) {
          safeSend(sendResponse, { ok: false, error: "Please upload and parse a resume first." });
          return;
        }

        const tabData = await getActiveTabText();
        if (!tabData) {
          safeSend(sendResponse, { ok: false, error: "Could not access active tab." });
          return;
        }
        if (!matchesAllowedUrl(tabData.url, state.settings.allowedUrlPatterns)) {
          safeSend(sendResponse, { ok: false, error: "This URL is not enabled. Add it in Settings > Active URLs." });
          return;
        }

        const evalResult = await evaluateResumeMatch(state.settings.llmConfig, resumeText, tabData.text || "");
        if (!evalResult.ok) {
          safeSend(sendResponse, evalResult);
          return;
        }

        const updatedSettings = {
          ...state.settings,
          resumeMatchLastEvaluation: {
            url: tabData.url,
            title: tabData.title,
            scorePercent: evalResult.scorePercent,
            summary: evalResult.summary,
            updatedAt: Date.now()
          }
        };

        await chrome.storage.sync.set({ settings: updatedSettings });

        if (tabData.tabId) {
          try {
            await chrome.tabs.sendMessage(tabData.tabId, { action: "forceRescan" });
          } catch {
            // Content script may not be attached in this tab context.
          }
        }

        safeSend(sendResponse, {
          ok: true,
          scorePercent: evalResult.scorePercent,
          summary: evalResult.summary,
          matchedKeywords: evalResult.matchedKeywords,
          missingKeywords: evalResult.missingKeywords
        });
        return;
      }

      if (request.action === "buildKeywordsFromResume") {
        const resumeText = String((request && request.resumeText) || "").trim();
        if (!resumeText) {
          safeSend(sendResponse, { ok: false, error: "Please upload and parse a resume first." });
          return;
        }

        const result = await buildKeywordsFromResume(state.settings.llmConfig, resumeText, state.groups);
        safeSend(sendResponse, result);
        return;
      }

      if (request.action === "getPopupState") {
        safeSend(sendResponse, {
          ok: true,
          groups: state.groups,
          phrases: state.phrases,
          settings: state.settings,
          scanHistory: state.scanHistory,
          lastAnalysis: state.lastAnalysis
        });
        return;
      }

      if (request.action === "saveAll") {
        const mergedPayload = {
          groups: Object.prototype.hasOwnProperty.call(request.payload || {}, "groups") ? request.payload.groups : state.groups,
          phrases: Object.prototype.hasOwnProperty.call(request.payload || {}, "phrases") ? request.payload.phrases : state.phrases,
          settings: {
            ...state.settings,
            ...((request.payload && request.payload.settings) || {}),
            gradeThresholds: {
              ...(state.settings.gradeThresholds || {}),
              ...(((request.payload && request.payload.settings) || {}).gradeThresholds || {})
            },
            llmConfig: {
              ...(state.settings.llmConfig || {}),
              ...(((request.payload && request.payload.settings) || {}).llmConfig || {})
            }
          },
          scanHistory: request.payload && Array.isArray(request.payload.scanHistory) ? request.payload.scanHistory : state.scanHistory
        };
        const normalized = normalizeData(mergedPayload);
        await chrome.storage.sync.set({
          groups: normalized.groups,
          phrases: normalized.phrases,
          settings: normalized.settings,
          scanHistory: normalized.scanHistory
        });
        safeSend(sendResponse, { ok: true });
        return;
      }

      if (request.action === "rescoreActiveTab") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          safeSend(sendResponse, { ok: false, error: "No active tab found." });
          return;
        }
        if (!matchesAllowedUrl(tab.url, state.settings.allowedUrlPatterns)) {
          safeSend(sendResponse, { ok: false, error: "This URL is not enabled. Add it in Settings > Active URLs." });
          return;
        }
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "forceRescan" });
          safeSend(sendResponse, { ok: true });
        } catch {
          safeSend(sendResponse, { ok: false, error: "Current tab does not have the extension content script loaded." });
        }
        return;
      }

      if (request.action === "compareJobs") {
        const ids = Array.isArray(request.ids) ? request.ids : [];
        const items = state.scanHistory.filter((item) => ids.includes(item.id));
        safeSend(sendResponse, { ok: true, items });
        return;
      }

      safeSend(sendResponse, { ok: false, error: "Unknown action" });
    } catch (error) {
      safeSend(sendResponse, {
        ok: false,
        error: error && error.message ? error.message : "Unexpected background error."
      });
    }
  })();

  return true;
});