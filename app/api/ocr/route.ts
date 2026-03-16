import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "Fotoja mungon ose është e pavlefshme." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Çelësi i API nuk është konfiguruar." },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an OCR assistant analyzing a fuel/diesel bill receipt. Extract the following information from the image and return ONLY a valid JSON object with these exact fields:
- date: the date in YYYY-MM-DD format (if only day/month found, assume current year ${new Date().getFullYear()})
- liters: the number of liters as a decimal number (e.g. 45.5)
- totalPrice: the total price/amount as a decimal number (e.g. 8500.00)

If any field cannot be reliably extracted, set it to null.
If the image is blurry, unreadable, or not a fuel receipt, return: {"error": "unreadable"}

Return ONLY the JSON object, no other text.`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "Fotoja nuk u lexua dot. Provoni përsëri me një foto më të qartë." },
        { status: 422 }
      );
    }

    let parsed: { date?: string | null; liters?: number | null; totalPrice?: number | null; error?: string };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "Fotoja nuk u lexua dot. Provoni përsëri me një foto më të qartë." },
        { status: 422 }
      );
    }

    if (parsed.error === "unreadable") {
      return NextResponse.json(
        { error: "Fotoja është e paqartë ose nuk është faturë karburanti. Provoni me foto tjetër." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      date: parsed.date || null,
      liters: parsed.liters || null,
      totalPrice: parsed.totalPrice || null,
    });
  } catch (err: unknown) {
    console.error("OCR Error:", err);

    const message = err instanceof Error ? err.message : "";
    if (message.includes("rate limit") || message.includes("429")) {
      return NextResponse.json(
        { error: "Shumë kërkesa. Prisni pak dhe provoni përsëri." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Ndodhi një gabim gjatë analizës. Plotësoni të dhënat manualisht." },
      { status: 500 }
    );
  }
}
