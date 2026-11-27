import type { ActivityItem, AgentState, DataRow, Dataset, SavedPipeline, SqlQueryRecord } from '../types';
import { profileDataset } from '../utils/dataHelpers';

const ECOMMERCE_HEADERS = [
  'order_id',
  'order_date',
  'region',
  'category',
  'customer_segment',
  'units_sold',
  'unit_price',
  'revenue',
  'discount_pct',
  'delivery_days',
  'returned',
];

const ECOMMERCE_ROWS: DataRow[] = [
  { order_id: 'ORD-1041', order_date: '2026-01-04', region: 'North America', category: 'Cloud Hardware', customer_segment: 'Enterprise', units_sold: 14, unit_price: 420.0, revenue: 5880.0, discount_pct: 5, delivery_days: 3, returned: false },
  { order_id: 'ORD-1042', order_date: '2026-01-06', region: 'Europe', category: 'Edge Sensors', customer_segment: 'Mid-Market', units_sold: 28, unit_price: 145.5, revenue: 4074.0, discount_pct: 10, delivery_days: 4, returned: false },
  { order_id: 'ORD-1043', order_date: '2026-01-09', region: 'Asia Pacific', category: 'Compute Nodes', customer_segment: 'Enterprise', units_sold: 8, unit_price: 1120.0, revenue: 8960.0, discount_pct: 0, delivery_days: 5, returned: false },
  { order_id: 'ORD-1044', order_date: '2026-01-12', region: 'North America', category: 'Networking', customer_segment: 'SMB', units_sold: 19, unit_price: 210.0, revenue: null, discount_pct: 8, delivery_days: 2, returned: false },
  { order_id: 'ORD-1045', order_date: '2026-01-15', region: 'Europe', category: 'Cloud Hardware', customer_segment: 'Enterprise', units_sold: 22, unit_price: 420.0, revenue: 9240.0, discount_pct: 5, delivery_days: 3, returned: false },
  { order_id: 'ORD-1046', order_date: '2026-01-19', region: 'Latin America', category: 'Edge Sensors', customer_segment: 'SMB', units_sold: 11, unit_price: '145.50 USD', revenue: 1600.5, discount_pct: 12, delivery_days: 7, returned: true },
  { order_id: 'ORD-1047', order_date: '2026-02-02', region: 'Asia Pacific', category: 'Cloud Hardware', customer_segment: 'Mid-Market', units_sold: 16, unit_price: 420.0, revenue: 6720.0, discount_pct: 5, delivery_days: 4, returned: false },
  { order_id: 'ORD-1048', order_date: '2026-02-07', region: 'North America', category: 'Compute Nodes', customer_segment: 'Enterprise', units_sold: 12, unit_price: 1120.0, revenue: 13440.0, discount_pct: 4, delivery_days: 3, returned: false },
  { order_id: 'ORD-1048', order_date: '2026-02-07', region: 'North America', category: 'Compute Nodes', customer_segment: 'Enterprise', units_sold: 12, unit_price: 1120.0, revenue: 13440.0, discount_pct: 4, delivery_days: 3, returned: false },
  { order_id: 'ORD-1049', order_date: '2026-02-14', region: 'Europe', category: 'Networking', customer_segment: null, units_sold: 31, unit_price: 210.0, revenue: 6510.0, discount_pct: 10, delivery_days: 4, returned: false },
  { order_id: 'ORD-1050', order_date: '2026-02-20', region: 'Asia Pacific', category: 'Edge Sensors', customer_segment: 'Mid-Market', units_sold: 45, unit_price: 145.5, revenue: 6547.5, discount_pct: 15, delivery_days: 5, returned: false },
  { order_id: 'ORD-1051', order_date: '2026-03-03', region: 'North America', category: 'Cloud Hardware', customer_segment: 'Enterprise', units_sold: 185, unit_price: 420.0, revenue: 77700.0, discount_pct: 20, delivery_days: 2, returned: false },
  { order_id: 'ORD-1052', order_date: '2026-03-11', region: 'Europe', category: 'Compute Nodes', customer_segment: 'Enterprise', units_sold: 10, unit_price: 1120.0, revenue: 11200.0, discount_pct: 0, delivery_days: 4, returned: false },
  { order_id: 'ORD-1053', order_date: '2026-03-18', region: 'Latin America', category: 'Networking', customer_segment: 'SMB', units_sold: 15, unit_price: 210.0, revenue: 3150.0, discount_pct: null, delivery_days: 6, returned: true },
  { order_id: 'ORD-1054', order_date: '2026-03-24', region: 'North America', category: 'Edge Sensors', customer_segment: 'Mid-Market', units_sold: 34, unit_price: 145.5, revenue: 4947.0, discount_pct: 8, delivery_days: 3, returned: false },
  { order_id: 'ORD-1055', order_date: '2026-04-02', region: 'Asia Pacific', category: 'Cloud Hardware', customer_segment: 'Enterprise', units_sold: 26, unit_price: 420.0, revenue: 10920.0, discount_pct: 5, delivery_days: 4, returned: false },
  { order_id: 'ORD-1056', order_date: '2026-04-10', region: 'Europe', category: 'Edge Sensors', customer_segment: 'SMB', units_sold: 20, unit_price: 145.5, revenue: null, discount_pct: 10, delivery_days: 5, returned: false },
  { order_id: 'ORD-1057', order_date: '2026-04-18', region: 'North America', category: 'Networking', customer_segment: 'Enterprise', units_sold: 29, unit_price: 210.0, revenue: 6090.0, discount_pct: 6, delivery_days: 2, returned: false },
];

const CHURN_HEADERS = [
  'customer_id',
  'plan_tier',
  'tenure_months',
  'monthly_spend',
  'support_tickets',
  'api_calls_k',
  'nps_score',
  'auto_renew',
  'churned',
];

const CHURN_ROWS: DataRow[] = [
  { customer_id: 'CUST-901', plan_tier: 'Enterprise', tenure_months: 34, monthly_spend: 1290, support_tickets: 1, api_calls_k: 420, nps_score: 9, auto_renew: true, churned: 0 },
  { customer_id: 'CUST-902', plan_tier: 'Pro', tenure_months: 6, monthly_spend: 299, support_tickets: 7, api_calls_k: 38, nps_score: 4, auto_renew: false, churned: 1 },
  { customer_id: 'CUST-903', plan_tier: 'Starter', tenure_months: 4, monthly_spend: 79, support_tickets: 5, api_calls_k: 12, nps_score: 5, auto_renew: false, churned: 1 },
  { customer_id: 'CUST-904', plan_tier: 'Enterprise', tenure_months: 48, monthly_spend: 1850, support_tickets: 0, api_calls_k: 890, nps_score: 10, auto_renew: true, churned: 0 },
  { customer_id: 'CUST-905', plan_tier: 'Pro', tenure_months: 19, monthly_spend: 349, support_tickets: 2, api_calls_k: 165, nps_score: 8, auto_renew: true, churned: 0 },
  { customer_id: 'CUST-906', plan_tier: 'Pro', tenure_months: 9, monthly_spend: 299, support_tickets: 6, api_calls_k: 42, nps_score: 3, auto_renew: false, churned: 1 },
  { customer_id: 'CUST-907', plan_tier: 'Starter', tenure_months: 14, monthly_spend: 99, support_tickets: 1, api_calls_k: 55, nps_score: 7, auto_renew: true, churned: 0 },
  { customer_id: 'CUST-908', plan_tier: 'Enterprise', tenure_months: 27, monthly_spend: 1420, support_tickets: 2, api_calls_k: 610, nps_score: 9, auto_renew: true, churned: 0 },
  { customer_id: 'CUST-909', plan_tier: 'Starter', tenure_months: 3, monthly_spend: 79, support_tickets: 8, api_calls_k: 8, nps_score: null, auto_renew: false, churned: 1 },
  { customer_id: 'CUST-910', plan_tier: 'Pro', tenure_months: 22, monthly_spend: 349, support_tickets: 1, api_calls_k: 210, nps_score: 8, auto_renew: true, churned: 0 },
  { customer_id: 'CUST-911', plan_tier: 'Pro', tenure_months: 11, monthly_spend: 299, support_tickets: 4, api_calls_k: 74, nps_score: 6, auto_renew: true, churned: 0 },
  { customer_id: 'CUST-912', plan_tier: 'Starter', tenure_months: 5, monthly_spend: 79, support_tickets: 6, api_calls_k: 15, nps_score: 4, auto_renew: false, churned: 1 },
];

export const INITIAL_DATASETS: Dataset[] = [
  profileDataset(
    'ds-ecommerce-2026',
    'B2B Hardware Sales 2026',
    'b2b_hardware_sales_2026.csv',
    'CSV',
    248320,
    ECOMMERCE_HEADERS,
    ECOMMERCE_ROWS,
    'sample'
  ),
  profileDataset(
    'ds-saas-churn',
    'SaaS Customer Churn Telemetry',
    'saas_customer_churn.json',
    'JSON',
    118400,
    CHURN_HEADERS,
    CHURN_ROWS,
    'sample'
  ),
];

export const INITIAL_AGENTS: AgentState[] = [
  {
    id: 'cleaning',
    name: 'Data Cleaning Agent',
    shortName: 'Cleaning',
    description: 'LangGraph node for missing values, duplicate deduplication, outlier clamping, and schema casting.',
    status: 'Idle',
    lastUpdated: 'Ready',
  },
  {
    id: 'sql',
    name: 'SQL Generation Agent',
    shortName: 'SQL Gen',
    description: 'Translates natural language into DuckDB / PostgreSQL queries with syntax validation.',
    status: 'Idle',
    lastUpdated: 'Ready',
  },
  {
    id: 'analytics',
    name: 'Analytics & Dashboard Agent',
    shortName: 'Analytics',
    description: 'Synthesizes KPI aggregations, trend series, Pearson correlations, and anomaly notes.',
    status: 'Idle',
    lastUpdated: 'Ready',
  },
  {
    id: 'etl',
    name: 'ETL Pipeline Agent',
    shortName: 'ETL Pipe',
    description: 'Orchestrates source ingestion, transformation DAGs, Great Expectations validation, and DB load.',
    status: 'Idle',
    lastUpdated: 'Ready',
  },
  {
    id: 'ml',
    name: 'Machine Learning Agent',
    shortName: 'ML Auto',
    description: 'Detects task type, trains scikit-learn / XGBoost models, evaluates metrics, and extracts SHAP weights.',
    status: 'Idle',
    lastUpdated: 'Ready',
  },
  {
    id: 'report',
    name: 'Report Generation Agent',
    shortName: 'Reports',
    description: 'Compiles executive summaries, data quality audits, charts, and ML findings into PDF-ready briefs.',
    status: 'Idle',
    lastUpdated: 'Ready',
  },
];

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    timestamp: '2 mins ago',
    agent: 'analytics',
    action: 'Profiled B2B Hardware Sales 2026',
    datasetName: 'b2b_hardware_sales_2026.csv',
    status: 'info',
    details: 'Identified 4 missing cells, 1 duplicate row, and 1 unit_price type mismatch.',
  },
  {
    id: 'act-2',
    timestamp: '14 mins ago',
    agent: 'etl',
    action: 'Validated staging schema contract',
    datasetName: 'saas_customer_churn.json',
    status: 'success',
    details: '9/9 columns mapped to DuckDB staging table.',
  },
  {
    id: 'act-3',
    timestamp: '41 mins ago',
    agent: 'sql',
    action: 'Generated revenue by region query',
    datasetName: 'b2b_hardware_sales_2026.csv',
    status: 'success',
    details: 'Executed in 12.4 ms (Sample Preview).',
  },
];

export const INITIAL_SQL_HISTORY: SqlQueryRecord[] = [
  {
    id: 'sql-1',
    prompt: 'Show total revenue and order count by region',
    sql: `SELECT region, SUM(revenue) AS total_revenue, AVG(unit_price) AS avg_unit_price\nFROM active_dataset\nGROUP BY region\nORDER BY total_revenue DESC\nLIMIT 10;`,
    executedAt: '10:42 AM',
    executionTimeMs: 12.4,
    rowCount: 4,
    status: 'success',
  },
  {
    id: 'sql-2',
    prompt: 'List top orders sorted by revenue',
    sql: `SELECT order_id, order_date, region, category, units_sold, revenue\nFROM active_dataset\nORDER BY revenue DESC\nLIMIT 8;`,
    executedAt: '10:15 AM',
    executionTimeMs: 9.8,
    rowCount: 8,
    status: 'success',
  },
];

export const INITIAL_PIPELINES: SavedPipeline[] = [
  {
    id: 'pipe-daily-warehouse',
    name: 'Hardware Sales → PostgreSQL Warehouse',
    datasetId: 'ds-ecommerce-2026',
    schedule: 'Daily at 02:00 UTC',
    lastRunAt: 'Today, 02:00 UTC',
    status: 'Active',
    stages: [
      {
        id: 'source',
        label: 'Data Source',
        description: 'Ingest CSV/JSON/Excel stream via Pandas & DuckDB reader',
        status: 'idle',
        configSummary: 'CSV Connector · UTF-8 · Auto-schema',
        parameters: { format: 'CSV', chunkSize: 50000, inferTypes: true },
      },
      {
        id: 'cleaning',
        label: 'Cleaning',
        description: 'Impute nulls, deduplicate keys, cast malformed currency strings',
        status: 'idle',
        configSummary: 'Median Impute · Drop Exact Dupes',
        parameters: { deduplicate: true, imputeNumeric: 'median', castTypes: true },
      },
      {
        id: 'transformation',
        label: 'Transformation',
        description: 'Derive net_margin, normalize timestamps, standardize region codes',
        status: 'idle',
        configSummary: 'Normalize ISO-8601 · Compute KPIs',
        parameters: { normalizeDates: true, deriveMetrics: true, trimStrings: true },
      },
      {
        id: 'validation',
        label: 'Validation',
        description: 'Enforce non-null PKs, range bounds, and zero schema drift',
        status: 'idle',
        configSummary: 'Quality Gate ≥ 90% · Strict Types',
        parameters: { minQualityScore: 90, failOnSchemaDrift: true },
      },
      {
        id: 'database',
        label: 'Database',
        description: 'Upsert curated records into PostgreSQL & DuckDB analytics mart',
        status: 'idle',
        configSummary: 'PostgreSQL · analytics.fact_orders',
        parameters: { target: 'PostgreSQL + DuckDB', writeMode: 'upsert' },
      },
    ],
  },
];
