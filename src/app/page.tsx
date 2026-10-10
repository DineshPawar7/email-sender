"use client";

import { useEffect, useRef, useState } from "react";

type Upload = {
  id: string;
  fileName: string;
  totalRows: number;
  totalBatches: number;
  doneBatches: number;
  insertedRows: number;
  duplicateRows: number;
  invalidRows: number;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  errors: { row: number; reason: string }[];
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    const poll = async () => {
      const res = await fetch(`/api/uploads/${uploadId}`);
      if (!res.ok) return;
      const data: Upload = await res.json();
      setUpload(data);
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        if (timer.current) clearInterval(timer.current);
      }
    };
    poll();
    timer.current = setInterval(poll, 1500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [uploadId]);

  async function submit() {
    if (!file) return;
    setError(null);
    setUpload(null);
    setSending(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Upload failed");
      setUploadId(data.uploadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSending(false);
    }
  }

  const pct = upload && upload.totalBatches ? Math.round((upload.doneBatches / upload.totalBatches) * 100) : upload ? 100 : 0;

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-2xl font-semibold">Import members</h1>
      <p className="mt-1 text-sm text-slate-600">
        Upload an Excel file with the columns <b>name</b>, <b>email</b> and <b>phone</b>. Rows are validated, split into
        batches and saved in the background.
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-white p-5 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
        />
        <button
          onClick={submit}
          disabled={!file || sending}
          className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
        >
          {sending ? "Uploading…" : "Start import"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {upload && (
        <section className="mt-6 rounded-lg border border-[var(--line)] bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">{upload.fileName}</h2>
            <span className="text-sm text-slate-600">{upload.status.toLowerCase()}</span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {upload.doneBatches} of {upload.totalBatches} batches done
          </p>

          <dl className="mt-4 grid grid-cols-4 gap-3 text-center text-sm">
            <Stat label="Rows" value={upload.totalRows} />
            <Stat label="Saved" value={upload.insertedRows} />
            <Stat label="Already existed" value={upload.duplicateRows} />
            <Stat label="Invalid" value={upload.invalidRows} />
          </dl>

          {upload.errors.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer">Rows with problems</summary>
              <ul className="mt-2 max-h-48 overflow-auto text-slate-700">
                {upload.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="text-lg font-semibold">{value}</dd>
      <dt className="text-xs text-slate-600">{label}</dt>
    </div>
  );
}
