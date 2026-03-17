import { getClient } from "./supabase";

export interface Employee {
  id?: number;
  emri: string;
  mbiemri: string;
  paymentMethod: "Cash" | "Bankë";
  cmimiOre: number;
  createdAt?: string;
}

export interface Attendance {
  id?: number;
  employeeId: number;
  emri: string;
  mbiemri: string;
  date: string;
  paymentMethod: "Cash" | "Bankë";
  hoursWorked: number;
  createdAt?: string;
}

export interface Vehicle {
  id?: number;
  emriMjetit: string;
  targa: string;
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

// --- Row mappers (DB snake_case → TS camelCase) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmployee(row: any): Employee {
  return {
    id: row.id,
    emri: row.emri,
    mbiemri: row.mbiemri,
    paymentMethod: row.payment_method,
    cmimiOre: Number(row.cmimi_ore),
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
      });
      if (error) throw error;
    },

    async update(id: number, emp: Partial<Employee>): Promise<void> {
      const updates: Record<string, unknown> = {};
      if (emp.emri !== undefined) updates.emri = emp.emri;
      if (emp.mbiemri !== undefined) updates.mbiemri = emp.mbiemri;
      if (emp.paymentMethod !== undefined) updates.payment_method = emp.paymentMethod;
      if (emp.cmimiOre !== undefined) updates.cmimi_ore = emp.cmimiOre;
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
      });
      if (error) throw error;
    },

    async delete(id: number): Promise<void> {
      const { error } = await getClient().from("attendance").delete().eq("id", id);
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
};
