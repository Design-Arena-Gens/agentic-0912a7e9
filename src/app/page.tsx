"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { EngineResult, Synthesis } from "@/lib/orchestrator";

type FetchState = "idle" | "loading" | "success" | "error";

const DEFAULT_PROMPT =
  "What are the key trends, risks, and opportunities in the global battery recycling market over the next five years?";

export default function Home() {
  const [question, setQuestion] = useState(DEFAULT_PROMPT);
  const [status, setStatus] = useState<FetchState>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<Synthesis | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      setError("Please provide a research question to orchestrate.");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Research orchestrator failed.");
      }

      const data = (await response.json()) as Synthesis;
      setResult(data);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error.";
      setError(message);
      setStatus("error");
    }
  };

  const hasFallbackEngines = useMemo(
    () => Boolean(result?.engines.some((engine) => engine.usedFallback)),
    [result],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 lg:px-12">
        <header className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-300">
            Deep Research Orchestrator
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Multi-engine intelligence synthesis
          </h1>
          <p className="max-w-3xl text-lg text-slate-300">
            Break complex questions into targeted research tracks, fan them out across OpenAI Deep
            Research, Perplexity Deep Research, Kimi K2, and Gemini 2.5 Pro, then merge the signals
            into a single decision-ready report with explicit consensus, conflict, and risk flags.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Research focus
            </label>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-h-[140px] resize-y rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-slate-100 shadow-inner outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-400/60"
              placeholder="Describe the strategic question or hypothesis you need to investigate."
            />
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                The orchestrator will automatically generate sub-questions, fan out to four research
                engines, cross-check the signal, and return a master brief.
              </p>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 disabled:cursor-not-allowed disabled:bg-slate-600"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Orchestrating…" : "Run orchestrator"}
              </button>
            </div>
          </form>
          {error && (
            <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          )}
          {status === "loading" && (
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
              Coordinating engines and synthesising results…
            </div>
          )}
        </section>

        {result && (
          <Report result={result} hasFallbackEngines={hasFallbackEngines} />
        )}
      </div>
    </div>
  );
}

function Report({
  result,
  hasFallbackEngines,
}: {
  result: Synthesis;
  hasFallbackEngines: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
        <h2 className="text-xl font-semibold text-white">Executive Summary</h2>
        <p className="mt-3 text-sm text-slate-300">
          Generated at {new Date(result.generatedAt).toLocaleString()} | Source engines:{" "}
          {result.engines.map((engine) => engine.engineName).join(" · ")}
        </p>
        {hasFallbackEngines && (
          <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Live API credentials are missing for at least one engine. The orchestrator produced
            synthetic scaffolding and marked all impacted findings as low-confidence.
          </div>
        )}
        <ul className="mt-6 space-y-3 text-base text-slate-100">
          {result.executiveSummary.map((line, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-sky-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Consensus Highlights"
          emptyFallback="No consensus emerged across engines."
          isEmpty={result.consensus.length === 0}
        >
          <ul className="space-y-3">
            {result.consensus.map((item, index) => (
              <li key={index} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-sm text-slate-200">{item}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          title="Conflicts & Single-source Claims"
          emptyFallback="No conflicting or single-source claims detected."
          isEmpty={result.disagreements.length === 0}
        >
          <ul className="space-y-3">
            {result.disagreements.map((item, index) => (
              <li key={index} className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
                <p className="text-sm text-rose-100">{item}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Sub-questions pursued</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          {result.subquestions.map((subquestion, index) => (
            <li key={index}>{subquestion}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Key findings by theme</h2>
        <div className="mt-6 flex flex-col gap-6">
          {result.keyFindings.map((cluster) => (
            <div key={cluster.theme} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="text-lg font-semibold text-sky-200">{cluster.theme}</h3>
              <ul className="mt-3 space-y-3 text-sm text-slate-200">
                {cluster.takeaways.map((takeaway, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-500" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Tool comparison</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {result.toolComparison.map((tool) => (
            <div
              key={tool.engineId}
              className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">{tool.engineName}</h3>
                <Badge label={tool.engineId.toUpperCase()} tone="slate" />
              </div>
              <p className="text-sm text-slate-300">{tool.strengths}</p>
              <p className="text-sm text-amber-200">
                <span className="font-semibold text-amber-300">Caution:</span> {tool.cautions}
              </p>
              <p className="text-sm text-slate-200">
                <span className="font-semibold text-sky-300">Best for:</span> {tool.bestFor}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Risks & Uncertainties"
          emptyFallback="No explicit risks were flagged by the engines."
          isEmpty={result.risksAndUncertainties.length === 0}
        >
          <ul className="space-y-3">
            {result.risksAndUncertainties.map((risk, index) => (
              <li key={index} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-100">{risk}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          title="Recommendations"
          emptyFallback="No recommendations generated."
          isEmpty={result.recommendations.length === 0}
        >
          <ul className="space-y-3">
            {result.recommendations.map((recommendation, index) => (
              <li
                key={index}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-100"
              >
                {recommendation}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="flex flex-col gap-6">
        {result.engines.map((engine) => (
          <EnginePanel key={engine.engineId} engine={engine} />
        ))}
      </section>
    </div>
  );
}

function EnginePanel({ engine }: { engine: EngineResult }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">{engine.engineName}</h3>
          <p className="text-sm text-slate-300">{engine.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            label={`Confidence: ${engine.overallConfidence.toUpperCase()}`}
            tone={confidenceTone(engine.overallConfidence)}
          />
          <Badge label={engine.usedFallback ? "Fallback output" : "Live data"} tone={engine.usedFallback ? "amber" : "sky"} />
        </div>
      </header>

      {engine.warnings && engine.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {engine.warnings.map((warning, index) => (
            <p
              key={index}
              className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-100"
            >
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-5">
        {engine.findings.map((finding, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 shadow-inner shadow-slate-950/30"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-lg font-semibold text-sky-200">{finding.theme}</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge label={`Confidence: ${finding.confidence}`} tone={confidenceTone(finding.confidence)} />
                <Badge label={`Evidence: ${finding.evidenceStatus}`} tone={evidenceTone(finding.evidenceStatus)} />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-100">{finding.statement}</p>
            <p className="mt-2 text-xs text-slate-400">{finding.rationale}</p>
            {finding.references.length > 0 && (
              <div className="mt-3 space-y-2">
                {finding.references.map((reference, refIndex) => (
                  <a
                    key={refIndex}
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-sky-200 hover:border-sky-400 hover:bg-slate-900/80"
                  >
                    <span className="block font-semibold text-slate-100">{reference.title}</span>
                    <span className="block text-slate-400">{reference.snippet}</span>
                    <span className="block truncate text-slate-500">{reference.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  emptyFallback,
  isEmpty,
}: {
  title: string;
  children: ReactNode;
  emptyFallback: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-4 text-sm text-slate-400">{emptyFallback}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "sky" | "amber" | "slate" | "emerald" | "rose" }) {
  const toneClasses: Record<string, string> = {
    sky: "bg-sky-500/20 text-sky-200 border-sky-500/30",
    amber: "bg-amber-500/20 text-amber-100 border-amber-500/40",
    slate: "bg-slate-500/20 text-slate-100 border-slate-500/30",
    emerald: "bg-emerald-500/20 text-emerald-100 border-emerald-500/30",
    rose: "bg-rose-500/20 text-rose-100 border-rose-500/40",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

function confidenceTone(confidence: string): "sky" | "emerald" | "amber" | "rose" | "slate" {
  switch (confidence) {
    case "high":
      return "emerald";
    case "medium":
      return "sky";
    case "low":
      return "amber";
    default:
      return "slate";
  }
}

function evidenceTone(
  status: string,
): "sky" | "emerald" | "amber" | "rose" | "slate" {
  switch (status) {
    case "confirmed":
      return "emerald";
    case "conflicting":
      return "rose";
    case "uncertain":
    default:
      return "amber";
  }
}
