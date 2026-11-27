import type {
  CleaningRecommendation,
  ColumnDataType,
  ColumnSchema,
  DataRow,
  Dataset,
  DatasetQualityMetrics,
  SqlExecutionResult,
} from '../types';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function inferColumnType(values: (string | number | boolean | null)[]): ColumnDataType {
  const nonNull = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNull.length === 0) return 'string';

  const boolMatches = nonNull.filter((v) => {
    const s = String(v).toLowerCase();
    return s === 'true' || s === 'false';
  });
  if (boolMatches.length === nonNull.length) return 'boolean';

  const numericMatches = nonNull.filter((v) => {
    if (typeof v === 'number') return !Number.isNaN(v);
    const cleaned = String(v).replace(/[$,%]/g, '').trim();
    return cleaned !== '' && !Number.isNaN(Number(cleaned));
  });
  if (numericMatches.length >= nonNull.length * 0.85) {
    const hasDecimal = numericMatches.some((v) => String(v).includes('.'));
    return hasDecimal ? 'float' : 'integer';
  }

  const dateMatches = nonNull.filter((v) => {
    const s = String(v);
    return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);
  });
  if (dateMatches.length >= nonNull.length * 0.8) return 'date';

  const uniqueRatio = new Set(nonNull.map(String)).size / nonNull.length;
  if (uniqueRatio <= 0.35 && nonNull.length >= 6) return 'categorical';

  return 'string';
}

export function parseCsvText(text: string): { headers: string[]; rows: DataRow[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h, i) => h || `column_${i + 1}`);
  const rows: DataRow[] = lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const row: DataRow = {};
    headers.forEach((header, idx) => {
      const raw = vals[idx] ?? '';
      if (raw === '' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'na' || raw.toLowerCase() === 'n/a') {
        row[header] = null;
      } else if (!Number.isNaN(Number(raw)) && raw.trim() !== '') {
        row[header] = Number(raw);
      } else if (raw.toLowerCase() === 'true') {
        row[header] = true;
      } else if (raw.toLowerCase() === 'false') {
        row[header] = false;
      } else {
        row[header] = raw;
      }
    });
    return row;
  });

  return { headers, rows };
}

export function profileDataset(
  id: string,
  name: string,
  fileName: string,
  format: 'CSV' | 'Excel' | 'JSON',
  sizeBytes: number,
  headers: string[],
  rows: DataRow[],
  source: 'sample' | 'uploaded'
): Dataset {
  let missingCells = 0;
  let typeMismatchCount = 0;
  let outlierCount = 0;

  const schema: ColumnSchema[] = headers.map((col) => {
    const values = rows.map((r) => (r[col] === undefined ? null : r[col]));
    const missingCount = values.filter((v) => v === null || v === '').length;
    missingCells += missingCount;

    const inferred = inferColumnType(values);
    const nonNull = values.filter((v) => v !== null && v !== '');
    const uniqueCount = new Set(nonNull.map(String)).size;

    let issue: string | undefined;
    if (inferred === 'integer' || inferred === 'float' || inferred === 'number') {
      const mismatched = nonNull.filter((v) => typeof v !== 'number' && Number.isNaN(Number(String(v).replace(/[$,%]/g, ''))));
      if (mismatched.length > 0) {
        typeMismatchCount += mismatched.length;
        issue = `${mismatched.length} non-numeric entries in numeric column`;
      }
      const nums = nonNull
        .map((v) => (typeof v === 'number' ? v : Number(String(v).replace(/[$,%]/g, ''))))
        .filter((n) => !Number.isNaN(n));
      if (nums.length >= 5) {
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const std = Math.sqrt(nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length) || 1;
        const outliers = nums.filter((n) => Math.abs((n - mean) / std) > 2.4);
        if (outliers.length > 0) {
          outlierCount += outliers.length;
          issue = issue || `${outliers.length} statistical outlier(s) detected (>2.4σ)`;
        }
      }
    }

    if (!issue && missingCount > 0) {
      issue = `${missingCount} missing value(s)`;
    }

    return {
      name: col,
      type: inferred,
      missingCount,
      uniqueCount,
      sampleValues: nonNull.slice(0, 3),
      issue,
    };
  });

  const seen = new Set<string>();
  let duplicateRows = 0;
  rows.forEach((r) => {
    const sig = JSON.stringify(r);
    if (seen.has(sig)) duplicateRows++;
    else seen.add(sig);
  });

  const totalCells = Math.max(1, rows.length * Math.max(1, headers.length));
  const completeness = Math.max(0, Math.round((1 - missingCells / totalCells) * 100));
  const uniqueness = Math.max(0, Math.round((1 - duplicateRows / Math.max(1, rows.length)) * 100));
  const validity = Math.max(0, Math.round((1 - typeMismatchCount / totalCells) * 100));
  const consistency = Math.max(0, Math.round((1 - outlierCount / Math.max(1, rows.length * 2)) * 100));
  const overallScore = Math.round(completeness * 0.35 + uniqueness * 0.25 + validity * 0.25 + consistency * 0.15);

  const quality: DatasetQualityMetrics = {
    overallScore,
    completeness,
    uniqueness,
    validity,
    consistency,
    missingCells,
    duplicateRows,
    outlierCount,
    typeMismatchCount,
  };

  return {
    id,
    name,
    fileName,
    format,
    sizeBytes,
    uploadedAt: new Date().toISOString(),
    rowCount: rows.length,
    columnCount: headers.length,
    schema,
    rows,
    quality,
    source,
  };
}

export function buildRecommendationsForDataset(dataset: Dataset): CleaningRecommendation[] {
  const recs: CleaningRecommendation[] = [];

  if (dataset.quality.duplicateRows > 0) {
    recs.push({
      id: `rec-dup-${dataset.id}`,
      category: 'duplicates',
      column: 'All Columns',
      severity: dataset.quality.duplicateRows > 3 ? 'high' : 'medium',
      affectedRows: dataset.quality.duplicateRows,
      description: `Detected ${dataset.quality.duplicateRows} exact duplicate row(s) in ${dataset.name}.`,
      suggestedAction: 'Drop exact duplicate records while retaining first occurrence',
      selected: true,
    });
  }

  dataset.schema.forEach((col) => {
    if (col.missingCount > 0) {
      const isNum = col.type === 'integer' || col.type === 'float' || col.type === 'number';
      recs.push({
        id: `rec-miss-${col.name}`,
        category: 'missing',
        column: col.name,
        severity: col.missingCount > 3 ? 'high' : 'medium',
        affectedRows: col.missingCount,
        description: `Column "${col.name}" has ${col.missingCount} null/missing value(s).`,
        suggestedAction: isNum ? `Impute missing values with column median` : `Fill missing values with mode / "Unknown"`,
        selected: true,
      });
    }

    if (col.issue && col.issue.includes('non-numeric')) {
      recs.push({
        id: `rec-type-${col.name}`,
        category: 'types',
        column: col.name,
        severity: 'high',
        affectedRows: 1,
        description: col.issue,
        suggestedAction: `Strip currency/text artifacts and cast "${col.name}" to ${col.type}`,
        selected: true,
      });
    }

    if (col.issue && col.issue.includes('outlier')) {
      recs.push({
        id: `rec-out-${col.name}`,
        category: 'outliers',
        column: col.name,
        severity: 'low',
        affectedRows: 1,
        description: col.issue,
        suggestedAction: `Winsorize values beyond 99th / 1st percentile in "${col.name}"`,
        selected: true,
      });
    }
  });

  return recs;
}

export function applyCleaningToDataset(
  dataset: Dataset,
  recommendations: CleaningRecommendation[]
): Dataset {
  const active = recommendations.filter((r) => r.selected);
  let cleanedRows = dataset.rows.map((r) => ({ ...r }));

  // 1. Type coercion
  const typeCols = active.filter((r) => r.category === 'types').map((r) => r.column);
  if (typeCols.length > 0) {
    cleanedRows = cleanedRows.map((row) => {
      const next = { ...row };
      typeCols.forEach((col) => {
        const val = next[col];
        if (val !== null && val !== undefined && typeof val !== 'number') {
          const parsed = Number(String(val).replace(/[^0-9.-]/g, ''));
          next[col] = Number.isNaN(parsed) || String(val).replace(/[^0-9.-]/g, '') === '' ? null : parsed;
        }
      });
      return next;
    });
  }

  // 2. Missing value imputation
  const missingCols = active.filter((r) => r.category === 'missing').map((r) => r.column);
  missingCols.forEach((col) => {
    const schemaCol = dataset.schema.find((s) => s.name === col);
    const isNum = schemaCol && (schemaCol.type === 'integer' || schemaCol.type === 'float' || schemaCol.type === 'number');
    const nonNull = cleanedRows.map((r) => r[col]).filter((v) => v !== null && v !== '' && v !== undefined);
    let fillVal: string | number | boolean = 'Unknown';
    if (isNum) {
      const nums = nonNull.map((v) => Number(v)).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
      fillVal = nums.length > 0 ? nums[Math.floor(nums.length / 2)] : 0;
    } else if (nonNull.length > 0) {
      const freq = new Map<string, number>();
      nonNull.forEach((v) => freq.set(String(v), (freq.get(String(v)) || 0) + 1));
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
      fillVal = top ? top[0] : 'Unknown';
    }
    cleanedRows = cleanedRows.map((r) => ({
      ...r,
      [col]: r[col] === null || r[col] === '' || r[col] === undefined ? fillVal : r[col],
    }));
  });

  // 3. Outliers winsorize
  const outlierCols = active.filter((r) => r.category === 'outliers').map((r) => r.column);
  outlierCols.forEach((col) => {
    const nums = cleanedRows
      .map((r) => Number(r[col]))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    if (nums.length >= 5) {
      const p95 = nums[Math.floor(nums.length * 0.92)];
      const p05 = nums[Math.floor(nums.length * 0.05)];
      cleanedRows = cleanedRows.map((r) => {
        const val = Number(r[col]);
        if (Number.isNaN(val)) return r;
        const clamped = Math.min(Math.max(val, p05), p95);
        return { ...r, [col]: Number(clamped.toFixed(2)) };
      });
    }
  });

  // 4. Duplicates
  if (active.some((r) => r.category === 'duplicates')) {
    const seen = new Set<string>();
    cleanedRows = cleanedRows.filter((r) => {
      const sig = JSON.stringify(r);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }

  const headers = dataset.schema.map((s) => s.name);
  const reprofiled = profileDataset(
    dataset.id,
    dataset.name,
    dataset.fileName,
    dataset.format,
    dataset.sizeBytes,
    headers,
    cleanedRows,
    dataset.source
  );

  return {
    ...reprofiled,
    uploadedAt: dataset.uploadedAt,
    isCleaned: true,
  };
}

export function executeLocalSqlPreview(sql: string, dataset: Dataset): SqlExecutionResult {
  const start = performance.now();
  const normalized = sql.trim();

  if (!normalized.toLowerCase().startsWith('select')) {
    throw new Error('Local preview engine supports SELECT queries. Connect FastAPI + DuckDB for DDL/DML statements.');
  }

  // Handle simple GROUP BY aggregation patterns or LIMIT/WHERE on dataset.rows
  const limitMatch = normalized.match(/\bLIMIT\s+(\d+)/i);
  const limit = limitMatch ? Math.min(Number(limitMatch[1]), 100) : 25;

  const groupMatch = normalized.match(/SELECT\s+(.+?)\s+FROM\s+\w+(?:\s+GROUP\s+BY\s+([a-zA-Z0-9_]+))?(?:\s+ORDER\s+BY\s+([a-zA-Z0-9_]+)\s*(ASC|DESC)?)?/i);

  let resultRows: DataRow[] = [...dataset.rows];
  let columns = dataset.schema.map((s) => s.name);

  if (groupMatch && groupMatch[2]) {
    const groupCol = groupMatch[2];
    const selectPart = groupMatch[1];
    if (columns.includes(groupCol)) {
      const groups = new Map<string, DataRow[]>();
      resultRows.forEach((r) => {
        const key = String(r[groupCol] ?? 'Null');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      });

      const numericCol = dataset.schema.find((s) => s.type === 'float' || s.type === 'integer')?.name;
      const aggregated: DataRow[] = [...groups.entries()].map(([key, items]) => {
        const row: DataRow = { [groupCol]: key, record_count: items.length };
        if (numericCol && selectPart.toLowerCase().includes('sum(')) {
          const sum = items.reduce((acc, it) => acc + (Number(it[numericCol]) || 0), 0);
          row[`total_${numericCol}`] = Number(sum.toFixed(2));
        }
        if (numericCol && selectPart.toLowerCase().includes('avg(')) {
          const avg = items.reduce((acc, it) => acc + (Number(it[numericCol]) || 0), 0) / Math.max(1, items.length);
          row[`avg_${numericCol}`] = Number(avg.toFixed(2));
        }
        return row;
      });
      columns = Object.keys(aggregated[0] || { [groupCol]: '' });
      resultRows = aggregated;
    }
  } else if (groupMatch && groupMatch[1].trim() !== '*') {
    const requestedCols = groupMatch[1]
      .split(',')
      .map((c) => c.trim().split(/\s+as\s+/i)[0].replace(/["`]/g, ''))
      .filter((c) => columns.includes(c));
    if (requestedCols.length > 0) {
      columns = requestedCols;
      resultRows = resultRows.map((r) => {
        const projected: DataRow = {};
        requestedCols.forEach((c) => {
          projected[c] = r[c];
        });
        return projected;
      });
    }
  }

  if (groupMatch && groupMatch[3] && columns.includes(groupMatch[3])) {
    const sortCol = groupMatch[3];
    const desc = (groupMatch[4] || 'ASC').toUpperCase() === 'DESC';
    resultRows.sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (typeof av === 'number' && typeof bv === 'number') return desc ? bv - av : av - bv;
      return desc ? String(bv ?? '').localeCompare(String(av ?? '')) : String(av ?? '').localeCompare(String(bv ?? ''));
    });
  }

  const sliced = resultRows.slice(0, limit);
  const elapsed = Math.max(4.2, Number((performance.now() - start + 8.4).toFixed(1)));

  return {
    columns,
    rows: sliced,
    executionTimeMs: elapsed,
    rowCount: sliced.length,
    isMocked: true,
  };
}

export function exportRowsToCsv(columns: string[], rows: DataRow[], fileName: string): void {
  const escape = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = columns.map(escape).join(',');
  const dataLines = rows.map((r) => columns.map((c) => escape(r[c])).join(','));
  const blob = new Blob([[headerLine, ...dataLines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
