import { storage } from "../storage";
import type { BackgroundJob } from "@shared/schema";

export type JobType = "parse_document" | "generate_insights" | "calculate_taxes" | "send_email";

type JobHandler = (payload: any) => Promise<any>;

export class JobQueueService {
  private handlers: Map<JobType, JobHandler> = new Map();
  private workerInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  async enqueue(type: JobType, payload: Record<string, any>, priority = 0): Promise<BackgroundJob> {
    return storage.createBackgroundJob({
      type,
      payload,
      status: "pending",
      priority,
      attempts: 0,
      maxAttempts: 3,
      result: null,
      errorMessage: null,
      scheduledAt: new Date(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
    });
  }

  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  startWorker(intervalMs = 5000): void {
    if (this.workerInterval !== null) {
      console.warn("[JobQueueService] Worker already running");
      return;
    }

    console.log(`[JobQueueService] Starting worker (interval: ${intervalMs}ms)`);
    this.workerInterval = setInterval(() => {
      this.processNextJob().catch((err) => {
        console.error("[JobQueueService] Worker loop error:", err);
      });
    }, intervalMs);
  }

  stopWorker(): void {
    if (this.workerInterval !== null) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      console.log("[JobQueueService] Worker stopped");
    }
  }

  async getStats(): Promise<{ pending: number; running: number; completed: number; failed: number }> {
    // getPendingJobCount only returns pending — we do a simple approach using storage
    const pending = await storage.getPendingJobCount();

    // For the extended stats we lean on what storage exposes; other statuses
    // are not individually counted by the storage interface, so we return 0 for
    // running/completed/failed unless the storage implementation supports it.
    return {
      pending,
      running: 0,
      completed: 0,
      failed: 0,
    };
  }

  private async processNextJob(): Promise<void> {
    if (this.isProcessing) {
      return; // Prevent concurrent processing
    }

    this.isProcessing = true;
    try {
      const job = await storage.getNextPendingJob();
      if (!job) {
        return;
      }

      const handler = this.handlers.get(job.type as JobType);
      if (!handler) {
        console.warn(`[JobQueueService] No handler registered for job type: ${job.type}`);
        // Mark as failed immediately — no handler registered
        await storage.updateBackgroundJob(job.id, {
          status: "failed",
          attempts: job.attempts + 1,
          errorMessage: `No handler registered for job type: ${job.type}`,
          failedAt: new Date(),
        });
        return;
      }

      console.log(`[JobQueueService] Processing job ${job.id} (type: ${job.type})`);

      await storage.updateBackgroundJob(job.id, {
        status: "running",
        startedAt: new Date(),
        attempts: job.attempts + 1,
      });

      try {
        const result = await handler(job.payload);

        await storage.updateBackgroundJob(job.id, {
          status: "completed",
          result: result ?? null,
          completedAt: new Date(),
        });

        console.log(`[JobQueueService] Job ${job.id} completed successfully`);
      } catch (handlerError: any) {
        console.error(`[JobQueueService] Job ${job.id} failed:`, handlerError);

        const newAttempts = job.attempts + 1;
        const maxAttempts = job.maxAttempts ?? 3;

        if (newAttempts >= maxAttempts) {
          await storage.updateBackgroundJob(job.id, {
            status: "failed",
            attempts: newAttempts,
            errorMessage: handlerError.message,
            failedAt: new Date(),
          });
          console.log(`[JobQueueService] Job ${job.id} permanently failed after ${newAttempts} attempts`);
        } else {
          // Retry: set back to pending
          await storage.updateBackgroundJob(job.id, {
            status: "pending",
            attempts: newAttempts,
            errorMessage: handlerError.message,
          });
          console.log(`[JobQueueService] Job ${job.id} queued for retry (attempt ${newAttempts}/${maxAttempts})`);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const jobQueueService = new JobQueueService();
