# Deep Research Orchestrator

Agentic research console that breaks an input question into targeted investigative threads, queries four specialised engines (OpenAI Deep Research, Perplexity Deep Research, Kimi K2, Gemini 2.5 Pro), cross-checks their findings, and merges the signal into a decision-ready Master Brief. The UI highlights consensus, conflicts, risks, and actionable recommendations.

> ⚠️ The app ships with deterministic fallback synthesis when real engine credentials are missing. Wire up the live APIs to replace the scaffolding with authoritative findings.

## Tech stack

- [Next.js App Router](https://nextjs.org/docs/app) + Server Actions
- Tailwind CSS (via `@tailwindcss/postcss`)
- TypeScript throughout

## Local development

```bash
npm install
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000) and submit any research prompt.

## API credentials

Each engine can be pointed at a proxy or official API by setting the following environment variables (e.g. in a `.env.local` file):

| Engine | Endpoint variable | API key variable | Optional model variable |
| ------ | ----------------- | ---------------- | ----------------------- |
| OpenAI Deep Research | `OPENAI_DEEP_RESEARCH_ENDPOINT` | `OPENAI_DEEP_RESEARCH_API_KEY` | `OPENAI_DEEP_RESEARCH_MODEL` |
| Perplexity Deep Research | `PERPLEXITY_DEEP_RESEARCH_ENDPOINT` | `PERPLEXITY_DEEP_RESEARCH_API_KEY` | `PERPLEXITY_DEEP_RESEARCH_MODEL` |
| Kimi K2 | `KIMI_K2_ENDPOINT` | `KIMI_K2_API_KEY` | `KIMI_K2_MODEL` |
| Gemini 2.5 Pro | `GEMINI_25_PRO_ENDPOINT` | `GEMINI_25_PRO_API_KEY` | `GEMINI_25_PRO_MODEL` |

Each endpoint must accept a `POST` request with the payload:

```json
{
  "question": "Original user prompt",
  "subquestions": ["Derived sub question 1", "…"],
  "model": "optional model hint"
}
```

And return a JSON body matching:

```json
{
  "summary": "Short overview",
  "findings": [
    {
      "theme": "Scope or sub-question",
      "statement": "Synthesised insight",
      "rationale": "Supporting logic",
      "confidence": "high | medium | low",
      "evidenceStatus": "confirmed | uncertain | conflicting",
      "references": [
        { "title": "Source title", "url": "https://…", "snippet": "Optional supporting text" }
      ]
    }
  ],
  "overallConfidence": "high | medium | low",
  "warnings": ["Optional string array"]
}
```

If either the endpoint or key is missing, the orchestrator produces low-confidence fallback findings and flags the gaps in the Risks section to prevent silent failure.

## Quality gates

```bash
npm run lint
npm run build
```

## Deployment

The project is optimised for Vercel. Once quality checks pass, deploy with:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-0912a7e9
```

After deployment, verify DNS propagation:

```bash
curl https://agentic-0912a7e9.vercel.app
```

## Extending the orchestrator

- Swap the fallback heuristics with live responses by connecting APIs.
- Introduce persistence (e.g. Supabase/Postgres) to archive research runs.
- Add analyst workflow tools (annotation, red-team review logging, evidence scoring).
- Expand the engine matrix with additional connectors (financial data, patent search, etc.).
