import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { importQueue } from "@/lib/queue";
import { chunk, validateRows } from "@/lib/validate";

export const runtime = "nodejs";

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 100);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Excel file required (field: file)" }, { status: 400 });
    }
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return NextResponse.json({ error: "Only .xlsx, .xls or .csv allowed" }, { status: 400 });
    }

  // Step 1: Excel read
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (raw.length === 0) {
      return NextResponse.json({ error: "Sheet is empty" }, { status: 400 });
    }

  // Step 3: Validation (format + in-file duplicates)
    const { valid, errors } = validateRows(raw);
    const batches = chunk(valid, BATCH_SIZE);

    const upload = await prisma.upload.create({
    data: {
      fileName: file.name,
      totalRows: raw.length,
      totalBatches: batches.length,
      invalidRows: errors.length,
      errors: errors.slice(0, 200),
      status: batches.length ? "QUEUED" : "COMPLETED",
    },
    });

  // Step 2: Batches ko BullMQ me push
    if (batches.length) {
      const jobs = batches.map((rows, batchIndex) => ({
        name: "import-batch",
        data: { uploadId: upload.id, batchIndex, rows },
      }));
      await Promise.race([
        importQueue.addBulk(jobs),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Redis queue timed out. Check REDIS_URL and Redis availability.")), 10000)
        ),
      ]);
    }

    return NextResponse.json({ uploadId: upload.id, totalRows: raw.length, batches: batches.length });
  } catch (error) {
    console.error("Upload failed:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
