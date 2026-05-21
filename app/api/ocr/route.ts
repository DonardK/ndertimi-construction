import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export type OcrMode = "diesel" | "mechanic" | "office";

function technicalDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    const status = o.status;
    const message = o.message;
    const code = o.code;
    const errorBody = o.error;
    const parts = [
      typeof message === "string" ? message : null,
      typeof status === "number" ? `HTTP ${status}` : null,
      typeof code === "string" ? `code: ${code}` : null,
      errorBody != null ? JSON.stringify(errorBody) : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function promptForMode(mode: OcrMode, year: number): string {
  if (mode === "diesel") {
    return `You are an OCR assistant analyzing a fuel/diesel bill receipt. Extract the following information from the image and return ONLY a valid JSON object with these exact fields:
- date: the date in YYYY-MM-DD format (if only day/month found, assume current year ${year})
- liters: the number of liters as a decimal number (e.g. 45.5)
- totalPrice: the total price/amount paid as a decimal number in EUR (e.g. 124.20), no currency symbol
- pricePerLiter: unit price per liter in EUR if clearly printed, else null

If any field cannot be reliably extracted, set it to null.
If the image is blurry, unreadable, or not a fuel receipt, return: {"error": "unreadable"}

Return ONLY the JSON object, no other text.`;
  }

  if (mode === "mechanic") {
    return `You are an OCR assistant analyzing an auto repair / mechanic shop invoice or receipt. Extract data and return ONLY a valid JSON object:
- date: YYYY-MM-DD (assume current year ${year} if year missing)
- lineItems: array of objects { "description": string (short repair/service line), "amount": number in EUR }
- totalPrice: total amount in EUR as number (match invoice total if visible)
- notes: short optional summary string or null

If no line items can be read, use empty lineItems []. Prefer one line item per distinct repair/charge on the document.
If unreadable or not a mechanic invoice, return: {"error": "unreadable"}

Return ONLY the JSON object, no other text.`;
  }

  return `You are an OCR assistant analyzing a general business receipt or invoice (office supplies, utilities, rent, etc.). Extract and return ONLY a valid JSON object:
- date: YYYY-MM-DD (assume current year ${year} if year missing)
- title: merchant/vendor name or short description of purchase (string)
- totalAmount: total paid in EUR as number
- categoryGuess: one of: Zyra, Ushqim, Transport, Shërbime, Materiale, Të tjera — pick best guess or "Të tjera"

If unreadable, return: {"error": "unreadable"}

Return ONLY the JSON object, no other text.`;
}

function maxTokensForMode(mode: OcrMode): number {
  if (mode === "mechanic") return 800;
  if (mode === "office") return 400;
  return 300;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mode: rawMode } = body;
    const mode: OcrMode =
      rawMode === "mechanic" || rawMode === "office" ? rawMode : "diesel";

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        {
          error: "Fotoja mungon ose është e pavlefshme.",
          detail: "imageBase64 is missing or not a string",
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "Çelësi i API nuk është konfiguruar.",
          detail: "OPENAI_API_KEY is not set on the server",
        },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const year = new Date().getFullYear();

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: maxTokensForMode(mode),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptForMode(mode, year) },
            {
              type: "image_url",
              image_url: { url: imageBase64, detail: "high" },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        {
          error: "Fotoja nuk u lexua dot. Provoni përsëri me një foto më të qartë.",
          detail: "OpenAI returned empty message content",
        },
        { status: 422 }
      );
    }

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in model output");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      return NextResponse.json(
        {
          error: "Fotoja nuk u lexua dot. Provoni përsëri me një foto më të qartë.",
          detail: `JSON parse failed. Model output (truncated): ${content.slice(0, 500)} | ${technicalDetail(parseErr)}`,
        },
        { status: 422 }
      );
    }

    if (parsed.error === "unreadable") {
      return NextResponse.json(
        {
          error:
            mode === "diesel"
              ? "Fotoja është e paqartë ose nuk është faturë karburanti. Provoni me foto tjetër."
              : "Fotoja është e paqartë ose nuk lexohet si faturë. Provoni me foto tjetër.",
          detail: 'Model returned { error: "unreadable" }',
        },
        { status: 422 }
      );
    }

    if (mode === "diesel") {
      const litersRaw = parsed.liters != null ? Number(parsed.liters) : NaN;
      const totalRaw = parsed.totalPrice != null ? Number(parsed.totalPrice) : NaN;
      const liters = Number.isFinite(litersRaw) ? litersRaw : null;
      const totalPrice = Number.isFinite(totalRaw) ? totalRaw : null;
      const pplRaw =
        parsed.pricePerLiter != null ? Number(parsed.pricePerLiter) : NaN;
      let cmimiLiter: number | null = Number.isFinite(pplRaw) ? pplRaw : null;
      if (cmimiLiter == null && totalPrice != null && liters != null && liters > 0) {
        cmimiLiter = Math.round((totalPrice / liters) * 10000) / 10000;
      }
      return NextResponse.json({
        mode: "diesel",
        date: typeof parsed.date === "string" ? parsed.date : null,
        liters,
        totalPrice,
        cmimiLiter,
      });
    }

    if (mode === "mechanic") {
      const rawLines = parsed.lineItems;
      const lineItems: { description: string; amount: number }[] = [];
      if (Array.isArray(rawLines)) {
        for (const row of rawLines) {
          if (row && typeof row === "object") {
            const r = row as { description?: string; amount?: unknown };
            const amount = Number(r.amount);
            lineItems.push({
              description: String(r.description ?? "").trim() || "Rresht",
              amount: Number.isFinite(amount) ? amount : 0,
            });
          }
        }
      }
      let totalPrice = parsed.totalPrice != null ? Number(parsed.totalPrice) : NaN;
      if (!Number.isFinite(totalPrice)) {
        totalPrice = lineItems.reduce((s, l) => s + l.amount, 0);
      }
      return NextResponse.json({
        mode: "mechanic",
        date: typeof parsed.date === "string" ? parsed.date : null,
        lineItems,
        totalPrice: Number.isFinite(totalPrice) ? totalPrice : lineItems.reduce((s, l) => s + l.amount, 0),
        notes: typeof parsed.notes === "string" ? parsed.notes : null,
      });
    }

    const totalAmount = parsed.totalAmount != null ? Number(parsed.totalAmount) : null;
    return NextResponse.json({
      mode: "office",
      date: typeof parsed.date === "string" ? parsed.date : null,
      title: typeof parsed.title === "string" ? parsed.title : null,
      totalAmount: Number.isFinite(totalAmount as number) ? totalAmount : null,
      categoryGuess:
        typeof parsed.categoryGuess === "string" ? parsed.categoryGuess : null,
    });
  } catch (err: unknown) {
    console.error("OCR Error:", err);

    const message = err instanceof Error ? err.message : "";
    const detail = technicalDetail(err);

    if (message.includes("rate limit") || message.includes("429")) {
      return NextResponse.json(
        { error: "Shumë kërkesa. Prisni pak dhe provoni përsëri.", detail },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Ndodhi një gabim gjatë analizës. Plotësoni të dhënat manualisht.",
        detail,
      },
      { status: 500 }
    );
  }
}
