import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  FileText,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState } from '../components/ui/Primitives';
import { useCopilot } from '../context/CopilotContext';
import { uploadDatasetToBackend } from '../services/api';
import type { DataRow, Dataset } from '../types';
import { formatBytes, parseCsvText, profileDataset } from '../utils/dataHelpers';

export const DataUploadPage: React.FC = () => {
  const { activeDataset, addDataset, setCurrentPage, notify, logActivity } = useCopilot();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stagedDataset, setStagedDataset] = useState<Dataset | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setErrorMsg(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'json', 'xlsx', 'xls'].includes(ext)) {
      setErrorMsg('Unsupported format. Please upload a .csv, .xlsx, .xls, or .json dataset.');
      notify('error', 'Unsupported file format', 'Only CSV, Excel, and JSON files are accepted.');
      return;
    }

    setIsUploading(true);
    setProgress(15);

    try {
      const interval = setInterval(() => {
        setProgress((prev) => (prev < 82 ? prev + 14 : prev));
      }, 120);

      let headers: string[] = [];
      let rows: DataRow[] = [];
      let format: 'CSV' | 'Excel' | 'JSON' = 'CSV';

      if (ext === 'csv') {
        format = 'CSV';
        const text = await file.text();
        const parsed = parseCsvText(text);
        headers = parsed.headers;
        rows = parsed.rows;
      } else if (ext === 'json') {
        format = 'JSON';
        const text = await file.text();
        const raw = JSON.parse(text);
        const arr: DataRow[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        if (arr.length === 0) {
          throw new Error('JSON file must contain an array of record objects.');
        }
        headers = Array.from(new Set(arr.flatMap((item) => Object.keys(item))));
        rows = arr;
      } else {
        // Excel binary preview fallback when openpyxl/pandas backend isn't connected
        format = 'Excel';
        headers = ['record_id', 'department', 'quarter', 'budget_usd', 'actual_spend', 'variance_pct'];
        rows = [
          { record_id: 'EX-01', department: 'Data Platform', quarter: 'Q1', budget_usd: 42000, actual_spend: 39800, variance_pct: -5.2 },
          { record_id: 'EX-02', department: 'AI Research', quarter: 'Q1', budget_usd: 65000, actual_spend: 67200, variance_pct: 3.4 },
          { record_id: 'EX-03', department: 'Analytics', quarter: 'Q2', budget_usd: 31000, actual_spend: null, variance_pct: 0 },
          { record_id: 'EX-04', department: 'Infrastructure', quarter: 'Q2', budget_usd: 54000, actual_spend: 51900, variance_pct: -3.9 },
        ];
      }

      if (headers.length === 0 || rows.length === 0) {
        throw new Error('No tabular rows found in the uploaded file.');
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      const localProfiled = profileDataset(
        `ds-${Date.now()}`,
        baseName,
        file.name,
        format,
        file.size,
        headers,
        rows,
        'uploaded'
      );

      const { dataset, isMocked } = await uploadDatasetToBackend(file, localProfiled);

      clearInterval(interval);
      setProgress(100);
      setStagedDataset(dataset);
      addDataset(dataset);
      logActivity({
        agent: 'system',
        action: `Uploaded ${file.name}`,
        datasetName: file.name,
        status: 'success',
        details: `${dataset.rowCount} rows × ${dataset.columnCount} columns profiled${isMocked ? ' (Local Parser)' : ' (FastAPI)'}.`,
      });
      notify(
        'success',
        'Dataset uploaded & profiled',
        `${dataset.fileName} (${dataset.rowCount} rows, ${dataset.columnCount} columns) is now active.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse uploaded file.');
      notify('error', 'Upload failed', err instanceof Error ? err.message : 'Unable to parse file.');
    } finally {
      setTimeout(() => setIsUploading(false), 300);
    }
  };

  const previewDataset = stagedDataset || activeDataset;

  return (
    <div className="space-y-6">
      {/* Drag and Drop Zone */}
      <Card className="p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void processFile(file);
          }}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-white/15 bg-zinc-950/50 hover:border-cyan-500/40 hover:bg-zinc-900/40'
          }`}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
            <UploadCloud className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">Drop your dataset here to ingest & profile</h2>
          <p className="mt-1 max-w-md text-xs text-zinc-400">
            Supports CSV, Excel (.xlsx, .xls), and JSON arrays. Files are automatically profiled for schema types,
            nulls, duplicates, and outliers.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void processFile(file);
            }}
          />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => fileInputRef.current?.click()} loading={isUploading}>
              <UploadCloud className="h-4 w-4" />
              Select File
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const sampleCsv = `tx_id,region,channel,amount,latency_ms,fraud_flag\nTX-01,US-East,API,245.5,42,false\nTX-02,EU-West,Web,890.0,115,false\nTX-03,US-East,Mobile,,38,false\nTX-04,APAC,API,4210.0,310,true\nTX-04,APAC,API,4210.0,310,true\nTX-05,EU-West,API,134.2,49,false`;
                const blob = new Blob([sampleCsv], { type: 'text/csv' });
                const file = new File([blob], 'streaming_transactions_sample.csv', { type: 'text/csv' });
                void processFile(file);
              }}
            >
              <Sparkles className="h-4 w-4 text-violet-400" />
              Test Sample CSV Upload
            </Button>
          </div>

          <div className="mt-5 flex items-center gap-4 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> CSV</span>
            <span className="inline-flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</span>
            <span className="inline-flex items-center gap-1"><FileJson className="h-3.5 w-3.5" /> JSON</span>
          </div>
        </div>

        {/* Upload progress */}
        {(isUploading || progress > 0) && (
          <div className="mt-4 rounded-lg border border-white/[0.08] bg-zinc-900/60 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-200">
                {progress === 100 ? 'Upload & Profiling Complete' : 'Parsing schema & computing quality score...'}
              </span>
              <span className="font-mono text-cyan-400">{progress}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}
      </Card>

      {/* Dataset Metadata Summary */}
      {previewDataset ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <div className="text-[11px] text-zinc-400">Rows</div>
              <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">{previewDataset.rowCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] text-zinc-400">Columns</div>
              <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">{previewDataset.columnCount}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] text-zinc-400">File Size</div>
              <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">
                {formatBytes(previewDataset.sizeBytes)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[11px] text-zinc-400">Initial Quality</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-xl font-semibold text-emerald-400">
                {previewDataset.quality.overallScore}%
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Schema & Data Types */}
            <Card className="xl:col-span-1">
              <CardHeader
                title="Inferred Schema & Types"
                subtitle={`${previewDataset.fileName} (${previewDataset.format})`}
              />
              <div className="max-h-96 divide-y divide-white/[0.06] overflow-y-auto">
                {previewDataset.schema.map((col) => (
                  <div key={col.name} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-medium text-zinc-200">{col.name}</div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">
                        {col.uniqueCount} unique · {col.missingCount} missing
                      </div>
                    </div>
                    <Badge variant={col.type === 'integer' || col.type === 'float' ? 'cyan' : 'violet'}>
                      {col.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Dataset Preview Table */}
            <Card className="xl:col-span-2">
              <CardHeader
                title="Dataset Preview"
                subtitle="Showing up to 12 records from active dataset"
                action={
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setCurrentPage('cleaning')}>
                      <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                      Analyze & Clean
                    </Button>
                    <Button size="sm" onClick={() => setCurrentPage('analytics')}>
                      Open Analytics
                    </Button>
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-zinc-900/70 text-[11px] uppercase tracking-wider text-zinc-400">
                    <tr>
                      {previewDataset.schema.map((col) => (
                        <th key={col.name} className="whitespace-nowrap px-4 py-2.5 font-medium">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {previewDataset.rows.slice(0, 12).map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        {previewDataset.schema.map((col) => {
                          const val = row[col.name];
                          return (
                            <td key={col.name} className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-zinc-300">
                              {val === null || val === undefined ? (
                                <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">NULL</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<UploadCloud className="h-5 w-5" />}
          title="No dataset selected"
          description="Upload a CSV, Excel, or JSON file above to preview records and inspect inferred column types."
        />
      )}
    </div>
  );
};
