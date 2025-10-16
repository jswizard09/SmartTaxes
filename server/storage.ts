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
} from "@shared/schema";
import { randomUUID } from "crypto";

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

  constructor() {
    this.users = new Map();
    this.taxReturns = new Map();
    this.documents = new Map();
    this.w2Data = new Map();
    this.form1099Div = new Map();
    this.form1099Int = new Map();
    this.form1099B = new Map();
    this.form1040 = new Map();
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
}

export const storage = new MemStorage();
