import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateToken, generateToken, type AuthRequest } from "./middleware/auth";
import { insertUserSchema, loginSchema, FILING_STATUS } from "@shared/schema";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  parsePDF,
  parseCSV,
  parseExcel,
  parseImageWithOCR,
  detectDocumentType,
  parseW2Data,
  parse1099DivData,
  parse1099IntData,
  parse1099BData,
} from "./utils/parsers";

const upload = multer({ dest: "uploads/" });

// 2024 Tax Brackets and Standard Deductions
const TAX_BRACKETS_2024 = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 365600, rate: 0.35 },
    { min: 365600, max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 16550, rate: 0.10 },
    { min: 16550, max: 63100, rate: 0.12 },
    { min: 63100, max: 100500, rate: 0.22 },
    { min: 100500, max: 191950, rate: 0.24 },
    { min: 191950, max: 243700, rate: 0.32 },
    { min: 243700, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION_2024 = {
  single: 14600,
  married_joint: 29200,
  married_separate: 14600,
  head_of_household: 21900,
};

function calculateTax(taxableIncome: number, filingStatus: string): number {
  // Get the appropriate tax brackets for the filing status
  const brackets = TAX_BRACKETS_2024[filingStatus as keyof typeof TAX_BRACKETS_2024] || TAX_BRACKETS_2024.single;
  
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome > bracket.min) {
      const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
      tax += taxableInBracket * bracket.rate;
    }
    if (taxableIncome <= bracket.max) break;
  }

  return Math.round(tax * 100) / 100;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email } = insertUserSchema.parse(req.body);

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
      });

      res.json({ message: "User created successfully", userId: user.id });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user.id);
      res.json({ token, userId: user.id });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  // Tax Returns routes
  app.get("/api/tax-returns", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      res.json(taxReturns);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tax-returns", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturn = await storage.createTaxReturn({
        userId: req.userId!,
        taxYear: req.body.taxYear || 2024,
        filingStatus: req.body.filingStatus || "single",
        status: "draft",
      });
      res.json(taxReturn);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Documents routes
  app.get("/api/documents", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.json([]);
      }

      const documents = await storage.getDocumentsByTaxReturnId(taxReturns[0].id);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/upload", authenticateToken, upload.array("files", 10), async (req: AuthRequest, res) => {
    try {
      // Get or create tax return for user
      let taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        const newReturn = await storage.createTaxReturn({
          userId: req.userId!,
          taxYear: 2024,
          filingStatus: "single",
          status: "draft",
        });
        taxReturns = [newReturn];
      }

      const taxReturn = taxReturns[0];
      const files = req.files as Express.Multer.File[];
      const uploadedDocs = [];

      for (const file of files) {
        const document = await storage.createDocument({
          taxReturnId: taxReturn.id,
          fileName: file.originalname,
          fileType: file.mimetype,
          documentType: "Unknown",
          fileSize: file.size,
          filePath: file.path,
          status: "processing",
        });

        // Parse document based on file type
        let text = "";
        try {
          if (file.mimetype === "application/pdf") {
            text = await parsePDF(file.path);
          } else if (file.mimetype === "text/csv") {
            const csvData = await parseCSV(file.path);
            text = JSON.stringify(csvData);
          } else if (file.mimetype.includes("spreadsheet") || file.mimetype.includes("excel")) {
            const excelData = await parseExcel(file.path);
            text = JSON.stringify(excelData);
          } else if (file.mimetype.startsWith("image/")) {
            // Use OCR for image files (JPG, PNG, etc.)
            text = await parseImageWithOCR(file.path);
          }

          const docType = detectDocumentType(text);
          
          // Parse based on document type
          if (docType === "W-2") {
            const w2Data = parseW2Data(text);
            await storage.createW2Data({
              documentId: document.id,
              taxReturnId: taxReturn.id,
              ...w2Data,
            });
          } else if (docType === "1099-DIV") {
            const divData = parse1099DivData(text);
            await storage.create1099Div({
              documentId: document.id,
              taxReturnId: taxReturn.id,
              ...divData,
            });
          } else if (docType === "1099-INT") {
            const intData = parse1099IntData(text);
            await storage.create1099Int({
              documentId: document.id,
              taxReturnId: taxReturn.id,
              ...intData,
            });
          } else if (docType === "1099-B") {
            const bData = parse1099BData(text);
            await storage.create1099B({
              documentId: document.id,
              taxReturnId: taxReturn.id,
              ...bData,
            });
          }

          await storage.updateDocument(document.id, {
            documentType: docType,
            status: "parsed",
            parsedData: text,
          });

          uploadedDocs.push(document);
        } catch (parseError: any) {
          await storage.updateDocument(document.id, {
            status: "error",
          });
        }
      }

      res.json({ message: "Files uploaded successfully", documents: uploadedDocs });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  app.delete("/api/documents/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete file from filesystem
      if (fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
      }

      await storage.deleteDocument(req.params.id);
      res.json({ message: "Document deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Form data routes
  app.get("/api/w2-data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json([]);
      
      const data = await storage.getW2DataByTaxReturnId(taxReturns[0].id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/1099-div-data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json([]);
      
      const data = await storage.get1099DivByTaxReturnId(taxReturns[0].id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/1099-int-data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json([]);
      
      const data = await storage.get1099IntByTaxReturnId(taxReturns[0].id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/1099-b-data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json([]);
      
      const data = await storage.get1099BByTaxReturnId(taxReturns[0].id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tax calculation route
  app.post("/api/calculate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { filingStatus } = req.body;
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }

      const taxReturn = taxReturns[0];

      // Get all income data
      const w2Data = await storage.getW2DataByTaxReturnId(taxReturn.id);
      const divData = await storage.get1099DivByTaxReturnId(taxReturn.id);
      const intData = await storage.get1099IntByTaxReturnId(taxReturn.id);
      const bData = await storage.get1099BByTaxReturnId(taxReturn.id);

      // Calculate total income
      const totalWages = w2Data.reduce((sum, w2) => sum + parseFloat(w2.wages || "0"), 0);
      const totalFederalWithheld = w2Data.reduce((sum, w2) => sum + parseFloat(w2.federalWithheld || "0"), 0);
      const totalDividends = divData.reduce((sum, div) => sum + parseFloat(div.ordinaryDividends || "0"), 0);
      const totalQualifiedDividends = divData.reduce((sum, div) => sum + parseFloat(div.qualifiedDividends || "0"), 0);
      const totalInterest = intData.reduce((sum, int) => sum + parseFloat(int.interestIncome || "0"), 0);
      const totalCapitalGains = bData.reduce((sum, b) => sum + parseFloat(b.shortTermGainLoss || "0") + parseFloat(b.longTermGainLoss || "0"), 0);

      const totalIncome = totalWages + totalDividends + totalInterest + totalCapitalGains;
      
      // Standard deduction
      const standardDeduction = STANDARD_DEDUCTION_2024[filingStatus as keyof typeof STANDARD_DEDUCTION_2024] || STANDARD_DEDUCTION_2024.single;
      
      // Calculate taxable income
      const adjustedGrossIncome = totalIncome;
      const taxableIncome = Math.max(0, adjustedGrossIncome - standardDeduction);
      
      // Calculate tax
      const tax = calculateTax(taxableIncome, filingStatus);
      
      // Calculate refund or owed
      const refundOrOwed = totalFederalWithheld - tax;

      // Update tax return
      const updated = await storage.updateTaxReturn(taxReturn.id, {
        filingStatus,
        totalIncome: totalIncome.toString(),
        totalDeductions: standardDeduction.toString(),
        taxableIncome: taxableIncome.toString(),
        totalTax: tax.toString(),
        withheld: totalFederalWithheld.toString(),
        refundOrOwed: refundOrOwed.toString(),
        status: "complete",
      });

      // Create or update Form 1040
      const existing1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);
      
      const form1040Data = {
        taxReturnId: taxReturn.id,
        wages: totalWages.toString(),
        interestIncome: totalInterest.toString(),
        dividendIncome: totalDividends.toString(),
        qualifiedDividends: totalQualifiedDividends.toString(),
        capitalGains: totalCapitalGains.toString(),
        totalIncome: totalIncome.toString(),
        adjustments: "0",
        adjustedGrossIncome: adjustedGrossIncome.toString(),
        standardDeduction: standardDeduction.toString(),
        taxableIncome: taxableIncome.toString(),
        tax: tax.toString(),
        credits: "0",
        totalTax: tax.toString(),
        federalWithheld: totalFederalWithheld.toString(),
        refundOrOwed: refundOrOwed.toString(),
      };

      if (existing1040) {
        await storage.updateForm1040(existing1040.id, form1040Data);
      } else {
        await storage.createForm1040(form1040Data);
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Calculation failed" });
    }
  });

  // Form 1040 route
  app.get("/api/form1040", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json(null);
      
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturns[0].id);
      res.json(form1040 || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
