from datetime import datetime, timezone
import io
import time
from typing import Any, Dict, List

import duckdb
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agents.graph import AGENT_REGISTRY

app = FastAPI(
    title="AI Data Engineering Copilot API",
    version="1.0.0",
    description="FastAPI + LangGraph + DuckDB + PostgreSQL backend for AI Data Engineering Copilot",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory dataset store + DuckDB connection for rapid local prototyping
DATASET_STORE: Dict[str, pd.DataFrame] = {}
DUCKDB_CONN = duckdb.connect(database=":memory:")


class SqlGenerateRequest(BaseModel):
    prompt: str
    dataset_id: str
    columns: List[Dict[str, Any]] = []


class SqlExecuteRequest(BaseModel):
    sql: str
    dataset_id: str


class CleaningAnalyzeRequest(BaseModel):
    dataset_id: str
    schema: List[Dict[str, Any]] = []
    quality: Dict[str, Any] = {}


class MlTrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    algorithm: str = "XGBoost"


class ChatRequest(BaseModel):
    prompt: str
    dataset_id: str


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "agents": list(AGENT_REGISTRY.keys()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    filename = file.filename or "dataset.csv"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content = await file.read()

    try:
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(content))
            fmt = "CSV"
        elif ext == "json":
            df = pd.read_json(io.BytesIO(content))
            fmt = "JSON"
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(content))
            fmt = "Excel"
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {exc}") from exc

    dataset_id = f"ds_{int(time.time())}"
    DATASET_STORE[dataset_id] = df
    DUCKDB_CONN.register(dataset_id, df)

    missing_cells = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())
    total_cells = max(1, int(df.shape[0] * df.shape[1]))
    completeness = max(0, round((1 - missing_cells / total_cells) * 100))
    uniqueness = max(0, round((1 - duplicate_rows / max(1, len(df))) * 100))
    overall = round(completeness * 0.4 + uniqueness * 0.3 + 95 * 0.3)

    schema = []
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        col_type = "float" if "float" in dtype_str else "integer" if "int" in dtype_str else "boolean" if "bool" in dtype_str else "string"
        schema.append(
            {
                "name": str(col),
                "type": col_type,
                "missingCount": int(df[col].isna().sum()),
                "uniqueCount": int(df[col].nunique(dropna=True)),
                "sampleValues": df[col].dropna().head(3).tolist(),
            }
        )

    rows = df.head(200).replace({np.nan: None}).to_dict(orient="records")

    return {
        "dataset": {
            "id": dataset_id,
            "name": filename.rsplit(".", 1)[0],
            "fileName": filename,
            "format": fmt,
            "sizeBytes": len(content),
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "rowCount": int(df.shape[0]),
            "columnCount": int(df.shape[1]),
            "schema": schema,
            "rows": rows,
            "quality": {
                "overallScore": overall,
                "completeness": completeness,
                "uniqueness": uniqueness,
                "validity": 98,
                "consistency": 95,
                "missingCells": missing_cells,
                "duplicateRows": duplicate_rows,
                "outlierCount": 0,
                "typeMismatchCount": 0,
            },
            "source": "uploaded",
        }
    }


@app.post("/api/agents/sql/execute")
def execute_sql(payload: SqlExecuteRequest):
    if payload.dataset_id not in DATASET_STORE:
        raise HTTPException(status_code=404, detail="Dataset not registered in DuckDB session.")
    start = time.perf_counter()
    try:
        res_df = DUCKDB_CONN.execute(payload.sql).fetchdf()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    return {
        "columns": [str(c) for c in res_df.columns],
        "rows": res_df.head(100).replace({np.nan: None}).to_dict(orient="records"),
        "executionTimeMs": elapsed_ms,
        "rowCount": int(len(res_df)),
        "isMocked": False,
    }


@app.post("/api/agents/sql/generate")
def generate_sql(payload: SqlGenerateRequest):
    cols = ", ".join([c.get("name", "") for c in payload.columns[:5]]) or "*"
    table_name = payload.dataset_id.replace("-", "_")
    return {
        "sql": f"SELECT {cols}\nFROM {table_name}\nLIMIT 20;",
        "explanation": f"Generated via FastAPI SQL stub for prompt: {payload.prompt}",
    }
