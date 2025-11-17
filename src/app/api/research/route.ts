import { NextResponse } from "next/server";
import { orchestrateResearch } from "@/lib/orchestrator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        { error: "A non-empty question is required.", status: 400 },
        { status: 400 },
      );
    }

    const synthesis = await orchestrateResearch(question);
    return NextResponse.json(synthesis);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
