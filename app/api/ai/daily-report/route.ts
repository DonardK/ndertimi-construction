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
  company?: string;
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

function companyFromLocation(
  loc: string,
  fallbackCompany: "Etna Group" | "Dervisholli" = "Etna Group"
): "Etna Group" | "Dervisholli" {
  const upper = loc.toUpperCase().trim();
  if (
    upper === "R8" ||
    upper === "R10" ||
    upper.includes("RESIDIO") ||
    upper.includes("DERVISHOLLI")
  ) {
    return "Dervisholli";
  }
  if (
    upper === "PR" ||
    upper === "PZ" ||
    upper === "M" ||
    upper.includes("PRISHTIN") ||
    upper.includes("PRIZREN") ||
    upper.includes("MALISHEV") ||
    upper.includes("ETNA")
  ) {
    return "Etna Group";
  }
  return fallbackCompany;
}

function normalizeLocationCode(
  loc: string,
  company: "Etna Group" | "Dervisholli"
): "Pr" | "Pz" | "M" | "R8" | "R10" {
  const upper = loc.toUpperCase().trim();
  if (upper === "R8" || upper.includes("RESIDIO 8") || upper.includes("RESIDIO8")) return "R8";
  if (upper === "R10" || upper.includes("RESIDIO 10") || upper.includes("RESIDIO10")) return "R10";
  if (upper === "PZ" || upper.includes("PRIZREN")) return "Pz";
  if (upper === "M" || upper.includes("MALISHEV")) return "M";
  if (upper === "PR" || upper.includes("PRISHTIN")) return "Pr";
  return company === "Dervisholli" ? "R8" : "Pr";
}

const DEFAULT_LABELS: Record<string, string> = {
  Pr: "Prishtinë",
  Pz: "Prizren",
  M: "Malishevë",
  R8: "Residio 8",
  R10: "Residio 10",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      reportText,
      imageBase64,
      date = new Date().toISOString().split("T")[0],
      employees = [],
    } = body as {
      reportText?: string;
      imageBase64?: string;
      date?: string;
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

    const systemPrompt = `You are an expert operations assistant for construction operations in Kosovo managing two sister companies:
1. "Etna Group" (Locations: Pr = Prishtinë, Pz = Prizren, M = Malishevë)
2. "Dervisholli" (Locations: R8 = Residio 8, R10 = Residio 10)

The user will paste a daily construction report (in Albanian, informal, handwritten, or voice-transcribed).
The report can contain work logs, sites, and worker hours for Etna Group, Dervisholli, or BOTH companies combined in one text.
Your task is to analyze everything and cleanly SEPARATE the data between "Etna Group" and "Dervisholli".

Registered active employees:
${empListText || "(No employee list provided)"}

RULES FOR SEPARATION:
1. SITE AND COMPANY IDENTIFICATION:
   - "Pr" (Prishtinë), "Pz" (Prizren), "M" (Malishevë) strictly belong to "Etna Group".
   - "R8" (Residio 8), "R10" (Residio 10) strictly belong to "Dervisholli".
   - If the report explicitly has headers or sections for "Etna Group" / "Etna" or "Dervisholli", assign all items under them accordingly.
   - If a site or project name like "Residio 8", "Residio 10", "R8", "R10" is mentioned anywhere, it belongs to "Dervisholli".
   - If a site like "Prishtinë", "Prizren", "Malishevë" is mentioned anywhere, it belongs to "Etna Group".

2. EXTRACT WORKER ATTENDANCE:
   - Identify every worker mentioned.
   - Match their name against the registered employees list. Pay attention to common Albanian names, nicknames, or first-name-only mentions.
     * If matched, assign their numeric employeeId and exact registered name.
     * If not matched, set employeeId to null and preserve rawName.
   - Assign the worker's company: strictly "Etna Group" or "Dervisholli".
   - Assign the worker's location code (Pr, Pz, M, R8, R10).
     * RULE: If location is R8 or R10, company MUST be "Dervisholli".
     * RULE: If location is Pr, Pz, or M, company MUST be "Etna Group".
   - Extract hours worked (e.g. 8, 8.5, 9, 10). If the report simply states they worked or were present without specifying hours, default to 8.0.
   - Extract specific task description for each worker.
   - Assign confidence: "high", "medium", or "low".

3. GENERATE COMPANY DAILY REPORTS:
   - Create clean Markdown summaries separated for each company:
     - For "Etna Group":
       * title: e.g. "Raporti ditor - Etna Group - ${date}"
       * formattedReport: Markdown summary of work per site for Etna Group
       * siteReports: array of { location: "Pr"|"Pz"|"M", locationLabel: string, workDescription: string }
     - For "Dervisholli":
       * title: e.g. "Raporti ditor - Dervisholli - ${date}"
       * formattedReport: Markdown summary of work per site for Dervisholli
       * siteReports: array of { location: "R8"|"R10", locationLabel: string, workDescription: string }
   - If no work was reported for one of the companies, set formattedReport to "" and siteReports to [].

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this structure:
{
  "date": "${date}",
  "companyReports": {
    "Etna Group": {
      "title": "string",
      "formattedReport": "string (markdown)",
      "siteReports": [
        {
          "location": "Pr" | "Pz" | "M",
          "locationLabel": "full location name",
          "workDescription": "description of work performed at this site"
        }
      ]
    },
    "Dervisholli": {
      "title": "string",
      "formattedReport": "string (markdown)",
      "siteReports": [
        {
          "location": "R8" | "R10",
          "locationLabel": "full location name",
          "workDescription": "description of work performed at this site"
        }
      ]
    }
  },
  "workerHours": [
    {
      "tempId": "unique string like w1, w2",
      "employeeId": number or null,
      "name": "matched employee full name or best guess",
      "rawName": "name as appeared in report",
      "company": "Etna Group" | "Dervisholli",
      "location": "Pr" | "Pz" | "M" | "R8" | "R10",
      "hours": number,
      "task": "short task description",
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;

    // Prepare messages
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    if (reportText?.trim()) {
      userContent.push({
        type: "text",
        text: `Këtu është raporti ditor për datën ${date} për Etna Group dhe Dervisholli:\n\n"""\n${reportText.trim()}\n"""`,
      });
    }

    if (imageBase64?.trim()) {
      userContent.push({
        type: "text",
        text: "Këtu është edhe fotoja/skanimi i raportit ditor. Lexoni të gjitha të dhënat nga fotoja dhe ndani sipas Etna Group dhe Dervisholli:",
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

    // Normalize company reports
    interface RawSiteReport {
      location?: string;
      locationLabel?: string;
      workDescription?: string;
    }

    interface RawCompanyReport {
      title?: string;
      formattedReport?: string;
      siteReports?: RawSiteReport[];
    }

    const rawEtna = (parsed.companyReports?.["Etna Group"] || {}) as RawCompanyReport;
    const rawDerv = (parsed.companyReports?.["Dervisholli"] || {}) as RawCompanyReport;

    const normalizedEtna = {
      title:
        typeof rawEtna.title === "string" && rawEtna.title.trim()
          ? rawEtna.title.trim()
          : `Raporti ditor - Etna Group - ${date}`,
      formattedReport:
        typeof rawEtna.formattedReport === "string" ? rawEtna.formattedReport.trim() : "",
      siteReports: Array.isArray(rawEtna.siteReports)
        ? rawEtna.siteReports.map((sr) => {
            const loc = normalizeLocationCode(sr.location || "Pr", "Etna Group");
            return {
              location: loc,
              locationLabel: sr.locationLabel || DEFAULT_LABELS[loc] || "Etna Group",
              workDescription: String(sr.workDescription || "").trim(),
            };
          })
        : [],
    };

    const normalizedDervisholli = {
      title:
        typeof rawDerv.title === "string" && rawDerv.title.trim()
          ? rawDerv.title.trim()
          : `Raporti ditor - Dervisholli - ${date}`,
      formattedReport:
        typeof rawDerv.formattedReport === "string" ? rawDerv.formattedReport.trim() : "",
      siteReports: Array.isArray(rawDerv.siteReports)
        ? rawDerv.siteReports.map((sr) => {
            const loc = normalizeLocationCode(sr.location || "R8", "Dervisholli");
            return {
              location: loc,
              locationLabel: sr.locationLabel || DEFAULT_LABELS[loc] || "Dervisholli",
              workDescription: String(sr.workDescription || "").trim(),
            };
          })
        : [],
    };

    // Normalize worker hours
    interface RawWorkerHour {
      tempId?: string;
      employeeId?: number;
      name?: string;
      rawName?: string;
      company?: string;
      location?: string;
      hours?: number | string;
      task?: string;
      confidence?: string;
    }

    const workerHours = Array.isArray(parsed.workerHours)
      ? (parsed.workerHours as RawWorkerHour[]).map((wh, idx) => {
          const empId =
            typeof wh.employeeId === "number" && !isNaN(wh.employeeId) ? wh.employeeId : null;
          const rawHours = parseFloat(String(wh.hours ?? ""));
          const hours = isNaN(rawHours) || rawHours < 0 ? 8 : rawHours;

          // Determine company and location consistency
          const rawLoc = String(wh.location || "");
          const rawCompany = String(wh.company || "");
          const company: "Etna Group" | "Dervisholli" =
            companyFromLocation(
              rawLoc,
              rawCompany.toLowerCase().includes("dervisholli") ? "Dervisholli" : "Etna Group"
            );
          const location = normalizeLocationCode(rawLoc, company);

          return {
            tempId: wh.tempId || `w_${idx + 1}`,
            employeeId: empId,
            name: String(wh.name || wh.rawName || `Punonjës ${idx + 1}`),
            rawName: String(wh.rawName || wh.name || ""),
            company,
            location,
            hours,
            task: String(wh.task || "").trim(),
            confidence:
              wh.confidence === "high" || wh.confidence === "medium" || wh.confidence === "low"
                ? wh.confidence
                : "medium",
          };
        })
      : [];

    return NextResponse.json({
      success: true,
      date,
      companyReports: {
        "Etna Group": normalizedEtna,
        Dervisholli: normalizedDervisholli,
      },
      workerHours,
      // Root-level compatibility
      title:
        normalizedEtna.formattedReport
          ? normalizedEtna.title
          : normalizedDervisholli.title || `Raporti ditor - ${date}`,
      formattedReport: [normalizedEtna.formattedReport, normalizedDervisholli.formattedReport]
        .filter(Boolean)
        .join("\n\n---\n\n"),
      siteReports: [...normalizedEtna.siteReports, ...normalizedDervisholli.siteReports],
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
