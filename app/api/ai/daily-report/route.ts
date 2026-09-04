import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface EmployeeItem {
  id: number;
  emri: string;
  mbiemri: string;
}

interface LocationItem {
  code: string;
  label: string;
}

function technicalDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      reportText,
      imageBase64,
      date = new Date().toISOString().split("T")[0],
      company = "Etna Group",
      employees = [],
      locations = [],
    } = body as {
      reportText?: string;
      imageBase64?: string;
      date?: string;
      company?: string;
      employees?: EmployeeItem[];
      locations?: LocationItem[];
    };

    if (!reportText?.trim() && !imageBase64?.trim()) {
      return NextResponse.json(
        {
          error: "Ju lutem shkruani ose ngjisni tekstin e raportit ose ngarkoni një foto.",
          detail: "Neither reportText nor imageBase64 provided",
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "Çelësi i OpenAI API (OPENAI_API_KEY) nuk është konfiguruar në server.",
          detail: "OPENAI_API_KEY is not set on the server",
        },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Format employee directory for model
    const empListText = (employees || [])
      .map((e) => `ID: ${e.id} -> ${e.emri} ${e.mbiemri}`)
      .join("\n");

    // Format available locations for model
    const locListText = (locations || [])
      .map((l) => `${l.code} = ${l.label}`)
      .join(", ");

    const systemPrompt = `You are an expert operations assistant for a construction company in Kosovo.
Your task is to analyze daily site construction reports (written in Albanian, informal, handwritten, or voice-transcribed).
The company is "${company}". The report date is "${date}".

Available registered employees:
${empListText || "(No employee list provided)"}

Valid location codes and names:
${locListText || "Pr = Prishtinë, Pz = Prizren, M = Malishevë"}

INSTRUCTIONS:
1. SEPARATE THE REPORT BY PLACES/SITES:
   - Identify every distinct location/site mentioned in the text (e.g. Prishtinë, Prizren, Malishevë, Residio 8, Residio 10, or specific project names).
   - For each location, write a clean summary of what work was completed, tasks done, equipment used, issues, etc.
   - If no location is explicitly named, assign to the most appropriate or default location for ${company}.

2. EXTRACT WORKER ATTENDANCE AND HOURS:
   - Identify every worker mentioned.
   - Match their name to the registered employees list above. Pay attention to common Albanian names, nicknames, or first-name-only mentions.
   - If a confident match exists, use their numeric employeeId and exact registered name.
   - If no match exists in the registered employee list, set employeeId to null, and put the name as found in rawName.
   - Extract the number of hours worked (e.g. 8, 8.5, 9, 10). If the report simply states they worked or were present without specifying an hour number, use 8.0.
   - Assign the worker to the location code where they worked on that day.
   - Extract any specific task note for that worker (e.g. "suvatim", "armaturë", "shofer", "eskavator").

3. GENERATE FORMATTED DAILY REPORT:
   - Create a clean Markdown formatted report combining all site sections under clear headings like:
     ### Prishtinë
     Puna e kryer: ...
     
     ### Prizren
     Puna e kryer: ...
   - Create a short descriptive title, e.g. "Raporti ditor - ${date} (${company})".

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this exact structure:
{
  "date": "${date}",
  "title": "string",
  "formattedReport": "string (markdown)",
  "siteReports": [
    {
      "location": "location code (e.g. Pr, Pz, M, R8, R10)",
      "locationLabel": "full location name",
      "workDescription": "description of work performed at this site"
    }
  ],
  "workerHours": [
    {
      "tempId": "unique string like w1, w2",
      "employeeId": number or null,
      "name": "matched employee full name or best guess",
      "rawName": "name as appeared in report",
      "location": "location code",
      "hours": number,
      "task": "short task description",
      "confidence": "high" or "medium" or "low"
    }
  ]
}`;

    // Prepare messages
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    if (reportText?.trim()) {
      userContent.push({
        type: "text",
        text: `Këtu është raporti ditor për datën ${date} (${company}):\n\n"""\n${reportText.trim()}\n"""`,
      });
    }

    if (imageBase64?.trim()) {
      userContent.push({
        type: "text",
        text: "Këtu është edhe fotoja/skanimi i raportit ditor. Lexoni të gjitha të dhënat nga fotoja:",
      });
      userContent.push({
        type: "image_url",
        image_url: { url: imageBase64, detail: "high" },
      });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        {
          error: "AI nuk ktheu përgjigje. Provoni përsëri.",
          detail: "Empty response from OpenAI",
        },
        { status: 422 }
      );
    }

    const parsed = JSON.parse(content);

    // Normalize returned structure
    const title = typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : `Raporti ditor - ${date}`;

    const formattedReport = typeof parsed.formattedReport === "string"
      ? parsed.formattedReport.trim()
      : "";

    // Normalize site reports
    interface RawSiteReport {
      location?: string;
      locationLabel?: string;
      workDescription?: string;
    }
    const siteReports = Array.isArray(parsed.siteReports)
      ? (parsed.siteReports as RawSiteReport[]).map((sr) => ({
          location: String(sr.location || "Pr"),
          locationLabel: String(sr.locationLabel || sr.location || "Lokacioni"),
          workDescription: String(sr.workDescription || "").trim(),
        }))
      : [];

    // Normalize worker hours
    interface RawWorkerHour {
      tempId?: string;
      employeeId?: number;
      name?: string;
      rawName?: string;
      location?: string;
      hours?: number | string;
      task?: string;
      confidence?: string;
    }
    const workerHours = Array.isArray(parsed.workerHours)
      ? (parsed.workerHours as RawWorkerHour[]).map((wh, idx) => {
          const empId = typeof wh.employeeId === "number" && !isNaN(wh.employeeId)
            ? wh.employeeId
            : null;
          const rawHours = parseFloat(String(wh.hours ?? ""));
          const hours = isNaN(rawHours) || rawHours < 0 ? 8 : rawHours;
          return {
            tempId: wh.tempId || `w_${idx + 1}`,
            employeeId: empId,
            name: String(wh.name || wh.rawName || `Punonjës ${idx + 1}`),
            rawName: String(wh.rawName || wh.name || ""),
            location: String(wh.location || "Pr"),
            hours,
            task: String(wh.task || "").trim(),
            confidence: wh.confidence === "high" || wh.confidence === "medium" || wh.confidence === "low"
              ? wh.confidence
              : "medium",
          };
        })
      : [];

    return NextResponse.json({
      success: true,
      date,
      company,
      title,
      formattedReport,
      siteReports,
      workerHours,
    });
  } catch (err: unknown) {
    console.error("AI Daily Report Error:", err);
    const message = err instanceof Error ? err.message : "";
    const detail = technicalDetail(err);

    if (message.includes("rate limit") || message.includes("429")) {
      return NextResponse.json(
        { error: "Shumë kërkesa në API. Prisni pak sekonda dhe provoni përsëri.", detail },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Ndodhi një gabim gjatë përpunimit me AI. Provoni përsëri ose shkruani manualisht.",
        detail,
      },
      { status: 500 }
    );
  }
}
