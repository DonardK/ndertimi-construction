import type { Attendance, Company } from "./db";

export type CompanyFilter = "all" | Company;

const ALBANIAN_WEEKDAYS = ["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht"] as const;

const ALBANIAN_MONTHS = [
  "Janar",
  "Shkurt",
  "Mars",
  "Prill",
  "Maj",
  "Qershor",
  "Korrik",
  "Gusht",
  "Shtator",
  "Tetor",
  "Nëntor",
  "Dhjetor",
] as const;

export interface AttendanceExportLabels {
  workerColumn: string;
  totalColumn: string;
  pdfTitle: string;
  allCompaniesLabel: string;
}

export interface AttendanceMatrixRow {
  employeeId: number;
  name: string;
  dayHours: (number | null)[];
  total: number;
}

export interface AttendanceMatrix {
  year: number;
  month: number;
  daysInMonth: number;
  dayHeaders: string[];
  rows: AttendanceMatrixRow[];
  monthLabel: string;
  companyLabel: string;
}

function parseYearMonth(ym: string): { year: number; month: number } {
  const [year, month] = ym.split("-").map((n) => parseInt(n, 10));
  return { year, month };
}

function matchesCompanyFilter(company: Company, filter: CompanyFilter): boolean {
  return filter === "all" || company === filter;
}

function dayHeader(day: number, year: number, month: number): string {
  const weekday = ALBANIAN_WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${day}\n${weekday}`;
}

function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function companySlug(filter: CompanyFilter): string {
  if (filter === "all") return "te-gjitha";
  return filter.replace(/\s+/g, "-").toLowerCase();
}

function companyPdfLabel(filter: CompanyFilter, allCompaniesLabel: string): string {
  return filter === "all" ? allCompaniesLabel : filter;
}

/** Build worker × day matrix from attendance rows for a given month and company filter. */
export function buildAttendanceMatrix(
  attendance: Attendance[],
  yearMonth: string,
  companyFilter: CompanyFilter,
  allCompaniesLabel: string
): AttendanceMatrix | null {
  const { year, month } = parseYearMonth(yearMonth);
  const daysInMonth = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  const monthPrefix = `${year}-${mm}-`;

  const filtered = attendance.filter(
    (a) => a.date.startsWith(monthPrefix) && matchesCompanyFilter(a.company, companyFilter)
  );

  if (filtered.length === 0) return null;

  const byEmployee = new Map<
    number,
    { name: string; hoursByDay: Map<number, number> }
  >();

  for (const a of filtered) {
    const day = parseInt(a.date.slice(8, 10), 10);
    const name = `${a.emri} ${a.mbiemri}`.trim();
    let entry = byEmployee.get(a.employeeId);
    if (!entry) {
      entry = { name, hoursByDay: new Map() };
      byEmployee.set(a.employeeId, entry);
    }
    entry.hoursByDay.set(day, (entry.hoursByDay.get(day) ?? 0) + a.hoursWorked);
  }

  const rows: AttendanceMatrixRow[] = [...byEmployee.entries()]
    .map(([employeeId, { name, hoursByDay }]) => {
      const dayHours: (number | null)[] = [];
      let total = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const h = hoursByDay.get(d);
        if (h != null && h > 0) {
          dayHours.push(h);
          total += h;
        } else {
          dayHours.push(null);
        }
      }
      return { employeeId, name, dayHours, total };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "sq"));

  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) =>
    dayHeader(i + 1, year, month)
  );

  return {
    year,
    month,
    daysInMonth,
    dayHeaders,
    rows,
    monthLabel: `${ALBANIAN_MONTHS[month - 1]} ${year}`,
    companyLabel: companyPdfLabel(companyFilter, allCompaniesLabel),
  };
}

/** Generate and download attendance matrix PDF. Returns false when there is no data. */
export async function exportAttendanceMatrixPdf(
  attendance: Attendance[],
  yearMonth: string,
  companyFilter: CompanyFilter,
  labels: AttendanceExportLabels
): Promise<boolean> {
  const matrix = buildAttendanceMatrix(
    attendance,
    yearMonth,
    companyFilter,
    labels.allCompaniesLabel
  );
  if (!matrix || matrix.rows.length === 0) return false;

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });

  const title = `${labels.pdfTitle} — ${matrix.monthLabel} — ${matrix.companyLabel}`;
  doc.setFontSize(14);
  doc.text(title, 14, 14);

  const head = [
    [labels.workerColumn, ...matrix.dayHeaders, labels.totalColumn],
  ];

  const body = matrix.rows.map((row) => [
    row.name,
    ...row.dayHours.map((h) => (h == null ? "" : formatHours(h))),
    formatHours(row.total),
  ]);

  autoTable(doc, {
    startY: 20,
    head,
    body,
    theme: "striped",
    styles: { fontSize: 5, cellPadding: 0.8, halign: "center", valign: "middle" },
    headStyles: {
      fillColor: [22, 163, 74],
      fontSize: 5,
      cellPadding: 0.8,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 28, fontSize: 6 },
      [matrix.daysInMonth + 1]: { fontStyle: "bold", cellWidth: 10 },
    },
  });

  const ym = `${matrix.year}-${String(matrix.month).padStart(2, "0")}`;
  doc.save(`pjesemarrja-${ym}-${companySlug(companyFilter)}.pdf`);
  return true;
}
