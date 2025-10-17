import {
  type User,
  type InsertUser,
  type UserProfile,
  type InsertUserProfile,
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
  type Form1099BEntry,
  type InsertForm1099BEntry,
  type Form1040,
  type Insert1040,
  type Form8949,
  type Insert8949,
  type ScheduleD,
  type InsertScheduleD,
  type ParsingAttempt,
  type InsertParsingAttempt,
  type AiInsight,
  type InsertAiInsight,
  type ProcessingHistory,
  type InsertProcessingHistory,
  type UserPreferences,
  type InsertUserPreferences,
  type Subscription,
  type InsertSubscription,
  type ApiUsage,
  type InsertApiUsage,
  type EfileSubmission,
  type InsertEfileSubmission,
  type StateTaxReturn,
  type InsertStateTaxReturn,
  users,
  userProfiles,
  taxReturns,
  documents,
  w2Data,
  form1099Div,
  form1099Int,
  form1099B,
  form1099BEntries,
  form1040,
  form8949,
  scheduleD,
  parsingAttempts,
  aiInsights,
  processingHistory,
  userPreferences,
  subscriptions,
  apiUsage,
  efileSubmissions,
  stateTaxReturns,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, inArray } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Profile methods
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createUserProfile(data: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile>;

  // Tax Return methods
  getTaxReturn(id: string): Promise<TaxReturn | undefined>;
  getTaxReturnsByUserId(userId: string): Promise<TaxReturn[]>;
  createTaxReturn(taxReturn: InsertTaxReturn): Promise<TaxReturn>;
  updateTaxReturn(id: string, data: Partial<TaxReturn>): Promise<TaxReturn>;

  // Document methods
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByTaxReturnId(taxReturnId: string): Promise<Document[]>;
  getDocumentCountForUser(userId: string): Promise<number>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  clearAllDocuments(): Promise<void>;

  // W-2 Data methods
  getW2DataByTaxReturnId(taxReturnId: string): Promise<W2Data[]>;
  createW2Data(data: InsertW2): Promise<W2Data>;
  updateW2Data(id: string, data: Partial<W2Data>): Promise<W2Data>;

  // 1099-DIV methods
  get1099DivByTaxReturnId(taxReturnId: string): Promise<Form1099Div[]>;
  create1099Div(data: Insert1099Div): Promise<Form1099Div>;
  update1099Div(id: string, data: Partial<Form1099Div>): Promise<Form1099Div>;

  // 1099-INT methods
  get1099IntByTaxReturnId(taxReturnId: string): Promise<Form1099Int[]>;
  create1099Int(data: Insert1099Int): Promise<Form1099Int>;
  update1099Int(id: string, data: Partial<Form1099Int>): Promise<Form1099Int>;

  // 1099-B methods
  get1099BByTaxReturnId(taxReturnId: string): Promise<Form1099B[]>;
  create1099B(data: Insert1099B): Promise<Form1099B>;
  update1099B(id: string, data: Partial<Form1099B>): Promise<Form1099B>;

  // 1099-B Entries methods
  get1099BEntriesByTaxReturnId(taxReturnId: string): Promise<Form1099BEntry[]>;
  create1099BEntry(form1099BId: string, data: Omit<Form1099BEntry, "id" | "form1099BId">): Promise<Form1099BEntry>;
  update1099BEntry(id: string, data: Partial<Form1099BEntry>): Promise<Form1099BEntry>;
  delete1099BEntry(id: string): Promise<void>;

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

  // Parsing Attempts methods
  createParsingAttempt(data: InsertParsingAttempt): Promise<ParsingAttempt>;
  getParsingAttemptsByDocumentId(documentId: string): Promise<ParsingAttempt[]>;

  // AI Insights methods
  createAiInsight(data: InsertAiInsight): Promise<AiInsight>;
  getAiInsightsByTaxReturnId(taxReturnId: string): Promise<AiInsight[]>;
  updateAiInsight(id: string, data: Partial<AiInsight>): Promise<AiInsight>;

  // Processing History methods
  createProcessingHistory(data: InsertProcessingHistory): Promise<ProcessingHistory>;
  getProcessingHistoryByDocumentId(documentId: string): Promise<ProcessingHistory[]>;

  // User Preferences methods
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(data: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(id: string, data: Partial<UserPreferences>): Promise<UserPreferences>;

  // Subscription methods
  getSubscriptionByUserId(userId: string): Promise<Subscription | undefined>;
  getActiveSubscription(userId: string): Promise<Subscription | undefined>;
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription>;

  // API Usage methods
  createApiUsage(data: InsertApiUsage): Promise<ApiUsage>;
  getApiUsageByUserId(userId: string): Promise<ApiUsage[]>;

  // E-file Submission methods
  createEfileSubmission(data: InsertEfileSubmission): Promise<EfileSubmission>;
  getEfileSubmissionsByTaxReturnId(taxReturnId: string): Promise<EfileSubmission[]>;
  updateEfileSubmission(id: string, data: Partial<EfileSubmission>): Promise<EfileSubmission>;

  // State Tax Return methods
  createStateTaxReturn(data: InsertStateTaxReturn): Promise<StateTaxReturn>;
  getStateTaxReturnsByTaxReturnId(taxReturnId: string): Promise<StateTaxReturn[]>;
  updateStateTaxReturn(id: string, data: Partial<StateTaxReturn>): Promise<StateTaxReturn>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private userProfiles: Map<string, UserProfile>;
  private taxReturns: Map<string, TaxReturn>;
  private documents: Map<string, Document>;
  private w2Data: Map<string, W2Data>;
  private form1099Div: Map<string, Form1099Div>;
  private form1099Int: Map<string, Form1099Int>;
  private form1099B: Map<string, Form1099B>;
  private form1099BEntries: Map<string, Form1099BEntry>;
  private form1040: Map<string, Form1040>;
  private form8949: Map<string, Form8949>;
  private scheduleD: Map<string, ScheduleD>;
  private parsingAttempts: Map<string, ParsingAttempt>;
  private aiInsights: Map<string, AiInsight>;
  private processingHistory: Map<string, ProcessingHistory>;
  private userPreferences: Map<string, UserPreferences>;
  private subscriptions: Map<string, Subscription>;
  private apiUsage: Map<string, ApiUsage>;
  private efileSubmissions: Map<string, EfileSubmission>;
  private stateTaxReturns: Map<string, StateTaxReturn>;

  constructor() {
    this.users = new Map();
    this.userProfiles = new Map();
    this.taxReturns = new Map();
    this.documents = new Map();
    this.w2Data = new Map();
    this.form1099Div = new Map();
    this.form1099Int = new Map();
    this.form1099B = new Map();
    this.form1099BEntries = new Map();
    this.form1040 = new Map();
    this.form8949 = new Map();
    this.scheduleD = new Map();
    this.parsingAttempts = new Map();
    this.aiInsights = new Map();
    this.processingHistory = new Map();
    this.userPreferences = new Map();
    this.subscriptions = new Map();
    this.apiUsage = new Map();
    this.efileSubmissions = new Map();
    this.stateTaxReturns = new Map();
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

  // Profile methods
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this.userProfiles.get(userId);
  }

  async createUserProfile(data: InsertUserProfile): Promise<UserProfile> {
    const id = randomUUID();
    const profile: UserProfile = {
      id,
      userId: data.userId,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      middleName: data.middleName || null,
      ssn: data.ssn || null,
      dateOfBirth: data.dateOfBirth || null,
      phoneNumber: data.phoneNumber || null,
      address: data.address || null,
      filingStatus: data.filingStatus || "single",
      spouseFirstName: data.spouseFirstName || null,
      spouseLastName: data.spouseLastName || null,
      spouseMiddleName: data.spouseMiddleName || null,
      spouseSsn: data.spouseSsn || null,
      spouseDateOfBirth: data.spouseDateOfBirth || null,
      dependents: data.dependents || null,
      bankAccountInfo: data.bankAccountInfo || null,
      isVeteran: data.isVeteran || false,
      isBlind: data.isBlind || false,
      isDisabled: data.isDisabled || false,
      isSpouseBlind: data.isSpouseBlind || false,
      isSpouseDisabled: data.isSpouseDisabled || false,
      isSpouseVeteran: data.isSpouseVeteran || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.userProfiles.set(data.userId, profile);
    return profile;
  }

  async updateUserProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile> {
    const existing = this.userProfiles.get(userId);
    if (!existing) {
      // Create new profile if it doesn't exist
      return this.createUserProfile(data as InsertUserProfile);
    }
    
    const updated: UserProfile = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.userProfiles.set(userId, updated);
    return updated;
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
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: insertTaxReturn.userId,
      taxYear: insertTaxReturn.taxYear,
      filingStatus: insertTaxReturn.filingStatus,
      status: insertTaxReturn.status || "draft",
      totalIncome: insertTaxReturn.totalIncome || null,
      totalDeductions: insertTaxReturn.totalDeductions || null,
      taxableIncome: insertTaxReturn.taxableIncome || null,
      totalTax: insertTaxReturn.totalTax || null,
      withheld: insertTaxReturn.withheld || null,
      refundOrOwed: insertTaxReturn.refundOrOwed || null,
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

  async getDocumentCountForUser(userId: string): Promise<number> {
    const taxReturns = await this.getTaxReturnsByUserId(userId);
    if (taxReturns.length === 0) return 0;
    
    let totalCount = 0;
    for (const taxReturn of taxReturns) {
      const documents = await this.getDocumentsByTaxReturnId(taxReturn.id);
      totalCount += documents.length;
    }
    return totalCount;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = {
      id,
      createdAt: new Date(),
      taxReturnId: insertDocument.taxReturnId,
      fileName: insertDocument.fileName,
      fileType: insertDocument.fileType,
      documentType: insertDocument.documentType,
      fileSize: insertDocument.fileSize,
      filePath: insertDocument.filePath,
      status: insertDocument.status || "processing",
      parsedData: insertDocument.parsedData || null,
      parsingMethod: insertDocument.parsingMethod || null,
      confidenceScore: insertDocument.confidenceScore || null,
      rawTextContent: insertDocument.rawTextContent || null,
      llmResponse: insertDocument.llmResponse || null,
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

  async clearAllDocuments(): Promise<void> {
    // Clear all related data first
    this.w2Data.clear();
    this.form1099Div.clear();
    this.form1099Int.clear();
    this.form1099B.clear();
    this.form1099BEntries.clear();
    this.parsingAttempts.clear();
    this.processingHistory.clear();
    this.aiInsights.clear();
    
    // Clear documents last
    this.documents.clear();
  }

  // W-2 Data methods
  async getW2DataByTaxReturnId(taxReturnId: string): Promise<W2Data[]> {
    return Array.from(this.w2Data.values()).filter(
      (data) => data.taxReturnId === taxReturnId
    );
  }

  async createW2Data(insertW2: InsertW2): Promise<W2Data> {
    const id = randomUUID();
    const w2: W2Data = {
      id,
      taxReturnId: insertW2.taxReturnId,
      documentId: insertW2.documentId,
      employerName: insertW2.employerName || null,
      employerEin: insertW2.employerEin || null,
      wages: insertW2.wages || null,
      federalWithheld: insertW2.federalWithheld || null,
      socialSecurityWages: insertW2.socialSecurityWages || null,
      socialSecurityWithheld: insertW2.socialSecurityWithheld || null,
      medicareWages: insertW2.medicareWages || null,
      medicareWithheld: insertW2.medicareWithheld || null,
      stateWages: insertW2.stateWages || null,
      stateWithheld: insertW2.stateWithheld || null,
    };
    this.w2Data.set(id, w2);
    return w2;
  }

  async updateW2Data(id: string, data: Partial<W2Data>): Promise<W2Data> {
    const existing = this.w2Data.get(id);
    if (!existing) throw new Error("W-2 data not found");
    
    const updated = { ...existing, ...data };
    this.w2Data.set(id, updated);
    return updated;
  }

  // 1099-DIV methods
  async get1099DivByTaxReturnId(taxReturnId: string): Promise<Form1099Div[]> {
    return Array.from(this.form1099Div.values()).filter(
      (data) => data.taxReturnId === taxReturnId
    );
  }

  async create1099Div(insert1099Div: Insert1099Div): Promise<Form1099Div> {
    const id = randomUUID();
    const div: Form1099Div = {
      id,
      taxReturnId: insert1099Div.taxReturnId,
      documentId: insert1099Div.documentId,
      payerName: insert1099Div.payerName || null,
      payerTin: insert1099Div.payerTin || null,
      ordinaryDividends: insert1099Div.ordinaryDividends || null,
      qualifiedDividends: insert1099Div.qualifiedDividends || null,
      totalCapitalGain: insert1099Div.totalCapitalGain || null,
      section1202Gain: insert1099Div.section1202Gain || null,
      foreignTaxPaid: insert1099Div.foreignTaxPaid || null,
    };
    this.form1099Div.set(id, div);
    return div;
  }

  async update1099Div(id: string, data: Partial<Form1099Div>): Promise<Form1099Div> {
    const existing = this.form1099Div.get(id);
    if (!existing) throw new Error("1099-DIV data not found");
    
    const updated = { ...existing, ...data };
    this.form1099Div.set(id, updated);
    return updated;
  }

  // 1099-INT methods
  async get1099IntByTaxReturnId(taxReturnId: string): Promise<Form1099Int[]> {
    return Array.from(this.form1099Int.values()).filter(
      (data) => data.taxReturnId === taxReturnId
    );
  }

  async create1099Int(insert1099Int: Insert1099Int): Promise<Form1099Int> {
    const id = randomUUID();
    const int: Form1099Int = {
      id,
      taxReturnId: insert1099Int.taxReturnId,
      documentId: insert1099Int.documentId,
      federalWithheld: insert1099Int.federalWithheld || null,
      payerName: insert1099Int.payerName || null,
      payerTin: insert1099Int.payerTin || null,
      interestIncome: insert1099Int.interestIncome || null,
      earlyWithdrawalPenalty: insert1099Int.earlyWithdrawalPenalty || null,
      usBondInterest: insert1099Int.usBondInterest || null,
    };
    this.form1099Int.set(id, int);
    return int;
  }

  async update1099Int(id: string, data: Partial<Form1099Int>): Promise<Form1099Int> {
    const existing = this.form1099Int.get(id);
    if (!existing) throw new Error("1099-INT data not found");
    
    const updated = { ...existing, ...data };
    this.form1099Int.set(id, updated);
    return updated;
  }

  // 1099-B methods
  async get1099BByTaxReturnId(taxReturnId: string): Promise<Form1099B[]> {
    return Array.from(this.form1099B.values()).filter(
      (data) => data.taxReturnId === taxReturnId
    );
  }

  async create1099B(insert1099B: Insert1099B): Promise<Form1099B> {
    const id = randomUUID();
    const b: Form1099B = {
      id,
      taxReturnId: insert1099B.taxReturnId,
      documentId: insert1099B.documentId,
      payerName: insert1099B.payerName || null,
      payerTin: insert1099B.payerTin || null,
      description: insert1099B.description || null,
      dateAcquired: insert1099B.dateAcquired || null,
      dateSold: insert1099B.dateSold || null,
      proceeds: insert1099B.proceeds || null,
      costBasis: insert1099B.costBasis || null,
      shortTermGainLoss: insert1099B.shortTermGainLoss || null,
      longTermGainLoss: insert1099B.longTermGainLoss || null,
      washSale: insert1099B.washSale || null,
    };
    this.form1099B.set(id, b);
    return b;
  }

  async update1099B(id: string, data: Partial<Form1099B>): Promise<Form1099B> {
    const existing = this.form1099B.get(id);
    if (!existing) throw new Error("1099-B data not found");
    
    const updated = { ...existing, ...data };
    this.form1099B.set(id, updated);
    return updated;
  }

  // 1099-B Entries methods
  async get1099BEntriesByTaxReturnId(taxReturnId: string): Promise<Form1099BEntry[]> {
    // Get all 1099-B forms for this tax return
    const bForms = Array.from(this.form1099B.values()).filter(
      b => b.taxReturnId === taxReturnId
    );
    
    // Get all entries for these forms
    const entries: Form1099BEntry[] = [];
    for (const bForm of bForms) {
      const formEntries = Array.from(this.form1099BEntries.values()).filter(
        entry => entry.form1099BId === bForm.id
      );
      entries.push(...formEntries);
    }
    
    return entries;
  }

  async create1099BEntry(form1099BId: string, data: Omit<Form1099BEntry, "id" | "form1099BId">): Promise<Form1099BEntry> {
    const id = crypto.randomUUID();
    const entry: Form1099BEntry = {
      id,
      form1099BId,
      description: data.description || null,
      dateAcquired: data.dateAcquired || null,
      dateSold: data.dateSold || null,
      proceeds: data.proceeds || null,
      costBasis: data.costBasis || null,
      gainLoss: data.gainLoss || null,
      isShortTerm: data.isShortTerm || false,
      reportedToIrs: data.reportedToIrs || false,
      washSale: data.washSale || false,
      washSaleAmount: data.washSaleAmount || null,
    };
    this.form1099BEntries.set(id, entry);
    return entry;
  }

  async update1099BEntry(id: string, data: Partial<Form1099BEntry>): Promise<Form1099BEntry> {
    const existing = this.form1099BEntries.get(id);
    if (!existing) throw new Error("1099-B entry not found");
    
    const updated = { ...existing, ...data };
    this.form1099BEntries.set(id, updated);
    return updated;
  }

  async delete1099BEntry(id: string): Promise<void> {
    if (!this.form1099BEntries.has(id)) {
      throw new Error("1099-B entry not found");
    }
    this.form1099BEntries.delete(id);
  }

  // Form 1040 methods
  async getForm1040ByTaxReturnId(taxReturnId: string): Promise<Form1040 | undefined> {
    return Array.from(this.form1040.values()).find(
      (form) => form.taxReturnId === taxReturnId
    );
  }

  async createForm1040(insert1040: Insert1040): Promise<Form1040> {
    const id = randomUUID();
    const form: Form1040 = {
      id,
      taxReturnId: insert1040.taxReturnId,
      wages: insert1040.wages || null,
      interestIncome: insert1040.interestIncome || null,
      dividendIncome: insert1040.dividendIncome || null,
      qualifiedDividends: insert1040.qualifiedDividends || null,
      capitalGains: insert1040.capitalGains || null,
      totalIncome: insert1040.totalIncome || null,
      adjustments: insert1040.adjustments || null,
      adjustedGrossIncome: insert1040.adjustedGrossIncome || null,
      standardDeduction: insert1040.standardDeduction || null,
      taxableIncome: insert1040.taxableIncome || null,
      tax: insert1040.tax || null,
      credits: insert1040.credits || null,
      totalTax: insert1040.totalTax || null,
      federalWithheld: insert1040.federalWithheld || null,
      refundOrOwed: insert1040.refundOrOwed || null,
    };
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
    const form: Form8949 = {
      id,
      taxReturnId: insert8949.taxReturnId,
      description: insert8949.description,
      dateSold: insert8949.dateSold,
      proceeds: insert8949.proceeds,
      costBasis: insert8949.costBasis,
      washSale: insert8949.washSale || null,
      form1099BId: insert8949.form1099BId || null,
      adjustmentCode: insert8949.adjustmentCode || null,
      adjustmentAmount: insert8949.adjustmentAmount || null,
      gainOrLoss: insert8949.gainOrLoss,
      isShortTerm: insert8949.isShortTerm,
      dateAcquired: insert8949.dateAcquired || null,
    };
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
    const schedule: ScheduleD = {
      id,
      taxReturnId: insertScheduleD.taxReturnId,
      shortTermTotalProceeds: insertScheduleD.shortTermTotalProceeds || null,
      shortTermTotalCostBasis: insertScheduleD.shortTermTotalCostBasis || null,
      shortTermTotalGainLoss: insertScheduleD.shortTermTotalGainLoss || null,
      longTermTotalProceeds: insertScheduleD.longTermTotalProceeds || null,
      longTermTotalCostBasis: insertScheduleD.longTermTotalCostBasis || null,
      longTermTotalGainLoss: insertScheduleD.longTermTotalGainLoss || null,
      netShortTermGainLoss: insertScheduleD.netShortTermGainLoss || null,
      netLongTermGainLoss: insertScheduleD.netLongTermGainLoss || null,
      totalCapitalGainLoss: insertScheduleD.totalCapitalGainLoss || null,
    };
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

  // Parsing Attempts methods
  async createParsingAttempt(data: InsertParsingAttempt): Promise<ParsingAttempt> {
    const id = randomUUID();
    const parsingAttempt: ParsingAttempt = {
      id,
      createdAt: new Date(),
      parsingMethod: data.parsingMethod,
      documentId: data.documentId,
      confidenceScore: data.confidenceScore || null,
      rawText: data.rawText || null,
      extractedData: data.extractedData || null,
      processingTimeMs: data.processingTimeMs || null,
      errorMessage: data.errorMessage || null,
    };
    this.parsingAttempts.set(id, parsingAttempt);
    return parsingAttempt;
  }

  async getParsingAttemptsByDocumentId(documentId: string): Promise<ParsingAttempt[]> {
    return Array.from(this.parsingAttempts.values()).filter(pa => pa.documentId === documentId);
  }

  // AI Insights methods
  async createAiInsight(data: InsertAiInsight): Promise<AiInsight> {
    const id = randomUUID();
    const insight: AiInsight = {
      id,
      createdAt: new Date(),
      status: data.status || "active",
      taxReturnId: data.taxReturnId || null,
      documentId: data.documentId || null,
      insightType: data.insightType,
      category: data.category,
      title: data.title,
      description: data.description,
      potentialSavings: data.potentialSavings || null,
      priority: data.priority,
      metadata: data.metadata || null,
    };
    this.aiInsights.set(id, insight);
    return insight;
  }

  async getAiInsightsByTaxReturnId(taxReturnId: string): Promise<AiInsight[]> {
    return Array.from(this.aiInsights.values()).filter(ai => ai.taxReturnId === taxReturnId);
  }

  async updateAiInsight(id: string, data: Partial<AiInsight>): Promise<AiInsight> {
    const existing = this.aiInsights.get(id);
    if (!existing) throw new Error("AI Insight not found");

    const updated = { ...existing, ...data };
    this.aiInsights.set(id, updated);
    return updated;
  }

  // Processing History methods
  async createProcessingHistory(data: InsertProcessingHistory): Promise<ProcessingHistory> {
    const id = randomUUID();
    const history: ProcessingHistory = {
      id,
      createdAt: new Date(),
      status: data.status,
      documentId: data.documentId,
      step: data.step,
      method: data.method,
      confidenceScore: data.confidenceScore || null,
      processingTimeMs: data.processingTimeMs || null,
      errorMessage: data.errorMessage || null,
      metadata: data.metadata || null,
    };
    this.processingHistory.set(id, history);
    return history;
  }

  async getProcessingHistoryByDocumentId(documentId: string): Promise<ProcessingHistory[]> {
    return Array.from(this.processingHistory.values()).filter(ph => ph.documentId === documentId);
  }

  // User Preferences methods
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    return Array.from(this.userPreferences.values()).find(up => up.userId === userId);
  }

  async createUserPreferences(data: InsertUserPreferences): Promise<UserPreferences> {
    const id = randomUUID();
    const preferences: UserPreferences = {
      id,
      createdAt: new Date(),
      userId: data.userId,
      updatedAt: new Date(),
      subscriptionTier: data.subscriptionTier || "free",
      aiFeaturesEnabled: data.aiFeaturesEnabled || null,
      autoEfileEnabled: data.autoEfileEnabled || null,
      notificationsEnabled: data.notificationsEnabled || null,
      preferences: data.preferences || null,
    };
    this.userPreferences.set(id, preferences);
    return preferences;
  }

  async updateUserPreferences(id: string, data: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = this.userPreferences.get(id);
    if (!existing) throw new Error("User Preferences not found");

    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.userPreferences.set(id, updated);
    return updated;
  }

  // Subscription methods
  async getSubscriptionByUserId(userId: string): Promise<Subscription | undefined> {
    return Array.from(this.subscriptions.values()).find(s => s.userId === userId);
  }

  async getActiveSubscription(userId: string): Promise<Subscription | undefined> {
    return Array.from(this.subscriptions.values()).find(s => s.userId === userId && s.status === "active");
  }

  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const id = randomUUID();
    const subscription: Subscription = {
      id,
      createdAt: new Date(),
      userId: data.userId,
      status: data.status,
      tier: data.tier,
      startDate: data.startDate,
      renewalDate: data.renewalDate || null,
      cancelledAt: data.cancelledAt || null,
      stripeSubscriptionId: data.stripeSubscriptionId || null,
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription> {
    const existing = this.subscriptions.get(id);
    if (!existing) throw new Error("Subscription not found");

    const updated = { ...existing, ...data };
    this.subscriptions.set(id, updated);
    return updated;
  }

  // API Usage methods
  async createApiUsage(data: InsertApiUsage): Promise<ApiUsage> {
    const id = randomUUID();
    const usage: ApiUsage = {
      id,
      createdAt: new Date(),
      userId: data.userId,
      metadata: data.metadata || null,
      service: data.service,
      endpoint: data.endpoint,
      requestCount: data.requestCount || 1,
      costUsd: data.costUsd || null,
      tokensUsed: data.tokensUsed || null,
    };
    this.apiUsage.set(id, usage);
    return usage;
  }

  async getApiUsageByUserId(userId: string): Promise<ApiUsage[]> {
    return Array.from(this.apiUsage.values()).filter(au => au.userId === userId);
  }

  // E-file Submission methods
  async createEfileSubmission(data: InsertEfileSubmission): Promise<EfileSubmission> {
    const id = randomUUID();
    const submission: EfileSubmission = {
      id,
      createdAt: new Date(),
      status: data.status,
      taxReturnId: data.taxReturnId,
      errorMessage: data.errorMessage || null,
      submissionType: data.submissionType,
      irsSubmissionId: data.irsSubmissionId || null,
      acknowledgmentNumber: data.acknowledgmentNumber || null,
      errorCode: data.errorCode || null,
      submittedAt: data.submittedAt || null,
      processedAt: data.processedAt || null,
    };
    this.efileSubmissions.set(id, submission);
    return submission;
  }

  async getEfileSubmissionsByTaxReturnId(taxReturnId: string): Promise<EfileSubmission[]> {
    return Array.from(this.efileSubmissions.values()).filter(es => es.taxReturnId === taxReturnId);
  }

  async updateEfileSubmission(id: string, data: Partial<EfileSubmission>): Promise<EfileSubmission> {
    const existing = this.efileSubmissions.get(id);
    if (!existing) throw new Error("E-file Submission not found");

    const updated = { ...existing, ...data };
    this.efileSubmissions.set(id, updated);
    return updated;
  }

  // State Tax Return methods
  async createStateTaxReturn(data: InsertStateTaxReturn): Promise<StateTaxReturn> {
    const id = randomUUID();
    const stateReturn: StateTaxReturn = {
      id,
      createdAt: new Date(),
      status: data.status || "draft",
      taxReturnId: data.taxReturnId,
      stateWithheld: data.stateWithheld || null,
      state: data.state,
      stateIncome: data.stateIncome || null,
      stateTax: data.stateTax || null,
      stateRefundOrOwed: data.stateRefundOrOwed || null,
    };
    this.stateTaxReturns.set(id, stateReturn);
    return stateReturn;
  }

  async getStateTaxReturnsByTaxReturnId(taxReturnId: string): Promise<StateTaxReturn[]> {
    return Array.from(this.stateTaxReturns.values()).filter(str => str.taxReturnId === taxReturnId);
  }

  async updateStateTaxReturn(id: string, data: Partial<StateTaxReturn>): Promise<StateTaxReturn> {
    const existing = this.stateTaxReturns.get(id);
    if (!existing) throw new Error("State Tax Return not found");

    const updated = { ...existing, ...data };
    this.stateTaxReturns.set(id, updated);
    return updated;
  }
}

export class DbStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }
    const sql = postgres(process.env.DATABASE_URL);
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

  // Profile methods
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const result = await this.db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return result[0];
  }

  async createUserProfile(data: InsertUserProfile): Promise<UserProfile> {
    const result = await this.db.insert(userProfiles).values(data).returning();
    return result[0];
  }

  async updateUserProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    if (!existing) {
      // Create new profile if it doesn't exist
      return this.createUserProfile({ ...data, userId } as InsertUserProfile);
    }
    
    const result = await this.db
      .update(userProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
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

  async getDocumentCountForUser(userId: string): Promise<number> {
    const taxReturns = await this.getTaxReturnsByUserId(userId);
    if (taxReturns.length === 0) return 0;
    
    let totalCount = 0;
    for (const taxReturn of taxReturns) {
      const documents = await this.getDocumentsByTaxReturnId(taxReturn.id);
      totalCount += documents.length;
    }
    return totalCount;
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

  async clearAllDocuments(): Promise<void> {
    // Clear all related data first (in order of dependencies)
    await this.db.delete(w2Data);
    await this.db.delete(form1099Div);
    await this.db.delete(form1099Int);
    await this.db.delete(form1099B);
    await this.db.delete(parsingAttempts);
    await this.db.delete(processingHistory);
    await this.db.delete(aiInsights);
    
    // Clear documents last
    await this.db.delete(documents);
  }

  // W-2 Data methods
  async getW2DataByTaxReturnId(taxReturnId: string): Promise<W2Data[]> {
    return await this.db.select().from(w2Data).where(eq(w2Data.taxReturnId, taxReturnId));
  }

  async createW2Data(insertW2: InsertW2): Promise<W2Data> {
    const result = await this.db.insert(w2Data).values(insertW2).returning();
    return result[0];
  }

  async updateW2Data(id: string, data: Partial<W2Data>): Promise<W2Data> {
    const result = await this.db
      .update(w2Data)
      .set(data)
      .where(eq(w2Data.id, id))
      .returning();
    
    if (!result[0]) throw new Error("W-2 data not found");
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

  async update1099Div(id: string, data: Partial<Form1099Div>): Promise<Form1099Div> {
    const result = await this.db
      .update(form1099Div)
      .set(data)
      .where(eq(form1099Div.id, id))
      .returning();
    
    if (!result[0]) throw new Error("1099-DIV data not found");
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

  async update1099Int(id: string, data: Partial<Form1099Int>): Promise<Form1099Int> {
    const result = await this.db
      .update(form1099Int)
      .set(data)
      .where(eq(form1099Int.id, id))
      .returning();
    
    if (!result[0]) throw new Error("1099-INT data not found");
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

  async update1099B(id: string, data: Partial<Form1099B>): Promise<Form1099B> {
    const result = await this.db
      .update(form1099B)
      .set(data)
      .where(eq(form1099B.id, id))
      .returning();
    
    if (!result[0]) throw new Error("1099-B data not found");
    return result[0];
  }

  // 1099-B Entries methods
  async get1099BEntriesByTaxReturnId(taxReturnId: string): Promise<Form1099BEntry[]> {
    // Get all 1099-B forms for this tax return
    const bForms = await this.db.select().from(form1099B).where(eq(form1099B.taxReturnId, taxReturnId));
    
    if (bForms.length === 0) return [];
    
    // Get all entries for these forms
    const formIds = bForms.map(form => form.id);
    return await this.db.select().from(form1099BEntries).where(inArray(form1099BEntries.form1099BId, formIds));
  }

  async create1099BEntry(form1099BId: string, data: Omit<Form1099BEntry, "id" | "form1099BId">): Promise<Form1099BEntry> {
    const insertData: InsertForm1099BEntry = {
      form1099BId,
      description: data.description || null,
      dateAcquired: data.dateAcquired || null,
      dateSold: data.dateSold || null,
      proceeds: data.proceeds || null,
      costBasis: data.costBasis || null,
      gainLoss: data.gainLoss || null,
      isShortTerm: data.isShortTerm || false,
      reportedToIrs: data.reportedToIrs || false,
      washSale: data.washSale || false,
      washSaleAmount: data.washSaleAmount || null,
    };
    
    const result = await this.db.insert(form1099BEntries).values(insertData).returning();
    return result[0];
  }

  async update1099BEntry(id: string, data: Partial<Form1099BEntry>): Promise<Form1099BEntry> {
    console.log("DbStorage.update1099BEntry called with:", { id, data });
    const result = await this.db
      .update(form1099BEntries)
      .set(data)
      .where(eq(form1099BEntries.id, id))
      .returning();
    
    console.log("Database update result:", result);
    if (!result[0]) throw new Error("1099-B entry not found");
    return result[0];
  }

  async delete1099BEntry(id: string): Promise<void> {
    const result = await this.db.delete(form1099BEntries).where(eq(form1099BEntries.id, id));
    if (result.rowCount === 0) {
      throw new Error("1099-B entry not found");
    }
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

  // Parsing Attempts methods
  async createParsingAttempt(data: InsertParsingAttempt): Promise<ParsingAttempt> {
    const result = await this.db.insert(parsingAttempts).values(data).returning();
    return result[0];
  }

  async getParsingAttemptsByDocumentId(documentId: string): Promise<ParsingAttempt[]> {
    return await this.db.select().from(parsingAttempts).where(eq(parsingAttempts.documentId, documentId));
  }

  // AI Insights methods
  async createAiInsight(data: InsertAiInsight): Promise<AiInsight> {
    const result = await this.db.insert(aiInsights).values(data).returning();
    return result[0];
  }

  async getAiInsightsByTaxReturnId(taxReturnId: string): Promise<AiInsight[]> {
    return await this.db.select().from(aiInsights).where(eq(aiInsights.taxReturnId, taxReturnId));
  }

  async updateAiInsight(id: string, data: Partial<AiInsight>): Promise<AiInsight> {
    const result = await this.db
      .update(aiInsights)
      .set(data)
      .where(eq(aiInsights.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error("AI Insight not found");
    }

    return result[0];
  }

  // Processing History methods
  async createProcessingHistory(data: InsertProcessingHistory): Promise<ProcessingHistory> {
    const result = await this.db.insert(processingHistory).values(data).returning();
    return result[0];
  }

  async getProcessingHistoryByDocumentId(documentId: string): Promise<ProcessingHistory[]> {
    return await this.db.select().from(processingHistory).where(eq(processingHistory.documentId, documentId));
  }

  // User Preferences methods
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const result = await this.db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return result[0];
  }

  async createUserPreferences(data: InsertUserPreferences): Promise<UserPreferences> {
    const result = await this.db.insert(userPreferences).values(data).returning();
    return result[0];
  }

  async updateUserPreferences(id: string, data: Partial<UserPreferences>): Promise<UserPreferences> {
    const result = await this.db
      .update(userPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userPreferences.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error("User Preferences not found");
    }

    return result[0];
  }

  // Subscription methods
  async getSubscriptionByUserId(userId: string): Promise<Subscription | undefined> {
    const result = await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
    return result[0];
  }

  async getActiveSubscription(userId: string): Promise<Subscription | undefined> {
    const result = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
      .limit(1);
    return result[0];
  }

  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const result = await this.db.insert(subscriptions).values(data).returning();
    return result[0];
  }

  async updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription> {
    const result = await this.db
      .update(subscriptions)
      .set(data)
      .where(eq(subscriptions.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error("Subscription not found");
    }

    return result[0];
  }

  // API Usage methods
  async createApiUsage(data: InsertApiUsage): Promise<ApiUsage> {
    const result = await this.db.insert(apiUsage).values(data).returning();
    return result[0];
  }

  async getApiUsageByUserId(userId: string): Promise<ApiUsage[]> {
    return await this.db.select().from(apiUsage).where(eq(apiUsage.userId, userId));
  }

  // E-file Submission methods
  async createEfileSubmission(data: InsertEfileSubmission): Promise<EfileSubmission> {
    const result = await this.db.insert(efileSubmissions).values(data).returning();
    return result[0];
  }

  async getEfileSubmissionsByTaxReturnId(taxReturnId: string): Promise<EfileSubmission[]> {
    return await this.db.select().from(efileSubmissions).where(eq(efileSubmissions.taxReturnId, taxReturnId));
  }

  async updateEfileSubmission(id: string, data: Partial<EfileSubmission>): Promise<EfileSubmission> {
    const result = await this.db
      .update(efileSubmissions)
      .set(data)
      .where(eq(efileSubmissions.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error("E-file Submission not found");
    }

    return result[0];
  }

  // State Tax Return methods
  async createStateTaxReturn(data: InsertStateTaxReturn): Promise<StateTaxReturn> {
    const result = await this.db.insert(stateTaxReturns).values(data).returning();
    return result[0];
  }

  async getStateTaxReturnsByTaxReturnId(taxReturnId: string): Promise<StateTaxReturn[]> {
    return await this.db.select().from(stateTaxReturns).where(eq(stateTaxReturns.taxReturnId, taxReturnId));
  }

  async updateStateTaxReturn(id: string, data: Partial<StateTaxReturn>): Promise<StateTaxReturn> {
    const result = await this.db
      .update(stateTaxReturns)
      .set(data)
      .where(eq(stateTaxReturns.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error("State Tax Return not found");
    }

    return result[0];
  }
}

export const storage = new DbStorage();
