import {
  type User,
  type InsertUser,
  type TaxReturn,
  type InsertTaxReturn,
  type Document,
  type InsertDocument,
  type W2Data,
  type InsertW2,
  type Form1099Div,
  type Insert1099Div,
  type Form1099Int,
  type Insert1099Int,
  type Form1099B,
  type Insert1099B,
  type Form1040,
  type Insert1040,
  type Form8949,
  type Insert8949,
  type ScheduleD,
  type InsertScheduleD,
  users,
  taxReturns,
  documents,
  w2Data,
  form1099Div,
  form1099Int,
  form1099B,
  form1040,
  form8949,
  scheduleD,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Tax Return methods
  getTaxReturn(id: string): Promise<TaxReturn | undefined>;
  getTaxReturnsByUserId(userId: string): Promise<TaxReturn[]>;
  createTaxReturn(taxReturn: InsertTaxReturn): Promise<TaxReturn>;
  updateTaxReturn(id: string, data: Partial<TaxReturn>): Promise<TaxReturn>;

  // Document methods
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByTaxReturnId(taxReturnId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // W-2 Data methods
  getW2DataByTaxReturnId(taxReturnId: string): Promise<W2Data[]>;
  createW2Data(data: InsertW2): Promise<W2Data>;

  // 1099-DIV methods
  get1099DivByTaxReturnId(taxReturnId: string): Promise<Form1099Div[]>;
  create1099Div(data: Insert1099Div): Promise<Form1099Div>;

  // 1099-INT methods
  get1099IntByTaxReturnId(taxReturnId: string): Promise<Form1099Int[]>;
  create1099Int(data: Insert1099Int): Promise<Form1099Int>;

  // 1099-B methods
  get1099BByTaxReturnId(taxReturnId: string): Promise<Form1099B[]>;
  create1099B(data: Insert1099B): Promise<Form1099B>;

  // Form 1040 methods
  getForm1040ByTaxReturnId(taxReturnId: string): Promise<Form1040 | undefined>;
  createForm1040(data: Insert1040): Promise<Form1040>;
  updateForm1040(id: string, data: Partial<Form1040>): Promise<Form1040>;

  // Form 8949 methods
  get8949ByTaxReturnId(taxReturnId: string): Promise<Form8949[]>;
  create8949(data: Insert8949): Promise<Form8949>;
  delete8949ByTaxReturnId(taxReturnId: string): Promise<void>;

  // Schedule D methods
  getScheduleDByTaxReturnId(taxReturnId: string): Promise<ScheduleD | undefined>;
  createScheduleD(data: InsertScheduleD): Promise<ScheduleD>;
  updateScheduleD(id: string, data: Partial<ScheduleD>): Promise<ScheduleD>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private taxReturns: Map<string, TaxReturn>;
  private documents: Map<string, Document>;
  private w2Data: Map<string, W2Data>;
  private form1099Div: Map<string, Form1099Div>;
  private form1099Int: Map<string, Form1099Int>;
  private form1099B: Map<string, Form1099B>;
  private form1040: Map<string, Form1040>;
  private form8949: Map<string, Form8949>;
  private scheduleD: Map<string, ScheduleD>;

  constructor() {
    this.users = new Map();
    this.taxReturns = new Map();
    this.documents = new Map();
    this.w2Data = new Map();
    this.form1099Div = new Map();
    this.form1099Int = new Map();
    this.form1099B = new Map();
    this.form1040 = new Map();
    this.form8949 = new Map();
    this.scheduleD = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Tax Return methods
  async getTaxReturn(id: string): Promise<TaxReturn | undefined> {
    return this.taxReturns.get(id);
  }

  async getTaxReturnsByUserId(userId: string): Promise<TaxReturn[]> {
    return Array.from(this.taxReturns.values()).filter(
      (tr) => tr.userId === userId
    );
  }

  async createTaxReturn(insertTaxReturn: InsertTaxReturn): Promise<TaxReturn> {
    const id = randomUUID();
    const taxReturn: TaxReturn = {
      ...insertTaxReturn,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.taxReturns.set(id, taxReturn);
    return taxReturn;
  }

  async updateTaxReturn(id: string, data: Partial<TaxReturn>): Promise<TaxReturn> {
    const existing = this.taxReturns.get(id);
    if (!existing) throw new Error("Tax return not found");
    
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.taxReturns.set(id, updated);
    return updated;
  }

  // Document methods
  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentsByTaxReturnId(taxReturnId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.taxReturnId === taxReturnId
    );
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = {
      ...insertDocument,
      id,
      createdAt: new Date(),
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document> {
    const existing = this.documents.get(id);
    if (!existing) throw new Error("Document not found");
    
    const updated = { ...existing, ...data };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  // W-2 Data methods
  async getW2DataByTaxReturnId(taxReturnId: string): Promise<W2Data[]> {
    return Array.from(this.w2Data.values()).filter(
      (data) => data.taxReturnId === taxReturnId
    );
  }

  async createW2Data(insertW2: InsertW2): Promise<W2Data> {
    const id = randomUUID();
    const w2: W2Data = { ...insertW2, id };
    this.w2Data.set(id, w2);
    return w2;
  }

  // 1099-DIV methods
  async get1099DivByTaxReturnId(taxReturnId: string): Promise<Form1099Div[]> {
    return Array.from(this.form1099Div.values()).filter(
      (data) => data.taxReturnId === taxReturnId
    );
  }

  async create1099Div(insert1099Div: Insert1099Div): Promise<Form1099Div> {
    const id = randomUUID();
    const div: Form1099Div = { ...insert1099Div, id };
    this.form1099Div.set(id, div);
    return div;
  }

  // 1099-INT methods
  async get1099IntByTaxReturnId(taxReturnId: string): Promise<Form1099Int[]> {
    return Array.from(this.form1099Int.values()).filter(
      (data) => data.taxReturnId === taxReturnId
    );
  }

  async create1099Int(insert1099Int: Insert1099Int): Promise<Form1099Int> {
    const id = randomUUID();
    const int: Form1099Int = { ...insert1099Int, id };
    this.form1099Int.set(id, int);
    return int;
  }

  // 1099-B methods
  async get1099BByTaxReturnId(taxReturnId: string): Promise<Form1099B[]> {
    return Array.from(this.form1099B.values()).filter(
      (data) => data.taxReturnId === taxReturnId
    );
  }

  async create1099B(insert1099B: Insert1099B): Promise<Form1099B> {
    const id = randomUUID();
    const b: Form1099B = { ...insert1099B, id };
    this.form1099B.set(id, b);
    return b;
  }

  // Form 1040 methods
  async getForm1040ByTaxReturnId(taxReturnId: string): Promise<Form1040 | undefined> {
    return Array.from(this.form1040.values()).find(
      (form) => form.taxReturnId === taxReturnId
    );
  }

  async createForm1040(insert1040: Insert1040): Promise<Form1040> {
    const id = randomUUID();
    const form: Form1040 = { ...insert1040, id };
    this.form1040.set(id, form);
    return form;
  }

  async updateForm1040(id: string, data: Partial<Form1040>): Promise<Form1040> {
    const existing = this.form1040.get(id);
    if (!existing) throw new Error("Form 1040 not found");
    
    const updated = { ...existing, ...data };
    this.form1040.set(id, updated);
    return updated;
  }

  // Form 8949 methods
  async get8949ByTaxReturnId(taxReturnId: string): Promise<Form8949[]> {
    return Array.from(this.form8949.values()).filter(
      (form) => form.taxReturnId === taxReturnId
    );
  }

  async create8949(insert8949: Insert8949): Promise<Form8949> {
    const id = randomUUID();
    const form: Form8949 = { ...insert8949, id };
    this.form8949.set(id, form);
    return form;
  }

  async delete8949ByTaxReturnId(taxReturnId: string): Promise<void> {
    const toDelete = Array.from(this.form8949.entries())
      .filter(([_, form]) => form.taxReturnId === taxReturnId)
      .map(([id]) => id);
    
    toDelete.forEach(id => this.form8949.delete(id));
  }

  // Schedule D methods
  async getScheduleDByTaxReturnId(taxReturnId: string): Promise<ScheduleD | undefined> {
    return Array.from(this.scheduleD.values()).find(
      (schedule) => schedule.taxReturnId === taxReturnId
    );
  }

  async createScheduleD(insertScheduleD: InsertScheduleD): Promise<ScheduleD> {
    const id = randomUUID();
    const schedule: ScheduleD = { ...insertScheduleD, id };
    this.scheduleD.set(id, schedule);
    return schedule;
  }

  async updateScheduleD(id: string, data: Partial<ScheduleD>): Promise<ScheduleD> {
    const existing = this.scheduleD.get(id);
    if (!existing) throw new Error("Schedule D not found");
    
    const updated = { ...existing, ...data };
    this.scheduleD.set(id, updated);
    return updated;
  }
}

export class DbStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Tax Return methods
  async getTaxReturn(id: string): Promise<TaxReturn | undefined> {
    const result = await this.db.select().from(taxReturns).where(eq(taxReturns.id, id)).limit(1);
    return result[0];
  }

  async getTaxReturnsByUserId(userId: string): Promise<TaxReturn[]> {
    return await this.db.select().from(taxReturns).where(eq(taxReturns.userId, userId));
  }

  async createTaxReturn(insertTaxReturn: InsertTaxReturn): Promise<TaxReturn> {
    const result = await this.db.insert(taxReturns).values(insertTaxReturn).returning();
    return result[0];
  }

  async updateTaxReturn(id: string, data: Partial<TaxReturn>): Promise<TaxReturn> {
    const result = await this.db
      .update(taxReturns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taxReturns.id, id))
      .returning();
    
    if (!result[0]) throw new Error("Tax return not found");
    return result[0];
  }

  // Document methods
  async getDocument(id: string): Promise<Document | undefined> {
    const result = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return result[0];
  }

  async getDocumentsByTaxReturnId(taxReturnId: string): Promise<Document[]> {
    return await this.db.select().from(documents).where(eq(documents.taxReturnId, taxReturnId));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const result = await this.db.insert(documents).values(insertDocument).returning();
    return result[0];
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document> {
    const result = await this.db
      .update(documents)
      .set(data)
      .where(eq(documents.id, id))
      .returning();
    
    if (!result[0]) throw new Error("Document not found");
    return result[0];
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.delete(documents).where(eq(documents.id, id));
  }

  // W-2 Data methods
  async getW2DataByTaxReturnId(taxReturnId: string): Promise<W2Data[]> {
    return await this.db.select().from(w2Data).where(eq(w2Data.taxReturnId, taxReturnId));
  }

  async createW2Data(insertW2: InsertW2): Promise<W2Data> {
    const result = await this.db.insert(w2Data).values(insertW2).returning();
    return result[0];
  }

  // 1099-DIV methods
  async get1099DivByTaxReturnId(taxReturnId: string): Promise<Form1099Div[]> {
    return await this.db.select().from(form1099Div).where(eq(form1099Div.taxReturnId, taxReturnId));
  }

  async create1099Div(insert1099Div: Insert1099Div): Promise<Form1099Div> {
    const result = await this.db.insert(form1099Div).values(insert1099Div).returning();
    return result[0];
  }

  // 1099-INT methods
  async get1099IntByTaxReturnId(taxReturnId: string): Promise<Form1099Int[]> {
    return await this.db.select().from(form1099Int).where(eq(form1099Int.taxReturnId, taxReturnId));
  }

  async create1099Int(insert1099Int: Insert1099Int): Promise<Form1099Int> {
    const result = await this.db.insert(form1099Int).values(insert1099Int).returning();
    return result[0];
  }

  // 1099-B methods
  async get1099BByTaxReturnId(taxReturnId: string): Promise<Form1099B[]> {
    return await this.db.select().from(form1099B).where(eq(form1099B.taxReturnId, taxReturnId));
  }

  async create1099B(insert1099B: Insert1099B): Promise<Form1099B> {
    const result = await this.db.insert(form1099B).values(insert1099B).returning();
    return result[0];
  }

  // Form 1040 methods
  async getForm1040ByTaxReturnId(taxReturnId: string): Promise<Form1040 | undefined> {
    const result = await this.db.select().from(form1040).where(eq(form1040.taxReturnId, taxReturnId)).limit(1);
    return result[0];
  }

  async createForm1040(insert1040: Insert1040): Promise<Form1040> {
    const result = await this.db.insert(form1040).values(insert1040).returning();
    return result[0];
  }

  async updateForm1040(id: string, data: Partial<Form1040>): Promise<Form1040> {
    const result = await this.db
      .update(form1040)
      .set(data)
      .where(eq(form1040.id, id))
      .returning();
    
    if (!result[0]) throw new Error("Form 1040 not found");
    return result[0];
  }

  // Form 8949 methods
  async get8949ByTaxReturnId(taxReturnId: string): Promise<Form8949[]> {
    return await this.db.select().from(form8949).where(eq(form8949.taxReturnId, taxReturnId));
  }

  async create8949(insert8949: Insert8949): Promise<Form8949> {
    const result = await this.db.insert(form8949).values(insert8949).returning();
    return result[0];
  }

  async delete8949ByTaxReturnId(taxReturnId: string): Promise<void> {
    await this.db.delete(form8949).where(eq(form8949.taxReturnId, taxReturnId));
  }

  // Schedule D methods
  async getScheduleDByTaxReturnId(taxReturnId: string): Promise<ScheduleD | undefined> {
    const result = await this.db.select().from(scheduleD).where(eq(scheduleD.taxReturnId, taxReturnId)).limit(1);
    return result[0];
  }

  async createScheduleD(insertScheduleD: InsertScheduleD): Promise<ScheduleD> {
    const result = await this.db.insert(scheduleD).values(insertScheduleD).returning();
    return result[0];
  }

  async updateScheduleD(id: string, data: Partial<ScheduleD>): Promise<ScheduleD> {
    const result = await this.db
      .update(scheduleD)
      .set(data)
      .where(eq(scheduleD.id, id))
      .returning();
    
    if (!result[0]) throw new Error("Schedule D not found");
    return result[0];
  }
}

export const storage = new DbStorage();
