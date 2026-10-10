import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { createRedis } from "../lib/redis";
import { QUEUE_NAME, type BatchJob } from "../lib/queue";

const prisma = new PrismaClient();
const connection = createRedis();

const worker = new Worker<BatchJob>(
  QUEUE_NAME,
  async (job) => {
    const { uploadId, rows } = job.data;

    await prisma.upload.updateMany({
      where: { id: uploadId, status: "QUEUED" },
      data: { status: "PROCESSING" },
    });

    // Step 5: DB insert. email @unique hai, isliye existing members skip ho jayenge
    const res = await prisma.member.createMany({
      data: rows.map((r) => ({ ...r, uploadId })),
      skipDuplicates: true,
    });
    const duplicates = rows.length - res.count;

    // Step 4: Redis me live progress (UI fast poll ke liye optional)
    await connection.hincrby(`upload:${uploadId}`, "done", 1);

    const updated = await prisma.upload.update({
      where: { id: uploadId },
      data: {
        doneBatches: { increment: 1 },
        insertedRows: { increment: res.count },
        duplicateRows: { increment: duplicates },
      },
    });

    if (updated.doneBatches >= updated.totalBatches) {
      await prisma.upload.update({ where: { id: uploadId }, data: { status: "COMPLETED" } });
    }
    return { inserted: res.count, duplicates };
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5) }
);

worker.on("completed", (job) => console.log(`✔ batch ${job.data.batchIndex} of ${job.data.uploadId}`));
worker.on("failed", async (job, err) => {
  console.error(`✖ batch ${job?.data.batchIndex} failed:`, err.message);
  // Saare retries ke baad bhi fail hua to upload FAILED mark karo
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.upload.update({
      where: { id: job.data.uploadId },
      data: { status: "FAILED" },
    });
  }
});

const shutdown = async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Worker started, waiting for jobs...");
