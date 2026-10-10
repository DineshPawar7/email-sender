import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_NAME = "member-import";

export type MemberRow = { name: string; email: string; phone?: string };
export type BatchJob = { uploadId: string; batchIndex: number; rows: MemberRow[] };

export const importQueue = new Queue<BatchJob>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
