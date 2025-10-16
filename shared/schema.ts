import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taxReturns = pgTable("tax_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  taxYear: integer("tax_year").notNull(),
  filingStatus: text("filing_status").notNull(),
  totalIncome: decimal("total_income", { precision: 12, scale: 2 }),
  totalDeductions: decimal("total_deductions", { precision: 12, scale: 2 }),
  taxableIncome: decimal("taxable_income", { precision: 12, scale: 2 }),
  totalTax: decimal("total_tax", { precision: 12, scale: 2 }),
  withheld: decimal("withheld", { precision: 12, scale: 2 }),
  refundOrOwed: decimal("refund_or_owed", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  documentType: text("document_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  parsedData: jsonb("parsed_data"),
  status: text("status").notNull().default("uploaded"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const w2Data = pgTable("w2_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  employerName: text("employer_name"),
  employerEin: text("employer_ein"),
  wages: decimal("wages", { precision: 12, scale: 2 }),
  federalWithheld: decimal("federal_withheld", { precision: 12, scale: 2 }),
  socialSecurityWages: decimal("social_security_wages", { precision: 12, scale: 2 }),
  socialSecurityWithheld: decimal("social_security_withheld", { precision: 12, scale: 2 }),
  medicareWages: decimal("medicare_wages", { precision: 12, scale: 2 }),
  medicareWithheld: decimal("medicare_withheld", { precision: 12, scale: 2 }),
  stateWages: decimal("state_wages", { precision: 12, scale: 2 }),
  stateWithheld: decimal("state_withheld", { precision: 12, scale: 2 }),
});

export const form1099Div = pgTable("form_1099_div", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  payerName: text("payer_name"),
  payerTin: text("payer_tin"),
  ordinaryDividends: decimal("ordinary_dividends", { precision: 12, scale: 2 }),
  qualifiedDividends: decimal("qualified_dividends", { precision: 12, scale: 2 }),
  totalCapitalGain: decimal("total_capital_gain", { precision: 12, scale: 2 }),
  section1202Gain: decimal("section_1202_gain", { precision: 12, scale: 2 }),
  foreignTaxPaid: decimal("foreign_tax_paid", { precision: 12, scale: 2 }),
});

export const form1099Int = pgTable("form_1099_int", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  payerName: text("payer_name"),
  payerTin: text("payer_tin"),
  interestIncome: decimal("interest_income", { precision: 12, scale: 2 }),
  earlyWithdrawalPenalty: decimal("early_withdrawal_penalty", { precision: 12, scale: 2 }),
  usBondInterest: decimal("us_bond_interest", { precision: 12, scale: 2 }),
  federalWithheld: decimal("federal_withheld", { precision: 12, scale: 2 }),
});

export const form1099B = pgTable("form_1099_b", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  payerName: text("payer_name"),
  payerTin: text("payer_tin"),
  description: text("description"),
  dateAcquired: text("date_acquired"),
  dateSold: text("date_sold"),
  proceeds: decimal("proceeds", { precision: 12, scale: 2 }),
  costBasis: decimal("cost_basis", { precision: 12, scale: 2 }),
  shortTermGainLoss: decimal("short_term_gain_loss", { precision: 12, scale: 2 }),
  longTermGainLoss: decimal("long_term_gain_loss", { precision: 12, scale: 2 }),
  washSale: boolean("wash_sale").default(false),
});

export const form1040 = pgTable("form_1040", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  wages: decimal("wages", { precision: 12, scale: 2 }),
  interestIncome: decimal("interest_income", { precision: 12, scale: 2 }),
  dividendIncome: decimal("dividend_income", { precision: 12, scale: 2 }),
  qualifiedDividends: decimal("qualified_dividends", { precision: 12, scale: 2 }),
  capitalGains: decimal("capital_gains", { precision: 12, scale: 2 }),
  totalIncome: decimal("total_income", { precision: 12, scale: 2 }),
  adjustments: decimal("adjustments", { precision: 12, scale: 2 }),
  adjustedGrossIncome: decimal("adjusted_gross_income", { precision: 12, scale: 2 }),
  standardDeduction: decimal("standard_deduction", { precision: 12, scale: 2 }),
  taxableIncome: decimal("taxable_income", { precision: 12, scale: 2 }),
  tax: decimal("tax", { precision: 12, scale: 2 }),
  credits: decimal("credits", { precision: 12, scale: 2 }),
  totalTax: decimal("total_tax", { precision: 12, scale: 2 }),
  federalWithheld: decimal("federal_withheld", { precision: 12, scale: 2 }),
  refundOrOwed: decimal("refund_or_owed", { precision: 12, scale: 2 }),
});

export const form8949 = pgTable("form_8949", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  form1099BId: varchar("form_1099_b_id").references(() => form1099B.id),
  description: text("description").notNull(),
  dateAcquired: text("date_acquired"),
  dateSold: text("date_sold").notNull(),
  proceeds: decimal("proceeds", { precision: 12, scale: 2 }).notNull(),
  costBasis: decimal("cost_basis", { precision: 12, scale: 2 }).notNull(),
  adjustmentCode: text("adjustment_code"),
  adjustmentAmount: decimal("adjustment_amount", { precision: 12, scale: 2 }).default("0"),
  gainOrLoss: decimal("gain_or_loss", { precision: 12, scale: 2 }).notNull(),
  isShortTerm: boolean("is_short_term").notNull(),
  washSale: boolean("wash_sale").default(false),
});

export const scheduleD = pgTable("schedule_d", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  shortTermTotalProceeds: decimal("short_term_total_proceeds", { precision: 12, scale: 2 }).default("0"),
  shortTermTotalCostBasis: decimal("short_term_total_cost_basis", { precision: 12, scale: 2 }).default("0"),
  shortTermTotalGainLoss: decimal("short_term_total_gain_loss", { precision: 12, scale: 2 }).default("0"),
  longTermTotalProceeds: decimal("long_term_total_proceeds", { precision: 12, scale: 2 }).default("0"),
  longTermTotalCostBasis: decimal("long_term_total_cost_basis", { precision: 12, scale: 2 }).default("0"),
  longTermTotalGainLoss: decimal("long_term_total_gain_loss", { precision: 12, scale: 2 }).default("0"),
  netShortTermGainLoss: decimal("net_short_term_gain_loss", { precision: 12, scale: 2 }).default("0"),
  netLongTermGainLoss: decimal("net_long_term_gain_loss", { precision: 12, scale: 2 }).default("0"),
  totalCapitalGainLoss: decimal("total_capital_gain_loss", { precision: 12, scale: 2 }).default("0"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  email: z.string().email(),
  password: z.string().min(6),
});

export const insertTaxReturnSchema = createInsertSchema(taxReturns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertW2Schema = createInsertSchema(w2Data).omit({
  id: true,
});

export const insert1099DivSchema = createInsertSchema(form1099Div).omit({
  id: true,
});

export const insert1099IntSchema = createInsertSchema(form1099Int).omit({
  id: true,
});

export const insert1099BSchema = createInsertSchema(form1099B).omit({
  id: true,
});

export const insert1040Schema = createInsertSchema(form1040).omit({
  id: true,
});

export const insert8949Schema = createInsertSchema(form8949).omit({
  id: true,
});

export const insertScheduleDSchema = createInsertSchema(scheduleD).omit({
  id: true,
});

// Select types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTaxReturn = z.infer<typeof insertTaxReturnSchema>;
export type TaxReturn = typeof taxReturns.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertW2 = z.infer<typeof insertW2Schema>;
export type W2Data = typeof w2Data.$inferSelect;

export type Insert1099Div = z.infer<typeof insert1099DivSchema>;
export type Form1099Div = typeof form1099Div.$inferSelect;

export type Insert1099Int = z.infer<typeof insert1099IntSchema>;
export type Form1099Int = typeof form1099Int.$inferSelect;

export type Insert1099B = z.infer<typeof insert1099BSchema>;
export type Form1099B = typeof form1099B.$inferSelect;

export type Insert1040 = z.infer<typeof insert1040Schema>;
export type Form1040 = typeof form1040.$inferSelect;

export type Insert8949 = z.infer<typeof insert8949Schema>;
export type Form8949 = typeof form8949.$inferSelect;

export type InsertScheduleD = z.infer<typeof insertScheduleDSchema>;
export type ScheduleD = typeof scheduleD.$inferSelect;

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Document types enum
export const DOCUMENT_TYPES = {
  W2: "W-2",
  FORM_1099_DIV: "1099-DIV",
  FORM_1099_INT: "1099-INT",
  FORM_1099_B: "1099-B",
} as const;

export const FILING_STATUS = {
  SINGLE: "single",
  MARRIED_JOINT: "married_joint",
  MARRIED_SEPARATE: "married_separate",
  HEAD_OF_HOUSEHOLD: "head_of_household",
} as const;

export const RETURN_STATUS = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  COMPLETE: "complete",
} as const;
