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
import { parsingService } from "./services/parsingService";
import { llmService } from "./services/llmService";
import { aiInsightsService } from "./services/aiInsightsService";
import { pdfService } from "./services/pdfService";
import { efileService } from "./services/efileService";
import { stateTaxService } from "./services/stateTaxService";
import { subscriptionService, subscriptionMiddleware, requireFeature, checkDocumentLimit, SubscriptionRequest } from "./middleware/subscription";

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

  // Profile routes
  app.get("/api/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const profile = await storage.getUserProfile(req.userId!);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const profileData = { ...req.body, userId: req.userId! };
      const profile = await storage.updateUserProfile(req.userId!, profileData);
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
          console.log(`[Parser] Processing file: ${file.originalname} (${file.mimetype})`);
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

          console.log(`[Parser] Extracted text length: ${text.length}`);
          const docType = detectDocumentType(text);
          console.log(`[Parser] Detected document type: ${docType}`);
          
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
          console.error(`[Parser] Error processing document ${document.id} (${file.originalname}):`, parseError);
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
      // Get document names for each W-2 entry
      const dataWithDocumentNames = await Promise.all(
        data.map(async (item) => {
          if (item.documentId) {
            const document = await storage.getDocument(item.documentId);
            return {
              ...item,
              documentName: document?.fileName || null,
            };
          }
          return {
            ...item,
            documentName: null,
          };
        })
      );
      res.json(dataWithDocumentNames);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/w2-data/batch", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { updates } = req.body; // Array of {id, data} objects
      const results = await Promise.all(
        updates.map(({ id, data }: { id: string; data: any }) => 
          storage.updateW2Data(id, data)
        )
      );
      res.json({ message: "W-2 data updated successfully", results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/1099-div-data/batch", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { updates } = req.body; // Array of {id, data} objects
      const results = await Promise.all(
        updates.map(({ id, data }: { id: string; data: any }) => 
          storage.update1099Div(id, data)
        )
      );
      res.json({ message: "1099-DIV data updated successfully", results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/1099-int-data/batch", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { updates } = req.body; // Array of {id, data} objects
      const results = await Promise.all(
        updates.map(({ id, data }: { id: string; data: any }) => 
          storage.update1099Int(id, data)
        )
      );
      res.json({ message: "1099-INT data updated successfully", results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/1099-b-data/batch", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { updates } = req.body; // Array of {id, data} objects
      const results = await Promise.all(
        updates.map(({ id, data }: { id: string; data: any }) => 
          storage.update1099B(id, data)
        )
      );
      res.json({ message: "1099-B data updated successfully", results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/1099-div-data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json([]);
      
      const data = await storage.get1099DivByTaxReturnId(taxReturns[0].id);
      // Get document names for each 1099-DIV entry
      const dataWithDocumentNames = await Promise.all(
        data.map(async (item) => {
          if (item.documentId) {
            const document = await storage.getDocument(item.documentId);
            return {
              ...item,
              documentName: document?.fileName || null,
            };
          }
          return {
            ...item,
            documentName: null,
          };
        })
      );
      res.json(dataWithDocumentNames);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/1099-div-data/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = await storage.update1099Div(req.params.id, req.body);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/1099-div-data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = await storage.create1099Div(req.body);
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
      // Get document names for each 1099-INT entry
      const dataWithDocumentNames = await Promise.all(
        data.map(async (item) => {
          if (item.documentId) {
            const document = await storage.getDocument(item.documentId);
            return {
              ...item,
              documentName: document?.fileName || null,
            };
          }
          return {
            ...item,
            documentName: null,
          };
        })
      );
      res.json(dataWithDocumentNames);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/1099-int-data/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = await storage.update1099Int(req.params.id, req.body);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/1099-int-data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = await storage.create1099Int(req.body);
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
      // Get document names for each 1099-B entry
      const dataWithDocumentNames = await Promise.all(
        data.map(async (item) => {
          if (item.documentId) {
            const document = await storage.getDocument(item.documentId);
            return {
              ...item,
              documentName: document?.fileName || null,
            };
          }
          return {
            ...item,
            documentName: null,
          };
        })
      );
      res.json(dataWithDocumentNames);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/1099-b-data/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = await storage.update1099B(req.params.id, req.body);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/1099-b-data", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = await storage.create1099B(req.body);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 1099-B Entries routes
  app.get("/api/1099-b-entries", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json([]);
      
      const data = await storage.get1099BEntriesByTaxReturnId(taxReturns[0].id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/1099-b-entries", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { form1099BId, ...entryData } = req.body;
      const data = await storage.create1099BEntry(form1099BId, entryData);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/1099-b-entries/batch", authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log("Batch update request received:", JSON.stringify(req.body, null, 2));
      const { updates } = req.body;
      const results = [];
      
      for (const update of updates) {
        console.log("Processing update:", JSON.stringify(update, null, 2));
        
        // The update should have { id: "entryId", data: {...} } structure
        const entryId = update.id;
        const updateData = update.data;
        
        console.log("Entry ID:", entryId);
        console.log("Update data:", JSON.stringify(updateData, null, 2));
        
        // Clean the update data - remove fields that shouldn't be updated
        const { id, form1099BId, ...cleanedData } = updateData;
        
        // Ensure numeric fields are properly formatted
        const finalData = {
          description: cleanedData.description || null,
          dateAcquired: cleanedData.dateAcquired || null,
          dateSold: cleanedData.dateSold || null,
          proceeds: cleanedData.proceeds || null,
          costBasis: cleanedData.costBasis || null,
          gainLoss: cleanedData.gainLoss || null,
          isShortTerm: cleanedData.isShortTerm || false,
          reportedToIrs: cleanedData.reportedToIrs || false,
          washSale: cleanedData.washSale || false,
          washSaleAmount: cleanedData.washSaleAmount || null,
        };
        
        console.log("Final data for update:", JSON.stringify(finalData, null, 2));
        
        const data = await storage.update1099BEntry(entryId, finalData);
        console.log("Update successful for ID:", entryId);
        results.push(data);
      }
      
      console.log("Batch update completed successfully");
      res.json(results);
    } catch (error: any) {
      console.error("Batch update error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/1099-b-entries/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = await storage.update1099BEntry(req.params.id, req.body);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/1099-b-entries/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.delete1099BEntry(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Income breakdown route
  app.get("/api/income-breakdown/:taxReturnId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { taxReturnId } = req.params;
      
      // Get all income data
      const w2Data = await storage.getW2DataByTaxReturnId(taxReturnId);
      const divData = await storage.get1099DivByTaxReturnId(taxReturnId);
      const intData = await storage.get1099IntByTaxReturnId(taxReturnId);
      const bData = await storage.get1099BByTaxReturnId(taxReturnId);
      const bEntries = await storage.get1099BEntriesByTaxReturnId(taxReturnId);

      // Calculate totals
      const totalWages = w2Data.reduce((sum, w2) => sum + parseFloat(w2.wages || "0"), 0);
      const totalFederalWithheld = w2Data.reduce((sum, w2) => sum + parseFloat(w2.federalWithheld || "0"), 0);
      const totalDividends = divData.reduce((sum, div) => sum + parseFloat(div.ordinaryDividends || "0"), 0);
      const totalQualifiedDividends = divData.reduce((sum, div) => sum + parseFloat(div.qualifiedDividends || "0"), 0);
      const totalInterest = intData.reduce((sum, int) => sum + parseFloat(int.interestIncome || "0"), 0);
      
      // Calculate capital gains from individual entries, accounting for wash sales
      const totalCapitalGains = bEntries.reduce((sum, entry) => {
        const proceeds = parseFloat(entry.proceeds || "0");
        const costBasis = parseFloat(entry.costBasis || "0");
        const washSaleAmount = parseFloat(entry.washSaleAmount || "0");
        
        // For wash sales, subtract wash sale amount from cost basis
        const adjustedCostBasis = costBasis - washSaleAmount;
        const gainLoss = proceeds - adjustedCostBasis;
        
        console.log(`Capital Gains Calculation - Entry ${entry.id}:`, {
          proceeds,
          costBasis,
          washSaleAmount,
          adjustedCostBasis,
          gainLoss,
          description: entry.description
        });
        
        return sum + gainLoss;
      }, 0);

      const breakdown = {
        wages: totalWages,
        federalWithheld: totalFederalWithheld,
        dividends: totalDividends,
        qualifiedDividends: totalQualifiedDividends,
        interest: totalInterest,
        capitalGains: totalCapitalGains,
        totalIncome: totalWages + totalDividends + totalInterest + totalCapitalGains,
        w2Count: w2Data.length,
        divCount: divData.length,
        intCount: intData.length,
        bCount: bData.length,
      };

      res.json(breakdown);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tax calculation route
  app.post("/api/calculate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Get user profile for filing status and other tax-relevant info
      const profile = await storage.getUserProfile(req.userId!);
      const filingStatus = req.body.filingStatus || profile?.filingStatus || "single";
      
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
      
      // Standard deduction - consider additional deductions for blind/disabled
      let standardDeduction = STANDARD_DEDUCTION_2024[filingStatus as keyof typeof STANDARD_DEDUCTION_2024] || STANDARD_DEDUCTION_2024.single;
      
      // Additional standard deduction for blind/disabled taxpayers
      if (profile?.isBlind) {
        standardDeduction += 1850; // 2024 additional standard deduction for blind
      }
      if (profile?.isDisabled) {
        standardDeduction += 1850; // 2024 additional standard deduction for disabled
      }
      if (profile?.isVeteran) {
        // Veterans may qualify for additional deductions - this would need more specific logic
        // For now, we'll just note it in the response
      }
      
      // For married filing jointly, consider spouse's additional deductions
      if ((filingStatus === "married_joint" || filingStatus === "married_separate") && profile) {
        if (profile.isSpouseBlind) {
          standardDeduction += 1850;
        }
        if (profile.isSpouseDisabled) {
          standardDeduction += 1850;
        }
        if (profile.isSpouseVeteran) {
          // Additional spouse veteran deductions
        }
      }
      
      // Calculate dependent-related deductions and credits
      let childTaxCredit = 0;
      let dependentDeduction = 0;
      
      if (profile?.dependents && Array.isArray(profile.dependents)) {
        const qualifyingChildren = profile.dependents.filter(dep => dep.isQualifyingChild);
        const qualifyingRelatives = profile.dependents.filter(dep => dep.isQualifyingRelative);
        
        // Child Tax Credit (2024: $2,000 per qualifying child)
        childTaxCredit = qualifyingChildren.length * 2000;
        
        // Additional Child Tax Credit for children under 17 (simplified calculation)
        const childrenUnder17 = qualifyingChildren.filter(dep => {
          const birthYear = new Date(dep.dateOfBirth).getFullYear();
          const currentYear = 2024;
          return (currentYear - birthYear) < 17;
        });
        childTaxCredit += childrenUnder17.length * 2000; // Additional $2,000 per child under 17
        
        // Dependent deduction (simplified - in reality this affects AGI)
        dependentDeduction = (qualifyingChildren.length + qualifyingRelatives.length) * 500; // Simplified dependent deduction
      }
      
      // Calculate taxable income
      const adjustedGrossIncome = totalIncome;
      const taxableIncome = Math.max(0, adjustedGrossIncome - standardDeduction - dependentDeduction);
      
      // Calculate tax
      const tax = calculateTax(taxableIncome, filingStatus);
      
      // Apply credits
      const taxAfterCredits = Math.max(0, tax - childTaxCredit);
      
      // Calculate refund or owed
      const refundOrOwed = totalFederalWithheld - taxAfterCredits;

      // Update tax return
      const updated = await storage.updateTaxReturn(taxReturn.id, {
        filingStatus,
        totalIncome: totalIncome.toString(),
        totalDeductions: (standardDeduction + dependentDeduction).toString(),
        taxableIncome: taxableIncome.toString(),
        totalTax: taxAfterCredits.toString(),
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

      res.json({
        ...updated,
        profileBasedCalculations: {
          filingStatus: profile?.filingStatus || filingStatus,
          standardDeduction,
          dependentDeduction,
          childTaxCredit,
          additionalDeductions: {
            blind: profile?.isBlind ? 1850 : 0,
            disabled: profile?.isDisabled ? 1850 : 0,
            veteran: profile?.isVeteran ? "eligible" : "not_eligible",
            spouseBlind: profile?.isSpouseBlind ? 1850 : 0,
            spouseDisabled: profile?.isSpouseDisabled ? 1850 : 0,
            spouseVeteran: profile?.isSpouseVeteran ? "eligible" : "not_eligible",
          },
          dependents: {
            total: Array.isArray(profile?.dependents) ? profile.dependents.length : 0,
            qualifyingChildren: Array.isArray(profile?.dependents) ? profile.dependents.filter((dep: any) => dep.isQualifyingChild).length : 0,
            qualifyingRelatives: Array.isArray(profile?.dependents) ? profile.dependents.filter((dep: any) => dep.isQualifyingRelative).length : 0,
          }
        }
      });
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

  // Form 1040 PDF Export route
  app.get("/api/form1040/export", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const PDFKit = await import("pdfkit");
      const PDFDocument = PDFKit.default;
      
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      
      const taxReturn = taxReturns[0];
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);
      
      if (!form1040) {
        return res.status(404).json({ message: "Form 1040 not found" });
      }

      const user = await storage.getUser(req.userId!);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Form1040_${taxReturn.taxYear}.pdf"`
      );

      // Pipe PDF to response
      doc.pipe(res);

      // Add content to PDF
      doc.fontSize(20).text("U.S. Individual Income Tax Return", { align: "center" });
      doc.fontSize(16).text(`Form 1040 - ${taxReturn.taxYear}`, { align: "center" });
      doc.moveDown(2);

      // Taxpayer Information
      doc.fontSize(14).text("Taxpayer Information", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Name: ${user?.username || "N/A"}`);
      doc.text(`Email: ${user?.email || "N/A"}`);
      doc.text(`Filing Status: ${taxReturn.filingStatus.replace(/_/g, " ").toUpperCase()}`);
      doc.moveDown(1.5);

      // Income Section
      doc.fontSize(14).text("Income", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`1. Wages, salaries, tips, etc: $${parseFloat(form1040.wages || "0").toFixed(2)}`);
      doc.text(`2a. Tax-exempt interest: $0.00`);
      doc.text(`2b. Taxable interest: $${parseFloat(form1040.interestIncome || "0").toFixed(2)}`);
      doc.text(`3a. Qualified dividends: $${parseFloat(form1040.qualifiedDividends || "0").toFixed(2)}`);
      doc.text(`3b. Ordinary dividends: $${parseFloat(form1040.dividendIncome || "0").toFixed(2)}`);
      doc.text(`7. Capital gain or (loss): $${parseFloat(form1040.capitalGains || "0").toFixed(2)}`);
      doc.text(`9. Total income: $${parseFloat(form1040.totalIncome || "0").toFixed(2)}`);
      doc.moveDown(1.5);

      // Adjusted Gross Income
      doc.fontSize(14).text("Adjusted Gross Income", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`10. Adjustments to income: $${parseFloat(form1040.adjustments || "0").toFixed(2)}`);
      doc.text(`11. Adjusted gross income: $${parseFloat(form1040.adjustedGrossIncome || "0").toFixed(2)}`);
      doc.moveDown(1.5);

      // Tax and Credits
      doc.fontSize(14).text("Tax and Credits", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`12. Standard deduction: $${parseFloat(form1040.standardDeduction || "0").toFixed(2)}`);
      doc.text(`15. Taxable income: $${parseFloat(form1040.taxableIncome || "0").toFixed(2)}`);
      doc.text(`16. Tax: $${parseFloat(form1040.tax || "0").toFixed(2)}`);
      doc.text(`19. Total tax: $${parseFloat(form1040.totalTax || "0").toFixed(2)}`);
      doc.moveDown(1.5);

      // Payments
      doc.fontSize(14).text("Payments", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`25. Federal income tax withheld: $${parseFloat(form1040.federalWithheld || "0").toFixed(2)}`);
      doc.moveDown(1.5);

      // Refund or Amount Owed
      const refundOrOwed = parseFloat(form1040.refundOrOwed || "0");
      doc.fontSize(14).text(refundOrOwed >= 0 ? "Refund" : "Amount You Owe", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(
        refundOrOwed >= 0
          ? `34. Amount to be refunded: $${refundOrOwed.toFixed(2)}`
          : `37. Amount you owe: $${Math.abs(refundOrOwed).toFixed(2)}`
      );
      doc.moveDown(2);

      // Footer
      doc.fontSize(9).fillColor("gray").text(
        `Generated on ${new Date().toLocaleDateString()} by TaxFile Pro`,
        { align: "center" }
      );

      // Finalize PDF
      doc.end();
    } catch (error: any) {
      console.error("PDF export error:", error);
      res.status(500).json({ message: error.message || "PDF export failed" });
    }
  });

  // Form 8949 routes
  app.get("/api/form8949", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json([]);
      
      const form8949Data = await storage.get8949ByTaxReturnId(taxReturns[0].id);
      res.json(form8949Data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Schedule D route
  app.get("/api/schedule-d", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) return res.json(null);
      
      const scheduleD = await storage.getScheduleDByTaxReturnId(taxReturns[0].id);
      res.json(scheduleD || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calculate and generate Schedule D
  app.post("/api/schedule-d/calculate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }

      const taxReturn = taxReturns[0];

      // Get all 1099-B entries (individual transactions) instead of parent forms
      const form1099BEntries = await storage.get1099BEntriesByTaxReturnId(taxReturn.id);

      if (form1099BEntries.length === 0) {
        return res.status(400).json({ message: "No capital gain/loss transactions found" });
      }

      // Delete existing Form 8949 entries to avoid duplicates
      await storage.delete8949ByTaxReturnId(taxReturn.id);

      // Generate Form 8949 entries from 1099-B entries
      const form8949Entries = [];
      for (const entry of form1099BEntries) {
        const proceeds = parseFloat(entry.proceeds || "0");
        const costBasis = parseFloat(entry.costBasis || "0");
        const washSaleAmount = parseFloat(entry.washSaleAmount || "0");
        
        // For wash sales, subtract wash sale amount from cost basis
        // This effectively increases the gain or reduces the loss
        const adjustedCostBasis = costBasis - washSaleAmount;
        const gainOrLoss = proceeds - adjustedCostBasis;

        const form8949Entry = await storage.create8949({
          taxReturnId: taxReturn.id,
          form1099BId: entry.form1099BId,
          description: entry.description || "Securities",
          dateAcquired: entry.dateAcquired,
          dateSold: entry.dateSold || new Date().toISOString().split('T')[0],
          proceeds: proceeds.toString(),
          costBasis: adjustedCostBasis.toString(), // Use adjusted cost basis
          adjustmentCode: entry.washSale ? "W" : null, // Mark wash sale adjustments
          adjustmentAmount: washSaleAmount.toString(),
          gainOrLoss: gainOrLoss.toString(),
          isShortTerm: entry.isShortTerm,
          washSale: entry.washSale || false,
        });

        form8949Entries.push(form8949Entry);
      }

      // Calculate Schedule D totals
      const shortTermTransactions = form8949Entries.filter(e => e.isShortTerm);
      const longTermTransactions = form8949Entries.filter(e => !e.isShortTerm);

      const shortTermTotalProceeds = shortTermTransactions.reduce(
        (sum, t) => sum + parseFloat(t.proceeds || "0"), 0
      );
      const shortTermTotalCostBasis = shortTermTransactions.reduce(
        (sum, t) => sum + parseFloat(t.costBasis || "0"), 0
      );
      const shortTermTotalGainLoss = shortTermTransactions.reduce(
        (sum, t) => sum + parseFloat(t.gainOrLoss || "0"), 0
      );

      const longTermTotalProceeds = longTermTransactions.reduce(
        (sum, t) => sum + parseFloat(t.proceeds || "0"), 0
      );
      const longTermTotalCostBasis = longTermTransactions.reduce(
        (sum, t) => sum + parseFloat(t.costBasis || "0"), 0
      );
      const longTermTotalGainLoss = longTermTransactions.reduce(
        (sum, t) => sum + parseFloat(t.gainOrLoss || "0"), 0
      );

      const totalCapitalGainLoss = shortTermTotalGainLoss + longTermTotalGainLoss;

      // Create or update Schedule D
      const existingScheduleD = await storage.getScheduleDByTaxReturnId(taxReturn.id);

      const scheduleDData = {
        taxReturnId: taxReturn.id,
        shortTermTotalProceeds: shortTermTotalProceeds.toString(),
        shortTermTotalCostBasis: shortTermTotalCostBasis.toString(),
        shortTermTotalGainLoss: shortTermTotalGainLoss.toString(),
        longTermTotalProceeds: longTermTotalProceeds.toString(),
        longTermTotalCostBasis: longTermTotalCostBasis.toString(),
        longTermTotalGainLoss: longTermTotalGainLoss.toString(),
        netShortTermGainLoss: shortTermTotalGainLoss.toString(),
        netLongTermGainLoss: longTermTotalGainLoss.toString(),
        totalCapitalGainLoss: totalCapitalGainLoss.toString(),
      };

      if (existingScheduleD) {
        await storage.updateScheduleD(existingScheduleD.id, scheduleDData);
      } else {
        await storage.createScheduleD(scheduleDData);
      }

      // Update Form 1040 with capital gains
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);
      if (form1040) {
        await storage.updateForm1040(form1040.id, {
          capitalGains: totalCapitalGainLoss.toString(),
        });
      }

      res.json({ 
        message: "Schedule D calculated successfully",
        form8949Count: form8949Entries.length,
        totalCapitalGainLoss 
      });
    } catch (error: any) {
      console.error("Schedule D calculation error:", error);
      res.status(500).json({ message: error.message || "Schedule D calculation failed" });
    }
  });

  // AI Insights routes
  app.post("/api/ai/analyze-document", authenticateToken, subscriptionMiddleware(subscriptionService), async (req: SubscriptionRequest, res) => {
    try {
      const { documentId } = req.body;
      
      if (!req.canGetAIInsights) {
        return res.status(403).json({ message: "AI insights require premium subscription" });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Generate insights for the document
      const insights = await aiInsightsService.generateInsights({
        w2Data: [],
        divData: [],
        intData: [],
        bData: [],
        taxReturn: { id: document.taxReturnId } as any,
      }, req.userId!);

      res.json({ insights });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/optimize-taxes", authenticateToken, subscriptionMiddleware(subscriptionService), async (req: SubscriptionRequest, res) => {
    try {
      if (!req.canGetAIInsights) {
        return res.status(403).json({ message: "AI insights require premium subscription" });
      }

      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }

      const taxReturn = taxReturns[0];
      const w2Data = await storage.getW2DataByTaxReturnId(taxReturn.id);
      const divData = await storage.get1099DivByTaxReturnId(taxReturn.id);
      const intData = await storage.get1099IntByTaxReturnId(taxReturn.id);
      const bData = await storage.get1099BByTaxReturnId(taxReturn.id);

      const insights = await aiInsightsService.generateInsights({
        w2Data,
        divData,
        intData,
        bData,
        taxReturn,
      }, req.userId!);

      res.json({ insights });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/insights", authenticateToken, subscriptionMiddleware(subscriptionService), async (req: SubscriptionRequest, res) => {
    try {
      if (!req.canGetAIInsights) {
        return res.status(403).json({ message: "AI insights require premium subscription" });
      }

      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.json([]);
      }

      // This would typically query the aiInsights table
      // For now, return empty array
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // E-file routes
  app.post("/api/efile/submit", authenticateToken, subscriptionMiddleware(subscriptionService), requireFeature("canEfile"), async (req: SubscriptionRequest, res) => {
    try {
      const { bankAccount, signatureConsent } = req.body;

      if (!signatureConsent) {
        return res.status(400).json({ message: "Signature consent is required" });
      }

      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }

      const taxReturn = taxReturns[0];
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);
      const user = await storage.getUser(req.userId!);

      if (!form1040) {
        return res.status(404).json({ message: "Form 1040 not found" });
      }

      const efileResponse = await efileService.submitTaxReturn(
        taxReturn,
        form1040,
        user!,
        {
          submissionType: "federal",
          bankAccount,
          signatureConsent,
        }
      );

      if (efileResponse.success) {
        // Store submission record
        await storage.createEfileSubmission({
          taxReturnId: taxReturn.id,
          submissionType: "federal",
          status: efileResponse.status,
          irsSubmissionId: efileResponse.submissionId,
          acknowledgmentNumber: efileResponse.acknowledgmentNumber,
          submittedAt: new Date(),
        });
      }

      res.json(efileResponse);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/efile/status/:submissionId", authenticateToken, async (req: SubscriptionRequest, res) => {
    try {
      const { submissionId } = req.params;
      const status = await efileService.checkSubmissionStatus(submissionId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Enhanced PDF generation routes
  app.post("/api/forms/generate-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { includeInstructions = true, includeCoverLetter = true } = req.body;

      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }

      const taxReturn = taxReturns[0];
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);
      const form8949Data = await storage.get8949ByTaxReturnId(taxReturn.id);
      const scheduleD = await storage.getScheduleDByTaxReturnId(taxReturn.id);
      const user = await storage.getUser(req.userId!);

      if (!form1040) {
        return res.status(404).json({ message: "Form 1040 not found" });
      }

      const pdfBuffer = await pdfService.generateTaxFormsPDF(
        taxReturn,
        form1040,
        form8949Data,
        scheduleD || null,
        user!,
        {
          includeInstructions,
          includeCoverLetter,
          signatureRequired: true,
        }
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="TaxForms_${taxReturn.taxYear}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // State tax calculation routes
  app.get("/api/state-tax/calculate/:state", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { state } = req.params;
      const { filingStatus } = req.query;

      const validation = stateTaxService.validateState(state);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.message });
      }

      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }

      const taxReturn = taxReturns[0];
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);

      if (!form1040) {
        return res.status(404).json({ message: "Form 1040 not found" });
      }

      const stateTaxCalculation = await stateTaxService.calculateStateTax(
        state,
        taxReturn,
        form1040,
        filingStatus as string || taxReturn.filingStatus
      );

      res.json(stateTaxCalculation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/state-tax/supported-states", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const supportedStates = stateTaxService.getSupportedStates();
      const stateInfo = supportedStates.map(state => ({
        state,
        ...stateTaxService.getStateTaxSummary(state),
      }));

      res.json(stateInfo);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/state-tax/deductions/:state", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { state } = req.params;
      const deductions = stateTaxService.getStateDeductions(state);
      res.json(deductions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Enhanced upload route with hybrid parsing
  app.post("/api/upload-enhanced", authenticateToken, subscriptionMiddleware(subscriptionService), checkDocumentLimit(subscriptionService), upload.array("files", 10), async (req: SubscriptionRequest, res) => {
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
          console.log(`[Enhanced Parser] Processing file: ${file.originalname} (${file.mimetype})`);
          if (file.mimetype === "application/pdf") {
            text = await parsePDF(file.path);
          } else if (file.mimetype === "text/csv") {
            const csvData = await parseCSV(file.path);
            text = JSON.stringify(csvData);
          } else if (file.mimetype.includes("spreadsheet") || file.mimetype.includes("excel")) {
            const excelData = await parseExcel(file.path);
            text = JSON.stringify(excelData);
          } else if (file.mimetype.startsWith("image/")) {
            text = await parseImageWithOCR(file.path);
          }

          console.log(`[Enhanced Parser] Extracted text length: ${text.length}`);
          const docType = detectDocumentType(text);
          console.log(`[Enhanced Parser] Detected document type: ${docType}`);
          
          // Use enhanced parsing service
          const parsingResult = await parsingService.parseDocument(text, docType, {
            useLLMFallback: req.canUseLLMParsing! || false,
            confidenceThreshold: 0.7,
            userId: req.userId!,
            fileName: file.originalname,
          });

          console.log(`[Enhanced Parser] Parsing result: ${parsingResult.success}, confidence: ${parsingResult.confidenceScore}, method: ${parsingResult.method}`);

          // Store parsing attempt
          await storage.createParsingAttempt({
            documentId: document.id,
            parsingMethod: parsingResult.method,
            confidenceScore: parsingResult.confidenceScore.toString(),
            rawText: text,
            extractedData: parsingResult.data,
            processingTimeMs: parsingResult.processingTimeMs,
            errorMessage: parsingResult.errorMessage,
          });

          // Parse based on document type and store data
          if (parsingResult.success && parsingResult.data) {
            if (docType === "W-2") {
              await storage.createW2Data({
                documentId: document.id,
                taxReturnId: taxReturn.id,
                ...parsingResult.data as any,
              });
            } else if (docType === "1099-DIV") {
              await storage.create1099Div({
                documentId: document.id,
                taxReturnId: taxReturn.id,
                ...parsingResult.data as any,
              });
            } else if (docType === "1099-INT") {
              await storage.create1099Int({
                documentId: document.id,
                taxReturnId: taxReturn.id,
                ...parsingResult.data as any,
              });
            } else if (docType === "1099-B") {
              await storage.create1099B({
                documentId: document.id,
                taxReturnId: taxReturn.id,
                ...parsingResult.data as any,
              });
            } else if (docType === "1099-MISC") {
              // For now, store MISC data in a generic way or create a specific table
              await storage.createDocument({
                taxReturnId: taxReturn.id,
                fileName: `${document.fileName}_MISC`,
                fileType: document.fileType,
                documentType: "1099-MISC",
                fileSize: document.fileSize,
                filePath: document.filePath,
                parsedData: JSON.stringify(parsingResult.data),
                status: "parsed",
              });
            } else if (docType === "CONSOLIDATED-BROKERAGE") {
              // Handle consolidated brokerage statement
              const consolidatedData = parsingResult.data as any;
              
              // Store each section separately if it exists
              if (consolidatedData.hasDivSection && consolidatedData.divData) {
                await storage.create1099Div({
                  documentId: document.id,
                  taxReturnId: taxReturn.id,
                  ...consolidatedData.divData,
                });
              }
              
              if (consolidatedData.hasIntSection && consolidatedData.intData) {
                await storage.create1099Int({
                  documentId: document.id,
                  taxReturnId: taxReturn.id,
                  ...consolidatedData.intData,
                });
              }
              
              if (consolidatedData.hasMiscSection && consolidatedData.miscData) {
                await storage.createDocument({
                  taxReturnId: taxReturn.id,
                  fileName: `${document.fileName}_MISC`,
                  fileType: document.fileType,
                  documentType: "1099-MISC",
                  fileSize: document.fileSize,
                  filePath: document.filePath,
                  parsedData: JSON.stringify(consolidatedData.miscData),
                  status: "parsed",
                });
              }
              
              if (consolidatedData.hasBSection && consolidatedData.bData) {
                for (const bData of consolidatedData.bData) {
                  await storage.create1099B({
                    documentId: document.id,
                    taxReturnId: taxReturn.id,
                    ...bData,
                  });
                }
              }
            }
          }

          await storage.updateDocument(document.id, {
            documentType: docType,
            status: parsingResult.success ? "parsed" : "error",
            parsedData: text,
            parsingMethod: parsingResult.method,
            confidenceScore: parsingResult.confidenceScore.toString(),
            rawTextContent: text,
            llmResponse: parsingResult.method === "llm" ? parsingResult.data : null,
          });

          uploadedDocs.push({
            ...document,
            parsingResult: {
              success: parsingResult.success,
              confidenceScore: parsingResult.confidenceScore,
              method: parsingResult.method,
              extractedFields: parsingResult.extractedFields,
              missingFields: parsingResult.missingFields,
            },
          });
        } catch (parseError: any) {
          console.error(`[Enhanced Parser] Error processing document ${document.id} (${file.originalname}):`, parseError);
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

  // Admin endpoint to clear all documents (temporary for development)
  app.delete("/api/admin/clear-documents", authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.clearAllDocuments();
      res.json({ message: "All documents cleared successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to clear documents" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
