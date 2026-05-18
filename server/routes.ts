import type { Express } from "express";
import { createServer, type Server } from "http";
import { rateLimit } from "express-rate-limit";
import { storage } from "./storage";
import { authenticateToken, generateToken, type AuthRequest } from "./middleware/auth";
import { insertUserSchema, loginSchema, FILING_STATUS } from "@shared/schema";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10); // 10 MB default
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
import { taxConfigService } from "./services/taxConfigService";
import { subscriptionService, subscriptionMiddleware, requireFeature, checkDocumentLimit, SubscriptionRequest } from "./middleware/subscription";
import { eq } from "drizzle-orm";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${file.mimetype}' is not allowed`));
    }
  },
});

// Initialize tax configuration data on startup
async function initializeTaxData() {
  try {
    await taxConfigService.initializeDefaultTaxData();
    console.log("Tax configuration data initialized");
  } catch (error) {
    console.error("Failed to initialize tax data:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize tax configuration data
  await initializeTaxData();

  // Health check (no auth required — used by load balancers and Docker)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later" },
  });

  // Authentication routes
  app.post("/api/auth/register", authLimiter, async (req, res) => {
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

  app.post("/api/auth/login", authLimiter, async (req, res) => {
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      res.json(taxReturns);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tax-returns", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      const taxReturn = await storage.createTaxReturn({
        userId: req.userId!,
        taxYear: req.body.taxYear || activeYear?.year || new Date().getFullYear(),
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      let taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        const newReturn = await storage.createTaxReturn({
          userId: req.userId!,
          taxYear: activeYear?.year || new Date().getFullYear(),
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

      // Verify the document belongs to the requesting user
      const taxReturn = await storage.getTaxReturn(doc.taxReturnId);
      if (!taxReturn || taxReturn.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const { updates } = req.body;
      const results = [];

      for (const update of updates) {
        // The update should have { id: "entryId", data: {...} } structure
        const entryId = update.id;
        const updateData = update.data;
        
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
      const isMfj = filingStatus === "married_joint";

      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);

      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }

      const taxReturn = taxReturns[0];

      // Get all income data
      const w2Data = await storage.getW2DataByTaxReturnId(taxReturn.id);
      const divData = await storage.get1099DivByTaxReturnId(taxReturn.id);
      const intData = await storage.get1099IntByTaxReturnId(taxReturn.id);
      const bData = await storage.get1099BByTaxReturnId(taxReturn.id);

      // Schedule C — self-employment income
      const scheduleCEntries = await storage.getSchedulesByTaxReturnId(taxReturn.id);
      const totalScheduleCNetProfit = scheduleCEntries.reduce(
        (sum, sc) => sum + parseFloat(sc.netProfit || "0"),
        0
      );

      // Calculate total income
      const totalWages = w2Data.reduce((sum, w2) => sum + parseFloat(w2.wages || "0"), 0);
      const totalFederalWithheld = w2Data.reduce((sum, w2) => sum + parseFloat(w2.federalWithheld || "0"), 0);
      const totalDividends = divData.reduce((sum, div) => sum + parseFloat(div.ordinaryDividends || "0"), 0);
      const totalQualifiedDividends = divData.reduce((sum, div) => sum + parseFloat(div.qualifiedDividends || "0"), 0);
      const totalInterest = intData.reduce((sum, int) => sum + parseFloat(int.interestIncome || "0"), 0);
      const totalCapitalGains = bData.reduce(
        (sum, b) => sum + parseFloat(b.shortTermGainLoss || "0") + parseFloat(b.longTermGainLoss || "0"),
        0
      );

      // Self-employment tax (Schedule SE): 15.3% on net SE income up to SS wage base; simplified
      const selfEmploymentTax =
        totalScheduleCNetProfit > 0 ? totalScheduleCNetProfit * 0.9235 * 0.153 : 0;
      // SE tax deduction: half of SE tax reduces AGI
      const seTaxDeduction = selfEmploymentTax / 2;

      const totalIncome =
        totalWages + totalDividends + totalInterest + totalCapitalGains + totalScheduleCNetProfit;

      // Get tax calculation data from database
      const taxYear = await taxConfigService.getActiveTaxYear();
      if (!taxYear) {
        return res.status(500).json({ message: "No active tax year found" });
      }

      const taxData = await taxConfigService.getTaxCalculationData(taxYear.year, filingStatus);

      // Standard deduction - consider additional deductions for blind/disabled
      let standardDeduction = taxData.federalStandardDeduction
        ? Number(taxData.federalStandardDeduction.amount)
        : 0;

      // Additional standard deduction for blind/disabled taxpayers
      if (profile?.isBlind && taxData.federalStandardDeduction) {
        standardDeduction += Number(taxData.federalStandardDeduction.additionalBlindAmount || 0);
      }
      if (profile?.isDisabled && taxData.federalStandardDeduction) {
        standardDeduction += Number(taxData.federalStandardDeduction.additionalDisabledAmount || 0);
      }
      if (profile?.isVeteran) {
        // Veterans may qualify for additional deductions - this would need more specific logic
        // For now, we'll just note it in the response
      }

      // For married filing jointly, consider spouse's additional deductions
      if (
        (filingStatus === "married_joint" || filingStatus === "married_separate") &&
        profile &&
        taxData.federalStandardDeduction
      ) {
        if (profile.isSpouseBlind) {
          standardDeduction += Number(taxData.federalStandardDeduction.additionalBlindAmount || 0);
        }
        if (profile.isSpouseDisabled) {
          standardDeduction += Number(taxData.federalStandardDeduction.additionalDisabledAmount || 0);
        }
        if (profile.isSpouseVeteran) {
          // Additional spouse veteran deductions
        }
      }

      // AGI = total income minus SE tax deduction
      const adjustedGrossIncome = totalIncome - seTaxDeduction;

      // Itemized deduction from Schedule A (if it exists)
      const scheduleA = await storage.getScheduleAByTaxReturnId(taxReturn.id);
      const itemizedDeduction = scheduleA
        ? parseFloat(scheduleA.totalItemizedDeductions || "0")
        : 0;

      // Pick whichever deduction is larger
      const useItemized = itemizedDeduction > standardDeduction;
      const chosenDeduction = useItemized ? itemizedDeduction : standardDeduction;

      // Calculate dependent-related deductions and credits
      let dependentDeduction = 0;
      const qualifyingChildren: any[] = [];

      if (profile?.dependents && Array.isArray(profile.dependents)) {
        const qChildren = profile.dependents.filter((dep: any) => dep.isQualifyingChild);
        const qualifyingRelatives = profile.dependents.filter((dep: any) => dep.isQualifyingRelative);
        qualifyingChildren.push(...qChildren);
        dependentDeduction =
          (qChildren.length + qualifyingRelatives.length) * 500;
      }

      // Calculate taxable income
      const taxableIncome = Math.max(0, adjustedGrossIncome - chosenDeduction - dependentDeduction);

      // Calculate tax using database brackets
      const tax = await taxConfigService.calculateFederalTax(taxableIncome, filingStatus, taxYear.year);

      // ── Inline credit calculations ──────────────────────────────────────

      // Child Tax Credit: $2,000 per qualifying child, phase-out at $200K/$400K MFJ
      const ctcPhaseoutThreshold = isMfj ? 400000 : 200000;
      const ctcPhaseoutExcess = Math.max(0, adjustedGrossIncome - ctcPhaseoutThreshold);
      const ctcPhaseoutReduction = Math.ceil(ctcPhaseoutExcess / 1000) * 50;
      const childTaxCredit = Math.max(0, qualifyingChildren.length * 2000 - ctcPhaseoutReduction);

      // EITC: simplified estimate
      let eitcCredit = 0;
      const numChildren = qualifyingChildren.length;
      if (numChildren === 0 && adjustedGrossIncome < 17640) {
        eitcCredit = Math.min(632, adjustedGrossIncome * 0.0765);
      } else if (numChildren === 1 && adjustedGrossIncome < (isMfj ? 53120 : 46560)) {
        eitcCredit = Math.min(4213, Math.max(0, 4213 - Math.max(0, adjustedGrossIncome - 21430) * 0.1598));
      } else if (numChildren === 2 && adjustedGrossIncome < (isMfj ? 59478 : 52918)) {
        eitcCredit = Math.min(6960, Math.max(0, 6960 - Math.max(0, adjustedGrossIncome - 21430) * 0.2106));
      } else if (numChildren >= 3 && adjustedGrossIncome < (isMfj ? 63398 : 56838)) {
        eitcCredit = Math.min(7830, Math.max(0, 7830 - Math.max(0, adjustedGrossIncome - 21430) * 0.2106));
      }

      // Child & Dependent Care Credit: 20–35% of up to $3K (1 child) / $6K (2+)
      const careLimit = numChildren >= 2 ? 6000 : numChildren === 1 ? 3000 : 0;
      const childCareCredit = adjustedGrossIncome < 43000 ? careLimit * 0.35 : careLimit * 0.20;

      // Education credit: placeholder
      const educationCredit = 0;

      // Saver's Credit: simplified
      const saverPhaseout = isMfj ? 76500 : 38250;
      const saverCredit = adjustedGrossIncome < saverPhaseout ? Math.min(200, adjustedGrossIncome * 0.001) : 0;

      const totalCredits = childTaxCredit + eitcCredit + childCareCredit + educationCredit + saverCredit;

      // Apply credits (cannot reduce tax below 0)
      const taxAfterCredits = Math.max(0, tax + selfEmploymentTax - totalCredits);

      // Calculate refund or owed
      const refundOrOwed = totalFederalWithheld - taxAfterCredits;

      // Update tax return
      const updated = await storage.updateTaxReturn(taxReturn.id, {
        filingStatus,
        totalIncome: totalIncome.toString(),
        totalDeductions: (chosenDeduction + dependentDeduction).toString(),
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
        selfEmploymentIncome: totalScheduleCNetProfit.toString(),
        totalIncome: totalIncome.toString(),
        adjustments: seTaxDeduction.toString(),
        adjustedGrossIncome: adjustedGrossIncome.toString(),
        standardDeduction: standardDeduction.toString(),
        useItemized,
        itemizedDeduction: itemizedDeduction.toString(),
        taxableIncome: taxableIncome.toString(),
        tax: tax.toString(),
        selfEmploymentTax: selfEmploymentTax.toString(),
        childTaxCredit: childTaxCredit.toString(),
        eitcCredit: Math.round(eitcCredit).toString(),
        childCareCredit: Math.round(childCareCredit).toString(),
        educationCredit: educationCredit.toString(),
        saverCredit: Math.round(saverCredit).toString(),
        credits: Math.round(totalCredits).toString(),
        totalTax: taxAfterCredits.toString(),
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
          itemizedDeduction,
          useItemized,
          chosenDeduction,
          dependentDeduction,
          selfEmploymentTax: Math.round(selfEmploymentTax),
          childTaxCredit: Math.round(childTaxCredit),
          eitcCredit: Math.round(eitcCredit),
          childCareCredit: Math.round(childCareCredit),
          educationCredit,
          saverCredit: Math.round(saverCredit),
          totalCredits: Math.round(totalCredits),
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
            qualifyingChildren: qualifyingChildren.length,
            qualifyingRelatives: Array.isArray(profile?.dependents)
              ? profile.dependents.filter((dep: any) => dep.isQualifyingRelative).length
              : 0,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Calculation failed" });
    }
  });

  // Form 1040 route
  app.get("/api/form1040", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }

      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
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
      const activeYear = await taxConfigService.getActiveTaxYear();
      let taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        const newReturn = await storage.createTaxReturn({
          userId: req.userId!,
          taxYear: activeYear?.year || new Date().getFullYear(),
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

  // Admin endpoint to clear all documents (development only — disabled in production)
  if (process.env.NODE_ENV !== "production") {
    app.delete("/api/admin/clear-documents", authenticateToken, async (req: AuthRequest, res) => {
      try {
        await storage.clearAllDocuments();
        res.json({ message: "All documents cleared successfully" });
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to clear documents" });
      }
    });
  }

  // Tax Configuration API routes
  app.get("/api/tax-config/years", async (req, res) => {
    try {
      const years = await taxConfigService.getAllTaxYears();
      res.json(years);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tax-config/active-year", async (req, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      res.json(activeYear);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tax-config/set-active-year", authenticateToken, async (req, res) => {
    try {
      const { year } = req.body;
      if (!year || typeof year !== 'number') {
        return res.status(400).json({ message: "Year is required and must be a number" });
      }

      // First, ensure the tax year data exists (create if it doesn't)
      let taxYear = await taxConfigService.getTaxYear(year);
      if (!taxYear) {
        taxYear = await taxConfigService.createTaxYearData(year);
      }

      // First, set all years to inactive
      await storage.db
        .update(storage.taxYears)
        .set({ isActive: false });

      // Then set the selected year as active
      const result = await storage.db
        .update(storage.taxYears)
        .set({ isActive: true })
        .where(eq(storage.taxYears.year, year))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: `Tax year ${year} not found` });
      }

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tax-config/calculate/:year/:filingStatus", async (req, res) => {
    try {
      const { year, filingStatus } = req.params;
      const yearNum = parseInt(year);
      const taxableIncome = parseFloat(req.query.income as string) || 0;
      
      const tax = await taxConfigService.calculateFederalTax(taxableIncome, filingStatus, yearNum);
      res.json({ tax, taxableIncome, filingStatus, year: yearNum });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tax-config/state-calculate/:year/:filingStatus/:stateCode", async (req, res) => {
    try {
      const { year, filingStatus, stateCode } = req.params;
      const yearNum = parseInt(year);
      const taxableIncome = parseFloat(req.query.income as string) || 0;
      
      const tax = await taxConfigService.calculateStateTax(taxableIncome, filingStatus, stateCode, yearNum);
      res.json({ tax, taxableIncome, filingStatus, stateCode, year: yearNum });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Form Schema API routes
  app.get("/api/form-schemas/:formType/:year", async (req, res) => {
    try {
      const { formType, year } = req.params;
      const yearNum = parseInt(year);
      
      const schemaData = await taxConfigService.getFormSchema(formType, yearNum);
      res.json(schemaData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Application Configuration API routes
  app.get("/api/config/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const config = await taxConfigService.getAppConfiguration(key);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // App config write is disabled in production; only available with explicit env flag
  if (process.env.ALLOW_CONFIG_WRITE === "true" && process.env.NODE_ENV !== "production") {
    app.post("/api/config", authenticateToken, async (req: AuthRequest, res) => {
      try {
        const { configKey, configValue, configType, description } = req.body;

        const config = await taxConfigService.setAppConfiguration({
          configKey,
          configValue,
          configType,
          description,
        });

        res.json(config);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    });
  }

  // ── Schedule A Routes ──────────────────────────────────────────────────────

  app.get("/api/schedule-a", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }
      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      const taxReturn = taxReturns[0];
      let scheduleA = await storage.getScheduleAByTaxReturnId(taxReturn.id);
      if (!scheduleA) {
        scheduleA = await storage.createScheduleA({ taxReturnId: taxReturn.id });
      }
      res.json(scheduleA);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/schedule-a", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }
      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      const taxReturn = taxReturns[0];

      // Get AGI from form 1040 for the medical floor calculation
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);
      const agi = parseFloat(form1040?.adjustedGrossIncome || "0");

      const body = req.body;
      const p = (field: string) => parseFloat(body[field] || "0");

      // Medical: only amount above 7.5% of AGI is deductible
      const medicalExpenses = p("medicalExpenses");
      const medicalDeductible = Math.max(0, medicalExpenses - agi * 0.075);

      // SALT cap: $10,000
      const saltTotal = p("stateLocalIncomeTax") + p("realEstateTax") + p("personalPropertyTax");
      const saltCap = Math.min(saltTotal, 10000);

      const totalItemizedDeductions =
        medicalDeductible +
        saltCap +
        p("mortgageInterest") +
        p("mortgagePoints") +
        p("investmentInterest") +
        p("charitableCash") +
        p("charitableNonCash") +
        p("casualtyLoss") +
        p("otherDeductions");

      let scheduleA = await storage.getScheduleAByTaxReturnId(taxReturn.id);
      const updateData = {
        ...body,
        totalItemizedDeductions: totalItemizedDeductions.toString(),
      };

      if (scheduleA) {
        scheduleA = await storage.updateScheduleA(scheduleA.id, updateData);
      } else {
        scheduleA = await storage.createScheduleA({ taxReturnId: taxReturn.id, ...updateData });
      }

      res.json(scheduleA);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Schedule C Routes ──────────────────────────────────────────────────────

  app.get("/api/schedule-c", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }
      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      if (taxReturns.length === 0) {
        return res.json([]);
      }
      const schedules = await storage.getSchedulesByTaxReturnId(taxReturns[0].id);
      res.json(schedules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/schedule-c", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }
      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      const taxReturn = taxReturns[0];
      const schedule = await storage.createScheduleC({ ...req.body, taxReturnId: taxReturn.id });
      res.status(201).json(schedule);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/schedule-c/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }
      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      // Verify ownership
      const existing = (await storage.getSchedulesByTaxReturnId(taxReturns[0].id)).find(
        (s) => s.id === req.params.id
      );
      if (!existing) {
        return res.status(404).json({ message: "Schedule C not found" });
      }

      const body = req.body;
      const p = (field: string) => parseFloat(body[field] ?? existing[field as keyof typeof existing] ?? "0");

      // Gross income
      const grossReceipts = p("grossReceipts");
      const returns = p("returns");
      const otherIncome = p("otherIncome");
      const grossIncome = grossReceipts - returns + otherIncome;

      // Total expenses — sum of all expense fields
      const totalExpenses =
        p("advertising") +
        p("carTruck") +
        p("commissions") +
        p("contractLabor") +
        p("depletion") +
        p("depreciation") +
        p("insurance") +
        p("mortgageInterest") +
        p("otherInterest") +
        p("legalProfessional") +
        p("officeExpenses") +
        p("pensionProfitSharing") +
        p("rentLeaseMachinery") +
        p("rentLeaseOther") +
        p("repairsMaintenance") +
        p("supplies") +
        p("taxesLicenses") +
        p("travel") +
        p("mealsEntertainment") +
        p("utilities") +
        p("wages") +
        p("otherExpenses") +
        p("homeOfficeDeduction");

      const costOfGoodsSold = p("costOfGoodsSold");
      const netProfit = grossIncome - totalExpenses - costOfGoodsSold;

      const updated = await storage.updateScheduleC(req.params.id, {
        ...body,
        grossIncome: grossIncome.toString(),
        totalExpenses: totalExpenses.toString(),
        netProfit: netProfit.toString(),
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/schedule-c/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }
      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      // Verify ownership before deleting
      const existing = (await storage.getSchedulesByTaxReturnId(taxReturns[0].id)).find(
        (s) => s.id === req.params.id
      );
      if (!existing) {
        return res.status(404).json({ message: "Schedule C not found" });
      }
      await storage.deleteScheduleC(req.params.id);
      res.json({ message: "Schedule C deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Credits Calculation Route ─────────────────────────────────────────────

  app.get("/api/credits/calculate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }
      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      const taxReturn = taxReturns[0];
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);
      const profile = await storage.getUserProfile(req.userId!);

      const agi = parseFloat(form1040?.adjustedGrossIncome || "0");
      const filingStatus = taxReturn.filingStatus || "single";
      const isMfj = filingStatus === "married_joint";

      // Child Tax Credit: $2,000 per qualifying child, phase-out at $200K single / $400K MFJ
      const qualifyingChildren: any[] = Array.isArray(profile?.dependents)
        ? profile.dependents.filter((d: any) => d.isQualifyingChild)
        : [];
      const ctcPhaseoutThreshold = isMfj ? 400000 : 200000;
      const ctcPhaseoutExcess = Math.max(0, agi - ctcPhaseoutThreshold);
      const ctcPhaseoutReduction = Math.ceil(ctcPhaseoutExcess / 1000) * 50;
      const ctcBeforePhaseout = qualifyingChildren.length * 2000;
      const childTaxCredit = Math.max(0, ctcBeforePhaseout - ctcPhaseoutReduction);

      // EITC: simplified estimate based on filing status and children
      let eitcCredit = 0;
      if (qualifyingChildren.length === 0 && agi < 17640) {
        eitcCredit = Math.min(632, agi * 0.0765);
      } else if (qualifyingChildren.length === 1 && agi < (isMfj ? 53120 : 46560)) {
        eitcCredit = Math.min(4213, Math.max(0, 4213 - Math.max(0, agi - 21430) * 0.1598));
      } else if (qualifyingChildren.length === 2 && agi < (isMfj ? 59478 : 52918)) {
        eitcCredit = Math.min(6960, Math.max(0, 6960 - Math.max(0, agi - 21430) * 0.2106));
      } else if (qualifyingChildren.length >= 3 && agi < (isMfj ? 63398 : 56838)) {
        eitcCredit = Math.min(7830, Math.max(0, 7830 - Math.max(0, agi - 21430) * 0.2106));
      }

      // Child & Dependent Care Credit: simplified — 20% of up to $3,000 (1 child) or $6,000 (2+)
      const careExpenseLimit = qualifyingChildren.length >= 2 ? 6000 : qualifyingChildren.length === 1 ? 3000 : 0;
      const childCareCredit = agi < 43000 ? careExpenseLimit * 0.35 : careExpenseLimit * 0.20;

      // American Opportunity Credit / Lifetime Learning (education): placeholder $0 — no education data yet
      const educationCredit = 0;

      // Saver's Credit: simplified 10% of up to $2,000 for lower-income filers
      const saverPhaseout = isMfj ? 76500 : 38250;
      const saverCredit = agi < saverPhaseout ? Math.min(200, agi * 0.001) : 0;

      res.json({
        childTaxCredit: Math.round(childTaxCredit),
        eitcCredit: Math.round(eitcCredit),
        childCareCredit: Math.round(childCareCredit),
        educationCredit: Math.round(educationCredit),
        saverCredit: Math.round(saverCredit),
        totalCredits: Math.round(childTaxCredit + eitcCredit + childCareCredit + educationCredit + saverCredit),
        inputs: {
          agi,
          filingStatus,
          qualifyingChildrenCount: qualifyingChildren.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── AI Insights PATCH (accept/dismiss) ────────────────────────────────────

  app.patch("/api/ai/insights/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      if (!status || !["accepted", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "status must be 'accepted' or 'dismissed'" });
      }

      // Verify the insight belongs to the requesting user's tax return
      const taxReturns = await storage.getTaxReturnsByUserId(req.userId!);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      const taxReturn = taxReturns[0];
      const insights = await storage.getAiInsightsByTaxReturnId(taxReturn.id);
      const insight = insights.find((i) => i.id === req.params.id);
      if (!insight) {
        return res.status(404).json({ message: "Insight not found" });
      }

      const updated = await storage.updateAiInsight(req.params.id, { status });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Tax Planning Summary Route ────────────────────────────────────────────

  app.get("/api/tax-planning/summary", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const activeYear = await taxConfigService.getActiveTaxYear();
      if (!activeYear) {
        return res.status(404).json({ message: "No active tax year found" });
      }
      const taxReturns = await storage.getTaxReturnsByUserIdAndYear(req.userId!, activeYear.year);
      if (taxReturns.length === 0) {
        return res.status(404).json({ message: "No tax return found" });
      }
      const taxReturn = taxReturns[0];
      const form1040 = await storage.getForm1040ByTaxReturnId(taxReturn.id);

      const currentTax = parseFloat(form1040?.totalTax || taxReturn.totalTax || "0");
      const withheld = parseFloat(form1040?.federalWithheld || taxReturn.withheld || "0");

      // Safe harbor: use current tax as proxy for prior-year tax
      const safeHarborAmount = currentTax;
      const quarterlyEstimate = safeHarborAmount / 4;

      // W-4 suggestion: additional withholding needed per paycheck (assume 26 pay periods)
      const annualShortfall = Math.max(0, safeHarborAmount - withheld);
      const additionalWithholdingPerPaycheck = annualShortfall / 26;

      // Retirement contribution headroom (2024 limits: 401k $23,000, IRA $7,000)
      const estimated401kContributions = 0; // Would come from W-2 Box 12 in a full implementation
      const headroom401k = Math.max(0, 23000 - estimated401kContributions);
      const headroomIra = 7000; // Simplified — no existing IRA contribution data

      // Year-end position
      const estimatedRefundOwed = withheld - currentTax;

      res.json({
        quarterlyEstimatedPayments: {
          q1: Math.round(quarterlyEstimate),
          q2: Math.round(quarterlyEstimate),
          q3: Math.round(quarterlyEstimate),
          q4: Math.round(quarterlyEstimate),
          annualTotal: Math.round(safeHarborAmount),
        },
        w4Suggestion: {
          additionalWithholdingPerPaycheck: Math.round(additionalWithholdingPerPaycheck),
          annualShortfall: Math.round(annualShortfall),
          note:
            annualShortfall > 0
              ? `Consider adding $${Math.round(additionalWithholdingPerPaycheck)} to each paycheck's withholding`
              : "Current withholding appears sufficient",
        },
        retirementHeadroom: {
          traditional401k: Math.round(headroom401k),
          ira: Math.round(headroomIra),
          totalOpportunity: Math.round(headroom401k + headroomIra),
        },
        yearEndPosition: {
          estimatedTax: Math.round(currentTax),
          estimatedWithholding: Math.round(withheld),
          estimatedRefundOwed: Math.round(estimatedRefundOwed),
          isRefund: estimatedRefundOwed >= 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
