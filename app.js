(() => {
  "use strict";

  const STORAGE_KEY = "swarm-signal-history-v1";
  const PROVIDER_PREFS_KEY = "swarm-signal-provider-prefs-v1";
  const DEFAULT_SCENARIO = "Will the neighborhood solar project receive approval this year?";
  const DEFAULT_OBJECTIVES = [
    "Separate verified facts from assumptions",
    "Name the timing risks and conditions that would change the estimate",
    "Surface the strongest opposing interpretation",
  ];
  const MIN_SWARM_SIZE = 24;
  const MAX_SWARM_SIZE = 5000;
  const MIN_AGENT_COUNT = 2;
  const MAX_AGENT_COUNT = 12;
  const DEFAULT_AGENT_COUNT = 6;
  const DEFAULT_TIMEOUT = 20;
  const STAGE_DEFINITIONS = [
    { key: "research", label: "Research", waiting: "Waiting for automatic source discovery", detail: "Discover sources" },
    { key: "role_panel", label: "Role panel", waiting: "The selected agents are answering", detail: "Assign agents" },
    { key: "debate", label: "Debate", waiting: "Agents are challenging the strongest arguments", detail: "Challenge signal" },
    { key: "synthesis", label: "Synthesis", waiting: "Synthesis is comparing reports", detail: "Compare reports" },
    { key: "scoring", label: "Scoring", waiting: "Local scoring is measuring support and evidence", detail: "Measure support" },
    { key: "render", label: "Render", waiting: "Rendering the locally generated argument map", detail: "Map arguments" },
  ];
  const STAGE_LABELS = STAGE_DEFINITIONS.map((stage) => stage.label);
  const STAGE_NOTES = STAGE_DEFINITIONS.map((stage) => stage.waiting);
  const STAGE_PROGRESS = [10, 28, 47, 65, 82, 94];
  const DRIVER_STRENGTHS = [84, 68, 53, 41, 30, 22, 16, 11];
  const SVG_NS = "http://www.w3.org/2000/svg";

  // This catalog is intentionally bundled so Settings remains useful when the
  // local catalog endpoint is unavailable. It contains no credentials.
  const FALLBACK_PROVIDER_CATALOG = [
    {
      id: "openai",
      name: "OpenAI",
      protocol: "openai-chat-completions",
      default_base_url: "https://api.openai.com/v1",
      supports_custom_base_url: true,
    },
    {
      id: "anthropic",
      name: "Anthropic",
      protocol: "anthropic-messages",
      default_base_url: "https://api.anthropic.com",
      supports_custom_base_url: true,
    },
    {
      id: "google_gemini",
      name: "Google Gemini",
      protocol: "gemini-generate-content",
      default_base_url: "https://generativelanguage.googleapis.com/v1beta",
      supports_custom_base_url: true,
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      protocol: "openai-chat-completions",
      default_base_url: "https://openrouter.ai/api/v1",
      supports_custom_base_url: true,
    },
    {
      id: "custom_openai_compatible",
      name: "Custom OpenAI-compatible endpoint",
      protocol: "openai-chat-completions",
      default_base_url: "",
      supports_custom_base_url: true,
    },
  ];

  const DEFAULT_MODELS = {
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-latest",
    google_gemini: "gemini-1.5-flash",
    openrouter: "openai/gpt-4o-mini",
    custom_openai_compatible: "",
  };

  // Demo results are precomputed and deliberately kept separate from every
  // request helper. Playing one of these objects never calls an API.
  const DEMO_SCENARIOS = [
    {
      id: "civic-solar",
      domainLabel: "POLICY / ENERGY",
      title: "Neighborhood solar approval",
      description: "A city council decision with permits filed and funding secured.",
      request: {
        scenario: "Will the neighborhood solar project receive approval this year?",
        context: "Funding is secured, permits are filed, and the decision is expected by December.",
        swarm_size: 256,
        domains: ["policy", "energy", "community"],
        debate_rounds: 3,
        agent_count: 4,
        objectives: ["Separate verified facts from assumptions", "Name the timing risks"],
      },
      result: {
        probability: 0.68,
        confidence: 0.74,
        outcome: "The bundled panel leans toward approval, with timing and local opposition as the main swing factors.",
        evidence_summary: "The submitted packet points to a project already moving through formal preparation, while the timing of the hearing remains the least settled condition.",
        limitations: ["Bundled sources are illustrative and were not fetched during playback.", "The packet is not a comprehensive review."],
        sources: [
          { title: "Municipal solar permitting brief", domain: "civic.example", status: "reference", excerpt: "The project is listed for a public decision window later this year." },
          { title: "Community energy program overview", domain: "energy.example", status: "context", excerpt: "Funding and interconnection preparation are identified as early gates." },
        ],
        objectives: ["Separate verified facts from assumptions", "Name the timing risks"],
        key_drivers: [
          { label: "Permits and funding are already in motion", strength: 86 },
          { label: "Decision window leaves room for a vote this year", strength: 72 },
          { label: "Community support is likely to shape the final hearing", strength: 57 },
          { label: "Grid interconnection detail remains a dependency", strength: 43 },
        ],
        uncertainties: [
          "A hearing delay could push the decision outside the stated horizon.",
          "The panel cannot verify the quality of the engineering package.",
          "Organized objections could change the council's agenda.",
        ],
        representative_roster: [
          { id: "demo-policy-01", role: "municipal process reader", domain: "policy", stance: "supportive", probability: 0.71, rationale: "The filed-permit path suggests the project is past the earliest gate." },
          { id: "demo-energy-02", role: "grid integration reviewer", domain: "energy", stance: "mixed", probability: 0.63, rationale: "The outcome depends on a clean interconnection review." },
          { id: "demo-community-03", role: "neighborhood stakeholder", domain: "community", stance: "supportive", probability: 0.69, rationale: "Visible local benefits can outweigh disruption concerns." },
          { id: "demo-risk-04", role: "schedule risk reviewer", domain: "operations", stance: "skeptical", probability: 0.54, rationale: "Committee calendars and revisions are common sources of slippage." },
        ],
         debate_messages: [
           { round: 1, speaker: "process reader", claim: "The project has crossed meaningful preparation gates.", counterclaim: "Preparation is not approval; the hearing still has to resolve objections.", cited_source_ids: ["source-01"], message: "The baseline is more favorable than an unfiled proposal, while the hearing remains a live gate." },
           { round: 2, speaker: "risk reviewer", claim: "The vote window still leaves room for approval this year.", counterclaim: "A late technical question can move the vote outside the horizon.", cited_source_ids: ["source-01", "source-02"], message: "Approval is not the same as a completed build." },
           { round: 3, speaker: "synthesis lead", claim: "The center stays favorable.", counterclaim: "The time horizon is narrower than the approval likelihood alone suggests.", cited_source_ids: ["source-01"], message: "The panel keeps a favorable center with a timing discount." },
         ],
        impact_nodes: [
          { id: "approval", label: "Approval", type: "outcome", description: "Council decision" },
          { id: "hearing", label: "Public hearing", type: "condition", description: "Timing and objections" },
          { id: "interconnect", label: "Interconnection", type: "dependency", description: "Technical review" },
          { id: "build", label: "Project build", type: "consequence", description: "Delivery after approval" },
        ],
        connections: [
          { from: "hearing", to: "approval", label: "shapes" },
          { from: "interconnect", to: "approval", label: "gates" },
          { from: "approval", to: "build", label: "unlocks" },
        ],
        decision_paths: [
          { title: "Proceed with hearing preparation", probability: 0.68, impact: "high", summary: "Keep the vote window open while resolving the technical questions.", steps: ["Publish the hearing packet", "Confirm interconnection review owner"] },
          { title: "Pause for technical review", probability: 0.32, impact: "medium", summary: "Trade schedule certainty for a stronger engineering record.", steps: ["Request revised engineering detail", "Re-baseline the vote date"] },
        ],
        swarm_size: 256,
        requested_swarm_size: 256,
        domains: ["policy", "energy", "community"],
        debate_rounds: 3,
        method: { name: "bundled-demo-playback", description: "A precomputed showcase result for policy and energy.", live_agents: false, external_data: false, requested_virtual_swarm_size: 256 },
      },
    },
    {
      id: "clinic-triage",
      domainLabel: "TECHNOLOGY / OPERATIONS",
      title: "Clinic triage pilot launch",
      description: "A regional clinic weighs a limited AI-assisted intake pilot.",
      request: {
        scenario: "Will the regional clinic launch its AI-assisted triage pilot by September?",
        context: "A vendor is selected, the pilot budget is approved, and clinical review is still underway.",
        swarm_size: 384,
        domains: ["technology", "operations", "finance"],
        debate_rounds: 4,
        agent_count: 4,
        objectives: ["Separate launch readiness from broad adoption", "Identify the safety gate"],
      },
      result: {
        probability: 0.54,
        confidence: 0.62,
        outcome: "The bundled panel sits near the center: a September pilot is plausible, but clinical review is the gating dependency.",
        evidence_summary: "The example packet supports a narrow pilot path while leaving staff readiness and clinical review unresolved.",
        limitations: ["Bundled sources are illustrative and were not fetched during playback.", "Pilot readiness is not independently verified."],
        sources: [{ title: "Clinical AI pilot checklist", domain: "care.example", status: "reference", excerpt: "Limited pilots typically require a named clinical review owner before launch." }],
        objectives: ["Separate launch readiness from broad adoption", "Identify the safety gate"],
        key_drivers: [
          { label: "Vendor selection and budget remove early blockers", strength: 79 },
          { label: "Clinical review has an explicit decision path", strength: 67 },
          { label: "Staff workflow adoption may limit the first launch", strength: 58 },
          { label: "A staged pilot lowers the operational risk", strength: 45 },
        ],
        uncertainties: ["The approval timeline is not independently verified in this playback.", "Training capacity may compete with clinic operations.", "A limited pilot can launch while broader adoption slips."],
        representative_roster: [
          { id: "demo-tech-01", role: "implementation architect", domain: "technology", stance: "supportive", probability: 0.61, rationale: "A selected vendor and limited scope create a workable first release." },
          { id: "demo-ops-02", role: "clinic operations lead", domain: "operations", stance: "skeptical", probability: 0.48, rationale: "Training and shift coverage can absorb the calendar buffer." },
          { id: "demo-finance-03", role: "budget controller", domain: "finance", stance: "supportive", probability: 0.59, rationale: "Approved pilot funding reduces the risk of an immediate pause." },
          { id: "demo-care-04", role: "clinical safety reviewer", domain: "technology", stance: "mixed", probability: 0.51, rationale: "Safety review is the highest-leverage unresolved condition." },
        ],
         debate_messages: [
           { round: 1, speaker: "implementation architect", claim: "The launch has a concrete shape.", counterclaim: "A selected vendor is not the same as an operationally ready pilot.", cited_source_ids: ["source-01"], message: "The plan is stronger than a general innovation announcement." },
           { round: 2, speaker: "clinical safety reviewer", claim: "A limited pilot can proceed with a clear review owner.", counterclaim: "Funding is not clinical approval.", cited_source_ids: ["source-01"], message: "The remaining review is a real gate." },
           { round: 3, speaker: "operations lead", claim: "A staged rollout can protect the launch window.", counterclaim: "Compressed training could leave the pilot technically live but underused.", cited_source_ids: [], message: "Workflow adoption remains a practical constraint." },
           { round: 4, speaker: "synthesis lead", claim: "A narrow pilot is achievable.", counterclaim: "Full readiness is not assured by the September date.", cited_source_ids: ["source-01"], message: "The result remains close to even." },
         ],
        impact_nodes: [
          { id: "review", label: "Clinical review", type: "gate", description: "Safety and approval" },
          { id: "pilot", label: "Pilot launch", type: "outcome", description: "September target" },
          { id: "training", label: "Staff training", type: "dependency", description: "Workflow adoption" },
          { id: "care", label: "Care intake", type: "consequence", description: "Operational effect" },
        ],
        connections: [{ from: "review", to: "pilot", label: "gates" }, { from: "training", to: "pilot", label: "enables" }, { from: "pilot", to: "care", label: "changes" }],
        decision_paths: [
          { title: "Launch a narrow supervised pilot", probability: 0.58, impact: "medium", summary: "Protect the September date by limiting scope and supervision.", steps: ["Complete clinical review", "Train a small launch cohort"] },
          { title: "Delay for broader readiness", probability: 0.42, impact: "high", summary: "Move the date to reduce adoption and safety risk.", steps: ["Expand training window", "Reassess staffing and controls"] },
        ],
        swarm_size: 384,
        requested_swarm_size: 384,
        domains: ["technology", "operations", "finance"],
        debate_rounds: 4,
        method: { name: "bundled-demo-playback", description: "A precomputed showcase result for a technology rollout with operational gates.", live_agents: false, external_data: false, requested_virtual_swarm_size: 384 },
      },
    },
    {
      id: "coastal-resilience",
      domainLabel: "CLIMATE / FINANCE",
      title: "Coastal resilience bond",
      description: "A coastal city considers whether to issue a resilience bond this fiscal year.",
      request: {
        scenario: "Will the coastal city approve a resilience bond before the end of the fiscal year?",
        context: "The capital plan identifies flood defenses, but debt capacity and public consultation remain open.",
        swarm_size: 512,
        domains: ["climate", "finance", "policy"],
        debate_rounds: 2,
        agent_count: 4,
        objectives: ["Separate authorization from issuance", "Trace the financing constraint"],
      },
      result: {
        probability: 0.43,
        confidence: 0.69,
        outcome: "The bundled panel leans against a completed bond approval this fiscal year because financing capacity and consultation are unresolved.",
        evidence_summary: "The packet gives the project a visible policy home, but debt capacity and public consultation keep the issuance path fragile.",
        limitations: ["Bundled sources are illustrative and were not fetched during playback.", "Investor appetite is not represented in the example packet."],
        sources: [{ title: "Municipal resilience financing note", domain: "climate.example", status: "reference", excerpt: "Flood defense plans can be authorized before a financing route is fully executable." }],
        objectives: ["Separate authorization from issuance", "Trace the financing constraint"],
        key_drivers: [
          { label: "The capital plan gives the project a policy home", strength: 74 },
          { label: "Debt capacity is a hard timing constraint", strength: 82 },
          { label: "Flood risk creates durable pressure to act", strength: 64 },
          { label: "Public consultation can broaden or delay the mandate", strength: 52 },
        ],
        uncertainties: ["A grant or guarantee could change the financing picture quickly.", "The fiscal-year deadline may refer to authorization rather than issuance.", "The panel has no live view of current investor appetite."],
        representative_roster: [
          { id: "demo-climate-01", role: "resilience planner", domain: "climate", stance: "supportive", probability: 0.56, rationale: "The hazard case keeps the project on the policy agenda." },
          { id: "demo-finance-02", role: "municipal debt analyst", domain: "finance", stance: "skeptical", probability: 0.34, rationale: "Debt capacity is the strongest near-term limiting condition." },
          { id: "demo-policy-03", role: "public mandate reviewer", domain: "policy", stance: "mixed", probability: 0.42, rationale: "Consultation can produce support, but adds another decision surface." },
          { id: "demo-risk-04", role: "contingency planner", domain: "climate", stance: "skeptical", probability: 0.38, rationale: "The schedule depends on a financing event outside the capital plan alone." },
        ],
         debate_messages: [
           { round: 1, speaker: "resilience planner", claim: "The need is concrete and politically legible.", counterclaim: "Need does not establish an executable financing route.", cited_source_ids: ["source-01"], message: "The hazard case keeps the project on the policy agenda." },
           { round: 2, speaker: "synthesis lead", claim: "An authorization or grant-backed step remains possible.", counterclaim: "Full bond approval this fiscal year is still fragile.", cited_source_ids: ["source-01"], message: "The panel discounts issuance while leaving room for an intermediate step." },
         ],
        impact_nodes: [
          { id: "hazard", label: "Flood risk", type: "pressure", description: "Reason to act" },
          { id: "mandate", label: "Public mandate", type: "condition", description: "Consultation" },
          { id: "capacity", label: "Debt capacity", type: "constraint", description: "Financing limit" },
          { id: "bond", label: "Bond issuance", type: "outcome", description: "Fiscal-year decision" },
        ],
        connections: [{ from: "hazard", to: "mandate", label: "motivates" }, { from: "mandate", to: "bond", label: "authorizes" }, { from: "capacity", to: "bond", label: "constrains" }],
        decision_paths: [
          { title: "Authorize the project, finance later", probability: 0.57, impact: "medium", summary: "Preserve momentum while the city develops a viable financing route.", steps: ["Complete consultation", "Approve a financing workplan"] },
          { title: "Issue the bond this fiscal year", probability: 0.43, impact: "high", summary: "Move quickly if debt capacity and an external guarantee align.", steps: ["Confirm debt headroom", "Secure investor or grant support"] },
        ],
        swarm_size: 512,
        requested_swarm_size: 512,
        domains: ["climate", "finance", "policy"],
        debate_rounds: 2,
        method: { name: "bundled-demo-playback", description: "A precomputed showcase result for climate finance and public policy.", live_agents: false, external_data: false, requested_virtual_swarm_size: 512 },
      },
    },
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const refs = {
    form: $("#forecast-form"),
    scenario: $("#scenario"),
    context: $("#context"),
    sourceUrls: $("#source-urls"),
    discoverWeb: $("#discover-web"),
    objectives: $("#objectives"),
    scenarioCount: $("#scenario-count"),
    sourceUrlsCount: $("#source-urls-count"),
    objectivesCount: $("#objectives-count"),
    scenarioError: $("#scenario-error"),
    contextError: $("#context-error"),
    sourceUrlsError: $("#source-urls-error"),
     objectivesError: $("#objectives-error"),
     agentCountFieldset: $("#agent-count-fieldset"),
     agentCountRange: $("#agent-count-range"),
     agentCountValue: $("#agent-count-value"),
     agentCountError: $("#agent-count-error"),
    domainFieldset: $("#domain-fieldset"),
    domainError: $("#domain-error"),
    swarmSizeFieldset: $("#swarm-size-fieldset"),
    swarmSizeError: $("#swarm-size-error"),
    swarmSizeRange: $("#swarm-size-range"),
    swarmSizeValue: $("#swarm-size-value"),
    rounds: $("#debate-rounds"),
    roundsValue: $("#debate-rounds-value"),
    roundsError: $("#rounds-error"),
    runButton: $("#run-swarm"),
    runButtonLabel: $("#run-swarm .button-label"),
    collectEvidenceButton: $("#collect-evidence"),
    collectEvidenceLabel: $("#collect-evidence-label"),
    formStatus: $("#form-status"),
    resetButton: $("#reset-console"),
    progress: $("#progress-panel"),
    progressFill: $("#progress-fill"),
    progressPercent: $("#progress-percent"),
    progressStage: $("#progress-stage"),
    progressNote: $("#progress-note"),
    stageItems: $$(`[data-stage]`),
    evidencePanel: $("#evidence-panel"),
    evidenceStatus: $("#evidence-status"),
    evidenceCount: $("#evidence-count"),
    evidenceSources: $("#evidence-sources"),
    evidenceLimitations: $("#evidence-limitations"),
    evidenceScopeLabel: $("#evidence-scope-label"),
    results: $("#results-panel"),
    probabilityRing: $("#probability-ring"),
    probabilityValue: $("#probability-value"),
    signalCaption: $("#signal-caption"),
    confidenceValue: $("#confidence-value"),
    confidenceTrack: $(".confidence-track"),
    confidenceFill: $("#confidence-fill"),
     confidenceNote: $("#confidence-note"),
     resultAgentCount: $("#result-agent-count"),
     resultSwarmSize: $("#result-swarm-size"),
    resultRounds: $("#result-rounds"),
    resultDomains: $("#result-domains"),
     resultLiveAgents: $("#result-live-agents"),
     resultApiCalls: $("#result-api-calls"),
     resultTiming: $("#result-timing"),
    resultGuarantee: $("#result-guarantee-badge"),
     resultSourceCount: $("#result-source-count"),
    resultLimitations: $("#result-limitations"),
    resultEvidenceScopeLabel: $("#result-evidence-scope-label"),
    resultModeBadge: $("#result-mode-badge"),
    resultModeNote: $("#result-mode-note"),
    outcome: $("#outcome-text"),
    scenarioEcho: $("#scenario-echo"),
    evidenceSummary: $("#evidence-summary"),
    resultSources: $("#result-sources"),
     objectiveResults: $("#objective-results"),
     objectivesEmpty: $("#objectives-empty"),
     agentReports: $("#agent-reports"),
     agentReportsCount: $("#agent-reports-count"),
     agentReportsEmpty: $("#agent-reports-empty"),
     agentReportsLede: $("#agent-reports-lede"),
     scoringMetrics: $("#scoring-metrics"),
     scoringMethod: $("#scoring-method"),
     agentScores: $("#agent-scores"),
     agentScoresCount: $("#agent-scores-count"),
     agentScoresEmpty: $("#agent-scores-empty"),
     impactGraph: $("#impact-graph"),
     impactEmpty: $("#impact-empty"),
     impactLegend: $("#impact-legend"),
     impactGraphText: $("#impact-graph-text"),
    decisionPaths: $("#decision-paths"),
    decisionEmpty: $("#decision-empty"),
    drivers: $("#drivers-list"),
    uncertainties: $("#uncertainty-list"),
    roster: $("#roster-list"),
    rosterCount: $("#roster-count"),
    debate: $("#debate-list"),
    debateCount: $("#debate-count"),
     methodology: $("#methodology-text"),
     timingSummary: $("#timing-summary"),
     timingTraceList: $("#timing-trace-list"),
    rerunButton: $("#rerun-swarm"),
    newForecastButton: $("#new-forecast"),
    historyList: $("#history-list"),
    historyCount: $("#history-count"),
    clearHistory: $("#clear-history"),
    connectionDot: $("[data-connection-dot]"),
    connectionStatus: $("[data-connection-status]"),
    localClock: $("[data-local-clock]"),
    modeTabs: $$(`[data-mode-tab]`),
    modePanels: $$(`[data-mode-panel]`),
    liveReadiness: $("#live-readiness"),
    liveReadinessStatus: $("#live-readiness-status"),
    openSettingsInline: $("#open-settings-inline"),
    demoScenarios: $("#demo-scenarios"),
    providerForm: $("#provider-form"),
    providerSelect: $("#provider-select"),
    providerModel: $("#provider-model"),
    providerApiKey: $("#provider-api-key"),
    providerBaseUrl: $("#provider-base-url"),
    providerBaseUrlLabel: $("#provider-base-url-label"),
    providerBaseUrlHelp: $("#provider-base-url-help"),
    providerTimeout: $("#provider-timeout"),
    testProviderButton: $("#test-provider"),
    useProviderButton: $("#use-provider"),
    providerFormError: $("#provider-form-error"),
    providerStatus: $("#provider-status"),
    providerCatalogStatus: $("#provider-catalog-status"),
    providerCatalogList: $("#provider-catalog-list"),
  };

  let isRunning = false;
  let isCollectingEvidence = false;
  let progressStageIndex = 0;
  let progressMode = "live";
  let activeMode = "live";
  let history = [];
  let lastRequest = null;
  let lastResult = null;
  let lastMode = "live";
  let lastDemoId = null;
  let lastResearchPacket = null;
  let lastResearchFingerprint = "";

  const savedProviderPreferences = readProviderPreferences();
  const providerState = {
    catalog: FALLBACK_PROVIDER_CATALOG.map((entry) => ({ ...entry })),
    source: "fallback",
    selectedId: savedProviderPreferences.providerId || "openai",
    activeConfig: null,
    catalogPromise: null,
    fieldsInitialized: false,
  };
  history = readHistory();

  function clamp(value, lower, upper) {
    return Math.min(Math.max(value, lower), upper);
  }

  function numberValue(value, fallback = null) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  function ratioValue(value, fallback = null) {
    const numeric = numberValue(value, fallback);
    if (numeric === null) return fallback;
    return clamp(numeric > 1 && numeric <= 100 ? numeric / 100 : numeric, 0, 1);
  }

  function percentValue(value, fallback = 0) {
    const numeric = numberValue(value, fallback);
    if (numeric === null) return fallback;
    return clamp(numeric <= 1 ? numeric * 100 : numeric, 0, 100);
  }

  function formatPercent(value, digits = 1) {
    return `${Number(value).toFixed(digits)}%`;
  }

  function textValue(value, fallback = "") {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return fallback;
  }

  function collectionValue(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      return Object.entries(value).map(([key, item]) => {
        if (item && typeof item === "object" && !Array.isArray(item)) return { name: key, ...item };
        return { name: key, value: item };
      });
    }
    if (typeof value === "string" && value.trim()) return [value];
    return [];
  }

  function aliasValue(source, ...names) {
    if (!source || typeof source !== "object") return undefined;
    for (const name of names) {
      if (source[name] !== undefined && source[name] !== null) return source[name];
    }
    return undefined;
  }

  function canonicalProviderId(value) {
    const key = textValue(value).toLowerCase().replace(/[-\s]+/g, "_");
    const aliases = {
      openai: "openai",
      anthropic: "anthropic",
      gemini: "google_gemini",
      google: "google_gemini",
      google_gemini: "google_gemini",
      google_gemini_api: "google_gemini",
      google_generative_ai: "google_gemini",
      openrouter: "openrouter",
      custom: "custom_openai_compatible",
      custom_openai: "custom_openai_compatible",
      custom_openai_compatible: "custom_openai_compatible",
      custom_openai_compatible_endpoint: "custom_openai_compatible",
      openai_compatible: "custom_openai_compatible",
    };
    return aliases[key] || "";
  }

  function readProviderPreferences() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PROVIDER_PREFS_KEY) || "null");
      if (!saved || typeof saved !== "object") return {};
      const timeout = numberValue(saved.timeout, DEFAULT_TIMEOUT);
      return {
        providerId: canonicalProviderId(saved.provider_id ?? saved.providerId),
        model: textValue(saved.model),
        baseUrl: textValue(saved.base_url ?? saved.baseUrl),
        timeout: timeout === null ? DEFAULT_TIMEOUT : clamp(timeout, 0.1, 60),
      };
    } catch (_error) {
      return {};
    }
  }

  function persistProviderPreferences() {
    try {
      const timeout = numberValue(refs.providerTimeout.value, DEFAULT_TIMEOUT);
      // Deliberately omit refs.providerApiKey.value. Credentials stay in the
      // activeConfig object for this page session only.
      window.localStorage.setItem(
        PROVIDER_PREFS_KEY,
        JSON.stringify({
          provider_id: providerState.selectedId,
          model: refs.providerModel.value.trim(),
          base_url: refs.providerBaseUrl.value.trim(),
          timeout: timeout === null ? DEFAULT_TIMEOUT : clamp(timeout, 0.1, 60),
        }),
      );
    } catch (_error) {
      // Private browsing contexts may deny storage; the current page still works.
    }
  }

  function scrubSecrets(value, secret) {
    if (!secret) return value;
    if (typeof value === "string") return value.split(secret).join("[redacted]");
    if (Array.isArray(value)) return value.map((item) => scrubSecrets(item, secret));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrubSecrets(item, secret)]));
    }
    return value;
  }

  function currentSecret() {
    return providerState.activeConfig?.api_key || refs.providerApiKey?.value?.trim() || "";
  }

  function createElement(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function createSvgElement(tag, className) {
    const element = document.createElementNS(SVG_NS, tag);
    if (className) element.setAttribute("class", className);
    return element;
  }

  function updateClock() {
    if (!refs.localClock) return;
    refs.localClock.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  }

  function setConnectionState(state, label) {
    refs.connectionStatus.textContent = label;
    refs.connectionDot.classList.toggle("is-online", state === "online");
    refs.connectionDot.classList.toggle("is-offline", state === "offline");
  }

  async function checkHealth() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("health check failed");
      setConnectionState("online", "LOCAL / ONLINE");
    } catch (_error) {
      setConnectionState("offline", "LOCAL / OFFLINE");
    }
  }

  function updateScenarioCount() {
    refs.scenarioCount.textContent = `${refs.scenario.value.length.toLocaleString()} / 2,000`;
  }

  function updateSourceUrlCount() {
    const count = refs.sourceUrls.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
    refs.sourceUrlsCount.textContent = `${count} / 8`;
    refs.sourceUrlsCount.classList.toggle("is-over", count > 8);
  }

  function updateObjectivesCount() {
    refs.objectivesCount.textContent = `${refs.objectives.value.length.toLocaleString()} / 2,000`;
  }

  function updateRoundsValue() {
    const rounds = Number(refs.rounds.value);
    refs.roundsValue.textContent = `${rounds} round${rounds === 1 ? "" : "s"}`;
    refs.rounds.style.setProperty("--range-progress", `${((rounds - 1) / 4) * 100}%`);
  }

  function selectedAgentCount() {
    return Number(refs.agentCountRange?.value || DEFAULT_AGENT_COUNT);
  }

  function updateAgentCountValue() {
    if (!refs.agentCountRange || !refs.agentCountValue) return;
    const value = clamp(Number(refs.agentCountRange.value) || DEFAULT_AGENT_COUNT, MIN_AGENT_COUNT, MAX_AGENT_COUNT);
    refs.agentCountRange.value = String(value);
    refs.agentCountValue.textContent = `${value} agent${value === 1 ? "" : "s"}`;
    refs.agentCountRange.style.setProperty("--range-progress", `${((value - MIN_AGENT_COUNT) / (MAX_AGENT_COUNT - MIN_AGENT_COUNT)) * 100}%`);
    $$('input[name="agent_count_preset"]', refs.form).forEach((input) => {
      input.checked = Number(input.value) === value;
    });
  }

  function selectedDomains() {
    return $$('input[name="domains"]:checked', refs.form).map((input) => input.value);
  }

  function selectedSwarmSize() {
    return Number(refs.swarmSizeRange.value || 128);
  }

  function updateSwarmSizeValue() {
    const value = clamp(Number(refs.swarmSizeRange.value) || 128, MIN_SWARM_SIZE, MAX_SWARM_SIZE);
    refs.swarmSizeRange.value = String(value);
    refs.swarmSizeValue.textContent = `${value.toLocaleString()} voices`;
    refs.swarmSizeRange.style.setProperty("--range-progress", `${((value - MIN_SWARM_SIZE) / (MAX_SWARM_SIZE - MIN_SWARM_SIZE)) * 100}%`);
    $$('input[name="swarm_size"]', refs.form).forEach((input) => {
      input.checked = Number(input.value) === value;
    });
  }

  function parseObjectives(value = refs.objectives.value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function parseSourceUrls(value = refs.sourceUrls.value) {
    const seen = new Set();
    const urls = [];
    const invalid = [];
    String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((candidate) => {
      if (seen.has(candidate)) return;
      seen.add(candidate);
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== "https:") throw new Error("unsupported protocol");
        urls.push(parsed.href);
      } catch (_error) {
        invalid.push(candidate);
      }
    });
    return { urls, invalid };
  }

  function clearValidation() {
    [refs.scenario, refs.context, refs.sourceUrls, refs.objectives, refs.rounds, refs.agentCountRange].forEach((element) => element?.removeAttribute("aria-invalid"));
    refs.domainFieldset?.removeAttribute("aria-invalid");
    refs.swarmSizeFieldset?.removeAttribute("aria-invalid");
    [refs.scenarioError, refs.contextError, refs.sourceUrlsError, refs.objectivesError, refs.domainError, refs.swarmSizeError, refs.roundsError, refs.agentCountError, refs.formStatus].forEach((element) => {
      element.textContent = "";
    });
  }

  function setFieldError(control, message, errorElement) {
    control.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
  }

  function validateForm() {
    clearValidation();
    const scenario = refs.scenario.value.trim();
    const context = refs.context.value.trim();
    const objectives = parseObjectives();
    const sourceInput = parseSourceUrls();
    const domains = selectedDomains();
    const swarmSize = selectedSwarmSize();
    const rounds = Number(refs.rounds.value) || 3;
    const agentCount = selectedAgentCount();
    let firstInvalid = null;

    if (!scenario) {
      setFieldError(refs.scenario, "Add a forecasting statement before running the panel.", refs.scenarioError);
      firstInvalid = firstInvalid || refs.scenario;
    } else if (scenario.length > 2000) {
      setFieldError(refs.scenario, "Keep the statement under 2,000 characters.", refs.scenarioError);
      firstInvalid = firstInvalid || refs.scenario;
    }
    if (context.length > 1200) {
      setFieldError(refs.context, "Keep conditions under 1,200 characters.", refs.contextError);
      firstInvalid = firstInvalid || refs.context;
    }
    // URL notes are advanced preview input only. They are deliberately not a
    // gate on the question-first live workflow; normal runs never send them.
    if (refs.objectives.value.length > 2000) {
      setFieldError(refs.objectives, "Keep objectives under 2,000 characters.", refs.objectivesError);
      firstInvalid = firstInvalid || refs.objectives;
    }
    if (!Number.isInteger(swarmSize) || swarmSize < MIN_SWARM_SIZE || swarmSize > MAX_SWARM_SIZE) {
      refs.swarmSizeFieldset?.setAttribute("aria-invalid", "true");
      if (refs.swarmSizeError) refs.swarmSizeError.textContent = "Choose a virtual swarm size from 24 to 5,000.";
      firstInvalid = firstInvalid || refs.swarmSizeFieldset;
    }
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) {
      setFieldError(refs.rounds, "Choose between 1 and 5 debate rounds.", refs.roundsError);
      firstInvalid = firstInvalid || refs.rounds;
    }
    if (!Number.isInteger(agentCount) || agentCount < MIN_AGENT_COUNT || agentCount > MAX_AGENT_COUNT) {
      refs.agentCountFieldset?.setAttribute("aria-invalid", "true");
      if (refs.agentCountError) refs.agentCountError.textContent = `Choose between ${MIN_AGENT_COUNT} and ${MAX_AGENT_COUNT} agents.`;
      firstInvalid = firstInvalid || refs.agentCountFieldset;
    }
    if (firstInvalid) {
      refs.formStatus.textContent = "Review the highlighted fields, then try again.";
      if (typeof firstInvalid.focus === "function") firstInvalid.focus();
      return null;
    }

    return {
      scenario,
      question: scenario,
      forecasting_statement: scenario,
      context,
      conditions: context,
      // Keep advanced URL notes out of the normal live request. The optional
      // preview action can still use the parsed safe subset explicitly.
      urls: [],
      source_urls: [],
      objectives,
      swarm_size: swarmSize,
      domains: domains.length ? domains : ["general"],
      debate_rounds: rounds,
      agent_count: agentCount,
      discover: true,
      advanced_urls: sourceInput.urls,
    };
  }

  function validateResearchInput(request) {
    // A question is sufficient to start bounded public discovery. Explicit
    // URLs are never a prerequisite for the normal live workflow.
    request.discover = true;
    return true;
  }

  function updateResearchButtonLabel() {
    const hasUrls = Boolean(parseSourceUrls().urls.length);
    refs.collectEvidenceLabel.textContent = hasUrls
      ? (refs.discoverWeb.checked ? "Collect evidence + discover" : "Collect evidence")
      : "Discover sources + collect evidence";
  }

  function setFormRunning(running) {
    isRunning = running;
    $$('input, textarea, button', refs.form).forEach((control) => {
      control.disabled = running;
    });
    refs.runButtonLabel.textContent = running ? "Running research swarm" : "Run research swarm";
    refs.runButton.setAttribute("aria-busy", String(running));
  }

  function setProgressStage(index, note = "") {
    progressStageIndex = clamp(index, 0, STAGE_LABELS.length - 1);
    const percentage = STAGE_PROGRESS[progressStageIndex];
    refs.progressFill.style.width = `${percentage}%`;
    refs.progressPercent.textContent = `${percentage}%`;
    refs.progressStage.textContent = STAGE_LABELS[progressStageIndex];
    refs.progressNote.textContent = note || STAGE_NOTES[progressStageIndex];
    refs.stageItems.forEach((item, itemIndex) => {
      item.classList.toggle("is-active", itemIndex === progressStageIndex);
      item.classList.toggle("is-complete", itemIndex < progressStageIndex);
      if (itemIndex === progressStageIndex) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
  }

  function showProgress(request, mode = "live") {
    progressMode = mode;
    refs.results.hidden = true;
    refs.progress.hidden = false;
    refs.progress.setAttribute("aria-busy", "true");
    refs.stageItems.forEach((item, itemIndex) => {
      const detail = $("small", item);
      if (detail) detail.textContent = STAGE_DEFINITIONS[itemIndex]?.detail || "Awaiting response";
      item.classList.toggle("is-active", itemIndex === 0);
      item.classList.remove("is-complete");
      item.removeAttribute("aria-current");
    });
    setProgressStage(0, mode === "live"
      ? (!request.urls.length
        ? "Waiting for source discovery from the statement."
        : request.discover
          ? "Waiting for source discovery and submitted source collection."
          : "Waiting for submitted source collection.")
      : `Loading a bundled ${request.swarm_size.toLocaleString()}-voice example from local demo memory.`);
  }

  function stopProgress() {
    refs.progress.setAttribute("aria-busy", "false");
  }

  function finishProgress(result = null) {
    stopProgress();
    const timing = result?.timing;
    setProgressStage(5, timing?.returned ? "Rendering the returned signal and locally generated argument map." : "Signal returned; provider timing metadata was not returned.");
    refs.progressFill.style.width = "100%";
    refs.progressPercent.textContent = "100%";
    refs.progressStage.textContent = "Signal ready";
    refs.progressNote.textContent = progressMode === "live"
      ? (timing?.returned
        ? `Trace complete. ${timingSummaryText(timing)} Evidence scope remains bounded and is not comprehensive.`
        : "Trace complete. The provider returned no stage durations; timing not returned. Evidence scope remains bounded and is not comprehensive.")
      : "Trace complete. This demo result came from bundled memory; no API key or network call was used.";
    refs.stageItems.forEach((item) => {
      item.classList.remove("is-active");
      item.classList.add("is-complete");
      item.removeAttribute("aria-current");
    });
  }

  async function readJsonResponse(response, fallbackMessage) {
    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }
    if (!response.ok) {
      const apiError = payload?.error;
      const error = new Error(apiError?.message || fallbackMessage || `Request failed with HTTP ${response.status}.`);
      error.apiCode = apiError?.code || "request_failed";
      error.field = apiError?.field || null;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function requestResearch(researchRequest) {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(researchRequest),
    });
    return readJsonResponse(response, "The evidence packet could not be collected.");
  }

  async function requestLiveSimulation(request, providerConfig, researchPacket) {
    const livePayload = {
      question: request.question || request.scenario,
      scenario: request.scenario,
      agent_count: request.agent_count,
      // The live endpoint accepts this flag for compatibility; the research
      // endpoint and the backend default both keep discovery enabled.
      discover: true,
      research_enabled: true,
      research_packet: researchPacket,
      provider: providerConfig,
    };
    // Optional details remain useful when a user deliberately opens the
    // advanced brief, while the untouched question-first form stays minimal.
    if (request.context) livePayload.context = request.context;
    if (request.objectives.length) livePayload.objectives = request.objectives;
    if (request.domains.length && !(request.domains.length === 1 && request.domains[0] === "general")) livePayload.domains = request.domains;
    if (request.swarm_size !== 128) livePayload.swarm_size = request.swarm_size;
    if (request.debate_rounds !== 3) livePayload.debate_rounds = request.debate_rounds;
    const response = await fetch("/api/live-simulate", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      // The provider config is sent only in this request body. It is never
      // copied into lastRequest, browser storage, a URL, or rendered output.
      body: JSON.stringify(livePayload),
    });
    return readJsonResponse(response, "The live panel could not complete this run.");
  }

  function normalizeDrivers(rawDrivers) {
    return collectionValue(rawDrivers).map((item, index) => {
      if (typeof item === "string") return { label: item, strength: DRIVER_STRENGTHS[index] || 10 };
      const source = item && typeof item === "object" ? item : {};
      const rawStrength = aliasValue(source, "strength", "impact", "score", "value", "weight");
      return {
        label: textValue(aliasValue(source, "label", "name", "title", "description"), `Driver ${index + 1}`),
        strength: rawStrength === undefined ? DRIVER_STRENGTHS[index] || 10 : percentValue(rawStrength, DRIVER_STRENGTHS[index] || 10),
      };
    });
  }

  function normalizeUncertainties(rawUncertainties) {
    return collectionValue(rawUncertainties).map((item) => {
      if (typeof item === "string") return item;
      const source = item && typeof item === "object" ? item : {};
      return textValue(aliasValue(source, "text", "label", "description", "message", "name"), "Uncertainty remains in the signal.");
    });
  }

  function normalizeRoster(rawRoster) {
    return collectionValue(rawRoster).map((item, index) => {
      const source = item && typeof item === "object" ? item : {};
      return {
        id: textValue(aliasValue(source, "id", "agent_id", "agentId"), `agent-${String(index + 1).padStart(3, "0")}`),
        role: textValue(aliasValue(source, "role", "title"), "synthetic lens"),
        domain: textValue(aliasValue(source, "domain", "lens"), "general"),
        stance: textValue(aliasValue(source, "stance", "position", "view"), "mixed").toLowerCase(),
        probability: ratioValue(aliasValue(source, "estimated_probability", "estimatedProbability", "probability", "value"), null),
        rationale: textValue(aliasValue(source, "rationale", "reason", "explanation"), "A representative synthetic perspective in this panel."),
      };
    });
  }

  function normalizeTextList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (item && typeof item === "object") return textValue(aliasValue(item, "id", "source_id", "sourceId", "label", "name"));
        return textValue(item);
      }).filter(Boolean);
    }
    if (typeof value === "string") return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
    return [];
  }

  function normalizeAgentReports(rawReports, request = {}) {
    return collectionValue(rawReports).map((item, index) => {
      const source = item && typeof item === "object" ? item : { answer: item };
      const answer = textValue(aliasValue(source, "answer", "response", "report", "raw_answer", "rawAnswer", "text", "content"), "No answer was returned.");
      const claim = textValue(aliasValue(source, "claim", "assertion", "supporting_claim", "supportingClaim"), answer || "No claim supplied.");
      const counterclaim = textValue(aliasValue(source, "counterclaim", "counter_claim", "counterClaim", "challenge", "challenging_claim", "challengingClaim"), "No counterclaim supplied.");
      const rebuttal = textValue(aliasValue(source, "rebuttal", "rebuttal_summary", "rebuttalSummary", "concession"), "No rebuttal supplied.");
      const stance = textValue(aliasValue(source, "stance", "position", "view"), "mixed").toLowerCase();
      const question = textValue(aliasValue(source, "question", "scenario", "prompt"), request.question || request.scenario || "");
      return {
        id: textValue(aliasValue(source, "agent_id", "agentId", "id"), `live-agent-${String(index + 1).padStart(2, "0")}`),
        role: textValue(aliasValue(source, "role", "title"), "panel role"),
        domain: textValue(aliasValue(source, "domain", "lens"), "general"),
        question,
        answer,
        stance,
        position: textValue(aliasValue(source, "position", "stance", "view"), stance),
        confidence: ratioValue(aliasValue(source, "confidence", "certainty", "confidence_percent", "confidencePercent"), null),
        claim,
        counterclaim,
        rebuttal,
        citedSourceIds: normalizeTextList(aliasValue(source, "cited_source_ids", "citedSourceIds", "source_ids", "sourceIds", "citations", "cited_sources", "citedSources")),
        openQuestions: normalizeTextList(aliasValue(source, "open_questions", "openQuestions", "questions", "unresolved")),
      };
    }).filter((report) => report.answer || report.claim || report.counterclaim || report.rebuttal);
  }

  function normalizeAgentScores(rawScores, reports = []) {
    const sourceScores = collectionValue(rawScores);
    if (sourceScores.length) {
      return sourceScores.map((item, index) => {
        const source = item && typeof item === "object" ? item : {};
        return {
          id: textValue(aliasValue(source, "agent_id", "agentId", "id"), reports[index]?.id || `live-agent-${String(index + 1).padStart(2, "0")}`),
          role: textValue(aliasValue(source, "role", "title"), reports[index]?.role || "panel role"),
          domain: textValue(aliasValue(source, "domain", "lens"), reports[index]?.domain || "general"),
          evidenceCount: numberValue(aliasValue(source, "evidence_count", "evidenceCount", "cited_source_count", "citedSourceCount"), 0),
          stance: textValue(aliasValue(source, "stance", "position"), reports[index]?.stance || "mixed"),
          confidence: ratioValue(aliasValue(source, "confidence", "certainty"), reports[index]?.confidence ?? null),
          supportScore: ratioValue(aliasValue(source, "support_score", "supportScore", "support"), 0),
          oppositionScore: ratioValue(aliasValue(source, "opposition_score", "oppositionScore", "opposition"), 0),
          argumentQuality: ratioValue(aliasValue(source, "argument_quality", "argumentQuality", "quality", "score"), 0),
          citedSourceIds: normalizeTextList(aliasValue(source, "cited_source_ids", "citedSourceIds")),
        };
      });
    }
    return reports.map((report) => ({
      id: report.id,
      role: report.role,
      domain: report.domain,
      evidenceCount: report.citedSourceIds.length,
      stance: report.stance,
      confidence: report.confidence,
      supportScore: report.stance.includes("support") ? (report.confidence ?? 0.5) : 0,
      oppositionScore: report.stance.includes("opp") || report.stance.includes("skept") ? (report.confidence ?? 0.5) : 0,
      argumentQuality: report.confidence ?? 0.5,
      citedSourceIds: report.citedSourceIds,
    }));
  }

  function normalizeScoring(rawScoring, reports = [], sources = []) {
    const source = rawScoring && typeof rawScoring === "object" ? rawScoring : {};
    const method = source.method && typeof source.method === "object" ? source.method : {};
    return {
      evidenceCoverage: ratioValue(aliasValue(source, "evidence_coverage", "evidenceCoverage", "coverage"), sources.length ? 0 : 0),
      supportScore: ratioValue(aliasValue(source, "support_score", "supportScore", "support"), 0),
      oppositionScore: ratioValue(aliasValue(source, "opposition_score", "oppositionScore", "opposition"), 0),
      consensus: ratioValue(aliasValue(source, "consensus", "consensus_score", "consensusScore"), reports.length > 1 ? 0 : null),
      disagreement: ratioValue(aliasValue(source, "disagreement", "disagreement_score", "disagreementScore"), reports.length > 1 ? 0 : null),
      method: textValue(aliasValue(method, "description", "name"), "Local deterministic scoring from evidence citations and role reports."),
      limits: normalizeTextList(aliasValue(source, "limits", "limitations")),
    };
  }

  function normalizeDebateEntry(item, index, fallbackType = "synthesis_round") {
    if (typeof item === "string") {
      return {
        type: fallbackType,
        round: index + 1,
        speaker: "synthesis lead",
        agentId: "",
        role: "synthesis lead",
        domain: "",
        question: "",
        answer: "",
        claim: item,
        counterclaim: "",
        rebuttal: "",
        conclusion: "",
        message: item,
        citedSourceIds: [],
        openQuestions: [],
        confidence: null,
      };
    }
    const source = item && typeof item === "object" ? item : {};
    return {
      type: textValue(aliasValue(source, "type", "record_type", "recordType"), fallbackType),
      round: numberValue(aliasValue(source, "round", "round_number", "roundNumber"), index + 1),
      speaker: textValue(aliasValue(source, "speaker", "role", "agent", "author"), fallbackType === "agent_report" ? "panel agent" : "synthesis lead"),
      agentId: textValue(aliasValue(source, "agent_id", "agentId", "id")),
      role: textValue(aliasValue(source, "role", "title")),
      domain: textValue(aliasValue(source, "domain", "lens")),
      question: textValue(aliasValue(source, "question", "scenario", "prompt")),
      answer: textValue(aliasValue(source, "answer", "response", "report", "raw_answer", "rawAnswer")),
      claim: textValue(aliasValue(source, "claim", "assertion", "position", "support", "supporting_claim", "supportingClaim")),
      counterclaim: textValue(aliasValue(source, "counterclaim", "counter_claim", "counterClaim", "challenge", "opposition", "challenging_claim", "challengingClaim")),
      rebuttal: textValue(aliasValue(source, "rebuttal", "rebuttal_summary", "rebuttalSummary", "concession")),
      conclusion: textValue(aliasValue(source, "conclusion", "resolution", "result")),
      message: textValue(aliasValue(source, "message", "text", "content", "summary")),
      citedSourceIds: normalizeTextList(aliasValue(source, "cited_source_ids", "citedSourceIds", "source_ids", "sourceIds", "citations", "cited_sources", "citedSources")),
      openQuestions: normalizeTextList(aliasValue(source, "open_questions", "openQuestions")),
      confidence: ratioValue(aliasValue(source, "confidence", "certainty"), null),
    };
  }

  function normalizeDebate(rawDebate) {
    if (rawDebate && typeof rawDebate === "object" && !Array.isArray(rawDebate)) {
      const reports = normalizeAgentReports(aliasValue(rawDebate, "agent_reports", "agentReports", "reports"));
      const rounds = collectionValue(aliasValue(rawDebate, "synthesis_rounds", "synthesisRounds", "rounds", "messages"))
        .map((item, index) => normalizeDebateEntry(item, index, "synthesis_round"));
      const rawRecords = collectionValue(aliasValue(rawDebate, "records", "transcript"));
      const records = rawRecords.length
        ? rawRecords.map((item, index) => normalizeDebateEntry(item, index, textValue(item?.type) || "synthesis_round"))
        : [
            ...reports.map((report, index) => normalizeDebateEntry({ ...report, type: "agent_report" }, index, "agent_report")),
            ...rounds,
          ];
      return { agentReports: reports, synthesisRounds: rounds, records };
    }
    const rounds = collectionValue(rawDebate).map((item, index) => normalizeDebateEntry(item, index, "synthesis_round"));
    return { agentReports: [], synthesisRounds: rounds, records: rounds };
  }

  function safeHttpUrl(value) {
    const candidate = textValue(value);
    if (!candidate) return "";
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch (_error) {
      return "";
    }
  }

  function sourceDomain(url, fallback = "unknown domain") {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./i, "") || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function normalizeSources(rawSources) {
    return collectionValue(rawSources).map((item, index) => {
      const source = item && typeof item === "object" ? item : { title: item };
      const url = safeHttpUrl(aliasValue(source, "url", "source_url", "sourceUrl", "href", "link"));
      return {
        id: textValue(aliasValue(source, "id", "source_id", "sourceId"), `source-${index + 1}`),
        title: textValue(aliasValue(source, "title", "name", "source_title", "sourceTitle"), `Submitted source ${index + 1}`),
        domain: textValue(aliasValue(source, "domain", "hostname", "site"), sourceDomain(url)),
        status: textValue(aliasValue(source, "status", "source_status", "sourceStatus", "type"), "submitted"),
        excerpt: textValue(aliasValue(source, "excerpt", "snippet", "summary", "text", "description"), "No excerpt was returned for this source."),
        url,
      };
    });
  }

  function normalizeLimitations(rawLimitations) {
    return normalizeUncertainties(rawLimitations).filter(Boolean);
  }

  function normalizeObjectives(rawObjectives) {
    if (Array.isArray(rawObjectives)) return rawObjectives.map((item) => textValue(item)).filter(Boolean).slice(0, 12);
    if (typeof rawObjectives === "string") return parseObjectives(rawObjectives);
    return [];
  }

  function normalizeResearchPacket(raw, request = {}) {
    const container = raw?.research_packet ?? raw?.researchPacket ?? raw?.packet ?? raw ?? {};
    const rawSources = aliasValue(container, "sources", "evidence_sources", "evidenceSources", "source_cards", "sourceCards", "citations")
      ?? aliasValue(raw, "sources", "evidence_sources", "evidenceSources", "citations");
    const sources = normalizeSources(rawSources);
    const submittedUrls = Array.isArray(request.urls) ? [...request.urls] : [];
    const sourceCount = numberValue(aliasValue(container, "source_count", "sourceCount", "evidence_count", "evidenceCount", "count"), sources.length);
    const summary = textValue(aliasValue(container, "evidence_summary", "evidenceSummary", "summary", "overview", "synthesis"), "");
    const limitations = normalizeLimitations(aliasValue(container, "limitations", "evidence_limitations", "evidenceLimitations", "caveats", "limits"));
    const objectives = normalizeObjectives(aliasValue(container, "objectives", "agent_objectives", "agentObjectives"))
      .concat(normalizeObjectives(request.objectives)).filter((item, index, values) => values.indexOf(item) === index).slice(0, 12);
    const discoveryRaw = aliasValue(container, "discovery", "discovery_status", "discoveryStatus")
      ?? aliasValue(raw, "discovery", "research_discovery", "researchDiscovery");
    const discovery = discoveryRaw && typeof discoveryRaw === "object"
      ? {
          requested: discoveryRaw.requested === true,
          status: textValue(discoveryRaw.status, "not_requested"),
          foundCount: numberValue(discoveryRaw.found_count ?? discoveryRaw.foundCount, 0),
          error: textValue(discoveryRaw.error, ""),
        }
      : {
          requested: request.discover === true,
          status: request.discover === true ? "pending" : "not_requested",
          foundCount: 0,
          error: "",
        };
    return {
      statement: textValue(aliasValue(container, "statement", "scenario", "forecasting_statement", "forecastingStatement"), textValue(request.scenario)),
      sources,
      sourceCount: sourceCount === null ? sources.length : Math.max(0, sourceCount),
      summary: summary || (sources.length ? `The packet contains ${sources.length} submitted source${sources.length === 1 ? "" : "s"}.` : "No evidence summary was returned."),
      limitations: limitations.length ? limitations : [
        discovery.requested ? "Statement discovery used a small public result set; this packet is not comprehensive." : "Submitted URLs only; this packet is not comprehensive.",
        "Source status reflects the returned packet and is not independent verification.",
      ],
      submittedUrls,
      objectives,
      scopeLabel: discovery.requested
        ? "Statement discovery · small public result set · not comprehensive"
        : "Submitted URLs only · not comprehensive",
      discovery,
    };
  }

  function graphKey(value) {
    return textValue(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  function graphEndpoint(value, fallback = "") {
    if (value && typeof value === "object") {
      const id = textValue(aliasValue(value, "id", "node_id", "nodeId", "key", "claim_id", "claimId", "counterclaim_id", "counterclaimId"));
      const label = textValue(aliasValue(value, "label", "name", "title", "claim", "counterclaim", "text", "description"));
      return { value: id || label || fallback, label: label || id || fallback };
    }
    const text = textValue(value, fallback);
    return { value: text, label: text };
  }

  function normalizeImpactNodes(rawNodes) {
    const seen = new Set();
    return collectionValue(rawNodes).map((item, index) => {
      const source = item && typeof item === "object" ? item : { label: item };
      const endpoint = graphEndpoint(aliasValue(source, "id", "node_id", "nodeId", "key", "claim_id", "claimId", "counterclaim_id", "counterclaimId", "claim", "counterclaim"), `impact-node-${index + 1}`);
      const baseId = endpoint.value.replace(/\s+/g, "-") || `impact-node-${index + 1}`;
      let id = baseId || `impact-node-${index + 1}`;
      let suffix = 2;
      while (seen.has(graphKey(id))) id = `${baseId}-${suffix++}`;
      seen.add(graphKey(id));
      const label = textValue(aliasValue(source, "label", "name", "title", "claim", "counterclaim", "text"), endpoint.label || `Impact node ${index + 1}`);
      return {
        id,
        label,
        type: textValue(aliasValue(source, "type", "category", "kind", "argument_type", "argumentType"), "signal"),
        description: textValue(aliasValue(source, "description", "summary", "detail", "explanation"), "Returned impact node."),
        impact: ratioValue(aliasValue(source, "impact", "impact_score", "impactScore", "weight", "score"), null),
        impactLabel: textValue(aliasValue(source, "impact_label", "impactLabel", "impact_level", "impactLevel")),
      };
    });
  }

  function normalizeConnections(rawConnections) {
    return collectionValue(rawConnections).map((item) => {
      const source = item && typeof item === "object" ? item : {};
      const rawFrom = aliasValue(source, "from", "source", "source_id", "sourceId", "from_id", "fromId", "claim_id", "claimId", "claim");
      const rawTo = aliasValue(source, "to", "target", "target_id", "targetId", "to_id", "toId", "counterclaim_id", "counterclaimId", "counterclaim");
      const fromEndpoint = graphEndpoint(rawFrom);
      const toEndpoint = graphEndpoint(rawTo);
      const argumentStyle = aliasValue(source, "claim", "counterclaim", "claim_id", "counterclaim_id", "claimId", "counterclaimId") !== undefined;
      const rawStrength = aliasValue(source, "strength", "impact", "weight", "score", "confidence");
      const relationship = textValue(aliasValue(source, "label", "relationship", "relation", "description", "type"), argumentStyle ? "challenges" : "connects");
      return {
        from: fromEndpoint.value,
        to: toEndpoint.value,
        fromLabel: fromEndpoint.label,
        toLabel: toEndpoint.label,
        label: relationship,
        relationship,
        strength: rawStrength === undefined ? null : ratioValue(rawStrength, null),
        strengthLabel: typeof rawStrength === "string" && ratioValue(rawStrength, null) === null ? rawStrength : "",
      };
    }).filter((connection) => connection.from && connection.to);
  }

  function mergeGraphNodes(nodes, connections) {
    const result = [...nodes];
    const known = new Map();
    result.forEach((node) => {
      [node.id, node.label].map(graphKey).filter(Boolean).forEach((key) => known.set(key, node));
    });
    connections.forEach((connection) => {
      [[connection.from, connection.fromLabel, "argument"], [connection.to, connection.toLabel, "argument"]].forEach(([value, label, type]) => {
        const key = graphKey(value) || graphKey(label);
        if (!key || known.has(key)) return;
        const node = {
          id: textValue(value, `argument-${result.length + 1}`).replace(/\s+/g, "-"),
          label: textValue(label, value),
          type,
          description: "Node derived from a returned argument connection.",
          impact: null,
          impactLabel: "",
        };
        result.push(node);
        [node.id, node.label].map(graphKey).filter(Boolean).forEach((nodeKey) => known.set(nodeKey, node));
      });
    });
    return result;
  }

  function buildLocalArgumentMap(question, sources, reports, outcome) {
    const nodes = [{ id: "question", type: "central_question", label: question, description: "Question sent to every selected agent." }];
    const edges = [{ source: "question", target: "outcome", relationship: "resolves_to", strength: null }];
    const sourceNodeIds = new Map();
    const addNode = (node) => {
      if (!nodes.some((existing) => graphKey(existing.id) === graphKey(node.id))) nodes.push(node);
    };
    sources.slice(0, 8).forEach((source, index) => {
      const id = textValue(source.id, `source-${index + 1}`);
      const nodeId = `evidence-${id}`;
      sourceNodeIds.set(graphKey(id), nodeId);
      addNode({ id: nodeId, type: "evidence", label: source.title || id, description: source.excerpt || "Bounded public evidence.", impact: null });
      edges.push({ source: nodeId, target: "question", relationship: "informs", strength: null });
    });
    reports.slice(0, MAX_AGENT_COUNT).forEach((report, index) => {
      const agentId = textValue(report.id, `agent-${index + 1}`);
      const claimId = `${agentId}-claim`;
      const counterclaimId = `${agentId}-counterclaim`;
      addNode({ id: claimId, type: "agent_claim", label: report.claim, description: `${report.role} · ${report.domain}`, impact: report.confidence, confidence: report.confidence, stance: report.stance });
      addNode({ id: counterclaimId, type: "agent_counterclaim", label: report.counterclaim, description: `${report.role} · challenge`, impact: report.confidence });
      edges.push({ source: "question", target: claimId, relationship: "frames", strength: report.confidence });
      edges.push({ source: claimId, target: counterclaimId, relationship: "answers_with_counterclaim", strength: report.confidence });
      edges.push({ source: claimId, target: "outcome", relationship: report.stance.includes("opp") || report.stance.includes("skept") ? "opposes" : report.stance.includes("support") ? "supports" : "qualifies", strength: report.confidence });
      edges.push({ source: counterclaimId, target: "outcome", relationship: "challenges", strength: report.confidence });
      report.citedSourceIds.forEach((sourceId) => {
        const sourceNodeId = sourceNodeIds.get(graphKey(sourceId));
        if (sourceNodeId) edges.push({ source: sourceNodeId, target: claimId, relationship: "supports", strength: report.confidence });
      });
    });
    addNode({ id: "outcome", type: "outcome", label: outcome, description: "Synthesis outcome from the bounded panel." });
    return {
      version: 1,
      generated_locally: true,
      nodes: nodes.slice(0, 64),
      edges: edges.slice(0, 192),
    };
  }

  function normalizeDecisionPaths(rawPaths) {
    return collectionValue(rawPaths).map((item, index) => {
      const source = item && typeof item === "object" ? item : { title: item };
      const rawSteps = aliasValue(source, "steps", "actions", "sequence", "conditions");
      return {
        id: textValue(aliasValue(source, "id", "path_id", "pathId"), `path-${index + 1}`),
        title: textValue(aliasValue(source, "title", "name", "label"), `Path ${index + 1}`),
        probability: ratioValue(aliasValue(source, "probability", "probability_percent", "probabilityPercent", "likelihood"), null),
        impact: textValue(aliasValue(source, "impact", "impact_level", "impactLevel", "effect"), "Unspecified"),
        summary: textValue(aliasValue(source, "summary", "description", "outcome", "rationale", "trigger"), "No path summary was returned."),
        steps: Array.isArray(rawSteps) ? rawSteps.map((step) => textValue(step)).filter(Boolean).slice(0, 8) : rawSteps ? [textValue(rawSteps)] : aliasValue(source, "trigger") ? [textValue(aliasValue(source, "trigger"))] : [],
      };
    });
  }

  function canonicalStageKey(value) {
    const key = textValue(value).toLowerCase().replace(/[-\s]+/g, "_");
    if (key.includes("research") || key.includes("discover") || key.includes("evidence")) return "research";
    if (key.includes("role") || key.includes("agent") || key.includes("panel")) return "role_panel";
    if (key.includes("debate") || key.includes("challenge") || key.includes("round")) return "debate";
    if (key.includes("synth") || key.includes("compare") || key.includes("aggregate")) return "synthesis";
    if (key.includes("score") || key.includes("evaluate") || key.includes("analysis")) return "scoring";
    if (key.includes("render") || key.includes("impact") || key.includes("map")) return "render";
    return "";
  }

  function durationMilliseconds(value) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
    if (typeof value !== "string" || !value.trim()) return null;
    const text = value.trim().toLowerCase();
    const match = text.match(/(-?\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|seconds?|m|minutes?)?/);
    if (!match) return null;
    const number = Number(match[1]);
    if (!Number.isFinite(number)) return null;
    const unit = match[2] || "ms";
    const multiplier = unit.startsWith("m") && !unit.startsWith("ms") ? 60_000 : unit.startsWith("s") ? 1_000 : 1;
    return Math.max(0, number * multiplier);
  }

  function normalizeTiming(rawTiming) {
    const emptyStages = STAGE_DEFINITIONS.map((stage) => ({ ...stage, status: "timing not returned", durationMs: null }));
    if (!rawTiming || (typeof rawTiming !== "object" && !Array.isArray(rawTiming))) {
      return { returned: false, stages: emptyStages, totalDurationMs: null };
    }

    const entries = [];
    const pushEntry = (key, value) => {
      const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const stageName = textValue(aliasValue(source, "stage", "name", "key", "id"), key);
      const canonical = canonicalStageKey(stageName);
      if (!canonical) return;
      const rawDuration = aliasValue(source, "duration_ms", "durationMs", "elapsed_ms", "elapsedMs", "latency_ms", "latencyMs", "duration", "elapsed")
        ?? (typeof value === "number" || typeof value === "string" ? value : undefined);
      entries.push({
        key: canonical,
        status: textValue(aliasValue(source, "status", "state", "result"), typeof value === "string" ? value : "reported") || "reported",
        durationMs: durationMilliseconds(rawDuration),
      });
    };

    if (Array.isArray(rawTiming)) {
      rawTiming.forEach((item, index) => pushEntry(item?.stage ?? item?.name ?? item?.key ?? `stage-${index + 1}`, item));
    } else {
      const nested = aliasValue(rawTiming, "stages", "stage_timings", "stageTimings", "steps", "events");
      if (Array.isArray(nested)) nested.forEach((item, index) => pushEntry(item?.stage ?? item?.name ?? item?.key ?? `stage-${index + 1}`, item));
      else if (nested && typeof nested === "object") Object.entries(nested).forEach(([key, value]) => pushEntry(key, value));
      Object.entries(rawTiming).forEach(([key, value]) => {
        if (["stages", "stage_timings", "stageTimings", "steps", "events", "total", "total_ms", "totalMs", "duration_ms", "durationMs", "elapsed_ms", "elapsedMs", "status"].includes(key)) return;
        pushEntry(key, value);
      });
    }

    const totalDurationMs = durationMilliseconds(aliasValue(rawTiming, "total_duration_ms", "totalDurationMs", "total_ms", "totalMs", "duration_ms", "durationMs", "total_duration", "total"));
    const stages = STAGE_DEFINITIONS.map((definition) => {
      const reported = entries.find((entry) => entry.key === definition.key);
      return reported ? { ...definition, ...reported } : { ...definition, status: "timing not returned", durationMs: null };
    });
    return {
      returned: entries.length > 0 || totalDurationMs !== null,
      stages,
      totalDurationMs,
      status: textValue(aliasValue(rawTiming, "status", "state"), ""),
    };
  }

  function normalizeResult(raw, request, fallbackResearchPacket = null) {
    if (!raw || typeof raw !== "object") throw new Error("The simulation returned an unreadable response.");
    const payload = raw.result && typeof raw.result === "object" && raw.probability === undefined && raw.probabilityPercent === undefined ? raw.result : raw;
    const probability = ratioValue(aliasValue(payload, "probability", "probability_percent", "probabilityPercent", "likelihood"), null);
    const confidence = ratioValue(aliasValue(payload, "confidence", "confidence_percent", "confidencePercent", "certainty"), null);
    if (probability === null || confidence === null) throw new Error("The simulation response did not include a probability and confidence signal.");

    const method = payload.method && typeof payload.method === "object" ? payload.method : payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
    const rawOutcome = aliasValue(payload, "outcome", "outcome_statement", "outcomeStatement", "summary", "result");
    const outcomeObject = rawOutcome && typeof rawOutcome === "object" ? rawOutcome : null;
    const favorable = probability >= 0.5;
    const outcome = textValue(outcomeObject?.statement ?? outcomeObject?.text ?? rawOutcome, `The panel leans ${favorable ? "favorable" : "unfavorable"} for this statement.`);
    const rawDomains = aliasValue(payload, "domains", "domain_lenses", "domainLenses") ?? request.domains;
    const domains = (Array.isArray(rawDomains) ? rawDomains : collectionValue(rawDomains)).map((domain) => textValue(domain)).filter(Boolean);
    const normalizedRoster = normalizeRoster(aliasValue(payload, "roster", "representative_roster", "representativeRoster"));
    const swarmSize = numberValue(aliasValue(payload, "swarm_size", "swarmSize", "requested_swarm_size", "requestedSwarmSize"), request.swarm_size);
    const requestedSwarmSize = numberValue(aliasValue(payload, "requested_swarm_size", "requestedSwarmSize", "requested_virtual_swarm_size", "requestedVirtualSwarmSize") ?? aliasValue(method, "requested_virtual_swarm_size", "requestedVirtualSwarmSize"), swarmSize);
    const requestedAgentCount = numberValue(aliasValue(payload, "requested_agent_count", "requestedAgentCount", "agent_count", "agentCount", "num_agents", "number_of_agents") ?? aliasValue(method, "requested_agent_count", "requestedAgentCount"), request.agent_count ?? null);
    const liveAgentCount = numberValue(aliasValue(payload, "live_agent_count", "liveAgentCount", "bounded_live_agent_count", "boundedLiveAgentCount") ?? aliasValue(method, "live_agent_count", "liveAgentCount", "bounded_live_agent_count", "boundedLiveAgentCount"), null);
    const totalApiCalls = numberValue(aliasValue(payload, "total_api_calls", "totalApiCalls", "provider_calls", "providerCalls") ?? aliasValue(method, "total_api_calls", "totalApiCalls"), null);
    const rawResearch = aliasValue(payload, "research_packet", "researchPacket", "evidence_packet", "evidencePacket", "research", "evidence");
    const researchPacket = rawResearch ? normalizeResearchPacket(rawResearch, request) : fallbackResearchPacket || normalizeResearchPacket(null, request);
    const rawSources = aliasValue(payload, "sources", "evidence_sources", "evidenceSources", "citations", "source_citations", "sourceCitations");
    if (rawSources !== undefined) researchPacket.sources = normalizeSources(rawSources);
    researchPacket.sourceCount = numberValue(aliasValue(payload, "source_count", "sourceCount", "evidence_count", "evidenceCount"), researchPacket.sourceCount ?? researchPacket.sources.length);
    researchPacket.summary = textValue(aliasValue(payload, "evidence_summary", "evidenceSummary", "research_summary", "researchSummary"), researchPacket.summary);
    const responseLimitations = normalizeLimitations(aliasValue(payload, "limitations", "evidence_limitations", "evidenceLimitations", "research_limitations", "researchLimitations"));
    if (responseLimitations.length) researchPacket.limitations = responseLimitations;
    const question = textValue(aliasValue(payload, "question", "scenario", "forecasting_statement", "forecastingStatement"), request.question || request.scenario);
    const rawAgentReports = aliasValue(payload, "agent_reports", "agentReports", "role_reports", "roleReports", "reports");
    const agentReports = normalizeAgentReports(rawAgentReports, { ...request, question });
    const rawTranscript = aliasValue(payload, "debate_transcript", "debateTranscript");
    const debateTranscript = normalizeDebate(rawTranscript ?? aliasValue(payload, "debate", "debate_messages", "debateMessages", "transcript"));
    const rosterReports = normalizedRoster.map((agent) => ({
      id: agent.id,
      role: agent.role,
      domain: agent.domain,
      question,
      answer: agent.rationale,
      stance: agent.stance,
      position: agent.stance,
      confidence: agent.probability,
      claim: agent.rationale,
      counterclaim: "No counterclaim supplied in this legacy response.",
      rebuttal: "No rebuttal supplied in this legacy response.",
      citedSourceIds: [],
      openQuestions: [],
    }));
    const completeAgentReports = agentReports.length ? agentReports : debateTranscript.agentReports.length ? debateTranscript.agentReports : rosterReports;
    const transcriptHasAgentReports = debateTranscript.records.some((record) => record.type === "agent_report");
    const completeDebateTranscript = transcriptHasAgentReports
      ? debateTranscript
      : {
          ...debateTranscript,
          agentReports: completeAgentReports,
          records: [
            ...completeAgentReports.map((report, index) => normalizeDebateEntry({ ...report, type: "agent_report" }, index, "agent_report")),
            ...debateTranscript.records,
          ],
        };
    const explicitArgumentMap = aliasValue(payload, "argument_map", "argumentMap");
    const explicitNodes = explicitArgumentMap && typeof explicitArgumentMap === "object"
      ? aliasValue(explicitArgumentMap, "nodes", "claims")
      : undefined;
    const explicitEdges = explicitArgumentMap && typeof explicitArgumentMap === "object"
      ? aliasValue(explicitArgumentMap, "edges", "connections", "arguments")
      : undefined;
    const legacyGraph = aliasValue(payload, "impact_graph", "impactGraph", "cross_argument_map", "crossArgumentMap", "graph")
      ?? payload.impactMap ?? payload.impact_map;
    const legacyNodes = aliasValue(payload, "impact_nodes", "impactNodes", "argument_nodes", "argumentNodes", "claims")
      ?? legacyGraph?.nodes ?? legacyGraph?.claims;
    const legacyConnections = aliasValue(payload, "connections", "impact_connections", "impactConnections", "argument_edges", "argumentEdges", "cross_argument_edges", "crossArgumentEdges", "argument_connections", "argumentConnections", "arguments")
      ?? (Array.isArray(legacyGraph) ? legacyGraph : legacyGraph?.connections ?? legacyGraph?.edges ?? legacyGraph?.arguments);
    const hasExplicitMap = collectionValue(explicitNodes).length > 0 || collectionValue(explicitEdges).length > 0;
    const localArgumentMap = buildLocalArgumentMap(question, researchPacket.sources, completeAgentReports, outcome);
    const mapNodes = hasExplicitMap ? explicitNodes : completeAgentReports.length || researchPacket.sources.length ? localArgumentMap.nodes : legacyNodes;
    const mapEdges = hasExplicitMap ? explicitEdges : completeAgentReports.length || researchPacket.sources.length ? localArgumentMap.edges : legacyConnections;
    const normalizedConnections = normalizeConnections(mapEdges);
    const normalizedNodes = mergeGraphNodes(normalizeImpactNodes(mapNodes), normalizedConnections);
    const mapWasGeneratedLocally = explicitArgumentMap?.generated_locally === true
      || explicitArgumentMap?.generatedLocally === true
      || !hasExplicitMap;
    const argumentMap = {
      ...(hasExplicitMap && explicitArgumentMap && typeof explicitArgumentMap === "object" ? explicitArgumentMap : {}),
      version: numberValue(explicitArgumentMap?.version, 1),
      generated_locally: mapWasGeneratedLocally,
      nodes: normalizedNodes,
      edges: normalizedConnections,
    };
    const rawTiming = aliasValue(payload, "timing", "timings", "trace", "stage_timings", "stageTimings", "progress_stages", "progressStages", "progress", "durations")
      ?? aliasValue(method, "timing", "timings", "trace", "stage_timings", "stageTimings", "progress", "durations");
    const timing = normalizeTiming(rawTiming);
    timing.note = textValue(aliasValue(payload, "timing_note", "timingNote"), "");
    const rawPaths = aliasValue(payload, "decision_paths", "decisionPaths", "paths");
    const safeRaw = scrubSecrets(payload, currentSecret());
    return {
      normalized: true,
      raw: safeRaw,
      scenario: question,
      question,
      domains: domains.length ? domains : request.domains,
      swarmSize,
      requestedSwarmSize,
      requestedAgentCount,
      debateRounds: numberValue(aliasValue(payload, "debate_rounds", "debateRounds"), request.debate_rounds),
      probability,
      confidence,
      outcome,
      drivers: normalizeDrivers(aliasValue(payload, "drivers", "key_drivers", "keyDrivers")),
      uncertainties: normalizeUncertainties(aliasValue(payload, "uncertainties", "uncertainty", "uncertainty_notes", "uncertaintyNotes")),
      roster: normalizedRoster,
      debate: debateTranscript.synthesisRounds,
      debateTranscript: completeDebateTranscript,
      agentReports: completeAgentReports,
      scoring: normalizeScoring(aliasValue(payload, "scoring", "score", "argument_scoring"), completeAgentReports, researchPacket.sources),
      agentScores: normalizeAgentScores(aliasValue(payload, "agent_scores", "agentScores", "per_agent_scores", "perAgentScores"), completeAgentReports),
      objectives: normalizeObjectives(aliasValue(payload, "objectives", "agent_objectives", "agentObjectives"))
        .concat(normalizeObjectives(request.objectives)).filter((item, index, values) => values.indexOf(item) === index).slice(0, 12),
      researchPacket,
      impactNodes: normalizedNodes,
      connections: normalizedConnections,
      argumentMap,
      decisionPaths: normalizeDecisionPaths(rawPaths),
      metadata: method,
      timing,
      liveAgentCount,
      totalApiCalls,
    };
  }

  function renderSourceCards(target, sources, emptyMessage, compact = false) {
    target.replaceChildren();
    if (!sources.length) {
      target.append(createElement("p", "empty-state", emptyMessage));
      return;
    }
    const fragment = document.createDocumentFragment();
    sources.slice(0, 8).forEach((source) => {
      const card = createElement("article", compact ? "source-card source-card-compact" : "source-card");
      const top = createElement("div", "source-card-top");
      const title = createElement("strong", "source-title", source.title);
      const status = createElement("span", "source-status", source.status);
      top.append(title, status);
      const meta = createElement("div", "source-meta");
      meta.append(createElement("span", "source-domain", source.domain), createElement("span", "source-kind", source.url ? "URL" : "PACKET"));
      const excerpt = createElement("p", "source-excerpt", source.excerpt);
      card.append(top, meta, excerpt);
      if (source.url) {
        const link = createElement("a", "source-link", "Open submitted source");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        card.append(link);
      }
      fragment.append(card);
    });
    target.append(fragment);
  }

  function renderEvidencePacket(packet) {
    const safePacket = packet || normalizeResearchPacket(null, { urls: [], discover: true });
    refs.evidenceCount.textContent = String(safePacket.sourceCount ?? safePacket.sources.length);
    if (safePacket.discovery?.requested) {
      refs.evidenceStatus.textContent = safePacket.sources.length
        ? `Packet ready from ${safePacket.sources.length} discovered public source${safePacket.sources.length === 1 ? "" : "s"}.`
        : safePacket.discovery.error || "No public sources were discovered for this statement.";
    } else {
      refs.evidenceStatus.textContent = safePacket.sources.length
        ? `Packet ready from ${safePacket.sources.length} submitted source${safePacket.sources.length === 1 ? "" : "s"}.`
        : "No sources were returned. Add optional URLs or let the next live run discover a small public result set.";
    }
    refs.evidenceLimitations.textContent = safePacket.limitations.join(" ");
    refs.evidenceScopeLabel.textContent = safePacket.discovery?.requested
      ? "Statement discovery · small public result set · not comprehensive"
      : "Submitted URLs only · not comprehensive";
    renderSourceCards(refs.evidenceSources, safePacket.sources, "Sources, status, and short excerpts will appear here.");
  }

  function renderObjectives(objectives) {
    refs.objectiveResults.replaceChildren();
    refs.objectivesEmpty.hidden = objectives.length > 0;
    objectives.forEach((objective) => {
      const item = createElement("li", "objective-result-item");
      item.append(createElement("span", "objective-bullet", "○"), createElement("span", "", objective));
      refs.objectiveResults.append(item);
    });
  }

  function renderDrivers(drivers) {
    refs.drivers.replaceChildren();
    const items = drivers.length ? drivers : [{ label: "No explicit driver text was returned; inspect the uncertainty panel.", strength: 28 }];
    items.slice(0, 8).forEach((driver) => {
      const item = createElement("li", "driver-item");
      const heading = createElement("div", "driver-heading");
      heading.append(createElement("span", "driver-name", driver.label), createElement("span", "driver-value", `${Math.round(driver.strength)} / relative`));
      const bar = createElement("div", "driver-bar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", `Relative emphasis: ${driver.label}`);
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", String(Math.round(driver.strength)));
      const fill = createElement("span");
      fill.style.width = `${clamp(driver.strength, 0, 100)}%`;
      bar.append(fill);
      item.append(heading, bar);
      refs.drivers.append(item);
    });
  }

  function renderUncertainties(uncertainties) {
    refs.uncertainties.replaceChildren();
    const items = uncertainties.length ? uncertainties : ["The panel returned no additional uncertainty notes."];
    items.slice(0, 6).forEach((uncertainty) => {
      const card = createElement("article", "uncertainty-card");
      card.append(createElement("span", "uncertainty-icon", "!"), createElement("p", "", uncertainty));
      refs.uncertainties.append(card);
    });
  }

  function stanceClass(stance) {
    if (stance.includes("skept")) return "is-skeptical";
    if (stance.includes("mixed") || stance.includes("neutral")) return "is-mixed";
    return "";
  }

  function appendLabeledText(parent, label, value, className = "agent-report-field") {
    const wrapper = createElement("div", className);
    wrapper.append(createElement("span", "agent-report-field-label", label), createElement("p", "agent-report-field-value", textValue(value, "Not returned.")));
    parent.append(wrapper);
  }

  function renderAgentReports(reports, requestedCount = null) {
    refs.agentReports.replaceChildren();
    refs.agentReportsEmpty.hidden = reports.length > 0;
    refs.agentReportsCount.textContent = `${reports.length || requestedCount || 0} AGENT${(reports.length || requestedCount || 0) === 1 ? "" : "S"}`;
    refs.agentReportsLede.textContent = reports.length
      ? `Each of the ${reports.length} returned agents answered the question independently before the full debate.`
      : "No structured agent reports were returned for this run.";
    reports.forEach((report, index) => {
      const details = createElement("details", "agent-report-card");
      if (index === 0) details.open = true;
      const summary = createElement("summary", "agent-report-summary");
      const summaryMain = createElement("span", "agent-report-summary-main");
      summaryMain.append(createElement("strong", "agent-report-role", report.role), createElement("span", "agent-report-domain", report.domain));
      const summaryMeta = createElement("span", "agent-report-summary-meta");
      summaryMeta.append(createElement("span", "agent-report-stance", report.position || report.stance), createElement("span", "agent-report-confidence", report.confidence === null ? "confidence —" : formatPercent(report.confidence)));
      summary.append(summaryMain, summaryMeta);
      const body = createElement("div", "agent-report-body");
      const identity = createElement("div", "agent-report-identity");
      identity.append(createElement("span", "agent-report-id", report.id), createElement("span", "agent-report-domain-detail", `${report.role} · ${report.domain}`));
      body.append(identity);
      appendLabeledText(body, "Question answered", report.question);
      appendLabeledText(body, "Answer", report.answer);
      const argumentGrid = createElement("div", "agent-report-argument-grid");
      appendLabeledText(argumentGrid, "Position / stance", report.position || report.stance, "agent-report-field agent-report-field-compact");
      appendLabeledText(argumentGrid, "Confidence", report.confidence === null ? "Not returned" : formatPercent(report.confidence), "agent-report-field agent-report-field-compact");
      appendLabeledText(argumentGrid, "Claim", report.claim, "agent-report-field agent-report-field-compact");
      appendLabeledText(argumentGrid, "Counterclaim", report.counterclaim, "agent-report-field agent-report-field-compact");
      appendLabeledText(argumentGrid, "Rebuttal", report.rebuttal, "agent-report-field agent-report-field-compact");
      body.append(argumentGrid);
      const citations = createElement("div", "agent-report-citations");
      citations.append(createElement("span", "agent-report-field-label", "Cited source IDs"));
      if (report.citedSourceIds.length) report.citedSourceIds.forEach((sourceId) => citations.append(createElement("span", "debate-citation", sourceId)));
      else citations.append(createElement("span", "agent-report-muted", "No source IDs cited"));
      body.append(citations);
      const openQuestions = createElement("div", "agent-report-open-questions");
      openQuestions.append(createElement("span", "agent-report-field-label", "Open questions"));
      if (report.openQuestions.length) {
        const list = createElement("ul", "agent-report-question-list");
        report.openQuestions.forEach((question) => list.append(createElement("li", "", question)));
        openQuestions.append(list);
      } else {
        openQuestions.append(createElement("p", "agent-report-muted", "No open questions returned."));
      }
      body.append(openQuestions);
      details.append(summary, body);
      refs.agentReports.append(details);
    });
  }

  function renderScoring(scoring, scores) {
    const metrics = [
      ["Evidence coverage", scoring.evidenceCoverage],
      ["Support", scoring.supportScore],
      ["Opposition", scoring.oppositionScore],
      ["Consensus", scoring.consensus],
      ["Disagreement", scoring.disagreement],
    ];
    refs.scoringMetrics.replaceChildren();
    metrics.forEach(([label, value]) => {
      const card = createElement("div", "score-metric");
      const heading = createElement("div", "score-metric-heading");
      heading.append(createElement("span", "score-metric-label", label), createElement("strong", "score-metric-value", value === null ? "—" : formatPercent(value)));
      const track = createElement("div", "score-bar");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", label);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", value === null ? "0" : String(Math.round(value * 100)));
      const fill = createElement("span");
      fill.style.width = value === null ? "0%" : `${clamp(value * 100, 0, 100)}%`;
      track.append(fill);
      card.append(heading, track);
      refs.scoringMetrics.append(card);
    });
    refs.scoringMethod.textContent = scoring.method || "Local deterministic scoring from evidence citations and role reports.";
    if (scoring.limits.length) refs.scoringMethod.textContent += ` ${scoring.limits.join(" ")}`;

    refs.agentScores.replaceChildren();
    refs.agentScoresEmpty.hidden = scores.length > 0;
    refs.agentScoresCount.textContent = `${scores.length} AGENT${scores.length === 1 ? "" : "S"}`;
    scores.forEach((score) => {
      const card = createElement("article", "agent-score-card");
      const top = createElement("div", "agent-score-top");
      top.append(createElement("strong", "agent-score-role", score.role), createElement("span", "agent-score-domain", `${score.domain} · ${score.stance}`));
      const scoreLine = createElement("div", "agent-score-line");
      scoreLine.append(createElement("span", "agent-score-id", score.id), createElement("span", "agent-score-value", `${formatPercent(score.argumentQuality ?? 0)} quality`));
      const track = createElement("div", "score-bar agent-score-bar");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${score.role} argument quality`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(Math.round((score.argumentQuality ?? 0) * 100)));
      const fill = createElement("span");
      fill.style.width = `${clamp((score.argumentQuality ?? 0) * 100, 0, 100)}%`;
      track.append(fill);
      const meta = createElement("p", "agent-score-meta", `${score.evidenceCount} cited source${score.evidenceCount === 1 ? "" : "s"} · ${score.confidence === null ? "confidence —" : `${formatPercent(score.confidence)} confidence`}`);
      card.append(top, scoreLine, track, meta);
      refs.agentScores.append(card);
    });
  }

  function renderRoster(roster) {
    refs.roster.replaceChildren();
    refs.rosterCount.textContent = `${roster.length} lens${roster.length === 1 ? "" : "es"}`;
    if (!roster.length) {
      refs.roster.append(createElement("p", "empty-state", "No representative roster was returned for this run."));
      return;
    }
    roster.slice(0, 8).forEach((agent) => {
      const card = createElement("article", "roster-card");
      const top = createElement("div", "roster-card-top");
      top.append(createElement("span", "roster-agent-id", agent.id), createElement("span", `roster-stance ${stanceClass(agent.stance)}`, agent.stance));
      const role = createElement("strong", "roster-role", agent.role);
      const meta = createElement("div", "roster-card-meta");
      meta.append(createElement("span", "", agent.domain), createElement("span", "roster-probability", agent.probability === null ? "stance —" : formatPercent(agent.probability)));
      const rationale = createElement("p", "roster-rationale", agent.rationale);
      card.append(top, role, meta, rationale);
      refs.roster.append(card);
    });
  }

  function renderDebate(transcript) {
    const records = transcript?.records || [];
    const rounds = transcript?.synthesisRounds || [];
    refs.debate.replaceChildren();
    refs.debateCount.textContent = `${records.length} record${records.length === 1 ? "" : "s"} · ${rounds.length} round${rounds.length === 1 ? "" : "s"}`;
    if (!records.length) {
      refs.debate.append(createElement("li", "debate-item", "No transcript messages were returned for this run."));
      return;
    }
    records.forEach((entry, index) => {
      const item = createElement("li", "debate-item");
      const heading = createElement("div", "debate-heading");
      const recordLabel = entry.type === "agent_report" ? "Agent report" : `Round ${entry.round}`;
      heading.append(createElement("span", "debate-round", recordLabel), createElement("span", "debate-speaker", entry.speaker || entry.role || `record ${index + 1}`));
      item.append(heading);
      if (entry.question) appendLabeledText(item, "Question", entry.question, "debate-inline-field");
      if (entry.answer) appendLabeledText(item, "Answer", entry.answer, "debate-inline-field");
      if (entry.claim || entry.counterclaim || entry.rebuttal) {
        const comparison = createElement("div", "debate-comparison");
        if (entry.claim) {
          const support = createElement("article", "debate-argument debate-argument-support");
          support.append(createElement("span", "debate-argument-label", "Claim"), createElement("p", "", entry.claim));
          comparison.append(support);
        }
        if (entry.counterclaim) {
          const challenge = createElement("article", "debate-argument debate-argument-challenge");
          challenge.append(createElement("span", "debate-argument-label", "Counterclaim"), createElement("p", "", entry.counterclaim));
          comparison.append(challenge);
        }
        if (entry.rebuttal) {
          const rebuttal = createElement("article", "debate-argument debate-argument-rebuttal");
          rebuttal.append(createElement("span", "debate-argument-label", "Rebuttal / concession"), createElement("p", "", entry.rebuttal));
          comparison.append(rebuttal);
        }
        item.append(comparison);
      }
      if (entry.citedSourceIds.length) {
        const citations = createElement("div", "debate-citations");
        citations.append(createElement("span", "debate-citations-label", "Cited sources"));
        entry.citedSourceIds.forEach((sourceId) => citations.append(createElement("span", "debate-citation", sourceId)));
        item.append(citations);
      }
      if (entry.conclusion) appendLabeledText(item, "Conclusion", entry.conclusion, "debate-inline-field");
      if (entry.message) item.append(createElement("p", "debate-message", entry.message));
      if (entry.openQuestions.length) appendLabeledText(item, "Open questions", entry.openQuestions.join(" · "), "debate-inline-field");
      refs.debate.append(item);
    });
  }

  function nodeEndpoint(value, nodesById, nodesByLabel) {
    const key = graphKey(value);
    return nodesById.get(key) || nodesByLabel.get(key) || null;
  }

  function renderImpactGraph(nodes, connections) {
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const safeConnections = Array.isArray(connections) ? connections : [];
    refs.impactGraph.replaceChildren();
    refs.impactGraphText.replaceChildren();
    refs.impactEmpty.hidden = safeNodes.length > 0;
    refs.impactGraph.hidden = safeNodes.length === 0;
    if (refs.impactLegend) refs.impactLegend.hidden = safeNodes.length === 0;
    if (!safeNodes.length) {
      refs.impactGraphText.append(createElement("li", "empty-state", "No structured nodes or connections were returned for this argument map."));
      return;
    }

    const width = 720;
    const columns = Math.min(3, Math.max(1, safeNodes.length));
    const nodeWidth = columns === 1 ? 300 : 198;
    const nodeHeight = 92;
    const rowGap = 54;
    const rows = Math.ceil(safeNodes.length / columns);
    const height = Math.max(320, 46 + rows * (nodeHeight + rowGap));
    refs.impactGraph.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const defs = createSvgElement("defs");
    const marker = createSvgElement("marker");
    marker.setAttribute("id", "impact-arrow");
    marker.setAttribute("markerWidth", "9");
    marker.setAttribute("markerHeight", "9");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "4.5");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "userSpaceOnUse");
    const arrow = createSvgElement("path");
    arrow.setAttribute("d", "M0,0 L9,4.5 L0,9 Z");
    arrow.setAttribute("fill", "#444440");
    marker.append(arrow);
    defs.append(marker);
    refs.impactGraph.append(defs);

    const xStep = width / (columns + 1);
    const positions = new Map();
    safeNodes.forEach((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      positions.set(node.id, { x: xStep * (column + 1), y: 46 + nodeHeight / 2 + row * (nodeHeight + rowGap), width: nodeWidth, height: nodeHeight });
    });
    const nodesById = new Map();
    const nodesByLabel = new Map();
    safeNodes.forEach((node) => {
      [node.id].map(graphKey).filter(Boolean).forEach((key) => nodesById.set(key, node));
      [node.label].map(graphKey).filter(Boolean).forEach((key) => nodesByLabel.set(key, node));
    });
    const edgeLayer = createSvgElement("g", "impact-edges");
    const nodeLayer = createSvgElement("g", "impact-nodes");

    const edgeAnchor = (point, other) => {
      const dx = other.x - point.x;
      const dy = other.y - point.y;
      const scale = 1 / Math.max(Math.abs(dx) / (point.width / 2), Math.abs(dy) / (point.height / 2), 1);
      return { x: point.x + dx * scale, y: point.y + dy * scale };
    };

    safeConnections.forEach((connection) => {
      const from = nodeEndpoint(connection.from, nodesById, nodesByLabel) || nodeEndpoint(connection.fromLabel, nodesById, nodesByLabel);
      const to = nodeEndpoint(connection.to, nodesById, nodesByLabel) || nodeEndpoint(connection.toLabel, nodesById, nodesByLabel);
      if (!from || !to || graphKey(from.id) === graphKey(to.id)) return;
      const startCenter = positions.get(from.id);
      const endCenter = positions.get(to.id);
      if (!startCenter || !endCenter) return;
      const start = edgeAnchor(startCenter, endCenter);
      const end = edgeAnchor(endCenter, startCenter);
      const line = createSvgElement("line", "impact-edge");
      const strength = connection.strength === null ? 0.45 : clamp(connection.strength, 0.1, 1);
      line.setAttribute("x1", String(start.x));
      line.setAttribute("y1", String(start.y));
      line.setAttribute("x2", String(end.x));
      line.setAttribute("y2", String(end.y));
      line.setAttribute("marker-end", "url(#impact-arrow)");
      line.setAttribute("stroke-width", String(1.1 + strength * 2.5));
      line.setAttribute("opacity", String(0.48 + strength * 0.48));
      const strengthText = connection.strength === null
        ? connection.strengthLabel
        : `${Math.round(connection.strength * 100)}% strength`;
      const edgeText = `${from.label} to ${to.label}${connection.label ? `: ${connection.label}` : ""}${strengthText ? ` (${strengthText})` : ""}`;
      line.setAttribute("aria-label", edgeText);
      const title = createSvgElement("title");
      title.textContent = edgeText;
      line.append(title);
      edgeLayer.append(line);
      const label = createSvgElement("text", "impact-edge-label");
      label.setAttribute("x", String((start.x + end.x) / 2));
      label.setAttribute("y", String((start.y + end.y) / 2 - 8));
      label.setAttribute("text-anchor", "middle");
      label.textContent = `${connection.label || "connects"}${strengthText ? ` · ${strengthText}` : ""}`;
      edgeLayer.append(label);
    });

    const shorten = (value, length) => {
      const text = textValue(value);
      return text.length > length ? `${text.slice(0, length - 1)}…` : text;
    };
    safeNodes.forEach((node) => {
      const point = positions.get(node.id);
      const group = createSvgElement("g", "impact-node");
      group.setAttribute("tabindex", "0");
      group.setAttribute("focusable", "true");
      group.setAttribute("role", "group");
      const impactText = node.impact === null ? (node.impactLabel || "impact not returned") : `${Math.round(node.impact * 100)}% impact`;
      group.setAttribute("aria-label", `${node.label}: ${node.description}. ${node.type}. ${impactText}.`);
      group.setAttribute("data-node-id", node.id);
      const title = createSvgElement("title");
      title.textContent = `${node.label}: ${node.description}`;
      const rect = createSvgElement("rect", "impact-node-shape");
      rect.setAttribute("x", String(point.x - point.width / 2));
      rect.setAttribute("y", String(point.y - point.height / 2));
      rect.setAttribute("width", String(point.width));
      rect.setAttribute("height", String(point.height));
      rect.setAttribute("rx", "8");
      rect.setAttribute("stroke-width", String(node.impact === null ? 1.2 : 1.2 + node.impact * 1.8));
      const label = createSvgElement("text", "impact-node-label");
      label.setAttribute("x", String(point.x));
      label.setAttribute("y", String(point.y - 23));
      label.setAttribute("text-anchor", "middle");
      label.textContent = shorten(node.label, columns === 1 ? 32 : 23);
      const type = createSvgElement("text", "impact-node-type");
      type.setAttribute("x", String(point.x));
      type.setAttribute("y", String(point.y - 8));
      type.setAttribute("text-anchor", "middle");
      type.textContent = `${shorten(node.type, 20)} · ${impactText}`;
      const description = createSvgElement("text", "impact-node-description");
      description.setAttribute("x", String(point.x));
      description.setAttribute("y", String(point.y + 12));
      description.setAttribute("text-anchor", "middle");
      description.textContent = shorten(node.description, columns === 1 ? 42 : 25);
      const cue = createSvgElement("text", "impact-node-cue");
      cue.setAttribute("x", String(point.x));
      cue.setAttribute("y", String(point.y + 31));
      cue.setAttribute("text-anchor", "middle");
      cue.textContent = "focus for details";
      group.append(title, rect, label, type, description, cue);
      nodeLayer.append(group);

      const fallback = createElement("li", "graph-text-item");
      fallback.append(createElement("strong", "", node.label), createElement("span", "", `${node.type} · ${node.description} · ${impactText}`));
      refs.impactGraphText.append(fallback);
    });
    refs.impactGraph.append(edgeLayer, nodeLayer);
    const connectionsLabel = createElement("li", "graph-text-connections", "Connections");
    safeConnections.forEach((connection) => {
      const from = nodeEndpoint(connection.from, nodesById, nodesByLabel) || { label: connection.fromLabel || connection.from };
      const to = nodeEndpoint(connection.to, nodesById, nodesByLabel) || { label: connection.toLabel || connection.to };
      const strengthText = connection.strength === null
        ? connection.strengthLabel
        : `${Math.round(connection.strength * 100)}% strength`;
      connectionsLabel.append(createElement("span", "", `${from.label} → ${to.label}${connection.label ? ` · ${connection.label}` : ""}${strengthText ? ` · ${strengthText}` : ""}`));
    });
    if (connectionsLabel.childElementCount > 0) refs.impactGraphText.append(connectionsLabel);
    else refs.impactGraphText.append(createElement("li", "graph-text-connections", "No connections were returned for these nodes."));
  }

  function renderDecisionPaths(paths) {
    refs.decisionPaths.replaceChildren();
    refs.decisionEmpty.hidden = paths.length > 0;
    paths.slice(0, 8).forEach((path) => {
      const card = createElement("article", "decision-path-card");
      card.dataset.pathId = path.id;
      const top = createElement("div", "decision-path-top");
      top.append(createElement("h4", "", path.title));
      const probability = path.probability === null ? "—" : formatPercent(path.probability);
      top.append(createElement("span", "decision-path-probability", probability));
      const impact = createElement("span", "decision-path-impact", `Impact · ${path.impact}`);
      card.append(top, impact, createElement("p", "decision-path-summary", path.summary));
      if (path.steps.length) {
        const list = createElement("ol", "decision-path-steps");
        path.steps.forEach((step) => list.append(createElement("li", "", step)));
        card.append(list);
      }
      refs.decisionPaths.append(card);
    });
  }

  function formatDuration(milliseconds) {
    if (milliseconds === null || milliseconds === undefined || !Number.isFinite(Number(milliseconds))) return "timing not returned";
    const value = Number(milliseconds);
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
    return `${Math.round(value)} ms`;
  }

  function timingSummaryText(timing) {
    if (!timing?.returned) return "timing not returned";
    const reported = (timing.stages || []).filter((stage) => stage.durationMs !== null || stage.status !== "timing not returned").length;
    if (timing.totalDurationMs !== null && timing.totalDurationMs !== undefined) return `Total ${formatDuration(timing.totalDurationMs)} · ${reported}/${STAGE_DEFINITIONS.length} stages reported`;
    return `${reported}/${STAGE_DEFINITIONS.length} stages reported`;
  }

  function updateStageRailTiming(timing) {
    refs.stageItems.forEach((item, index) => {
      const detail = $("small", item);
      const stage = timing?.stages?.[index];
      if (!detail || !stage) return;
      detail.textContent = timing.returned
        ? `${textValue(stage.status, "reported")} · ${formatDuration(stage.durationMs)}`
        : "timing not returned";
      item.setAttribute("aria-label", `${stage.label}: ${detail.textContent}`);
    });
  }

  function renderTimingTrace(timing, mode) {
    const normalized = timing || normalizeTiming(null);
    const summary = mode === "demo" ? "bundled playback · timing not returned" : timingSummaryText(normalized);
    refs.resultTiming.textContent = summary;
    refs.timingSummary.textContent = summary;
    refs.timingTraceList.replaceChildren();
    normalized.stages.forEach((stage) => {
      const item = createElement("li", `timing-trace-item${stage.status === "timing not returned" ? " is-missing" : ""}`);
      item.append(
        createElement("strong", "", stage.label),
        createElement("span", "timing-status", mode === "demo" ? "bundled playback · timing not returned" : stage.status),
        createElement("span", "timing-duration", mode === "demo" ? "timing not returned" : formatDuration(stage.durationMs)),
      );
      refs.timingTraceList.append(item);
    });
    if (normalized.note && mode === "live") refs.timingTraceList.append(createElement("li", "timing-trace-note", normalized.note));
    updateStageRailTiming(mode === "demo" ? normalizeTiming(null) : normalized);
  }

  function renderMethodology(metadata, mode, result) {
    if (mode === "live") {
      const description = textValue(metadata?.description, "A provider-assisted synthesis of bounded role perspectives.");
      const costNote = textValue(metadata?.cost_safety_note ?? metadata?.costSafetyNote, "The requested virtual size is metadata and does not multiply provider usage.");
      refs.methodology.textContent = `This is a live provider-assisted signal, not a real-world guarantee. ${description} ${costNote} Treat the output as a prompt for better questions and human judgment.`;
      return;
    }
    const description = textValue(metadata?.description, "A precomputed, dependency-free showcase result.");
    const requested = result?.requestedSwarmSize ? ` It represents a requested ${Number(result.requestedSwarmSize).toLocaleString()}-voice virtual panel.` : "";
    refs.methodology.textContent = `This is bundled demo playback, not a real-world guarantee. ${description}${requested} It used no API key and made no network calls. Treat the output as a prompt for better questions and human judgment.`;
  }

  function renderResultMode(result, mode) {
    const live = mode === "live";
    refs.resultModeBadge.className = `mode-badge ${live ? "mode-badge-live" : "mode-badge-demo"}`;
    refs.resultModeBadge.textContent = live ? "LIVE" : "DEMO";
    refs.resultGuarantee.textContent = "NO GUARANTEE";
    if (!live) {
      refs.resultModeNote.textContent = "Bundled playback · no API key / no network calls.";
      return;
    }
    const requested = Number(result.requestedSwarmSize || result.swarmSize || 0).toLocaleString();
    const requestedAgents = result.requestedAgentCount === null || result.requestedAgentCount === undefined ? "the selected agent count" : `${result.requestedAgentCount} agents`;
    const agentText = result.liveAgentCount === null ? "a bounded live panel" : `${result.liveAgentCount} bounded live agents`;
    const callText = result.totalApiCalls === null ? "" : ` and ${result.totalApiCalls} provider calls total`;
    refs.resultModeNote.textContent = `Exactly ${requestedAgents} answered the question. ${requested} virtual voices remain legacy metadata${callText ? `; ${callText.slice(5)}` : ""}.`;
  }

  function renderResults(raw, request, mode = "live", fallbackResearchPacket = null) {
    const result = raw?.normalized ? raw : normalizeResult(raw, request, fallbackResearchPacket);
    lastResult = result;
    lastMode = mode;
    const probabilityPercent = percentValue(result.probability);
    const confidencePercent = percentValue(result.confidence);
    refs.probabilityRing.style.setProperty("--probability", `${probabilityPercent}%`);
    refs.probabilityValue.textContent = formatPercent(probabilityPercent);
    refs.signalCaption.textContent = probabilityPercent >= 55 ? "Leans favorable" : probabilityPercent <= 45 ? "Leans unfavorable" : "Near the center";
    refs.confidenceValue.textContent = formatPercent(confidencePercent);
    refs.confidenceFill.style.width = `${confidencePercent}%`;
    refs.confidenceTrack.setAttribute("aria-valuenow", String(Math.round(confidencePercent)));
    refs.confidenceNote.textContent = `${confidencePercent >= 65 ? "A tighter" : "A wider"} panel cluster around the center estimate.`;
    refs.resultAgentCount.textContent = result.requestedAgentCount === null || result.requestedAgentCount === undefined ? "—" : String(result.requestedAgentCount);
    refs.resultSwarmSize.textContent = Number(result.requestedSwarmSize || result.swarmSize || 0).toLocaleString();
    refs.resultRounds.textContent = String(result.debateRounds ?? "—");
    refs.resultDomains.textContent = result.domains.join(" · ");
    refs.resultLiveAgents.textContent = mode === "live" ? (result.liveAgentCount === null ? "bounded" : `${result.liveAgentCount}`) : "none";
    refs.resultApiCalls.textContent = mode === "live" ? (result.totalApiCalls === null ? "—" : String(result.totalApiCalls)) : "none";
    refs.outcome.textContent = result.outcome;
    refs.scenarioEcho.textContent = result.scenario;
    refs.evidenceSummary.textContent = result.researchPacket.summary;
    refs.resultSourceCount.textContent = `${result.researchPacket.sourceCount} source${result.researchPacket.sourceCount === 1 ? "" : "s"}`;
    refs.resultLimitations.textContent = result.researchPacket.limitations.join(" ");
    refs.resultEvidenceScopeLabel.textContent = result.researchPacket.discovery?.requested
      ? "Statement discovery · small public result set · not comprehensive"
      : "Submitted URLs only · not comprehensive";
    renderResultMode(result, mode);
    renderEvidencePacket(result.researchPacket);
    renderSourceCards(refs.resultSources, result.researchPacket.sources, "No source citations were returned for this run.", true);
    renderObjectives(result.objectives);
    renderAgentReports(result.agentReports, result.requestedAgentCount);
    renderScoring(result.scoring, result.agentScores);
    renderDrivers(result.drivers);
    renderUncertainties(result.uncertainties);
    renderImpactGraph(result.argumentMap?.nodes || result.impactNodes, result.argumentMap?.edges || result.connections);
    renderDecisionPaths(result.decisionPaths);
    renderRoster(result.roster);
    renderDebate(result.debateTranscript);
    renderTimingTrace(result.timing, mode);
    renderMethodology(result.metadata, mode, result);
    refs.results.hidden = false;
    return result;
  }

  function readHistory() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved)
        ? saved.filter((item) => item && item.request && item.result).map(sanitizeHistoryItem).filter(Boolean).slice(0, 5)
        : [];
    } catch (_error) {
      return [];
    }
  }

  function scrubHistoryText(value) {
    const secret = currentSecret();
    const text = textValue(value).replace(/\bhttps?:\/\/[^\s<>()]+/gi, "[source link omitted]");
    return secret ? text.split(secret).join("[credential omitted]") : text;
  }

  function historySafeRequest(request) {
    const source = request && typeof request === "object" ? request : {};
    return {
      scenario: scrubHistoryText(source.scenario ?? source.forecasting_statement),
      question: scrubHistoryText(source.question ?? source.scenario ?? source.forecasting_statement),
      context: scrubHistoryText(source.context ?? source.conditions),
      swarm_size: numberValue(source.swarm_size ?? source.swarmSize, 128),
      domains: Array.isArray(source.domains) ? source.domains.map((domain) => textValue(domain)).filter(Boolean).slice(0, 8) : [],
      debate_rounds: numberValue(source.debate_rounds ?? source.debateRounds, 3),
      agent_count: numberValue(source.agent_count ?? source.agentCount ?? source.requested_agent_count ?? source.requestedAgentCount, DEFAULT_AGENT_COUNT),
      discover: source.discover !== false,
    };
  }

  function sanitizeHistoryItem(item) {
    const request = historySafeRequest(item.request);
    if (!request.scenario) return null;
    try {
      const normalized = normalizeResult(item.result, { ...request, urls: [], objectives: [] }, null);
      return {
        id: textValue(item.id, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        createdAt: textValue(item.createdAt, new Date().toISOString()),
        mode: item.mode === "live" || item.mode === "demo" ? item.mode : historyMode(item),
        demo_id: textValue(item.demo_id),
        request,
        result: safeHistoryResult(normalized),
      };
    } catch (_error) {
      return null;
    }
  }

  function safeHistoryMetadata(metadata) {
    const source = metadata && typeof metadata === "object" ? metadata : {};
    const safe = {};
    ["name", "description", "cost_safety_note", "costSafetyNote"].forEach((key) => {
      const value = textValue(source[key]);
      if (value) safe[key] = value;
    });
    ["live_agents", "liveAgents"].forEach((key) => {
      if (typeof source[key] === "boolean") safe[key] = source[key];
    });
    ["live_agent_count", "liveAgentCount", "synthesis_calls", "synthesisCalls", "total_api_calls", "totalApiCalls", "requested_virtual_swarm_size", "requestedVirtualSwarmSize"].forEach((key) => {
      const value = numberValue(source[key], null);
      if (value !== null) safe[key] = value;
    });
    return safe;
  }

  function safeHistoryTiming(timing) {
    if (!timing || typeof timing !== "object") return { returned: false };
    return {
      returned: timing.returned === true,
      total_duration_ms: timing.totalDurationMs === null || timing.totalDurationMs === undefined ? null : numberValue(timing.totalDurationMs, null),
      stages: Array.isArray(timing.stages) ? timing.stages.map((stage) => ({
        key: textValue(stage.key),
        label: textValue(stage.label),
        status: textValue(stage.status, "timing not returned"),
        duration_ms: stage.durationMs === null || stage.durationMs === undefined ? null : numberValue(stage.durationMs, null),
      })) : [],
    };
  }

  function safeHistoryDebate(debate) {
    return (Array.isArray(debate) ? debate : []).map((entry) => ({
      round: numberValue(entry.round, 1),
      speaker: scrubHistoryText(entry.speaker || "synthesis lead"),
      claim: scrubHistoryText(entry.claim),
      counterclaim: scrubHistoryText(entry.counterclaim),
      rebuttal: scrubHistoryText(entry.rebuttal),
      message: scrubHistoryText(entry.message),
      cited_source_ids: normalizeTextList(entry.citedSourceIds).slice(0, 8),
    }));
  }

  function safeHistoryGraph(nodes, connections) {
    return {
      nodes: (Array.isArray(nodes) ? nodes : []).map((node) => ({
        id: textValue(node.id),
        type: textValue(node.type, "argument"),
        label: scrubHistoryText(node.label),
        impact: node.impact === null || node.impact === undefined ? null : ratioValue(node.impact, null),
        impact_label: textValue(node.impactLabel),
      })).filter((node) => node.id && node.type !== "evidence"),
      edges: (Array.isArray(connections) ? connections : []).map((connection) => ({
        source: textValue(connection.from ?? connection.source),
        target: textValue(connection.to ?? connection.target),
        relationship: textValue(connection.relationship ?? connection.label),
        strength: connection.strength === null || connection.strength === undefined ? null : ratioValue(connection.strength, null),
      })).filter((connection) => connection.source && connection.target),
    };
  }

  function safeHistoryResult(result) {
    const graph = safeHistoryGraph(result.impactNodes, result.connections);
    return {
      scenario: scrubHistoryText(result.scenario),
      domains: result.domains,
      swarm_size: result.swarmSize,
      requested_swarm_size: result.requestedSwarmSize,
      debate_rounds: result.debateRounds,
      probability: result.probability,
      confidence: result.confidence,
      outcome: scrubHistoryText(result.outcome),
      key_drivers: (Array.isArray(result.drivers) ? result.drivers : []).map((driver) => ({ label: scrubHistoryText(driver.label), strength: driver.strength })),
      uncertainties: (Array.isArray(result.uncertainties) ? result.uncertainties : []).map(scrubHistoryText),
      representative_roster: (Array.isArray(result.roster) ? result.roster : []).map((agent) => ({
        id: scrubHistoryText(agent.id),
        role: scrubHistoryText(agent.role),
        domain: scrubHistoryText(agent.domain),
        stance: scrubHistoryText(agent.stance),
        estimated_probability: agent.probability,
        rationale: scrubHistoryText(agent.rationale),
      })),
      debate_messages: safeHistoryDebate(result.debate),
      impact_nodes: graph.nodes,
      connections: graph.edges,
      decision_paths: (Array.isArray(result.decisionPaths) ? result.decisionPaths : []).map((path) => ({
        id: scrubHistoryText(path.id),
        title: scrubHistoryText(path.title),
        probability: path.probability,
        impact: scrubHistoryText(path.impact),
        summary: scrubHistoryText(path.summary),
        steps: (Array.isArray(path.steps) ? path.steps : []).map(scrubHistoryText),
      })),
      scoring: result.scoring ? {
        evidence_coverage: result.scoring.evidenceCoverage,
        support_score: result.scoring.supportScore,
        opposition_score: result.scoring.oppositionScore,
        consensus: result.scoring.consensus,
        disagreement: result.scoring.disagreement,
      } : undefined,
      agent_scores: (Array.isArray(result.agentScores) ? result.agentScores : []).map((score) => ({
        agent_id: textValue(score.id),
        role: textValue(score.role),
        domain: textValue(score.domain),
        evidence_count: numberValue(score.evidenceCount, 0),
        stance: textValue(score.stance),
        confidence: score.confidence === null || score.confidence === undefined ? null : ratioValue(score.confidence, null),
        argument_quality: score.argumentQuality === null || score.argumentQuality === undefined ? null : ratioValue(score.argumentQuality, null),
      })),
      timing: safeHistoryTiming(result.timing),
      method: safeHistoryMetadata(result.metadata),
    };
  }

  function writeHistory() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 5)));
    } catch (_error) {
      // A private browsing context may deny storage; the current result still works.
    }
  }

  function historyDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "recent";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  }

  function historyMode(item) {
    if (item.mode === "live" || item.mode === "demo") return item.mode;
    return item.result?.method?.live_agents === true || item.result?.method?.liveAgents === true ? "live" : "demo";
  }

  function renderHistory() {
    refs.historyList.replaceChildren();
    refs.historyCount.textContent = String(history.length);
    refs.clearHistory.hidden = history.length === 0;
    if (!history.length) {
      refs.historyList.append(createElement("p", "empty-state", "Your latest signals stay on this device."));
      return;
    }
    history.forEach((item) => {
      let result;
      try {
        result = normalizeResult(item.result, item.request, null);
      } catch (_error) {
        return;
      }
      const mode = historyMode(item);
      const button = createElement("button", "history-item");
      button.type = "button";
      button.dataset.historyId = item.id;
      button.append(createElement("span", "history-item-title", item.request.scenario));
      const meta = createElement("span", "history-item-meta");
      meta.append(createElement("span", "", `${mode} · ${historyDate(item.createdAt)} · ${Number(item.request.swarm_size || result.swarmSize).toLocaleString()} voices`), createElement("span", "history-item-probability", formatPercent(result.probability * 100)));
      button.append(meta);
      button.addEventListener("click", () => restoreHistory(item));
      refs.historyList.append(button);
    });
  }

  function saveRun(request, result, mode = lastMode) {
    const safeRequest = historySafeRequest(request);
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      mode,
      demo_id: mode === "demo" ? lastDemoId : null,
      request: safeRequest,
      // Keep research URLs, excerpts, objectives, provider configs, and raw
      // packets out of local history. This is intentionally a result summary.
      result: safeHistoryResult(result),
    };
    history = [item, ...history.filter((entry) => entry.request?.scenario !== request.scenario)].slice(0, 5);
    writeHistory();
    renderHistory();
  }

  function setFormValues(request) {
    refs.scenario.value = request.question || request.scenario || DEFAULT_SCENARIO;
    refs.context.value = request.context || "";
    refs.sourceUrls.value = Array.isArray(request.urls || request.source_urls) ? [...(request.urls || request.source_urls)].join("\n") : "";
    refs.discoverWeb.checked = request.discover !== false;
    refs.objectives.value = Array.isArray(request.objectives) ? request.objectives.join("\n") : textValue(request.objectives, "");
    refs.swarmSizeRange.value = String(clamp(Number(request.swarm_size) || 128, MIN_SWARM_SIZE, MAX_SWARM_SIZE));
    updateSwarmSizeValue();
    const domains = Array.isArray(request.domains) ? request.domains : [];
    $$('input[name="domains"]', refs.form).forEach((input) => {
      input.checked = domains.includes(input.value);
    });
    refs.rounds.value = String(request.debate_rounds || 3);
    refs.agentCountRange.value = String(clamp(Number(request.agent_count || request.agentCount) || DEFAULT_AGENT_COUNT, MIN_AGENT_COUNT, MAX_AGENT_COUNT));
    updateScenarioCount();
    updateSourceUrlCount();
    updateObjectivesCount();
    updateRoundsValue();
    updateAgentCountValue();
  }

  function emptyEvidenceDesk() {
    lastResearchPacket = null;
    lastResearchFingerprint = "";
    refs.evidenceStatus.textContent = "The next live run will discover a small public result set from the statement.";
    refs.evidenceCount.textContent = "0";
    refs.evidenceScopeLabel.textContent = "Statement discovery or submitted overrides · not comprehensive";
    refs.evidenceLimitations.textContent = "No evidence packet has been collected for this brief.";
    renderSourceCards(refs.evidenceSources, [], "Sources, status, and short excerpts will appear here.");
  }

  function requestFingerprint(request) {
    return JSON.stringify({ scenario: request.scenario, context: request.context, urls: request.urls, objectives: request.objectives, discover: request.discover === true });
  }

  function invalidateResearchPacket() {
    if (!lastResearchPacket || isRunning || isCollectingEvidence) return;
    lastResearchPacket = null;
    lastResearchFingerprint = "";
    refs.evidenceStatus.textContent = "The brief changed. Collect evidence again before the live run.";
  }

  function restoreHistory(item) {
    if (isRunning || isCollectingEvidence) return;
    const request = {
      ...item.request,
      question: item.request.question || item.request.scenario,
      domains: Array.isArray(item.request.domains) && item.request.domains.length ? [...item.request.domains] : ["general"],
      objectives: [],
      urls: [],
      agent_count: item.request.agent_count || DEFAULT_AGENT_COUNT,
    };
    const mode = historyMode(item);
    setFormValues(request);
    clearValidation();
    emptyEvidenceDesk();
    lastRequest = request;
    lastDemoId = item.demo_id || null;
    setMode(mode, { preserveResults: true });
    const result = renderResults(item.result, request, mode, null);
    lastResult = result;
    refs.progress.hidden = true;
    refs.results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetConsole() {
    if (isRunning || isCollectingEvidence) return;
    stopProgress();
    refs.form.reset();
    refs.context.value = "";
    refs.sourceUrls.value = "";
    refs.objectives.value = "";
    clearValidation();
    updateScenarioCount();
    updateSourceUrlCount();
    updateObjectivesCount();
    updateSwarmSizeValue();
    updateRoundsValue();
    refs.agentCountRange.value = String(DEFAULT_AGENT_COUNT);
    updateAgentCountValue();
    refs.results.hidden = true;
    refs.progress.hidden = true;
    refs.progress.setAttribute("aria-busy", "false");
    lastRequest = null;
    lastResult = null;
    lastMode = "live";
    lastDemoId = null;
    emptyEvidenceDesk();
    setMode("live", { preserveResults: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
    refs.scenario.focus();
  }

  function providerEntry(providerId = providerState.selectedId) {
    return providerState.catalog.find((entry) => entry.id === providerId) || FALLBACK_PROVIDER_CATALOG.find((entry) => entry.id === providerId) || null;
  }

  function updateProviderBaseUrlGuidance() {
    const isCustom = providerState.selectedId === "custom_openai_compatible";
    const marker = $(".optional-label", refs.providerBaseUrlLabel);
    if (marker) marker.textContent = isCustom ? "REQUIRED" : "OPTIONAL";
    refs.providerBaseUrl.required = isCustom;
    refs.providerBaseUrlHelp.textContent = isCustom
      ? "A custom OpenAI-compatible endpoint is required for this provider. Use an HTTPS base URL."
      : "Leave blank to use the selected provider's default endpoint, or supply a compatible override.";
  }

  function populateProviderFields(useSavedPreferences = false) {
    const entry = providerEntry();
    const useSaved = useSavedPreferences && savedProviderPreferences.providerId === providerState.selectedId;
    refs.providerModel.value = useSaved ? savedProviderPreferences.model : (DEFAULT_MODELS[providerState.selectedId] || "");
    refs.providerBaseUrl.value = useSaved ? savedProviderPreferences.baseUrl : (entry?.default_base_url || "");
    refs.providerTimeout.value = String(useSaved ? savedProviderPreferences.timeout : DEFAULT_TIMEOUT);
    refs.providerApiKey.value = "";
    updateProviderBaseUrlGuidance();
  }

  function updateLiveReadiness() {
    const configured = Boolean(providerState.activeConfig);
    refs.liveReadiness.classList.toggle("is-ready", configured);
    if (!configured) {
      refs.liveReadinessStatus.textContent = "Configure a provider in Settings before running a live panel.";
      return;
    }
    const entry = providerEntry(providerState.activeConfig.provider_id);
    refs.liveReadinessStatus.textContent = `Ready for live runs with ${entry?.name || "the selected provider"}. The key is held only in this page session.`;
  }

  function invalidateActiveProvider() {
    if (!providerState.activeConfig) return;
    providerState.activeConfig = null;
    updateLiveReadiness();
    refs.providerStatus.textContent = "Provider fields changed. Choose Use for live runs again.";
  }

  function renderProviderCatalog() {
    const currentIds = providerState.catalog.map((entry) => entry.id);
    if (!currentIds.includes(providerState.selectedId)) providerState.selectedId = currentIds[0] || "openai";
    const options = document.createDocumentFragment();
    providerState.catalog.forEach((entry) => {
      const option = createElement("option", "", entry.name);
      option.value = entry.id;
      options.append(option);
    });
    refs.providerSelect.replaceChildren(options);
    refs.providerSelect.value = providerState.selectedId;

    const list = document.createDocumentFragment();
    providerState.catalog.forEach((entry) => {
      const item = createElement("li", "provider-catalog-item");
      const top = createElement("div", "provider-catalog-item-top");
      top.append(createElement("strong", "", entry.name), createElement("span", "provider-protocol", entry.protocol || "compatible chat"));
      item.append(top, createElement("span", "provider-catalog-detail", entry.default_base_url ? "Default endpoint available" : "Custom base URL required"));
      list.append(item);
    });
    refs.providerCatalogList.replaceChildren(list);
    refs.providerCatalogStatus.textContent = providerState.source === "remote"
      ? "Catalog loaded from /api/providers."
      : "Using the built-in catalog; the live server catalog is unavailable or not loaded yet.";
    if (!providerState.fieldsInitialized) {
      populateProviderFields(true);
      providerState.fieldsInitialized = true;
    } else {
      updateProviderBaseUrlGuidance();
    }
  }

  function normalizeRemoteCatalog(payload) {
    const remote = Array.isArray(payload) ? payload : payload?.providers;
    if (!Array.isArray(remote) || !remote.length) return [];
    const byId = new Map();
    remote.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const id = canonicalProviderId(entry.id ?? entry.provider_id ?? entry.provider);
      if (!id) return;
      const fallback = FALLBACK_PROVIDER_CATALOG.find((item) => item.id === id);
      byId.set(id, {
        id,
        name: textValue(entry.name, fallback?.name || id),
        protocol: textValue(entry.protocol, "compatible chat"),
        default_base_url: textValue(entry.default_base_url ?? entry.defaultBaseUrl, fallback?.default_base_url || ""),
        supports_custom_base_url: entry.supports_custom_base_url !== false,
      });
    });
    return FALLBACK_PROVIDER_CATALOG.map((fallback) => ({ ...fallback, ...(byId.get(fallback.id) || {}) }));
  }

  async function ensureProviderCatalog() {
    if (providerState.catalogPromise) return providerState.catalogPromise;
    providerState.catalogPromise = (async () => {
      try {
        const response = await fetch("/api/providers", { cache: "no-store" });
        if (!response.ok) throw new Error("catalog unavailable");
        const payload = await response.json();
        const remoteCatalog = normalizeRemoteCatalog(payload);
        if (!remoteCatalog.length) throw new Error("catalog empty");
        providerState.catalog = remoteCatalog;
        providerState.source = "remote";
      } catch (_error) {
        providerState.catalog = FALLBACK_PROVIDER_CATALOG.map((entry) => ({ ...entry }));
        providerState.source = "fallback";
      }
      renderProviderCatalog();
    })();
    return providerState.catalogPromise;
  }

  function clearProviderFeedback() {
    refs.providerFormError.textContent = "";
  }

  function validateProviderForm() {
    clearProviderFeedback();
    const providerId = canonicalProviderId(refs.providerSelect.value);
    const model = refs.providerModel.value.trim();
    const apiKey = refs.providerApiKey.value.trim();
    const baseUrl = refs.providerBaseUrl.value.trim();
    const timeout = numberValue(refs.providerTimeout.value, null);
    const isCustom = providerId === "custom_openai_compatible";
    if (!providerId) {
      refs.providerFormError.textContent = "Choose a supported provider.";
      refs.providerSelect.focus();
      return null;
    }
    if (!model) {
      refs.providerFormError.textContent = "Enter a model name before testing or enabling live runs.";
      refs.providerModel.focus();
      return null;
    }
    if (!apiKey) {
      refs.providerFormError.textContent = "Enter an API key. It stays in memory for this page session only.";
      refs.providerApiKey.focus();
      return null;
    }
    if (isCustom && !baseUrl) {
      refs.providerFormError.textContent = "Add a base URL for the custom OpenAI-compatible provider.";
      refs.providerBaseUrl.focus();
      return null;
    }
    if (timeout === null || timeout < 0.1 || timeout > 60) {
      refs.providerFormError.textContent = "Set a timeout between 0.1 and 60 seconds.";
      refs.providerTimeout.focus();
      return null;
    }
    const config = { provider_id: providerId, model, api_key: apiKey, timeout };
    if (baseUrl) config.base_url = baseUrl;
    return config;
  }

  function providerFailureMessage(error, fallback = "The provider request could not be completed.") {
    if (error?.apiCode === "invalid_provider") {
      if (String(error.field || "").includes("api_key")) return "The provider API key was rejected by the setup validator.";
      if (String(error.field || "").includes("base_url")) return "The provider base URL was rejected. Check the HTTPS endpoint or custom route.";
      return "Provider setup needs attention. Review the provider, model, and endpoint in Settings.";
    }
    if (error?.apiCode === "provider_timeout") return "The provider timed out. Try a longer timeout or a smaller brief.";
    if (error?.apiCode === "provider_unavailable") return "The provider could not be reached. Check the endpoint and network access.";
    if (error?.apiCode === "provider_response_error") return "The provider returned a response outside the supported contract.";
    const message = textValue(error?.message, "");
    const secret = currentSecret();
    if (message && (!secret || !message.includes(secret))) return message.slice(0, 220);
    return fallback;
  }

  async function requestProviderTest(providerConfig) {
    const response = await fetch("/api/providers/test", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(providerConfig),
    });
    return readJsonResponse(response, "The provider connection test could not be completed.");
  }

  async function testProviderConnection() {
    if (isRunning || isCollectingEvidence) return;
    const config = validateProviderForm();
    if (!config) return;
    refs.testProviderButton.disabled = true;
    refs.useProviderButton.disabled = true;
    refs.providerStatus.textContent = "Testing connection…";
    try {
      const payload = await requestProviderTest(config);
      const latency = numberValue(payload?.latency_ms ?? payload?.latencyMs, null);
      refs.providerStatus.textContent = `Connection OK${latency === null ? "" : ` · ${latency} ms`}. The key remains in memory only.`;
      clearProviderFeedback();
    } catch (error) {
      refs.providerStatus.textContent = `Connection test failed. ${providerFailureMessage(error, "Check the provider settings and try again.")}`;
    } finally {
      refs.testProviderButton.disabled = false;
      refs.useProviderButton.disabled = false;
    }
  }

  function activateProvider() {
    if (isRunning || isCollectingEvidence) return;
    const config = validateProviderForm();
    if (!config) return;
    providerState.selectedId = config.provider_id;
    providerState.activeConfig = config;
    persistProviderPreferences();
    const entry = providerEntry(config.provider_id);
    refs.providerStatus.textContent = `${entry?.name || "Provider"} is ready for live runs. The key is held in memory only and is not persisted.`;
    updateLiveReadiness();
  }

  function renderDemoCards() {
    const fragment = document.createDocumentFragment();
    DEMO_SCENARIOS.forEach((demo) => {
      const card = createElement("article", "demo-card");
      const top = createElement("div", "demo-card-top");
      top.append(createElement("span", "mode-badge mode-badge-demo", "DEMO"), createElement("span", "demo-card-domain", demo.domainLabel));
      const title = createElement("h3", "", demo.title);
      const description = createElement("p", "demo-card-description", demo.description);
      const resultMeta = createElement("div", "demo-card-meta");
      resultMeta.append(createElement("span", "", `${formatPercent(demo.result.probability * 100)} likelihood`), createElement("span", "", `${formatPercent(demo.result.confidence * 100)} confidence`), createElement("span", "", `${demo.result.sources.length} sources`));
      const button = createElement("button", "button button-secondary", "Open example");
      button.type = "button";
      button.dataset.demoId = demo.id;
      button.addEventListener("click", () => playDemoScenario(demo.id));
      card.append(top, title, description, resultMeta, button);
      fragment.append(card);
    });
    refs.demoScenarios.replaceChildren(fragment);
  }

  function playDemoScenario(demoId) {
    if (isRunning || isCollectingEvidence) return;
    const demo = DEMO_SCENARIOS.find((item) => item.id === demoId);
    if (!demo) return;
    const request = { ...demo.request, domains: [...demo.request.domains], objectives: [...demo.request.objectives], urls: [] };
    lastRequest = request;
    lastDemoId = demo.id;
    lastMode = "demo";
    lastResearchPacket = null;
    lastResearchFingerprint = "";
    setFormValues(request);
    clearValidation();
    stopProgress();
    refs.progress.hidden = true;
    setMode("demo", { preserveResults: true });
    const result = renderResults(demo.result, request, "demo", normalizeResearchPacket(demo.result, request));
    saveRun(request, result, "demo");
    refs.results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setMode(mode, { preserveResults = false } = {}) {
    const nextMode = ["live", "demo", "settings"].includes(mode) ? mode : "live";
    activeMode = nextMode;
    refs.modeTabs.forEach((tab) => {
      const selected = tab.dataset.modeTab === nextMode;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.setAttribute("tabindex", selected ? "0" : "-1");
    });
    refs.modePanels.forEach((panel) => {
      panel.hidden = panel.dataset.modePanel !== nextMode;
    });
    if (!preserveResults) {
      refs.results.hidden = true;
      refs.progress.hidden = true;
      refs.progress.setAttribute("aria-busy", "false");
    }
    if (nextMode === "settings") {
      stopProgress();
      ensureProviderCatalog();
    }
    updateLiveReadiness();
  }

  function setSimulationError(error) {
    const message = textValue(error.message, "The live panel could not complete this run.");
    if (error.field === "scenario") setFieldError(refs.scenario, message, refs.scenarioError);
    else if (error.field === "context") setFieldError(refs.context, message, refs.contextError);
    else if (error.field === "urls" || error.field === "source_urls") setFieldError(refs.sourceUrls, message, refs.sourceUrlsError);
    else if (error.field === "objectives") setFieldError(refs.objectives, message, refs.objectivesError);
    else if (error.field === "domains") {
      refs.domainFieldset.setAttribute("aria-invalid", "true");
      refs.domainError.textContent = message;
    } else if (error.field === "swarm_size") {
      refs.swarmSizeFieldset.setAttribute("aria-invalid", "true");
      refs.swarmSizeError.textContent = message;
    } else if (error.field === "debate_rounds") setFieldError(refs.rounds, message, refs.roundsError);
    else if (error.field === "agent_count") {
      refs.agentCountFieldset?.setAttribute("aria-invalid", "true");
      refs.agentCountError.textContent = message;
    }
    refs.formStatus.textContent = error.apiCode && error.apiCode !== "invalid_request" ? providerFailureMessage(error, message) : message;
    refs.formStatus.tabIndex = -1;
    refs.formStatus.focus();
  }

  function buildResearchRequest(request, { includeAdvancedUrls = false } = {}) {
    // The normal workflow is question-first: discovery is automatic and no
    // user URL notes are sent to either live endpoint.
    request.discover = true;
    const researchRequest = {
      question: request.question || request.scenario,
      statement: request.scenario,
      scenario: request.scenario,
      agent_count: request.agent_count,
      discover: true,
      urls: [],
    };
    if (includeAdvancedUrls && request.advanced_urls.length) researchRequest.urls = request.advanced_urls;
    return researchRequest;
  }

  async function collectEvidence() {
    if (isRunning || isCollectingEvidence || activeMode !== "live") return;
    const request = validateForm();
    if (!request || !validateResearchInput(request)) return;
    isCollectingEvidence = true;
    refs.collectEvidenceButton.disabled = true;
    refs.collectEvidenceButton.setAttribute("aria-busy", "true");
    refs.evidenceStatus.textContent = request.urls.length
      ? (request.discover ? "Collecting submitted sources and a bounded discovery packet…" : "Collecting the optional submitted source packet…")
      : "Waiting for source discovery from the statement, then collecting a bounded packet…";
    refs.formStatus.textContent = "";
    try {
      const packetResponse = await requestResearch(buildResearchRequest(request, { includeAdvancedUrls: true }));
      lastResearchPacket = normalizeResearchPacket(packetResponse, request);
      lastResearchFingerprint = requestFingerprint(request);
      renderEvidencePacket(lastResearchPacket);
      const sourceKind = lastResearchPacket.discovery?.requested ? "discovered public source" : "submitted source";
      refs.formStatus.textContent = `Evidence packet ready from ${lastResearchPacket.sourceCount} ${sourceKind}${lastResearchPacket.sourceCount === 1 ? "" : "s"}.`;
    } catch (error) {
      lastResearchPacket = null;
      lastResearchFingerprint = "";
      refs.evidenceStatus.textContent = `Evidence collection failed. ${providerFailureMessage(error, "Check the research endpoint and try again.")}`;
      refs.formStatus.textContent = error.status === 404
        ? "This server does not expose /api/research yet. Source discovery must be available before a live panel can run."
        : `Evidence collection failed. ${providerFailureMessage(error, "Check the optional URLs or try statement discovery again.")}`;
      refs.formStatus.tabIndex = -1;
      refs.formStatus.focus();
    } finally {
      isCollectingEvidence = false;
      refs.collectEvidenceButton.disabled = false;
      refs.collectEvidenceButton.removeAttribute("aria-busy");
    }
  }

  async function runForecast() {
    if (isRunning || isCollectingEvidence) return;
    const request = validateForm();
    if (!request) return;
    if (!providerState.activeConfig) {
      refs.formStatus.textContent = "Live setup needed: open Settings, enter a provider, model, and API key, then choose Use for live runs. The key stays in memory only.";
      refs.formStatus.tabIndex = -1;
      refs.formStatus.focus();
      return;
    }

    let researchPacket = null;
    let liveResearchPacket = null;
    lastRequest = request;
    lastMode = "live";
    lastDemoId = null;
    setFormRunning(true);
    showProgress(request, "live");
    try {
      setProgressStage(0, `Discovering public sources automatically from the question for ${request.agent_count} agents.`);
      try {
        const packetResponse = await requestResearch(buildResearchRequest(request));
        researchPacket = normalizeResearchPacket(packetResponse, request);
        liveResearchPacket = researchPacket;
        lastResearchPacket = researchPacket;
        lastResearchFingerprint = requestFingerprint(request);
        renderEvidencePacket(researchPacket);
      } catch (researchError) {
        if (researchError?.apiCode === "invalid_research" || researchError?.status === 400) throw researchError;
        const fallbackPacket = normalizeResearchPacket({
          statement: request.scenario,
          sources: [],
          evidence_count: 0,
          limitations: [
            "Source discovery did not return evidence; the live panel will continue without verified web sources.",
            "The panel must treat this run as evidence-limited and not comprehensive.",
          ],
          discovery: {
            requested: true,
            status: "error",
            found_count: 0,
            error: "Source discovery was unavailable for this run.",
          },
        }, request);
        researchPacket = fallbackPacket;
        liveResearchPacket = fallbackPacket;
        lastResearchPacket = fallbackPacket;
        lastResearchFingerprint = requestFingerprint(request);
        renderEvidencePacket(fallbackPacket);
        refs.evidenceStatus.textContent = "No web evidence returned; continuing with an evidence-limited panel.";
        refs.formStatus.textContent = "Source discovery was unavailable, so the provider panel will continue with an explicit evidence limitation.";
      }
      setProgressStage(1, `Role panel is answering with exactly ${request.agent_count} agents.`);
      const responsePromise = requestLiveSimulation(request, providerState.activeConfig, liveResearchPacket);
      setProgressStage(2, "Agents are debating the strongest supporting and opposing arguments.");
      const raw = await responsePromise;
      const normalized = normalizeResult(raw, request, researchPacket);
      setProgressStage(3, normalized.timing?.returned ? "Synthesis metadata returned; preparing the trace." : "Synthesis returned; provider timing metadata was not returned.");
      setProgressStage(4, "Scoring evidence coverage, support, opposition, consensus, and disagreement locally.");
      finishProgress(normalized);
      refs.progress.hidden = true;
      setMode("live", { preserveResults: true });
      renderResults(normalized, request, "live", researchPacket);
      saveRun(request, normalized, "live");
      refs.results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      stopProgress();
      refs.progress.hidden = true;
      if (!researchPacket) {
        lastResearchPacket = null;
        lastResearchFingerprint = "";
        refs.evidenceStatus.textContent = `Source discovery failed. ${providerFailureMessage(error, "The live panel was not started because no research packet was returned.")}`;
      }
      if (error?.status === 404) error.message = "Source discovery is unavailable on this server. The live panel was not started.";
      setSimulationError(error);
    } finally {
      setFormRunning(false);
    }
  }

  function rerunLast() {
    if (isRunning || isCollectingEvidence) return;
    if (lastMode === "demo" && lastRequest && lastResult) {
      setMode("demo", { preserveResults: true });
      renderResults(lastResult, lastRequest, "demo", lastResult.researchPacket);
      saveRun(lastRequest, lastResult, "demo");
      return;
    }
    runForecast();
  }

  refs.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.modeTab));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const index = refs.modeTabs.indexOf(tab);
      const next = event.key === "ArrowRight" ? (index + 1) % refs.modeTabs.length : (index - 1 + refs.modeTabs.length) % refs.modeTabs.length;
      refs.modeTabs[next].focus();
      setMode(refs.modeTabs[next].dataset.modeTab);
    });
  });
  refs.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runForecast();
  });
  refs.collectEvidenceButton?.addEventListener("click", collectEvidence);
  refs.scenario.addEventListener("input", () => { updateScenarioCount(); invalidateResearchPacket(); });
  refs.context.addEventListener("input", invalidateResearchPacket);
  refs.sourceUrls.addEventListener("input", () => { updateSourceUrlCount(); updateResearchButtonLabel(); invalidateResearchPacket(); });
  refs.discoverWeb.addEventListener("change", () => { updateResearchButtonLabel(); invalidateResearchPacket(); });
  refs.objectives.addEventListener("input", () => { updateObjectivesCount(); invalidateResearchPacket(); });
  refs.agentCountRange?.addEventListener("input", updateAgentCountValue);
  $$('input[name="agent_count_preset"]', refs.form).forEach((input) => {
    input.addEventListener("change", () => {
      refs.agentCountRange.value = input.value;
      updateAgentCountValue();
    });
  });
  refs.swarmSizeRange.addEventListener("input", updateSwarmSizeValue);
  $$('input[name="swarm_size"]', refs.form).forEach((input) => {
    input.addEventListener("change", () => {
      refs.swarmSizeRange.value = input.value;
      updateSwarmSizeValue();
    });
  });
  refs.rounds.addEventListener("input", updateRoundsValue);
  refs.resetButton.addEventListener("click", resetConsole);
  refs.newForecastButton.addEventListener("click", resetConsole);
  refs.rerunButton.addEventListener("click", rerunLast);
  refs.clearHistory.addEventListener("click", () => {
    history = [];
    writeHistory();
    renderHistory();
  });
  refs.openSettingsInline.addEventListener("click", () => {
    setMode("settings");
    window.setTimeout(() => refs.providerSelect.focus(), 0);
  });
  refs.providerSelect.addEventListener("change", () => {
    providerState.selectedId = canonicalProviderId(refs.providerSelect.value) || "openai";
    providerState.activeConfig = null;
    populateProviderFields(false);
    refs.providerStatus.textContent = "Provider changed. Test the connection or choose Use for live runs.";
    clearProviderFeedback();
    updateLiveReadiness();
  });
  [refs.providerModel, refs.providerApiKey, refs.providerBaseUrl, refs.providerTimeout].forEach((field) => {
    field.addEventListener("input", invalidateActiveProvider);
    field.addEventListener("change", invalidateActiveProvider);
  });
  refs.testProviderButton.addEventListener("click", testProviderConnection);
  refs.useProviderButton.addEventListener("click", activateProvider);
  refs.providerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    activateProvider();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!isRunning && !isCollectingEvidence && activeMode === "live") refs.form.requestSubmit();
    }
  });

  updateClock();
  window.setInterval(updateClock, 1000);
  updateScenarioCount();
  updateSourceUrlCount();
  updateResearchButtonLabel();
  updateObjectivesCount();
  updateSwarmSizeValue();
  updateRoundsValue();
  updateAgentCountValue();
  renderProviderCatalog();
  renderDemoCards();
  renderHistory();
  renderEvidencePacket(null);
  updateLiveReadiness();
  setMode("live", { preserveResults: true });
  checkHealth();
})();
