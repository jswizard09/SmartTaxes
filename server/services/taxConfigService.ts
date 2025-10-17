import { eq, and, desc } from "drizzle-orm";
import { storage } from "../storage";
import type { 
  TaxYear, 
  FederalTaxBracket, 
  FederalStandardDeduction,
  StateTaxBracket,
  StateStandardDeduction,
  FormSchema,
  FormFieldDefinition,
  AppConfiguration,
  InsertTaxYear,
  InsertFederalTaxBracket,
  InsertFederalStandardDeduction,
  InsertStateTaxBracket,
  InsertStateStandardDeduction,
  InsertFormSchema,
  InsertFormFieldDefinition,
  InsertAppConfiguration
} from "@shared/schema";

export interface TaxCalculationData {
  federalBrackets: FederalTaxBracket[];
  federalStandardDeduction: FederalStandardDeduction | null;
  stateBrackets: StateTaxBracket[];
  stateStandardDeduction: StateStandardDeduction | null;
}

export interface FormSchemaData {
  schema: FormSchema;
  fields: FormFieldDefinition[];
}

export class TaxConfigurationService {
  /**
   * Get active tax year
   */
  async getActiveTaxYear(): Promise<TaxYear | null> {
    const result = await storage.db
      .select()
      .from(storage.taxYears)
      .where(eq(storage.taxYears.isActive, true))
      .orderBy(desc(storage.taxYears.year))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get tax year by year
   */
  async getTaxYear(year: number): Promise<TaxYear | null> {
    const result = await storage.db
      .select()
      .from(storage.taxYears)
      .where(eq(storage.taxYears.year, year))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get all available tax years
   */
  async getAllTaxYears(): Promise<TaxYear[]> {
    return await storage.db
      .select()
      .from(storage.taxYears)
      .orderBy(desc(storage.taxYears.year));
  }

  /**
   * Create a new tax year
   */
  async createTaxYear(data: InsertTaxYear): Promise<TaxYear> {
    const result = await storage.db
      .insert(storage.taxYears)
      .values(data)
      .returning();
    
    return result[0];
  }

  /**
   * Get tax calculation data for a specific year and filing status
   */
  async getTaxCalculationData(
    year: number, 
    filingStatus: string, 
    stateCode?: string
  ): Promise<TaxCalculationData> {
    const taxYear = await this.getTaxYear(year);
    if (!taxYear) {
      throw new Error(`Tax year ${year} not found`);
    }

    // Get federal tax brackets
    const federalBrackets = await storage.db
      .select()
      .from(storage.federalTaxBrackets)
      .where(
        and(
          eq(storage.federalTaxBrackets.taxYearId, taxYear.id),
          eq(storage.federalTaxBrackets.filingStatus, filingStatus)
        )
      )
      .orderBy(storage.federalTaxBrackets.minIncome);

    // Get federal standard deduction
    const federalStandardDeduction = await storage.db
      .select()
      .from(storage.federalStandardDeductions)
      .where(
        and(
          eq(storage.federalStandardDeductions.taxYearId, taxYear.id),
          eq(storage.federalStandardDeductions.filingStatus, filingStatus)
        )
      )
      .limit(1);

    // Get state tax brackets if state code provided
    let stateBrackets: StateTaxBracket[] = [];
    let stateStandardDeduction: StateStandardDeduction | null = null;

    if (stateCode) {
      stateBrackets = await storage.db
        .select()
        .from(storage.stateTaxBrackets)
        .where(
          and(
            eq(storage.stateTaxBrackets.taxYearId, taxYear.id),
            eq(storage.stateTaxBrackets.stateCode, stateCode),
            eq(storage.stateTaxBrackets.filingStatus, filingStatus)
          )
        )
        .orderBy(storage.stateTaxBrackets.minIncome);

      const stateDeductionResult = await storage.db
        .select()
        .from(storage.stateStandardDeductions)
        .where(
          and(
            eq(storage.stateStandardDeductions.taxYearId, taxYear.id),
            eq(storage.stateStandardDeductions.stateCode, stateCode),
            eq(storage.stateStandardDeductions.filingStatus, filingStatus)
          )
        )
        .limit(1);

      stateStandardDeduction = stateDeductionResult[0] || null;
    }

    return {
      federalBrackets,
      federalStandardDeduction: federalStandardDeduction[0] || null,
      stateBrackets,
      stateStandardDeduction,
    };
  }

  /**
   * Calculate federal tax using database brackets
   */
  async calculateFederalTax(
    taxableIncome: number, 
    filingStatus: string, 
    year: number = new Date().getFullYear()
  ): Promise<number> {
    const { federalBrackets } = await this.getTaxCalculationData(year, filingStatus);
    
    let tax = 0;
    for (const bracket of federalBrackets) {
      if (taxableIncome > Number(bracket.minIncome)) {
        const maxIncome = bracket.maxIncome ? Number(bracket.maxIncome) : Infinity;
        const taxableInBracket = Math.min(taxableIncome, maxIncome) - Number(bracket.minIncome);
        tax += taxableInBracket * Number(bracket.taxRate);
      }
      if (taxableIncome <= (bracket.maxIncome ? Number(bracket.maxIncome) : Infinity)) break;
    }

    return Math.round(tax * 100) / 100;
  }

  /**
   * Calculate state tax using database brackets
   */
  async calculateStateTax(
    taxableIncome: number,
    filingStatus: string,
    stateCode: string,
    year: number = new Date().getFullYear()
  ): Promise<number> {
    const { stateBrackets } = await this.getTaxCalculationData(year, filingStatus, stateCode);
    
    if (stateBrackets.length === 0) {
      return 0; // No state income tax
    }

    let tax = 0;
    for (const bracket of stateBrackets) {
      if (taxableIncome > Number(bracket.minIncome)) {
        const maxIncome = bracket.maxIncome ? Number(bracket.maxIncome) : Infinity;
        const taxableInBracket = Math.min(taxableIncome, maxIncome) - Number(bracket.minIncome);
        tax += taxableInBracket * Number(bracket.taxRate);
      }
      if (taxableIncome <= (bracket.maxIncome ? Number(bracket.maxIncome) : Infinity)) break;
    }

    return Math.round(tax * 100) / 100;
  }

  /**
   * Get form schema for a specific form type and year
   */
  async getFormSchema(formType: string, year: number): Promise<FormSchemaData | null> {
    const taxYear = await this.getTaxYear(year);
    if (!taxYear) {
      throw new Error(`Tax year ${year} not found`);
    }

    const schemaResult = await storage.db
      .select()
      .from(storage.formSchemas)
      .where(
        and(
          eq(storage.formSchemas.formType, formType),
          eq(storage.formSchemas.taxYearId, taxYear.id),
          eq(storage.formSchemas.isActive, true)
        )
      )
      .limit(1);

    if (!schemaResult[0]) {
      return null;
    }

    const fields = await storage.db
      .select()
      .from(storage.formFieldDefinitions)
      .where(eq(storage.formFieldDefinitions.formSchemaId, schemaResult[0].id))
      .orderBy(storage.formFieldDefinitions.order);

    return {
      schema: schemaResult[0],
      fields,
    };
  }

  /**
   * Create form schema
   */
  async createFormSchema(data: InsertFormSchema): Promise<FormSchema> {
    const result = await storage.db
      .insert(storage.formSchemas)
      .values(data)
      .returning();
    
    return result[0];
  }

  /**
   * Add field definition to form schema
   */
  async addFormFieldDefinition(data: InsertFormFieldDefinition): Promise<FormFieldDefinition> {
    const result = await storage.db
      .insert(storage.formFieldDefinitions)
      .values(data)
      .returning();
    
    return result[0];
  }

  /**
   * Get application configuration
   */
  async getAppConfiguration(key: string): Promise<AppConfiguration | null> {
    const result = await storage.db
      .select()
      .from(storage.appConfigurations)
      .where(
        and(
          eq(storage.appConfigurations.configKey, key),
          eq(storage.appConfigurations.isActive, true)
        )
      )
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Set application configuration
   */
  async setAppConfiguration(data: InsertAppConfiguration): Promise<AppConfiguration> {
    // Check if configuration already exists
    const existing = await this.getAppConfiguration(data.configKey);
    
    if (existing) {
      // Update existing configuration
      const result = await storage.db
        .update(storage.appConfigurations)
        .set({
          configValue: data.configValue,
          configType: data.configType,
          description: data.description,
          updatedAt: new Date(),
        })
        .where(eq(storage.appConfigurations.id, existing.id))
        .returning();
      
      return result[0];
    } else {
      // Create new configuration
      const result = await storage.db
        .insert(storage.appConfigurations)
        .values(data)
        .returning();
      
      return result[0];
    }
  }

  /**
   * Create tax year data for any year (with default/placeholder values)
   * This allows users to work with any tax year even if official data isn't available
   */
  async createTaxYearData(year: number): Promise<TaxYear> {
    // Check if tax year already exists
    const existing = await this.getTaxYear(year);
    if (existing) {
      return existing;
    }

    console.log(`Creating tax year data for ${year}...`);
    
    // Create the tax year
    const taxYear = await this.createTaxYear({
      year: year,
      isActive: false,
      federalDeadline: `${year}-04-15`,
      stateDeadlines: {
        CA: `${year}-04-15`,
        NY: `${year}-04-15`,
        TX: null, // No state income tax
      },
    });

    // Create basic federal tax brackets (using 2024 values as template)
    const federalBrackets = [
      { filingStatus: 'single', brackets: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: null, rate: 0.37 },
      ]},
      { filingStatus: 'married_joint', brackets: [
        { min: 0, max: 23200, rate: 0.10 },
        { min: 23200, max: 94300, rate: 0.12 },
        { min: 94300, max: 201050, rate: 0.22 },
        { min: 201050, max: 383900, rate: 0.24 },
        { min: 383900, max: 487450, rate: 0.32 },
        { min: 487450, max: 731200, rate: 0.35 },
        { min: 731200, max: null, rate: 0.37 },
      ]},
      { filingStatus: 'married_separate', brackets: [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 365600, rate: 0.35 },
        { min: 365600, max: null, rate: 0.37 },
      ]},
      { filingStatus: 'head_of_household', brackets: [
        { min: 0, max: 16550, rate: 0.10 },
        { min: 16550, max: 63100, rate: 0.12 },
        { min: 63100, max: 100500, rate: 0.22 },
        { min: 100500, max: 191950, rate: 0.24 },
        { min: 191950, max: 243700, rate: 0.32 },
        { min: 243700, max: 609350, rate: 0.35 },
        { min: 609350, max: null, rate: 0.37 },
      ]},
    ];

    // Insert federal tax brackets
    for (const statusData of federalBrackets) {
      for (const bracket of statusData.brackets) {
        await storage.db.insert(storage.federalTaxBrackets).values({
          taxYearId: taxYear.id,
          filingStatus: statusData.filingStatus,
          minIncome: bracket.min.toString(),
          maxIncome: bracket.max ? bracket.max.toString() : null,
          taxRate: bracket.rate.toString(),
        });
      }
    }

    // Insert federal standard deductions
    const standardDeductions = [
      { filingStatus: 'single', amount: 14600 },
      { filingStatus: 'married_joint', amount: 29200 },
      { filingStatus: 'married_separate', amount: 14600 },
      { filingStatus: 'head_of_household', amount: 21900 },
    ];

    for (const deduction of standardDeductions) {
      await storage.db.insert(storage.federalStandardDeductions).values({
        taxYearId: taxYear.id,
        filingStatus: deduction.filingStatus,
        amount: deduction.amount.toString(),
        additionalBlindAmount: "1850",
        additionalDisabledAmount: "1850",
      });
    }

    console.log(`Tax year ${year} data created successfully`);
    return taxYear;
  }

  /**
   * Initialize default tax data for 2024
   */
  async initializeDefaultTaxData(): Promise<void> {
    try {
      // Check if 2024 tax year already exists
      const existing2024 = await this.getTaxYear(2024);
      if (existing2024) {
        console.log("2024 tax data already exists");
        return;
      }

      console.log("Initializing 2024 tax data...");
      // Create 2024 tax year
      const taxYear2024 = await this.createTaxYear({
        year: 2024,
        isActive: true,
        federalDeadline: "2024-04-15",
        stateDeadlines: {
          CA: "2024-04-15",
          NY: "2024-04-15",
          TX: null, // No state income tax
        },
      });

      console.log("2024 tax data initialized successfully");
    } catch (error: any) {
      console.error("Failed to initialize tax data:", error.message);
      
      // If it's a table not found error, provide helpful message
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.log("\n🔧 Database tables not found. Please run the migration first:");
        console.log("   Windows: run-migration.bat");
        console.log("   Linux/Mac: ./run-migration.sh");
        console.log("   Node.js: node run-migration.js");
        console.log("\nOr manually run: psql $DATABASE_URL -f migrations/001_add_tax_configuration_tables.sql");
      }
      
      throw error;
    }
  }
}

export const taxConfigService = new TaxConfigurationService();
