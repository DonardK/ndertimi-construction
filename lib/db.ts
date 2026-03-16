import Dexie, { type EntityTable } from "dexie";

export interface Employee {
  id?: number;
  emri: string;
  mbiemri: string;
  telefoni: string;
  createdAt: string;
  syncStatus: "local" | "synced";
}

export interface Attendance {
  id?: number;
  employeeId: number;
  emri: string;
  mbiemri: string;
  date: string;
  paymentMethod: "Bankë" | "Cash";
  hoursWorked: number;
  createdAt: string;
  syncStatus: "local" | "synced";
}

export interface Vehicle {
  id?: number;
  emriMjetit: string;
  targa: string;
  createdAt: string;
  syncStatus: "local" | "synced";
}

export interface DieselEntry {
  id?: number;
  vehicleId: number;
  emriMjetit: string;
  date: string;
  liters: number;
  totalPrice: number;
  photoBase64?: string;
  createdAt: string;
  syncStatus: "local" | "synced";
}

class NdertimiDB extends Dexie {
  employees!: EntityTable<Employee, "id">;
  attendance!: EntityTable<Attendance, "id">;
  vehicles!: EntityTable<Vehicle, "id">;
  diesel!: EntityTable<DieselEntry, "id">;

  constructor() {
    super("NdertimiDB");
    this.version(1).stores({
      employees: "++id, emri, mbiemri, telefoni, createdAt, syncStatus",
      attendance:
        "++id, employeeId, date, paymentMethod, hoursWorked, createdAt, syncStatus",
      vehicles: "++id, emriMjetit, targa, createdAt, syncStatus",
      diesel:
        "++id, vehicleId, date, liters, totalPrice, createdAt, syncStatus",
    });
  }
}

export const db = new NdertimiDB();
