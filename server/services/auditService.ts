import { storage } from "../storage";
import type { Request } from "express";
import type { AuthRequest } from "../middleware/auth";

export class AuditService {
  async log(params: {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    req?: Request;
    metadata?: Record<string, any>;
    success?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const { userId, action, resourceType, resourceId, req, metadata, success = true, errorMessage } = params;

      let ipAddress: string | undefined;
      let userAgent: string | undefined;

      if (req) {
        // Prefer X-Forwarded-For for proxied requests, fall back to req.ip
        const forwarded = req.headers["x-forwarded-for"];
        if (forwarded) {
          ipAddress = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0].trim();
        } else {
          ipAddress = req.ip;
        }
        userAgent = req.headers["user-agent"] as string | undefined;
      }

      await storage.createAuditLog({
        userId: userId ?? null,
        action,
        resourceType: resourceType ?? null,
        resourceId: resourceId ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: metadata ?? null,
        success,
        errorMessage: errorMessage ?? null,
      });
    } catch (err) {
      console.error("[AuditService] Failed to write audit log:", err);
    }
  }

  middleware(): (req: Request, res: any, next: any) => void {
    // Action patterns to capture: path segment → action name
    const stateChangingPatterns: Array<{ method: string; pathPattern: RegExp; action: string; resourceType?: string }> = [
      // Auth
      { method: "POST", pathPattern: /^\/api\/auth\/login$/, action: "login" },
      { method: "POST", pathPattern: /^\/api\/auth\/logout$/, action: "logout" },
      { method: "POST", pathPattern: /^\/api\/auth\/register$/, action: "register" },
      // Documents
      { method: "POST", pathPattern: /^\/api\/documents$/, action: "document_upload", resourceType: "document" },
      { method: "DELETE", pathPattern: /^\/api\/documents\/[^/]+$/, action: "document_delete", resourceType: "document" },
      // Tax calculations
      { method: "POST", pathPattern: /^\/api\/tax-returns\/[^/]+\/calculate$/, action: "tax_calculation", resourceType: "tax_return" },
      // PDF export
      { method: "GET", pathPattern: /^\/api\/tax-returns\/[^/]+\/pdf$/, action: "pdf_export", resourceType: "tax_return" },
      // E-file
      { method: "POST", pathPattern: /^\/api\/tax-returns\/[^/]+\/efile$/, action: "efile_submission", resourceType: "tax_return" },
    ];

    return (req: Request, res: any, next: any): void => {
      const match = stateChangingPatterns.find(
        (p) => p.method === req.method && p.pathPattern.test(req.path)
      );

      if (!match) {
        next();
        return;
      }

      const authReq = req as AuthRequest;
      const userId = authReq.userId;

      // Extract resource ID from URL if present
      const idMatch = req.path.match(/\/api\/[^/]+\/([^/]+)/);
      const resourceId = idMatch ? idMatch[1] : undefined;

      const originalSend = res.send.bind(res);
      res.send = (body: any) => {
        const success = res.statusCode < 400;

        this.log({
          userId,
          action: match.action,
          resourceType: match.resourceType,
          resourceId: resourceId !== match.action ? resourceId : undefined,
          req,
          success,
          errorMessage: !success ? `HTTP ${res.statusCode}` : undefined,
        }).catch(() => {
          // Already swallowed in log()
        });

        return originalSend(body);
      };

      next();
    };
  }
}

export const auditService = new AuditService();
