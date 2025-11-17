import crypto from "crypto";

export type EngineId = "openai" | "perplexity" | "kimi" | "gemini";

export interface Reference {
  title: string;
  url: string;
  snippet: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface EngineFinding {
  theme: string;
  statement: string;
  rationale: string;
  confidence: ConfidenceLevel;
  references: Reference[];
  evidenceStatus: "confirmed" | "uncertain" | "conflicting";
}

export interface EngineResult {
  engineId: EngineId;
  engineName: string;
  summary: string;
  findings: EngineFinding[];
  overallConfidence: ConfidenceLevel;
  usedFallback: boolean;
  rawEndpoint?: string;
  warnings?: string[];
}

export interface Synthesis {
  question: string;
  subquestions: string[];
  executiveSummary: string[];
  consensus: string[];
  disagreements: string[];
  keyFindings: { theme: string; takeaways: string[] }[];
  toolComparison: {
    engineId: EngineId;
    engineName: string;
    strengths: string;
    cautions: string;
    bestFor: string;
  }[];
  risksAndUncertainties: string[];
  recommendations: string[];
  engines: EngineResult[];
  generatedAt: string;
}

interface EngineConfig {
  id: EngineId;
  name: string;
  envPrefix: string;
  description: string;
  strengths: string;
  cautions: string;
  bestFor: string;
}

const ENGINE_CONFIGS: EngineConfig[] = [
  {
    id: "openai",
    name: "OpenAI Deep Research",
    envPrefix: "OPENAI_DEEP_RESEARCH",
    description:
      "Purpose-built for long-form, multi-hop reasoning with emphasis on cross-source synthesis.",
    strengths:
      "Robust summarisation and synthesis across lengthy documents; strong reasoning for causal chains.",
    cautions:
      "Slower latency for large workloads; currently optimised for English-language sources.",
    bestFor: "Deep analytical dives that require structured synthesis and reasoning transparency.",
  },
  {
    id: "perplexity",
    name: "Perplexity Deep Research",
    envPrefix: "PERPLEXITY_DEEP_RESEARCH",
    description:
      "Retrieval-augmented engine with live web coverage and automatic citation tracking.",
    strengths:
      "Fast coverage of current events with traceable citations; balanced extractive/abstractive summaries.",
    cautions:
      "Occasional redundancy across retrieved passages; quality depends on accessible sources.",
    bestFor:
      "Quick situational awareness and news monitoring when up-to-the-minute coverage matters.",
  },
  {
    id: "kimi",
    name: "Kimi K2",
    envPrefix: "KIMI_K2",
    description:
      "Bilingual research agent with strong performance on technical and Chinese-language corpora.",
    strengths:
      "Excels on multilingual corpora and developer/technical content; good mathematical reasoning.",
    cautions:
      "Live web access may be region-limited; English-language coverage can trail peers on niche topics.",
    bestFor:
      "Bilingual or technical dossiers where Mandarin-language sources and technical manuals matter.",
  },
  {
    id: "gemini",
    name: "Gemini 2.5 Pro",
    envPrefix: "GEMINI_25_PRO",
    description:
      "Multimodal, research-focused Gemini model tuned for grounded synthesis and safety controls.",
    strengths:
      "Strong fact-checking, hallucination resistance, and multimodal reasoning (charts, tables, images).",
    cautions:
      "Strict safety filters can redact contentious topics; API quotas vary by project tier.",
    bestFor:
      "Enterprise workflows needing conservative, well-cited synthesis with multimodal inputs.",
  },
];

interface EngineEnv {
  endpoint?: string;
  apiKey?: string;
  model?: string;
}

interface QueryEnginesResult {
  engines: EngineResult[];
  fallbackUsed: boolean;
}

export async function orchestrateResearch(question: string): Promise<Synthesis> {
  const normalisedQuestion = question.trim();
  if (!normalisedQuestion) {
    throw new Error("Question cannot be empty.");
  }

  const subquestions = generateSubquestions(normalisedQuestion);
  const { engines, fallbackUsed } = await queryEngines(normalisedQuestion, subquestions);
  const synthesis = buildMasterReport(normalisedQuestion, subquestions, engines);

  if (fallbackUsed) {
    synthesis.risksAndUncertainties.unshift(
      "One or more engines returned synthetic fallback responses because live API credentials were missing. Treat all findings as low-confidence scaffolding until real connectors are configured.",
    );
  }

  return synthesis;
}

function generateSubquestions(question: string): string[] {
  const cleaned = question.replace(/\s+/g, " ").trim();
  const baseTopic = deriveTopic(cleaned);

  const defaultAngles = [
    `What is the current landscape and most recent developments regarding ${baseTopic}?`,
    `Which structural drivers, stakeholders, or mechanisms are influencing ${baseTopic}?`,
    `What empirical evidence, quantitative indicators, or case studies illuminate ${baseTopic}?`,
    `What are the forward-looking scenarios, risks, and strategic implications of ${baseTopic}?`,
  ];

  const segments = cleaned
    .split(/[?;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    const uniqueSegments = Array.from(new Set(segments));
    const adapted = uniqueSegments.map((segment) =>
      segment.endsWith("?") ? segment : `${segment}?`,
    );
    return ensureUnique(adapted).slice(0, 6);
  }

  return ensureUnique(defaultAngles);
}

function deriveTopic(question: string): string {
  const lowered = question.toLowerCase();
  const prefixes = [
    "what is",
    "what are",
    "how does",
    "how do",
    "how will",
    "why is",
    "why are",
    "explain",
    "describe",
    "analyse",
    "analyze",
    "evaluate",
    "assess",
  ];

  let topic = question;
  for (const prefix of prefixes) {
    if (lowered.startsWith(prefix)) {
      topic = question.slice(prefix.length).trim();
      break;
    }
  }

  topic = topic.replace(/^\W+/, "").replace(/\?+$/, "").trim();
  if (!topic) {
    return question.trim();
  }

  return topic.charAt(0).toLowerCase() + topic.slice(1);
}

async function queryEngines(
  question: string,
  subquestions: string[],
): Promise<QueryEnginesResult> {
  const results: EngineResult[] = [];
  let fallbackUsed = false;

  for (const engine of ENGINE_CONFIGS) {
    const env = resolveEngineEnv(engine);
    const result = await runSingleEngine(engine, env, question, subquestions);
    if (result.usedFallback) {
      fallbackUsed = true;
    }
    results.push(result);
  }

  return { engines: results, fallbackUsed };
}

function resolveEngineEnv(engine: EngineConfig): EngineEnv {
  const { envPrefix } = engine;
  const endpoint = process.env[`${envPrefix}_ENDPOINT`];
  const apiKey = process.env[`${envPrefix}_API_KEY`];
  const model = process.env[`${envPrefix}_MODEL`];
  return { endpoint, apiKey, model };
}

async function runSingleEngine(
  engine: EngineConfig,
  env: EngineEnv,
  question: string,
  subquestions: string[],
): Promise<EngineResult> {
  if (!env.endpoint || !env.apiKey) {
    return generateFallback(engine, question, subquestions);
  }

  try {
    const payload = {
      question,
      subquestions,
      model: env.model,
    };

    const response = await fetch(env.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.apiKey}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ...generateFallback(engine, question, subquestions),
        warnings: [
          `Live API call failed with status ${response.status}. Fallback synthesis provided instead.`,
          text.slice(0, 500),
        ],
      };
    }

    const data = (await response.json()) as Partial<EngineResult>;
    return normaliseEngineResponse(engine, data, question, subquestions, env.endpoint);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...generateFallback(engine, question, subquestions),
      warnings: [`Live API call threw an error: ${message}`],
    };
  }
}

function normaliseEngineResponse(
  engine: EngineConfig,
  data: Partial<EngineResult>,
  question: string,
  subquestions: string[],
  endpoint?: string,
): EngineResult {
  const shouldFallback =
    !data || !data.findings || !Array.isArray(data.findings) || !data.summary;
  if (shouldFallback) {
    return {
      ...generateFallback(engine, question, subquestions),
      warnings: [
        "Live API response did not match expected schema. Fallback synthesis provided instead.",
      ],
      rawEndpoint: endpoint,
    };
  }

  const rawFindings = Array.isArray(data.findings) ? data.findings : [];
  const findings = rawFindings.map((finding) =>
    normaliseFinding(engine, finding as Partial<EngineFinding>, subquestions),
  );

  return {
    engineId: engine.id,
    engineName: engine.name,
    summary: data.summary ?? summarizeFindings(findings, engine.name),
    findings,
    overallConfidence: data.overallConfidence ?? inferOverallConfidence(findings),
    usedFallback: false,
    rawEndpoint: endpoint,
    warnings: data.warnings ?? [],
  };
}

function normaliseFinding(
  engine: EngineConfig,
  finding: Partial<EngineFinding>,
  subquestions: string[],
): EngineFinding {
  const defaultTheme = subquestions[0] ?? "General Insights";
  const cleanedTheme = finding.theme?.trim() || defaultTheme;
  const statement =
    finding.statement?.trim() ||
    `No structured statement supplied by ${engine.name}. Fallback summary inserted.`;
  const rationale =
    finding.rationale?.trim() ||
    "Original engine response omitted explicit rationale. Please verify directly with cited sources.";

  return {
    theme: cleanedTheme,
    statement,
    rationale,
    confidence: finding.confidence ?? "medium",
    references: Array.isArray(finding.references) ? cleanReferences(finding.references) : [],
    evidenceStatus: finding.evidenceStatus ?? "uncertain",
  };
}

function cleanReferences(references: Reference[]): Reference[] {
  return references
    .filter((ref) => Boolean(ref?.title) && Boolean(ref?.url))
    .map((ref) => ({
      title: ref.title.trim(),
      url: ref.url.trim(),
      snippet: ref.snippet?.trim() ?? "",
    }))
    .slice(0, 5);
}

function summarizeFindings(findings: EngineFinding[], engineName: string): string {
  if (!findings.length) {
    return `${engineName} did not return structured findings.`;
  }

  const themes = ensureUnique(findings.map((finding) => finding.theme));
  const consensusThemes = themes.slice(0, 3);
  return `${engineName} highlighted ${consensusThemes.join(", ")} as the most material themes.`;
}

function inferOverallConfidence(findings: EngineFinding[]): ConfidenceLevel {
  const score = findings.reduce((total, finding) => {
    if (finding.confidence === "high") return total + 3;
    if (finding.confidence === "medium") return total + 2;
    return total + 1;
  }, 0);

  if (!findings.length) return "low";

  const average = score / findings.length;
  if (average >= 2.5) return "high";
  if (average >= 1.75) return "medium";
  return "low";
}

function generateFallback(
  engine: EngineConfig,
  question: string,
  subquestions: string[],
): EngineResult {
  const topic = deriveTopic(question);
  const seed = hashString(`${engine.id}:${question}`);
  const tonalities = [
    "quantitative indicators",
    "expert interviews",
    "regulatory filings",
    "academic literature",
    "industry benchmarks",
    "market sentiment",
  ];
  const angles = rotateArray(tonalities, seed % tonalities.length);

  const findings = subquestions.map((theme, index) =>
    buildFallbackFinding(engine, theme, topic, angles[index % angles.length], seed + index),
  );

  return {
    engineId: engine.id,
    engineName: engine.name,
    summary: `${engine.name} generated scaffolded insights on ${topic}, but live connectors are not yet configured.`,
    findings,
    overallConfidence: "low",
    usedFallback: true,
    rawEndpoint: undefined,
    warnings: [
      "This is a synthetic placeholder response generated locally. Connect the engine's API to obtain live research.",
    ],
  };
}

function buildFallbackFinding(
  engine: EngineConfig,
  theme: string,
  topic: string,
  angle: string,
  seed: number,
): EngineFinding {
  const statement = `${capitalise(engine.name)} indicates that ${topic} is primarily shaped by ${angle} within the context of ${theme.toLowerCase()}.`;
  const rationale = `Heuristic synthesis derived from common open-source knowledge patterns. Replace with validated findings once ${engine.name} is connected to its official API.`;
  const references = buildPlaceholderReferences(topic, theme, seed);
  const evidenceStatus: EngineFinding["evidenceStatus"] = "uncertain";

  return {
    theme,
    statement,
    rationale,
    confidence: "low",
    references,
    evidenceStatus,
  };
}

function buildPlaceholderReferences(topic: string, theme: string, seed: number): Reference[] {
  const base = slugify(`${topic}-${theme}`);
  const sources = [
    {
      title: `Context overview on ${titleCase(topic)}`,
      url: `https://placeholder.research/${base}/${(seed % 7) + 1}`,
      snippet: `Background primer discussing ${topic} through the lens of ${theme.toLowerCase()}.`,
    },
    {
      title: `Comparative analysis: ${titleCase(theme)}`,
      url: `https://placeholder.research/${base}/${(seed % 13) + 2}`,
      snippet: `Summarises contrasting viewpoints relevant to ${theme.toLowerCase()}.`,
    },
  ];
  return sources;
}

function buildMasterReport(
  question: string,
  subquestions: string[],
  engines: EngineResult[],
): Synthesis {
  const consensusMap = new Map<string, Set<EngineId>>();
  const disagreementMap = new Map<string, Set<EngineId>>();
  const themeMap = new Map<string, string[]>();
  const uncertainty: string[] = [];

  for (const engine of engines) {
    for (const finding of engine.findings) {
      const normalised = normaliseText(finding.statement);
      const container = consensusMap.get(normalised) ?? new Set<EngineId>();
      container.add(engine.engineId);
      consensusMap.set(normalised, container);

      const grouped = themeMap.get(finding.theme) ?? [];
      grouped.push(`${engine.engineName}: ${finding.statement}`);
      themeMap.set(finding.theme, grouped);

      if (finding.confidence === "low" || finding.evidenceStatus !== "confirmed" || engine.usedFallback) {
        uncertainty.push(
          `${engine.engineName} flagged "${finding.statement}" as ${finding.evidenceStatus} with ${finding.confidence} confidence.`,
        );
      }
    }
  }

  for (const [statement, enginesSet] of consensusMap.entries()) {
    if (enginesSet.size === 1) {
      disagreementMap.set(statement, enginesSet);
    }
  }

  const consensusDescriptions = Array.from(consensusMap.entries())
    .filter(([, enginesSet]) => enginesSet.size >= 2)
    .map(
      ([statement, enginesSet]) =>
        `${deserialiseText(statement)} (corroborated by ${Array.from(enginesSet)
          .map((engineId) => lookupEngineName(engineId))
          .join(", ")})`,
    )
    .slice(0, 8);

  const disagreementDescriptions = Array.from(disagreementMap.entries()).map(
    ([statement, enginesSet]) =>
      `${deserialiseText(statement)} (only reported by ${lookupEngineName(Array.from(enginesSet)[0])}; treat as unverified)`,
  );

  const executiveSummary = buildExecutiveSummary(question, consensusDescriptions, engines);
  const keyFindings = Array.from(themeMap.entries()).map(([theme, items]) => ({
    theme,
    takeaways: ensureUnique(items).slice(0, 5),
  }));

  const toolComparison = engines.map((engine) => {
    const config = ENGINE_CONFIGS.find((cfg) => cfg.id === engine.engineId)!;
    const cautionaryNotes = [
      config.cautions,
      engine.usedFallback
        ? "Currently operating in fallback mode without live API connectivity."
        : undefined,
      engine.warnings?.[0],
    ]
      .filter(Boolean)
      .join(" ");

    return {
      engineId: engine.engineId,
      engineName: engine.engineName,
      strengths: config.strengths,
      cautions: cautionaryNotes || config.cautions,
      bestFor: config.bestFor,
    };
  });

  const recommendations = buildRecommendations(question, consensusDescriptions, engines);
  const risksAndUncertainties = ensureUnique(uncertainty.concat(disagreementDescriptions)).slice(
    0,
    10,
  );

  return {
    question,
    subquestions,
    executiveSummary,
    consensus: consensusDescriptions,
    disagreements: disagreementDescriptions,
    keyFindings,
    toolComparison,
    risksAndUncertainties,
    recommendations,
    engines,
    generatedAt: new Date().toISOString(),
  };
}

function buildExecutiveSummary(
  question: string,
  consensus: string[],
  engines: EngineResult[],
): string[] {
  const corePoint =
    consensus[0] ??
    `Engines produced preliminary scaffolding for "${question}" but require live connectors for verification.`;
  const coverage = `Coverage blends ${engines.length} research engines, each contributing ${
    engines.reduce((total, engine) => total + engine.findings.length, 0) || "multiple"
  } discrete findings.`;
  const reliability = engines.every((engine) => !engine.usedFallback)
    ? "All engines responded successfully with structured findings."
    : "At least one engine responded via fallback mode; interpret insights as indicative rather than authoritative.";
  const action = "Recommended next step: validate the highest-priority findings with primary sources or domain experts before acting.";

  return [corePoint, coverage, reliability, action];
}

function buildRecommendations(
  question: string,
  consensus: string[],
  engines: EngineResult[],
): string[] {
  const topic = deriveTopic(question);
  const recommendations: string[] = [];

  if (consensus.length) {
    recommendations.push(
      `Prioritise follow-up research on consensus items to confirm data quality for ${topic}.`,
    );
  } else {
    recommendations.push(`Commission first-party research to establish a verified baseline on ${topic}.`);
  }

  const fallbackEngines = engines.filter((engine) => engine.usedFallback);
  if (fallbackEngines.length) {
    recommendations.push(
      `Configure API credentials for ${fallbackEngines.map((engine) => engine.engineName).join(", ")} to unlock live evidence.`,
    );
  }

  recommendations.push(
    "Create a verification log capturing source reliability, publication dates, and bias notes for every cited item.",
  );
  recommendations.push(
    `Schedule a red-team review to stress-test the narrative around ${topic}, ensuring contradictory evidence is captured.`,
  );

  return ensureUnique(recommendations).slice(0, 6);
}

function normaliseText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function deserialiseText(text: string): string {
  return text;
}

function lookupEngineName(engineId: EngineId): string {
  return ENGINE_CONFIGS.find((engine) => engine.id === engineId)?.name ?? engineId;
}

function ensureUnique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()))).filter(Boolean);
}

function rotateArray<T>(array: T[], positions: number): T[] {
  if (!array.length) return array;
  const offset = positions % array.length;
  return array.slice(offset).concat(array.slice(0, offset));
}

function hashString(value: string): number {
  const hash = crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
  return parseInt(hash, 16);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function capitalise(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
