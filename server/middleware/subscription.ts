import type { Request, Response, NextFunction } from "express";
import { SUBSCRIPTION_TIER, SUBSCRIPTION_STATUS } from "@shared/schema";
import { storage } from "../storage";

export interface SubscriptionRequest extends Request {
  userId?: string;
  subscriptionTier?: string;
  canUseLLMParsing?: boolean;
  canGetAIInsights?: boolean;
  canEfile?: boolean;
}

export interface FeatureFlags {
  canUseLLMParsing: boolean;
  canGetAIInsights: boolean;
  canEfile: boolean;
  maxDocumentsPerYear: number;
  prioritySupport: boolean;
}

export class SubscriptionService {
  /**
   * Get user's subscription tier and feature flags
   */
  async getUserSubscription(userId: string): Promise<{
    tier: string;
    status: string;
    featureFlags: FeatureFlags;
  }> {
    try {
      // Get user preferences and active subscription
      const userPreferences = await storage.getUserPreferences(userId);
      const activeSubscription = await storage.getActiveSubscription(userId);
      
      const tier = activeSubscription?.tier || userPreferences?.subscriptionTier || SUBSCRIPTION_TIER.FREE;
      const status = activeSubscription?.status || SUBSCRIPTION_STATUS.ACTIVE;
      
      return {
        tier,
        status,
        featureFlags: this.getFeatureFlags(tier),
      };
    } catch (error) {
      console.error("[SubscriptionService] Error getting user subscription:", error);
      // Fallback to free tier
      return {
        tier: SUBSCRIPTION_TIER.FREE,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        featureFlags: this.getFeatureFlags(SUBSCRIPTION_TIER.FREE),
      };
    }
  }

  /**
   * Get feature flags for a subscription tier
   */
  getFeatureFlags(tier: string): FeatureFlags {
    switch (tier) {
      case SUBSCRIPTION_TIER.PREMIUM:
        return {
          canUseLLMParsing: true,
          canGetAIInsights: true,
          canEfile: true,
          maxDocumentsPerYear: -1, // Unlimited
          prioritySupport: true,
        };
      case SUBSCRIPTION_TIER.FREE:
      default:
        return {
          canUseLLMParsing: false,
          canGetAIInsights: false,
          canEfile: false,
          maxDocumentsPerYear: 5,
          prioritySupport: false,
        };
    }
  }

  /**
   * Check if user can use a specific feature
   */
  async canUseFeature(userId: string, feature: keyof FeatureFlags): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    return Boolean(subscription.featureFlags[feature]);
  }

  /**
   * Check document limit for free users
   */
  async checkDocumentLimit(userId: string, currentDocumentCount: number): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
  }> {
    const subscription = await this.getUserSubscription(userId);
    const limit = subscription.featureFlags.maxDocumentsPerYear;
    
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: -1 };
    }
    
    const remaining = Math.max(0, limit - currentDocumentCount);
    return {
      allowed: currentDocumentCount < limit,
      limit,
      remaining,
    };
  }

  /**
   * Track API usage for billing
   */
  async trackApiUsage(
    userId: string,
    service: string,
    endpoint: string,
    tokensUsed: number,
    costUsd: number
  ): Promise<void> {
    // This would typically insert into the apiUsage table
    console.log(`[SubscriptionService] API usage tracked: ${userId} - ${service}/${endpoint} - ${tokensUsed} tokens - $${costUsd}`);
  }
}

// Middleware to check subscription and add feature flags to request
export const subscriptionMiddleware = (subscriptionService: SubscriptionService) => {
  return async (req: SubscriptionRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const subscription = await subscriptionService.getUserSubscription(req.userId);
      
      // Add subscription info to request
      req.subscriptionTier = subscription.tier;
      req.canUseLLMParsing = subscription.featureFlags.canUseLLMParsing;
      req.canGetAIInsights = subscription.featureFlags.canGetAIInsights;
      req.canEfile = subscription.featureFlags.canEfile;

      next();
    } catch (error: any) {
      console.error("[SubscriptionMiddleware] Error:", error);
      res.status(500).json({ message: "Subscription check failed" });
    }
  };
};

// Middleware to require specific features
export const requireFeature = (feature: keyof FeatureFlags) => {
  return (req: SubscriptionRequest, res: Response, next: NextFunction) => {
    const featureFlags: Record<keyof FeatureFlags, boolean> = {
      canUseLLMParsing: req.canUseLLMParsing || false,
      canGetAIInsights: req.canGetAIInsights || false,
      canEfile: req.canEfile || false,
      maxDocumentsPerYear: false, // This is a number, not boolean
      prioritySupport: false,
    };

    if (!featureFlags[feature]) {
      return res.status(403).json({
        message: "Premium feature required",
        requiredFeature: feature,
        currentTier: req.subscriptionTier || "free",
      });
    }

    next();
  };
};

// Middleware to check document limits
export const checkDocumentLimit = (subscriptionService: SubscriptionService) => {
  return async (req: SubscriptionRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get the current document count from the database
      const currentDocumentCount = await storage.getDocumentCountForUser(req.userId);
      
      const limitCheck = await subscriptionService.checkDocumentLimit(req.userId, currentDocumentCount);
      
      if (!limitCheck.allowed) {
        return res.status(403).json({
          message: "Document limit exceeded",
          limit: limitCheck.limit,
          currentCount: currentDocumentCount,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error: any) {
      console.error("[DocumentLimitMiddleware] Error:", error);
      res.status(500).json({ message: "Document limit check failed" });
    }
  };
};

// Utility function to get subscription info for API responses
export const getSubscriptionInfo = (req: SubscriptionRequest) => {
  return {
    tier: req.subscriptionTier || SUBSCRIPTION_TIER.FREE,
    features: {
      llmParsing: req.canUseLLMParsing || false,
      aiInsights: req.canGetAIInsights || false,
      efile: req.canEfile || false,
    },
  };
};

// Export singleton instance
export const subscriptionService = new SubscriptionService();
