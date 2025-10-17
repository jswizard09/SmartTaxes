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

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  firstName: text("first_name"),
  lastName: text("last_name"),
  middleName: text("middle_name"),
  ssn: text("ssn"), // Encrypted in production
  dateOfBirth: text("date_of_birth"), // YYYY-MM-DD format
  phoneNumber: text("phone_number"),
  address: jsonb("address"), // {street, city, state, zip, country}
  filingStatus: text("filing_status").notNull().default("single"), // single, married_joint, married_separate, head_of_household
  spouseFirstName: text("spouse_first_name"),
  spouseLastName: text("spouse_last_name"),
  spouseMiddleName: text("spouse_middle_name"),
  spouseSsn: text("spouse_ssn"), // Encrypted in production
  spouseDateOfBirth: text("spouse_date_of_birth"), // YYYY-MM-DD format
  dependents: jsonb("dependents"), // Array of dependent objects
  bankAccountInfo: jsonb("bank_account_info"), // {routingNumber, accountNumber, accountType} - Encrypted
  isVeteran: boolean("is_veteran").default(false),
  isBlind: boolean("is_blind").default(false),
  isDisabled: boolean("is_disabled").default(false),
  isSpouseBlind: boolean("is_spouse_blind").default(false),
  isSpouseDisabled: boolean("is_spouse_disabled").default(false),
  isSpouseVeteran: boolean("is_spouse_veteran").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  parsingMethod: text("parsing_method"), // "pattern", "llm", "manual"
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  rawTextContent: text("raw_text_content"),
  llmResponse: jsonb("llm_response"),
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

export const form1099BEntries = pgTable("form_1099_b_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  form1099BId: varchar("form_1099_b_id").notNull().references(() => form1099B.id),
  description: text("description"),
  dateAcquired: text("date_acquired"),
  dateSold: text("date_sold"),
  proceeds: decimal("proceeds", { precision: 12, scale: 2 }),
  costBasis: decimal("cost_basis", { precision: 12, scale: 2 }),
  gainLoss: decimal("gain_loss", { precision: 12, scale: 2 }),
  isShortTerm: boolean("is_short_term").notNull(),
  reportedToIrs: boolean("reported_to_irs").default(false),
  washSale: boolean("wash_sale").default(false),
  washSaleAmount: decimal("wash_sale_amount", { precision: 12, scale: 2 }),
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

// Enhanced parsing and AI features tables
export const parsingAttempts = pgTable("parsing_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  parsingMethod: text("parsing_method").notNull(), // "pattern" or "llm"
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  rawText: text("raw_text"),
  extractedData: jsonb("extracted_data"),
  processingTimeMs: integer("processing_time_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiInsights = pgTable("ai_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxReturnId: varchar("tax_return_id").references(() => taxReturns.id),
  documentId: varchar("document_id").references(() => documents.id),
  insightType: text("insight_type").notNull(), // "document", "consolidated", "year_ahead", "audit_risk"
  category: text("category").notNull(), // "deduction", "optimization", "planning", "risk"
  title: text("title").notNull(),
  description: text("description").notNull(),
  potentialSavings: decimal("potential_savings", { precision: 12, scale: 2 }),
  priority: text("priority").notNull(), // "high", "medium", "low"
  status: text("status").notNull().default("pending"), // "pending", "accepted", "dismissed"
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const processingHistory = pgTable("processing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  step: text("step").notNull(), // "upload", "parse", "validate", "extract", "insights"
  method: text("method").notNull(), // "pattern", "llm", "manual"
  status: text("status").notNull(), // "success", "error", "warning"
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  processingTimeMs: integer("processing_time_ms"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  subscriptionTier: text("subscription_tier").notNull().default("free"), // "free", "premium"
  aiFeaturesEnabled: boolean("ai_features_enabled").default(false),
  autoEfileEnabled: boolean("auto_efile_enabled").default(false),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  preferences: jsonb("preferences"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tier: text("tier").notNull(), // "free", "premium"
  status: text("status").notNull(), // "active", "cancelled", "expired"
  startDate: timestamp("start_date").notNull(),
  renewalDate: timestamp("renewal_date"),
  cancelledAt: timestamp("cancelled_at"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiUsage = pgTable("api_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  service: text("service").notNull(), // "openai", "anthropic", "azure_form_recognizer"
  endpoint: text("endpoint").notNull(),
  requestCount: integer("request_count").notNull().default(1),
  costUsd: decimal("cost_usd", { precision: 8, scale: 4 }),
  tokensUsed: integer("tokens_used"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const efileSubmissions = pgTable("efile_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  submissionType: text("submission_type").notNull(), // "federal", "state"
  status: text("status").notNull(), // "pending", "accepted", "rejected", "error"
  irsSubmissionId: text("irs_submission_id"),
  acknowledgmentNumber: text("acknowledgment_number"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  submittedAt: timestamp("submitted_at"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stateTaxReturns = pgTable("state_tax_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxReturnId: varchar("tax_return_id").notNull().references(() => taxReturns.id),
  state: text("state").notNull(), // "CA", "NY", "TX", etc.
  stateIncome: decimal("state_income", { precision: 12, scale: 2 }),
  stateTax: decimal("state_tax", { precision: 12, scale: 2 }),
  stateWithheld: decimal("state_withheld", { precision: 12, scale: 2 }),
  stateRefundOrOwed: decimal("state_refund_or_owed", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  email: z.string().email(),
  password: z.string().min(6),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().default("US"),
  }).optional(),
  dependents: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().optional(),
    ssn: z.string().optional(),
    dateOfBirth: z.string(),
    relationship: z.string(), // child, stepchild, foster child, etc.
    isQualifyingChild: z.boolean().default(true),
    isQualifyingRelative: z.boolean().default(false),
  })).optional(),
  bankAccountInfo: z.object({
    routingNumber: z.string().optional(),
    accountNumber: z.string().optional(),
    accountType: z.enum(["checking", "savings"]).optional(),
  }).optional(),
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

export const insertParsingAttemptSchema = createInsertSchema(parsingAttempts).omit({
  id: true,
  createdAt: true,
});

export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({
  id: true,
  createdAt: true,
});

export const insertProcessingHistorySchema = createInsertSchema(processingHistory).omit({
  id: true,
  createdAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({
  id: true,
  createdAt: true,
});

export const insertEfileSubmissionSchema = createInsertSchema(efileSubmissions).omit({
  id: true,
  createdAt: true,
});

export const insertStateTaxReturnSchema = createInsertSchema(stateTaxReturns).omit({
  id: true,
  createdAt: true,
});

// Select types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

export type InsertTaxReturn = z.infer<typeof insertTaxReturnSchema>;
export type TaxReturn = typeof taxReturns.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertW2 = z.infer<typeof insertW2Schema>;
export type W2Data = typeof w2Data.$inferSelect & { documentName?: string | null };

export type Insert1099Div = z.infer<typeof insert1099DivSchema>;
export type Form1099Div = typeof form1099Div.$inferSelect & { documentName?: string | null };

export type Insert1099Int = z.infer<typeof insert1099IntSchema>;
export type Form1099Int = typeof form1099Int.$inferSelect & { documentName?: string | null };

export type Insert1099B = z.infer<typeof insert1099BSchema>;
export type Form1099B = typeof form1099B.$inferSelect & { documentName?: string | null };

export type Form1099BEntry = typeof form1099BEntries.$inferSelect;
export type InsertForm1099BEntry = typeof form1099BEntries.$inferInsert;

export type Insert1040 = z.infer<typeof insert1040Schema>;
export type Form1040 = typeof form1040.$inferSelect;

export type Insert8949 = z.infer<typeof insert8949Schema>;
export type Form8949 = typeof form8949.$inferSelect;

export type InsertScheduleD = z.infer<typeof insertScheduleDSchema>;
export type ScheduleD = typeof scheduleD.$inferSelect;

export type InsertParsingAttempt = z.infer<typeof insertParsingAttemptSchema>;
export type ParsingAttempt = typeof parsingAttempts.$inferSelect;

export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;
export type AiInsight = typeof aiInsights.$inferSelect;

export type InsertProcessingHistory = z.infer<typeof insertProcessingHistorySchema>;
export type ProcessingHistory = typeof processingHistory.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export type InsertApiUsage = z.infer<typeof insertApiUsageSchema>;
export type ApiUsage = typeof apiUsage.$inferSelect;

export type InsertEfileSubmission = z.infer<typeof insertEfileSubmissionSchema>;
export type EfileSubmission = typeof efileSubmissions.$inferSelect;

export type InsertStateTaxReturn = z.infer<typeof insertStateTaxReturnSchema>;
export type StateTaxReturn = typeof stateTaxReturns.$inferSelect;

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
  QUALIFYING_WIDOW: "qualifying_widow",
} as const;

export const DEPENDENT_RELATIONSHIPS = {
  CHILD: "child",
  STEPCHILD: "stepchild",
  FOSTER_CHILD: "foster_child",
  GRANDCHILD: "grandchild",
  SIBLING: "sibling",
  PARENT: "parent",
  GRANDPARENT: "grandparent",
  OTHER_RELATIVE: "other_relative",
  NON_RELATIVE: "non_relative",
} as const;

export const ACCOUNT_TYPES = {
  CHECKING: "checking",
  SAVINGS: "savings",
} as const;

export const RETURN_STATUS = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  COMPLETE: "complete",
} as const;

export const PARSING_METHOD = {
  PATTERN: "pattern",
  LLM: "llm",
  MANUAL: "manual",
} as const;

export const INSIGHT_TYPE = {
  DOCUMENT: "document",
  CONSOLIDATED: "consolidated",
  YEAR_AHEAD: "year_ahead",
  AUDIT_RISK: "audit_risk",
} as const;

export const INSIGHT_CATEGORY = {
  DEDUCTION: "deduction",
  OPTIMIZATION: "optimization",
  PLANNING: "planning",
  RISK: "risk",
} as const;

export const INSIGHT_PRIORITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const INSIGHT_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DISMISSED: "dismissed",
} as const;

export const SUBSCRIPTION_TIER = {
  FREE: "free",
  PREMIUM: "premium",
} as const;

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export const EFILE_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  ERROR: "error",
} as const;

// Tax Configuration Tables
export const taxYears = pgTable("tax_years", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull().unique(),
  isActive: boolean("is_active").default(false),
  federalDeadline: text("federal_deadline"), // "2024-04-15"
  stateDeadlines: jsonb("state_deadlines"), // {CA: "2024-04-15", NY: "2024-04-15"}
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const federalTaxBrackets = pgTable("federal_tax_brackets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYearId: varchar("tax_year_id").notNull().references(() => taxYears.id),
  filingStatus: text("filing_status").notNull(), // single, married_joint, etc.
  minIncome: decimal("min_income", { precision: 12, scale: 2 }).notNull(),
  maxIncome: decimal("max_income", { precision: 12, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).notNull(), // 0.10 for 10%
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const federalStandardDeductions = pgTable("federal_standard_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYearId: varchar("tax_year_id").notNull().references(() => taxYears.id),
  filingStatus: text("filing_status").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  additionalBlindAmount: decimal("additional_blind_amount", { precision: 12, scale: 2 }).default("0"),
  additionalDisabledAmount: decimal("additional_disabled_amount", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stateTaxBrackets = pgTable("state_tax_brackets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYearId: varchar("tax_year_id").notNull().references(() => taxYears.id),
  stateCode: text("state_code").notNull(), // CA, NY, TX, etc.
  filingStatus: text("filing_status").notNull(),
  minIncome: decimal("min_income", { precision: 12, scale: 2 }).notNull(),
  maxIncome: decimal("max_income", { precision: 12, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stateStandardDeductions = pgTable("state_standard_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxYearId: varchar("tax_year_id").notNull().references(() => taxYears.id),
  stateCode: text("state_code").notNull(),
  filingStatus: text("filing_status").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Form Configuration Tables
export const formSchemas = pgTable("form_schemas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formType: text("form_type").notNull(), // W-2, 1099-DIV, 1099-INT, 1099-B
  taxYearId: varchar("tax_year_id").notNull().references(() => taxYears.id),
  schemaVersion: text("schema_version").notNull().default("1.0"),
  fields: jsonb("fields").notNull(), // Array of field definitions
  validationRules: jsonb("validation_rules"), // Validation rules for fields
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const formFieldDefinitions = pgTable("form_field_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formSchemaId: varchar("form_schema_id").notNull().references(() => formSchemas.id),
  fieldName: text("field_name").notNull(),
  fieldType: text("field_type").notNull(), // text, number, date, boolean
  displayName: text("display_name").notNull(),
  description: text("description"),
  isRequired: boolean("is_required").default(false),
  validationPattern: text("validation_pattern"), // Regex pattern
  minLength: integer("min_length"),
  maxLength: integer("max_length"),
  minValue: decimal("min_value", { precision: 12, scale: 2 }),
  maxValue: decimal("max_value", { precision: 12, scale: 2 }),
  defaultValue: text("default_value"),
  options: jsonb("options"), // For select fields
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Application Configuration
export const appConfigurations = pgTable("app_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configKey: text("config_key").notNull().unique(),
  configValue: jsonb("config_value").notNull(),
  configType: text("config_type").notNull(), // string, number, boolean, object, array
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas for new tables
export const insertTaxYearSchema = createInsertSchema(taxYears).omit({
  id: true,
  createdAt: true,
});

export const insertFederalTaxBracketSchema = createInsertSchema(federalTaxBrackets).omit({
  id: true,
  createdAt: true,
});

export const insertFederalStandardDeductionSchema = createInsertSchema(federalStandardDeductions).omit({
  id: true,
  createdAt: true,
});

export const insertStateTaxBracketSchema = createInsertSchema(stateTaxBrackets).omit({
  id: true,
  createdAt: true,
});

export const insertStateStandardDeductionSchema = createInsertSchema(stateStandardDeductions).omit({
  id: true,
  createdAt: true,
});

export const insertFormSchemaSchema = createInsertSchema(formSchemas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormFieldDefinitionSchema = createInsertSchema(formFieldDefinitions).omit({
  id: true,
  createdAt: true,
});

export const insertAppConfigurationSchema = createInsertSchema(appConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select types for new tables
export type TaxYear = typeof taxYears.$inferSelect;
export type InsertTaxYear = z.infer<typeof insertTaxYearSchema>;

export type FederalTaxBracket = typeof federalTaxBrackets.$inferSelect;
export type InsertFederalTaxBracket = z.infer<typeof insertFederalTaxBracketSchema>;

export type FederalStandardDeduction = typeof federalStandardDeductions.$inferSelect;
export type InsertFederalStandardDeduction = z.infer<typeof insertFederalStandardDeductionSchema>;

export type StateTaxBracket = typeof stateTaxBrackets.$inferSelect;
export type InsertStateTaxBracket = z.infer<typeof insertStateTaxBracketSchema>;

export type StateStandardDeduction = typeof stateStandardDeductions.$inferSelect;
export type InsertStateStandardDeduction = z.infer<typeof insertStateStandardDeductionSchema>;

export type FormSchema = typeof formSchemas.$inferSelect;
export type InsertFormSchema = z.infer<typeof insertFormSchemaSchema>;

export type FormFieldDefinition = typeof formFieldDefinitions.$inferSelect;
export type InsertFormFieldDefinition = z.infer<typeof insertFormFieldDefinitionSchema>;

export type AppConfiguration = typeof appConfigurations.$inferSelect;
export type InsertAppConfiguration = z.infer<typeof insertAppConfigurationSchema>;
