import { getClient } from "./supabase";

export interface Employee {
  id?: number;
  emri: string;
  mbiemri: string;
  paymentMethod: "Cash" | "Bankë";
  cmimiOre: number;
  /** Bank name — used when paymentMethod is Bankë */
  emriBankes: string;
  /** Bank account (IBAN / account no.) — used when paymentMethod is Bankë */
  llogariaBankes: string;
  createdAt?: string;
}

export type WorkLocation = "Pr" | "Pz" | "M";

export const WORK_LOCATION_LABELS: Record<WorkLocation, string> = {
  Pr: "Prishtinë",
  Pz: "Prizren",
  M: "Malishevë",
};

export interface Attendance {
  id?: number;
  employeeId: number;
  emri: string;
  mbiemri: string;
  date: string;
  paymentMethod: "Cash" | "Bankë";
  hoursWorked: number;
  location: WorkLocation;
  createdAt?: string;
}

export interface DailyReport {
  id?: number;
  date: string;
  title: string;
  content: string;
  createdAt?: string;
}

export interface Vehicle {
  id?: number;
  emriMjetit: string;
  targa: string;
  createdAt?: string;
}

export interface WorkerPayment {
  id?: number;
  employeeId: number;
  emri: string;
  mbiemri: string;
  amount: number;
  pershkrim: string;
  date: string;
  createdAt?: string;
}

export interface DieselEntry {
  id?: number;
  vehicleId: number;
  emriMjetit: string;
  date: string;
  liters: number;
  totalPrice: number;
  photoBase64?: string;
  createdAt?: string;
}

export interface ServiceLineItem {
  description: string;
  amount: number;
}

export interface VehicleServiceEntry {
  id?: number;
  vehicleId: number;
  emriMjetit: string;
  date: string;
  notes: string;
  items: ServiceLineItem[];
  totalPrice: number;
  photoBase64?: string;
  createdAt?: string;
}

export interface StockItem {
  id?: number;
  category: string;
  name: string;
  quantity: number;
  unit: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficeExpense {
  id?: number;
  date: string;
  category: string;
  title: string;
  amount: number;
  notes: string;
  photoBase64?: string;
  createdAt?: string;
}

// --- Row mappers (DB snake_case → TS camelCase) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmployee(row: any): Employee {
  return {
    id: row.id,
    emri: row.emri,
    mbiemri: row.mbiemri,
    paymentMethod: row.payment_method,
    cmimiOre: Number(row.cmimi_ore),
    emriBankes: row.emri_bankes ?? "",
    llogariaBankes: row.llogaria_bankes ?? "",
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAttendance(row: any): Attendance {
  return {
    id: row.id,
    employeeId: row.employee_id,
    emri: row.emri,
    mbiemri: row.mbiemri,
    date: row.date,
    paymentMethod: row.payment_method,
    hoursWorked: Number(row.hours_worked),
    location: (row.location as WorkLocation) ?? "Pr",
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDailyReport(row: any): DailyReport {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVehicle(row: any): Vehicle {
  return {
    id: row.id,
    emriMjetit: row.emri_mjetit,
    targa: row.targa,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPayment(row: any): WorkerPayment {
  return {
    id: row.id,
    employeeId: row.employee_id,
    emri: row.emri,
    mbiemri: row.mbiemri,
    amount: Number(row.amount),
    pershkrim: row.pershkrim,
    date: row.date,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDiesel(row: any): DieselEntry {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    emriMjetit: row.emri_mjetit,
    date: row.date,
    liters: Number(row.liters),
    totalPrice: Number(row.total_price),
    photoBase64: row.photo_base64 ?? undefined,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVehicleService(row: any): VehicleServiceEntry {
  const rawItems = row.items;
  let items: ServiceLineItem[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems.map((it: { description?: string; amount?: number }) => ({
      description: String(it.description ?? ""),
      amount: Number(it.amount) || 0,
    }));
  }
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    emriMjetit: row.emri_mjetit,
    date: row.date,
    notes: row.notes ?? "",
    items,
    totalPrice: Number(row.total_price),
    photoBase64: row.photo_base64 ?? undefined,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStockItem(row: any): StockItem {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOfficeExpense(row: any): OfficeExpense {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    title: row.title,
    amount: Number(row.amount),
    notes: row.notes ?? "",
    photoBase64: row.photo_base64 ?? undefined,
    createdAt: row.created_at,
  };
}

// --- Database operations ---

export const db = {
  employees: {
    async getAll(): Promise<Employee[]> {
      const { data, error } = await getClient()
        .from("employees")
        .select("*")
        .order("emri");
      if (error) throw error;
      return (data ?? []).map(mapEmployee);
    },

    async add(emp: Omit<Employee, "id" | "createdAt">): Promise<void> {
      const { error } = await getClient().from("employees").insert({
        emri: emp.emri,
        mbiemri: emp.mbiemri,
        payment_method: emp.paymentMethod,
        cmimi_ore: emp.cmimiOre,
        emri_bankes: emp.paymentMethod === "Bankë" ? emp.emriBankes.trim() || null : null,
        llogaria_bankes: emp.paymentMethod === "Bankë" ? emp.llogariaBankes.trim() || null : null,
      });
      if (error) throw error;
    },

    async update(id: number, emp: Partial<Employee>): Promise<void> {
      const updates: Record<string, unknown> = {};
      if (emp.emri !== undefined) updates.emri = emp.emri;
      if (emp.mbiemri !== undefined) updates.mbiemri = emp.mbiemri;
      if (emp.paymentMethod !== undefined) updates.payment_method = emp.paymentMethod;
      if (emp.cmimiOre !== undefined) updates.cmimi_ore = emp.cmimiOre;
      if (emp.emriBankes !== undefined) updates.emri_bankes = emp.emriBankes.trim() || null;
      if (emp.llogariaBankes !== undefined) updates.llogaria_bankes = emp.llogariaBankes.trim() || null;
      const { error } = await getClient().from("employees").update(updates).eq("id", id);
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("employees").delete().eq("id", id);
      if (error) throw error;
    },
  },

  attendance: {
    async getAll(): Promise<Attendance[]> {
      const { data, error } = await getClient()
        .from("attendance")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapAttendance);
    },

    async add(att: Omit<Attendance, "id" | "createdAt">): Promise<void> {
      const { error } = await getClient().from("attendance").insert({
        employee_id: att.employeeId,
        emri: att.emri,
        mbiemri: att.mbiemri,
        date: att.date,
        payment_method: att.paymentMethod,
        hours_worked: att.hoursWorked,
        location: att.location,
      });
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("attendance").delete().eq("id", id);
      if (error) throw error;
    },
  },

  dailyReports: {
    async getAll(): Promise<DailyReport[]> {
      const { data, error } = await getClient()
        .from("daily_reports")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDailyReport);
    },

    async getByMonth(year: number, month: number): Promise<DailyReport[]> {
      const mm = String(month).padStart(2, "0");
      const from = `${year}-${mm}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
      const { data, error } = await getClient()
        .from("daily_reports")
        .select("*")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDailyReport);
    },

    async getByDate(date: string): Promise<DailyReport | null> {
      const { data, error } = await getClient()
        .from("daily_reports")
        .select("*")
        .eq("date", date)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDailyReport(data) : null;
    },

    async upsert(r: Omit<DailyReport, "id" | "createdAt">): Promise<void> {
      const { error } = await getClient()
        .from("daily_reports")
        .upsert(
          { date: r.date, title: r.title, content: r.content },
          { onConflict: "date" }
        );
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("daily_reports").delete().eq("id", id);
      if (error) throw error;
    },
  },

  vehicles: {
    async getAll(): Promise<Vehicle[]> {
      const { data, error } = await getClient()
        .from("vehicles")
        .select("*")
        .order("emri_mjetit");
      if (error) throw error;
      return (data ?? []).map(mapVehicle);
    },

    async add(v: Omit<Vehicle, "id" | "createdAt">): Promise<void> {
      const { error } = await getClient().from("vehicles").insert({
        emri_mjetit: v.emriMjetit,
        targa: v.targa,
      });
      if (error) throw error;
    },

    async update(id: number, v: Partial<Vehicle>): Promise<void> {
      const updates: Record<string, unknown> = {};
      if (v.emriMjetit !== undefined) updates.emri_mjetit = v.emriMjetit;
      if (v.targa !== undefined) updates.targa = v.targa;
      const { error } = await getClient().from("vehicles").update(updates).eq("id", id);
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
  },

  diesel: {
    async getAll(): Promise<DieselEntry[]> {
      const { data, error } = await getClient()
        .from("diesel")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDiesel);
    },

    async add(d: Omit<DieselEntry, "id" | "createdAt">): Promise<void> {
      const { error } = await getClient().from("diesel").insert({
        vehicle_id: d.vehicleId,
        emri_mjetit: d.emriMjetit,
        date: d.date,
        liters: d.liters,
        total_price: d.totalPrice,
        photo_base64: d.photoBase64 ?? null,
      });
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("diesel").delete().eq("id", id);
      if (error) throw error;
    },
  },

  workerPayments: {
    async getAll(): Promise<WorkerPayment[]> {
      const { data, error } = await getClient()
        .from("worker_payments")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPayment);
    },

    async getByEmployee(employeeId: number): Promise<WorkerPayment[]> {
      const { data, error } = await getClient()
        .from("worker_payments")
        .select("*")
        .eq("employee_id", employeeId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPayment);
    },

    async add(p: Omit<WorkerPayment, "id" | "createdAt">): Promise<void> {
      const { error } = await getClient().from("worker_payments").insert({
        employee_id: p.employeeId,
        emri: p.emri,
        mbiemri: p.mbiemri,
        amount: p.amount,
        pershkrim: p.pershkrim,
        date: p.date,
      });
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("worker_payments").delete().eq("id", id);
      if (error) throw error;
    },
  },

  vehicleServices: {
    async getAll(): Promise<VehicleServiceEntry[]> {
      const { data, error } = await getClient()
        .from("vehicle_services")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapVehicleService);
    },

    async add(s: Omit<VehicleServiceEntry, "id" | "createdAt">): Promise<void> {
      const { error } = await getClient().from("vehicle_services").insert({
        vehicle_id: s.vehicleId,
        emri_mjetit: s.emriMjetit,
        date: s.date,
        notes: s.notes.trim() || null,
        items: s.items,
        total_price: s.totalPrice,
        photo_base64: s.photoBase64 ?? null,
      });
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("vehicle_services").delete().eq("id", id);
      if (error) throw error;
    },
  },

  stock: {
    async getAll(): Promise<StockItem[]> {
      const { data, error } = await getClient()
        .from("stock_items")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []).map(mapStockItem);
    },

    async add(item: Omit<StockItem, "id" | "createdAt" | "updatedAt">): Promise<void> {
      const { error } = await getClient().from("stock_items").insert({
        category: item.category,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit.trim() || null,
        notes: item.notes.trim() || null,
      });
      if (error) throw error;
    },

    async update(id: number, item: Partial<StockItem>): Promise<void> {
      const updates: Record<string, unknown> = {};
      if (item.category !== undefined) updates.category = item.category;
      if (item.name !== undefined) updates.name = item.name;
      if (item.quantity !== undefined) updates.quantity = item.quantity;
      if (item.unit !== undefined) updates.unit = item.unit.trim() || null;
      if (item.notes !== undefined) updates.notes = item.notes.trim() || null;
      const { error } = await getClient().from("stock_items").update(updates).eq("id", id);
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("stock_items").delete().eq("id", id);
      if (error) throw error;
    },
  },

  officeExpenses: {
    async getAll(): Promise<OfficeExpense[]> {
      const { data, error } = await getClient()
        .from("office_expenses")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapOfficeExpense);
    },

    async add(e: Omit<OfficeExpense, "id" | "createdAt">): Promise<void> {
      const { error } = await getClient().from("office_expenses").insert({
        date: e.date,
        category: e.category,
        title: e.title,
        amount: e.amount,
        notes: e.notes.trim() || null,
        photo_base64: e.photoBase64 ?? null,
      });
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("office_expenses").delete().eq("id", id);
      if (error) throw error;
    },
  },
};
