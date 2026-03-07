# ModelGuru Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Databricks App that takes business questions as input and outputs a deployable Metric View YAML semantic model for Genie spaces.

**Architecture:** 6-step wizard flow. FastAPI backend calls Claude Sonnet 4.6 via Foundation Model API for NLP (parse questions, score tables, map columns) and Unity Catalog SDK for metadata discovery and deployment. React frontend with shadcn/ui and React Flow for ERD visualization. No persistence — all state in React context.

**Tech Stack:** APX (FastAPI + React/Vite), databricks-sdk, Foundation Model API (databricks-claude-sonnet-4-6), @xyflow/react, react-dropzone, shadcn/ui

**Design Doc:** `docs/plans/2026-03-07-model-guru-design.md`

---

### Task 1: Initialize APX Project

**Step 1: Scaffold the APX project**

```bash
cd /Users/jonathan.whiteley/Desktop/Databricks_Apps/projects/model-guru
uvx --from git+https://github.com/databricks-solutions/apx.git apx init
```

When prompted:
- App name: `ModelGuru`
- App slug: `model_guru`

**Step 2: Install additional Python dependencies**

Add to `pyproject.toml` under `[project.dependencies]`:
- `openai` (Foundation Model API uses OpenAI-compatible interface)
- `openpyxl` (xlsx parsing)
- `pyyaml` (YAML generation)

```bash
cd /Users/jonathan.whiteley/Desktop/Databricks_Apps/projects/model-guru
uv add openai openpyxl pyyaml
```

**Step 3: Install additional frontend dependencies**

```bash
cd /Users/jonathan.whiteley/Desktop/Databricks_Apps/projects/model-guru/ui
bun add @xyflow/react react-dropzone
```

**Step 4: Install shadcn components**

Use APX MCP tool `add_component` to install:
- button, card, badge, skeleton, select, input, textarea, label, separator, progress, tabs, checkbox, scroll-area, alert, dropdown-menu

**Step 5: Start the dev server**

```bash
# Use APX MCP: start
```

Verify both backend and frontend are running.

**Step 6: Commit**

```bash
git init && git add -A && git commit -m "chore: initialize APX project with dependencies"
```

---

### Task 2: Backend — Pydantic Models

**Files:**
- Create: `src/model_guru/models.py`

**Step 1: Create all Pydantic models**

```python
from __future__ import annotations
from pydantic import BaseModel
from typing import Literal


# --- Parse Questions ---

class Highlight(BaseModel):
    text: str
    type: Literal["measure", "dimension", "filter"]
    start: int
    end: int


class ParsedQuestion(BaseModel):
    original_text: str
    highlights: list[Highlight]


class ExtractedEntity(BaseModel):
    name: str
    type: Literal["measure", "dimension", "filter"]
    inferred_column: str
    source_questions: list[int]


class ParseQuestionsRequest(BaseModel):
    questions: list[str]


class ParseQuestionsResponse(BaseModel):
    parsed_questions: list[ParsedQuestion]
    entities: list[ExtractedEntity]


# --- Discover Tables ---

class ColumnMatch(BaseModel):
    entity_name: str
    catalog_column: str
    confidence: float


class TableSuggestion(BaseModel):
    table_name: str
    description: str
    confidence: float
    matched_columns: list[ColumnMatch]


class DiscoverTablesRequest(BaseModel):
    catalog: str
    entities: list[ExtractedEntity]


class DiscoverTablesResponse(BaseModel):
    tables: list[TableSuggestion]


# --- Map Columns ---

class ColumnMapping(BaseModel):
    entity_name: str
    entity_type: Literal["measure", "dimension", "filter"]
    table: str
    column: str
    aggregation: str | None = None
    confidence: float


class MapColumnsRequest(BaseModel):
    entities: list[ExtractedEntity]
    selected_tables: list[str]


class MapColumnsResponse(BaseModel):
    mappings: list[ColumnMapping]


# --- Generate Metric View ---

class ConfirmedMapping(BaseModel):
    entity_name: str
    entity_type: Literal["measure", "dimension", "filter"]
    table: str
    column: str
    aggregation: str | None = None


class JoinSpec(BaseModel):
    name: str
    source: str
    on_expr: str


class DimensionSpec(BaseModel):
    name: str
    expr: str
    comment: str | None = None


class MeasureSpec(BaseModel):
    name: str
    expr: str
    comment: str | None = None


class ERDNode(BaseModel):
    id: str
    table_name: str
    columns: list[str]


class ERDEdge(BaseModel):
    source: str
    target: str
    source_column: str
    target_column: str


class ERDSpec(BaseModel):
    nodes: list[ERDNode]
    edges: list[ERDEdge]


class GenerateMetricViewRequest(BaseModel):
    confirmed_mappings: list[ConfirmedMapping]
    source_table: str
    view_name: str


class GenerateMetricViewResponse(BaseModel):
    yaml: str
    erd: ERDSpec


# --- Deploy Metric View ---

class DeployMetricViewRequest(BaseModel):
    catalog: str
    schema_name: str
    view_name: str
    yaml: str


class DeployMetricViewResponse(BaseModel):
    success: bool
    message: str


# --- Catalogs ---

class CatalogListResponse(BaseModel):
    catalogs: list[str]
```

**Step 2: Commit**

```bash
git add src/model_guru/models.py && git commit -m "feat: add Pydantic models for all API endpoints"
```

---

### Task 3: Backend — LLM Client

**Files:**
- Create: `src/model_guru/llm.py`

**Step 1: Create Foundation Model API client**

Uses the OpenAI-compatible interface that Databricks Foundation Model API provides.

```python
from __future__ import annotations
import json
import os
from openai import OpenAI


def get_llm_client() -> OpenAI:
    """Get OpenAI client configured for Databricks Foundation Model API."""
    host = os.environ.get("DATABRICKS_HOST", "")
    token = os.environ.get("DATABRICKS_TOKEN", "")
    return OpenAI(
        base_url=f"{host}/serving-endpoints",
        api_key=token,
    )


def call_llm(system_prompt: str, user_prompt: str) -> dict:
    """Call Claude Sonnet 4.6 via Foundation Model API and parse JSON response."""
    client = get_llm_client()
    response = client.chat.completions.create(
        model="databricks-claude-sonnet-4-6",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=4096,
    )
    content = response.choices[0].message.content or "{}"
    # Strip markdown code fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(content)
```

**Step 2: Commit**

```bash
git add src/model_guru/llm.py && git commit -m "feat: add Foundation Model API LLM client"
```

---

### Task 4: Backend — Parse Questions Route

**Files:**
- Create: `src/model_guru/routers/parse.py`
- Modify: `src/model_guru/app.py` (register router)

**Step 1: Create the parse questions router**

```python
from __future__ import annotations
import io
import csv
from fastapi import APIRouter, UploadFile, File
from openpyxl import load_workbook

from ..models import (
    ParseQuestionsRequest,
    ParseQuestionsResponse,
    ParsedQuestion,
    Highlight,
    ExtractedEntity,
)
from ..llm import call_llm

router = APIRouter(prefix="/api")

PARSE_SYSTEM_PROMPT = """You are a data analyst expert. Given a list of business questions, extract all measures, dimensions, and filters from each question.

Rules:
- A MEASURE is an aggregatable numeric value (e.g., "net sales", "units sold", "gross margin")
- A DIMENSION is a categorical attribute used for grouping (e.g., "region", "category", "store")
- A FILTER is a constraint or time range (e.g., "last month", "west region", "store 123")

For each question, identify every measure, dimension, and filter mention with its exact character positions (start, end) in the original text.

Also provide a deduplicated list of unique entities across all questions, with an inferred database column name for each.

Respond with JSON in this exact format:
{
  "parsed_questions": [
    {
      "original_text": "the question text",
      "highlights": [
        {"text": "net sales", "type": "measure", "start": 10, "end": 19},
        {"text": "category", "type": "dimension", "start": 23, "end": 31},
        {"text": "last month", "type": "filter", "start": 32, "end": 42}
      ]
    }
  ],
  "entities": [
    {"name": "Net Sales", "type": "measure", "inferred_column": "net_sales_amt", "source_questions": [0]},
    {"name": "Category", "type": "dimension", "inferred_column": "category", "source_questions": [0]}
  ]
}

Be precise with character positions. Zero-indexed. The "text" field must exactly match the substring at [start:end] in original_text."""


@router.post("/parse-questions", response_model=ParseQuestionsResponse, operation_id="parseQuestions")
async def parse_questions(request: ParseQuestionsRequest) -> ParseQuestionsResponse:
    """Parse business questions to extract measures, dimensions, and filters."""
    questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(request.questions))
    result = call_llm(PARSE_SYSTEM_PROMPT, f"Business questions:\n{questions_text}")

    parsed_questions = [
        ParsedQuestion(
            original_text=pq["original_text"],
            highlights=[Highlight(**h) for h in pq["highlights"]],
        )
        for pq in result["parsed_questions"]
    ]

    entities = [ExtractedEntity(**e) for e in result["entities"]]

    return ParseQuestionsResponse(parsed_questions=parsed_questions, entities=entities)


@router.post("/upload-questions", response_model=ParseQuestionsResponse, operation_id="uploadQuestions")
async def upload_questions(file: UploadFile = File(...)) -> ParseQuestionsResponse:
    """Upload an xlsx or csv file of business questions and parse them."""
    content = await file.read()
    questions: list[str] = []

    if file.filename and file.filename.endswith(".xlsx"):
        wb = load_workbook(filename=io.BytesIO(content), read_only=True)
        ws = wb.active
        if ws:
            for row in ws.iter_rows(values_only=True):
                for cell in row:
                    if cell and isinstance(cell, str) and cell.strip():
                        questions.append(cell.strip())
    else:
        text = content.decode("utf-8")
        reader = csv.reader(io.StringIO(text))
        for row in reader:
            for cell in row:
                if cell.strip():
                    questions.append(cell.strip())

    request = ParseQuestionsRequest(questions=questions)
    return await parse_questions(request)
```

**Step 2: Register the router in app.py**

Add to `src/model_guru/app.py`:
```python
from .routers.parse import router as parse_router
app.include_router(parse_router)
```

**Step 3: Run type check**

```bash
# Use APX MCP: check
```

**Step 4: Commit**

```bash
git add src/model_guru/routers/parse.py src/model_guru/app.py && git commit -m "feat: add parse-questions and upload-questions endpoints"
```

---

### Task 5: Backend — Discover Tables Route

**Files:**
- Create: `src/model_guru/routers/discover.py`
- Modify: `src/model_guru/app.py` (register router)

**Step 1: Create the discover tables router**

```python
from __future__ import annotations
import os
from fastapi import APIRouter
from databricks.sdk import WorkspaceClient

from ..models import (
    CatalogListResponse,
    DiscoverTablesRequest,
    DiscoverTablesResponse,
    TableSuggestion,
    ColumnMatch,
    ExtractedEntity,
)
from ..llm import call_llm

router = APIRouter(prefix="/api")

SCORE_SYSTEM_PROMPT = """You are a data engineer. Given a list of business entities (measures, dimensions, filters) and a set of database tables with their columns, score how relevant each table is to answering business questions about these entities.

For each table, provide:
- confidence: 0-100 score of how likely this table is needed
- description: brief explanation of what this table contains and why it's relevant
- matched_columns: for each entity, which column in this table could be used

Respond with JSON:
{
  "tables": [
    {
      "table_name": "catalog.schema.table",
      "description": "Brief description of table purpose",
      "confidence": 95,
      "matched_columns": [
        {"entity_name": "Net Sales", "catalog_column": "net_sales_amt", "confidence": 90}
      ]
    }
  ]
}

Only include tables with confidence > 50. Sort by confidence descending."""


def get_workspace_client() -> WorkspaceClient:
    return WorkspaceClient(
        host=os.environ.get("DATABRICKS_HOST", ""),
        token=os.environ.get("DATABRICKS_TOKEN", ""),
    )


@router.get("/catalogs", response_model=CatalogListResponse, operation_id="listCatalogs")
async def list_catalogs() -> CatalogListResponse:
    """List available Unity Catalog catalogs."""
    ws = get_workspace_client()
    catalogs = [c.name for c in ws.catalogs.list() if c.name]
    return CatalogListResponse(catalogs=catalogs)


@router.post("/discover-tables", response_model=DiscoverTablesResponse, operation_id="discoverTables")
async def discover_tables(request: DiscoverTablesRequest) -> DiscoverTablesResponse:
    """Search Unity Catalog for tables relevant to the extracted entities."""
    ws = get_workspace_client()

    # Collect all table metadata across all schemas in the catalog
    table_metadata: list[dict] = []
    for schema in ws.schemas.list(catalog_name=request.catalog):
        if not schema.name or schema.name.startswith("__"):
            continue
        try:
            for table in ws.tables.list(catalog_name=request.catalog, schema_name=schema.name):
                if not table.full_name:
                    continue
                columns = []
                if table.columns:
                    columns = [
                        {"name": c.name, "type": str(c.type_name), "comment": c.comment or ""}
                        for c in table.columns
                        if c.name
                    ]
                table_metadata.append({
                    "full_name": table.full_name,
                    "comment": table.comment or "",
                    "columns": columns,
                })
        except Exception:
            continue

    # Format entities for the LLM
    entities_text = "\n".join(
        f"- {e.name} ({e.type}), inferred column: {e.inferred_column}"
        for e in request.entities
    )

    # Format table metadata for the LLM (chunked if needed)
    tables_text = ""
    for t in table_metadata:
        cols = ", ".join(f"{c['name']} ({c['type']})" for c in t["columns"][:30])
        tables_text += f"\nTable: {t['full_name']}\n  Comment: {t['comment']}\n  Columns: {cols}\n"

    result = call_llm(
        SCORE_SYSTEM_PROMPT,
        f"Business entities:\n{entities_text}\n\nAvailable tables:\n{tables_text}",
    )

    tables = [
        TableSuggestion(
            table_name=t["table_name"],
            description=t["description"],
            confidence=t["confidence"],
            matched_columns=[ColumnMatch(**mc) for mc in t.get("matched_columns", [])],
        )
        for t in result.get("tables", [])
    ]

    return DiscoverTablesResponse(tables=tables)
```

**Step 2: Register the router in app.py**

```python
from .routers.discover import router as discover_router
app.include_router(discover_router)
```

**Step 3: Run type check, commit**

```bash
git add src/model_guru/routers/discover.py src/model_guru/app.py && git commit -m "feat: add catalog listing and table discovery endpoints"
```

---

### Task 6: Backend — Map Columns Route

**Files:**
- Create: `src/model_guru/routers/mapping.py`
- Modify: `src/model_guru/app.py` (register router)

**Step 1: Create the column mapping router**

```python
from __future__ import annotations
import os
from fastapi import APIRouter
from databricks.sdk import WorkspaceClient

from ..models import (
    MapColumnsRequest,
    MapColumnsResponse,
    ColumnMapping,
)
from ..llm import call_llm

router = APIRouter(prefix="/api")

MAP_SYSTEM_PROMPT = """You are a data engineer. Given business entities (measures, dimensions, filters) and detailed column information for selected tables, suggest the best column mapping for each entity.

For measures, also suggest the appropriate aggregation function (SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT).

For dimensions and filters, set aggregation to null.

If a measure requires a calculated expression (e.g., net_sales = gross_sales - returns), note this in the column field as the full expression.

Respond with JSON:
{
  "mappings": [
    {
      "entity_name": "Net Sales",
      "entity_type": "measure",
      "table": "catalog.schema.sales_fact",
      "column": "net_sales_amt",
      "aggregation": "SUM",
      "confidence": 95
    },
    {
      "entity_name": "Region",
      "entity_type": "dimension",
      "table": "catalog.schema.dim_store",
      "column": "region_name",
      "aggregation": null,
      "confidence": 90
    }
  ]
}"""


@router.post("/map-columns", response_model=MapColumnsResponse, operation_id="mapColumns")
async def map_columns(request: MapColumnsRequest) -> MapColumnsResponse:
    """Suggest column mappings for entities from selected tables."""
    ws = WorkspaceClient(
        host=os.environ.get("DATABRICKS_HOST", ""),
        token=os.environ.get("DATABRICKS_TOKEN", ""),
    )

    # Fetch detailed column info for selected tables
    tables_detail: list[dict] = []
    for table_name in request.selected_tables:
        parts = table_name.split(".")
        if len(parts) != 3:
            continue
        try:
            table_info = ws.tables.get(full_name=table_name)
            columns = []
            if table_info.columns:
                columns = [
                    {"name": c.name, "type": str(c.type_name), "comment": c.comment or ""}
                    for c in table_info.columns
                    if c.name
                ]
            tables_detail.append({
                "full_name": table_name,
                "comment": table_info.comment or "",
                "columns": columns,
            })
        except Exception:
            continue

    entities_text = "\n".join(
        f"- {e.name} ({e.type}), inferred column: {e.inferred_column}"
        for e in request.entities
    )

    tables_text = ""
    for t in tables_detail:
        cols = "\n    ".join(f"- {c['name']} ({c['type']}): {c['comment']}" for c in t["columns"])
        tables_text += f"\nTable: {t['full_name']}\n  Comment: {t['comment']}\n  Columns:\n    {cols}\n"

    result = call_llm(
        MAP_SYSTEM_PROMPT,
        f"Business entities:\n{entities_text}\n\nSelected tables with columns:\n{tables_text}",
    )

    mappings = [ColumnMapping(**m) for m in result.get("mappings", [])]
    return MapColumnsResponse(mappings=mappings)
```

**Step 2: Register router, type check, commit**

```bash
git add src/model_guru/routers/mapping.py src/model_guru/app.py && git commit -m "feat: add column mapping endpoint"
```

---

### Task 7: Backend — Generate Metric View Route

**Files:**
- Create: `src/model_guru/routers/generate.py`
- Modify: `src/model_guru/app.py` (register router)

**Step 1: Create the YAML generation router**

This is pure logic — no LLM call. Builds the Metric View YAML from confirmed mappings.

```python
from __future__ import annotations
import yaml
from fastapi import APIRouter

from ..models import (
    GenerateMetricViewRequest,
    GenerateMetricViewResponse,
    ERDSpec,
    ERDNode,
    ERDEdge,
    JoinSpec,
)

router = APIRouter(prefix="/api")


def build_metric_view_yaml(request: GenerateMetricViewRequest) -> str:
    """Build a Metric View YAML from confirmed mappings."""
    # Group mappings by table
    tables_used: dict[str, list] = {}
    for m in request.confirmed_mappings:
        tables_used.setdefault(m.table, []).append(m)

    # Determine source table (the one with the most measure mappings, or first)
    source_table = request.source_table

    # Build joins for non-source tables
    joins = []
    for table_name in tables_used:
        if table_name == source_table:
            continue
        # Create a join alias from the table name
        alias = table_name.split(".")[-1]
        # Infer join condition — will need user confirmation in the UI
        joins.append({
            "name": alias,
            "source": table_name,
            "on": f"source.{alias}_id = {alias}.id",
        })

    # Build dimensions
    dimensions = []
    for m in request.confirmed_mappings:
        if m.entity_type == "dimension":
            table_alias = m.table.split(".")[-1] if m.table != source_table else "source"
            expr = f"{table_alias}.{m.column}" if m.table != source_table else m.column
            dimensions.append({"name": m.entity_name, "expr": expr})

    # Build measures
    measures = []
    for m in request.confirmed_mappings:
        if m.entity_type == "measure":
            table_alias = m.table.split(".")[-1] if m.table != source_table else "source"
            col_ref = f"{table_alias}.{m.column}" if m.table != source_table else m.column
            agg = m.aggregation or "SUM"
            expr = f"{agg}({col_ref})"
            measures.append({"name": m.entity_name, "expr": expr})

    # Build YAML structure
    mv: dict = {
        "version": "1.1",
        "comment": f"Metric view for {request.view_name}",
        "source": source_table,
    }

    if joins:
        mv["joins"] = joins
    mv["dimensions"] = dimensions
    mv["measures"] = measures

    return yaml.dump(mv, default_flow_style=False, sort_keys=False, allow_unicode=True)


def build_erd(request: GenerateMetricViewRequest) -> ERDSpec:
    """Build ERD nodes and edges from confirmed mappings."""
    tables_used: dict[str, list[str]] = {}
    for m in request.confirmed_mappings:
        tables_used.setdefault(m.table, []).append(m.column)

    nodes = [
        ERDNode(id=table_name, table_name=table_name, columns=list(set(cols)))
        for table_name, cols in tables_used.items()
    ]

    # Infer edges between tables (simplified — joins from source to dimension tables)
    source_table = request.source_table
    edges = []
    for table_name in tables_used:
        if table_name != source_table:
            alias = table_name.split(".")[-1]
            edges.append(ERDEdge(
                source=source_table,
                target=table_name,
                source_column=f"{alias}_id",
                target_column="id",
            ))

    return ERDSpec(nodes=nodes, edges=edges)


@router.post("/generate-metric-view", response_model=GenerateMetricViewResponse, operation_id="generateMetricView")
async def generate_metric_view(request: GenerateMetricViewRequest) -> GenerateMetricViewResponse:
    """Generate Metric View YAML and ERD from confirmed mappings."""
    yaml_content = build_metric_view_yaml(request)
    erd = build_erd(request)
    return GenerateMetricViewResponse(yaml=yaml_content, erd=erd)
```

**Step 2: Register router, type check, commit**

```bash
git add src/model_guru/routers/generate.py src/model_guru/app.py && git commit -m "feat: add metric view YAML generation endpoint"
```

---

### Task 8: Backend — Deploy Metric View Route

**Files:**
- Create: `src/model_guru/routers/deploy.py`
- Modify: `src/model_guru/app.py` (register router)

**Step 1: Create the deploy router**

```python
from __future__ import annotations
import os
from fastapi import APIRouter
from databricks.sdk import WorkspaceClient

from ..models import DeployMetricViewRequest, DeployMetricViewResponse

router = APIRouter(prefix="/api")


@router.post("/deploy-metric-view", response_model=DeployMetricViewResponse, operation_id="deployMetricView")
async def deploy_metric_view(request: DeployMetricViewRequest) -> DeployMetricViewResponse:
    """Deploy a Metric View to Unity Catalog."""
    ws = WorkspaceClient(
        host=os.environ.get("DATABRICKS_HOST", ""),
        token=os.environ.get("DATABRICKS_TOKEN", ""),
    )

    full_name = f"{request.catalog}.{request.schema_name}.{request.view_name}"
    sql = f"CREATE OR REPLACE VIEW {full_name}\nWITH METRICS\nLANGUAGE YAML\nAS $$\n{request.yaml}\n$$"

    try:
        # Get a warehouse to execute the SQL
        warehouses = list(ws.warehouses.list())
        if not warehouses:
            return DeployMetricViewResponse(
                success=False,
                message="No SQL warehouses available to execute the deployment.",
            )

        warehouse_id = warehouses[0].id
        result = ws.statement_execution.execute_statement(
            warehouse_id=warehouse_id,
            statement=sql,
            wait_timeout="30s",
        )

        if result.status and result.status.state and result.status.state.value == "SUCCEEDED":
            return DeployMetricViewResponse(
                success=True,
                message=f"Metric view '{full_name}' created successfully.",
            )
        else:
            error_msg = ""
            if result.status and result.status.error:
                error_msg = result.status.error.message or "Unknown error"
            return DeployMetricViewResponse(
                success=False,
                message=f"Deployment failed: {error_msg}",
            )
    except Exception as e:
        return DeployMetricViewResponse(
            success=False,
            message=f"Deployment error: {str(e)}",
        )
```

**Step 2: Register router, run full type check**

```bash
# Use APX MCP: check
```

**Step 3: Commit**

```bash
git add src/model_guru/routers/deploy.py src/model_guru/app.py && git commit -m "feat: add metric view deployment endpoint"
```

**Step 4: Refresh OpenAPI client**

```bash
# Use APX MCP: refresh_openapi
```

Wait for frontend API client to regenerate.

---

### Task 9: Frontend — Wizard Framework & Context

**Files:**
- Create: `ui/src/lib/wizard-context.tsx`
- Create: `ui/src/components/wizard/WizardShell.tsx`
- Modify: `ui/src/routes/_sidebar/route.tsx` (update nav)

**Step 1: Create the wizard context**

This holds all state for the 6-step wizard flow.

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";

export type WizardStep = "input" | "parse" | "discover" | "map" | "review" | "deploy";

export interface Highlight {
  text: string;
  type: "measure" | "dimension" | "filter";
  start: number;
  end: number;
}

export interface ParsedQuestion {
  original_text: string;
  highlights: Highlight[];
}

export interface ExtractedEntity {
  name: string;
  type: "measure" | "dimension" | "filter";
  inferred_column: string;
  source_questions: number[];
}

export interface TableSuggestion {
  table_name: string;
  description: string;
  confidence: number;
  matched_columns: { entity_name: string; catalog_column: string; confidence: number }[];
}

export interface ColumnMapping {
  entity_name: string;
  entity_type: "measure" | "dimension" | "filter";
  table: string;
  column: string;
  aggregation: string | null;
  confidence: number;
}

export interface ConfirmedMapping {
  entity_name: string;
  entity_type: "measure" | "dimension" | "filter";
  table: string;
  column: string;
  aggregation: string | null;
}

export interface ERDNode {
  id: string;
  table_name: string;
  columns: string[];
}

export interface ERDEdge {
  source: string;
  target: string;
  source_column: string;
  target_column: string;
}

interface WizardState {
  step: WizardStep;
  questions: string[];
  parsedQuestions: ParsedQuestion[];
  entities: ExtractedEntity[];
  selectedCatalog: string;
  tables: TableSuggestion[];
  selectedTables: string[];
  mappings: ColumnMapping[];
  confirmedMappings: ConfirmedMapping[];
  sourceTable: string;
  yaml: string;
  erdNodes: ERDNode[];
  erdEdges: ERDEdge[];
  deployResult: { success: boolean; message: string } | null;
}

interface WizardActions {
  setStep: (step: WizardStep) => void;
  setQuestions: (questions: string[]) => void;
  setParsedQuestions: (pq: ParsedQuestion[]) => void;
  setEntities: (entities: ExtractedEntity[]) => void;
  setSelectedCatalog: (catalog: string) => void;
  setTables: (tables: TableSuggestion[]) => void;
  setSelectedTables: (tables: string[]) => void;
  setMappings: (mappings: ColumnMapping[]) => void;
  setConfirmedMappings: (mappings: ConfirmedMapping[]) => void;
  setSourceTable: (table: string) => void;
  setYaml: (yaml: string) => void;
  setErd: (nodes: ERDNode[], edges: ERDEdge[]) => void;
  setDeployResult: (result: { success: boolean; message: string } | null) => void;
  reset: () => void;
}

const INITIAL_STATE: WizardState = {
  step: "input",
  questions: [],
  parsedQuestions: [],
  entities: [],
  selectedCatalog: "",
  tables: [],
  selectedTables: [],
  mappings: [],
  confirmedMappings: [],
  sourceTable: "",
  yaml: "",
  erdNodes: [],
  erdEdges: [],
  deployResult: null,
};

const WizardContext = createContext<(WizardState & WizardActions) | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const actions: WizardActions = {
    setStep: (step) => setState((s) => ({ ...s, step })),
    setQuestions: (questions) => setState((s) => ({ ...s, questions })),
    setParsedQuestions: (parsedQuestions) => setState((s) => ({ ...s, parsedQuestions })),
    setEntities: (entities) => setState((s) => ({ ...s, entities })),
    setSelectedCatalog: (selectedCatalog) => setState((s) => ({ ...s, selectedCatalog })),
    setTables: (tables) => setState((s) => ({ ...s, tables })),
    setSelectedTables: (selectedTables) => setState((s) => ({ ...s, selectedTables })),
    setMappings: (mappings) => setState((s) => ({ ...s, mappings })),
    setConfirmedMappings: (confirmedMappings) => setState((s) => ({ ...s, confirmedMappings })),
    setSourceTable: (sourceTable) => setState((s) => ({ ...s, sourceTable })),
    setYaml: (yaml) => setState((s) => ({ ...s, yaml })),
    setErd: (nodes, edges) => setState((s) => ({ ...s, erdNodes: nodes, erdEdges: edges })),
    setDeployResult: (deployResult) => setState((s) => ({ ...s, deployResult })),
    reset: () => setState(INITIAL_STATE),
  };

  return (
    <WizardContext.Provider value={{ ...state, ...actions }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
```

**Step 2: Create the WizardShell component**

```tsx
// ui/src/components/wizard/WizardShell.tsx
import { useWizard, type WizardStep } from "@/lib/wizard-context";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "input", label: "Input Questions" },
  { key: "parse", label: "Parse & Highlight" },
  { key: "discover", label: "Discover Tables" },
  { key: "map", label: "Map Columns" },
  { key: "review", label: "Review" },
  { key: "deploy", label: "Deploy" },
];

export function WizardShell({ children }: { children: React.ReactNode }) {
  const { step } = useWizard();
  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">ModelGuru</h1>
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  i < currentIndex
                    ? "bg-green-600 text-white"
                    : i === currentIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < currentIndex ? "✓" : i + 1}
              </div>
              <span
                className={`text-sm hidden md:inline ${
                  i === currentIndex ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px ${i < currentIndex ? "bg-green-600" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add ui/src/lib/wizard-context.tsx ui/src/components/wizard/WizardShell.tsx && git commit -m "feat: add wizard context and shell component"
```

---

### Task 10: Frontend — Step 1: Question Input

**Files:**
- Create: `ui/src/components/wizard/StepInput.tsx`

**Step 1: Build the question input component**

```tsx
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useWizard } from "@/lib/wizard-context";
import { useParseQuestions, useUploadQuestions } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function StepInput() {
  const { setStep, setQuestions, setParsedQuestions, setEntities } = useWizard();
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parseQuestions = useParseQuestions();

  const handleParse = async () => {
    const questions = text
      .split("\n")
      .map((q) => q.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter(Boolean);

    if (questions.length === 0) {
      setError("Please enter at least one question.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await parseQuestions.mutateAsync({ data: { questions } });
      setQuestions(questions);
      setParsedQuestions(result.data.parsed_questions);
      setEntities(result.data.entities);
      setStep("parse");
    } catch (e) {
      setError("Failed to parse questions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);

        // Manual fetch for file upload since generated hooks don't support multipart
        const response = await fetch("/api/upload-questions", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");

        const result = await response.json();
        const questions = result.parsed_questions.map((pq: any) => pq.original_text);
        setQuestions(questions);
        setParsedQuestions(result.parsed_questions);
        setEntities(result.entities);
        setStep("parse");
      } catch (e) {
        setError("Failed to upload and parse file. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [setQuestions, setParsedQuestions, setEntities, setStep],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enter Your Business Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={"What were net sales by category last month?\nHow many weekly units sold in west region?\nShow Y over Y performance of store 123 over last 12 months"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <Button onClick={handleParse} disabled={isLoading || !text.trim()}>
            {isLoading ? "Analyzing questions..." : "Analyze Questions"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-muted-foreground">
              {isDragActive
                ? "Drop the file here..."
                : "Drag & drop a CSV or XLSX file here, or click to select"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              One question per row
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/wizard/StepInput.tsx && git commit -m "feat: add wizard step 1 - question input with paste and file upload"
```

---

### Task 11: Frontend — Step 2: Parse & Highlight

**Files:**
- Create: `ui/src/components/wizard/StepParse.tsx`

**Step 1: Build the parse results component**

Shows highlighted questions and deduplicated entity table. Colors: green=measure, blue=dimension, gray=filter.

```tsx
import { useWizard } from "@/lib/wizard-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TYPE_COLORS = {
  measure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  dimension: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  filter: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const HIGHLIGHT_BG = {
  measure: "bg-green-200/50 dark:bg-green-800/30",
  dimension: "bg-blue-200/50 dark:bg-blue-800/30",
  filter: "bg-gray-200/50 dark:bg-gray-800/30",
};

function HighlightedText({ text, highlights }: { text: string; highlights: { text: string; type: "measure" | "dimension" | "filter"; start: number; end: number }[] }) {
  if (!highlights.length) return <span>{text}</span>;

  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  sorted.forEach((h, i) => {
    if (h.start > lastEnd) {
      parts.push(<span key={`t-${i}`}>{text.slice(lastEnd, h.start)}</span>);
    }
    parts.push(
      <span key={`h-${i}`} className={`px-1 rounded ${HIGHLIGHT_BG[h.type]}`}>
        {text.slice(h.start, h.end)}
      </span>
    );
    lastEnd = h.end;
  });

  if (lastEnd < text.length) {
    parts.push(<span key="end">{text.slice(lastEnd)}</span>);
  }

  return <span>{parts}</span>;
}

export function StepParse() {
  const { parsedQuestions, entities, setEntities, setStep } = useWizard();

  const removeEntity = (name: string) => {
    setEntities(entities.filter((e) => e.name !== name));
  };

  const groupedEntities = {
    measure: entities.filter((e) => e.type === "measure"),
    dimension: entities.filter((e) => e.type === "dimension"),
    filter: entities.filter((e) => e.type === "filter"),
  };

  return (
    <div className="space-y-6">
      {/* Highlighted Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Parsed Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {parsedQuestions.map((pq, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-muted-foreground text-sm font-mono w-6 shrink-0">
                  {i + 1}.
                </span>
                <p className="text-sm">
                  <HighlightedText text={pq.original_text} highlights={pq.highlights} />
                </p>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <span className={`px-2 py-1 rounded ${HIGHLIGHT_BG.measure}`}>Measure</span>
            <span className={`px-2 py-1 rounded ${HIGHLIGHT_BG.dimension}`}>Dimension</span>
            <span className={`px-2 py-1 rounded ${HIGHLIGHT_BG.filter}`}>Filter</span>
          </div>
        </CardContent>
      </Card>

      {/* Entity Table */}
      {(["measure", "dimension", "filter"] as const).map((type) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge className={TYPE_COLORS[type]}>{type}s</Badge>
              <span className="text-sm text-muted-foreground">
                ({groupedEntities[type].length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Inferred Column</TableHead>
                  <TableHead>Source Questions</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedEntities[type].map((entity) => (
                  <TableRow key={entity.name}>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell className="font-mono text-sm">{entity.inferred_column}</TableCell>
                    <TableCell>
                      {entity.source_questions.map((q) => q + 1).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEntity(entity.name)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("input")}>
          Back
        </Button>
        <Button onClick={() => setStep("discover")} disabled={entities.length === 0}>
          Find Tables
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/wizard/StepParse.tsx && git commit -m "feat: add wizard step 2 - parse results with highlighting and entity table"
```

---

### Task 12: Frontend — Step 3: Discover Tables

**Files:**
- Create: `ui/src/components/wizard/StepDiscover.tsx`

**Step 1: Build the table discovery component**

Shows catalog dropdown, then table suggestion cards with confidence scores and checkboxes.

```tsx
import { useState, useEffect } from "react";
import { useWizard } from "@/lib/wizard-context";
import { useListCatalogsSuspense, useDiscoverTables } from "@/lib/api";
import selector from "@/lib/selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

function CatalogSelector({ onSelect }: { onSelect: (catalog: string) => void }) {
  const { data } = useListCatalogsSuspense(selector());

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a catalog" />
      </SelectTrigger>
      <SelectContent>
        {data.catalogs.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 80) return "text-green-600";
  if (confidence >= 60) return "text-yellow-600";
  return "text-muted-foreground";
}

export function StepDiscover() {
  const {
    entities,
    tables,
    setTables,
    selectedTables,
    setSelectedTables,
    selectedCatalog,
    setSelectedCatalog,
    setStep,
  } = useWizard();
  const [isLoading, setIsLoading] = useState(false);
  const discoverTables = useDiscoverTables();

  const handleCatalogSelect = async (catalog: string) => {
    setSelectedCatalog(catalog);
    setIsLoading(true);
    try {
      const result = await discoverTables.mutateAsync({
        data: { catalog, entities },
      });
      setTables(result.data.tables);
      // Pre-select tables with >80% confidence
      const preSelected = result.data.tables
        .filter((t) => t.confidence > 80)
        .map((t) => t.table_name);
      setSelectedTables(preSelected);
    } catch (e) {
      console.error("Failed to discover tables:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTable = (tableName: string) => {
    setSelectedTables(
      selectedTables.includes(tableName)
        ? selectedTables.filter((t) => t !== tableName)
        : [...selectedTables, tableName]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Unity Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-10 w-64" />}>
            <CatalogSelector onSelect={handleCatalogSelect} />
          </Suspense>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-muted-foreground">Searching Unity Catalog for relevant tables...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && tables.length > 0 && (
        <>
          <h3 className="text-lg font-semibold">
            Possible Tables ({tables.length} found)
          </h3>
          <div className="space-y-3">
            {tables.map((table) => (
              <Card
                key={table.table_name}
                className={`cursor-pointer transition-colors ${
                  selectedTables.includes(table.table_name)
                    ? "border-primary"
                    : ""
                }`}
                onClick={() => toggleTable(table.table_name)}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <Checkbox
                    checked={selectedTables.includes(table.table_name)}
                    onCheckedChange={() => toggleTable(table.table_name)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium">
                        {table.table_name.split(".").pop()}
                      </span>
                      <Badge className={getConfidenceColor(table.confidence)}>
                        {Math.round(table.confidence)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {table.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {table.table_name}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("parse")}>
          Back
        </Button>
        <Button
          onClick={() => setStep("map")}
          disabled={selectedTables.length === 0}
        >
          Map Columns
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/wizard/StepDiscover.tsx && git commit -m "feat: add wizard step 3 - table discovery with confidence scores"
```

---

### Task 13: Frontend — Step 4: Map Columns

**Files:**
- Create: `ui/src/components/wizard/StepMap.tsx`

**Step 1: Build the column mapping component**

Fetches LLM-suggested mappings, lets user confirm/override via dropdowns.

```tsx
import { useState, useEffect } from "react";
import { useWizard } from "@/lib/wizard-context";
import { useMapColumns } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ConfirmedMapping } from "@/lib/wizard-context";

const AGGREGATIONS = ["SUM", "COUNT", "AVG", "MIN", "MAX", "COUNT_DISTINCT"];

const TYPE_COLORS = {
  measure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  dimension: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  filter: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export function StepMap() {
  const {
    entities,
    selectedTables,
    mappings,
    setMappings,
    setConfirmedMappings,
    setSourceTable,
    setStep,
  } = useWizard();
  const [isLoading, setIsLoading] = useState(false);
  const [localMappings, setLocalMappings] = useState<ConfirmedMapping[]>([]);
  const mapColumns = useMapColumns();

  useEffect(() => {
    const fetchMappings = async () => {
      setIsLoading(true);
      try {
        const result = await mapColumns.mutateAsync({
          data: { entities, selected_tables: selectedTables },
        });
        setMappings(result.data.mappings);
        // Initialize local mappings from LLM suggestions
        setLocalMappings(
          result.data.mappings.map((m) => ({
            entity_name: m.entity_name,
            entity_type: m.entity_type,
            table: m.table,
            column: m.column,
            aggregation: m.aggregation,
          }))
        );
      } catch (e) {
        console.error("Failed to map columns:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMappings();
  }, []);

  const updateMapping = (entityName: string, field: string, value: string) => {
    setLocalMappings((prev) =>
      prev.map((m) =>
        m.entity_name === entityName ? { ...m, [field]: value } : m
      )
    );
  };

  const handleNext = () => {
    setConfirmedMappings(localMappings);
    // Set source table as the first table with the most measure mappings
    const tableCounts: Record<string, number> = {};
    localMappings
      .filter((m) => m.entity_type === "measure")
      .forEach((m) => {
        tableCounts[m.table] = (tableCounts[m.table] || 0) + 1;
      });
    const source = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || selectedTables[0];
    setSourceTable(source);
    setStep("review");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-muted-foreground">Analyzing columns and suggesting mappings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirm Column Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Column</TableHead>
                <TableHead>Aggregation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localMappings.map((m) => (
                <TableRow key={m.entity_name}>
                  <TableCell className="font-medium">{m.entity_name}</TableCell>
                  <TableCell>
                    <Badge className={TYPE_COLORS[m.entity_type]}>
                      {m.entity_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={m.table}
                      onValueChange={(v) => updateMapping(m.entity_name, "table", v)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTables.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.split(".").pop()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <input
                      className="border rounded px-2 py-1 text-sm w-40 font-mono"
                      value={m.column}
                      onChange={(e) =>
                        updateMapping(m.entity_name, "column", e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {m.entity_type === "measure" ? (
                      <Select
                        value={m.aggregation || "SUM"}
                        onValueChange={(v) =>
                          updateMapping(m.entity_name, "aggregation", v)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGGREGATIONS.map((a) => (
                            <SelectItem key={a} value={a}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("discover")}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={localMappings.length === 0}>
          Generate Metric View
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/wizard/StepMap.tsx && git commit -m "feat: add wizard step 4 - column mapping with LLM suggestions"
```

---

### Task 14: Frontend — Step 5: Review (ERD + YAML)

**Files:**
- Create: `ui/src/components/wizard/StepReview.tsx`

**Step 1: Build the review component with React Flow ERD and YAML preview**

```tsx
import { useState, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWizard } from "@/lib/wizard-context";
import { useGenerateMetricView } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function TableNode({ data }: { data: { label: string; columns: string[] } }) {
  return (
    <div className="bg-card border rounded-lg shadow-sm min-w-[180px]">
      <div className="bg-primary text-primary-foreground px-3 py-2 rounded-t-lg font-medium text-sm">
        {data.label}
      </div>
      <div className="px-3 py-2 space-y-1">
        {data.columns.map((col) => (
          <div key={col} className="text-xs font-mono text-muted-foreground">
            {col}
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

export function StepReview() {
  const {
    confirmedMappings,
    sourceTable,
    yaml,
    setYaml,
    erdNodes,
    erdEdges,
    setErd,
    setStep,
  } = useWizard();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableYaml, setEditableYaml] = useState("");
  const generateMetricView = useGenerateMetricView();

  useEffect(() => {
    const generate = async () => {
      setIsLoading(true);
      try {
        const result = await generateMetricView.mutateAsync({
          data: {
            confirmed_mappings: confirmedMappings,
            source_table: sourceTable,
            view_name: "metric_view",
          },
        });
        setYaml(result.data.yaml);
        setEditableYaml(result.data.yaml);
        setErd(result.data.erd.nodes, result.data.erd.edges);
      } catch (e) {
        console.error("Failed to generate metric view:", e);
      } finally {
        setIsLoading(false);
      }
    };
    generate();
  }, []);

  // Convert ERD data to React Flow nodes/edges
  const flowNodes: Node[] = erdNodes.map((node, i) => ({
    id: node.id,
    type: "tableNode",
    position: { x: i * 280, y: Math.floor(i / 3) * 200 },
    data: {
      label: node.table_name.split(".").pop() || node.table_name,
      columns: node.columns,
    },
  }));

  const flowEdges: Edge[] = erdEdges.map((edge, i) => ({
    id: `e-${i}`,
    source: edge.source,
    target: edge.target,
    label: `${edge.source_column} → ${edge.target_column}`,
    type: "smoothstep",
  }));

  const handleSaveYaml = () => {
    setYaml(editableYaml);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-muted-foreground">Generating Metric View YAML...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ERD */}
      <Card>
        <CardHeader>
          <CardTitle>Entity Relationship Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] border rounded-lg">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      {/* YAML Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Metric View YAML</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (isEditing ? handleSaveYaml() : setIsEditing(true))}
            >
              {isEditing ? "Save" : "Edit"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <textarea
              className="w-full h-96 font-mono text-sm border rounded-lg p-4 bg-muted"
              value={editableYaml}
              onChange={(e) => setEditableYaml(e.target.value)}
            />
          ) : (
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono">
              {yaml}
            </pre>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("map")}>
          Back
        </Button>
        <Button onClick={() => setStep("deploy")}>
          Deploy to Databricks
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/wizard/StepReview.tsx && git commit -m "feat: add wizard step 5 - ERD visualization and YAML preview"
```

---

### Task 15: Frontend — Step 6: Deploy

**Files:**
- Create: `ui/src/components/wizard/StepDeploy.tsx`

**Step 1: Build the deploy component**

```tsx
import { useState } from "react";
import { useWizard } from "@/lib/wizard-context";
import { useDeployMetricView, useListCatalogsSuspense } from "@/lib/api";
import selector from "@/lib/selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function StepDeploy() {
  const { yaml, selectedCatalog, deployResult, setDeployResult, setStep, reset } = useWizard();
  const [catalog, setCatalog] = useState(selectedCatalog);
  const [schemaName, setSchemaName] = useState("");
  const [viewName, setViewName] = useState("metric_view");
  const [isDeploying, setIsDeploying] = useState(false);
  const deployMetricView = useDeployMetricView();

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const result = await deployMetricView.mutateAsync({
        data: {
          catalog,
          schema_name: schemaName,
          view_name: viewName,
          yaml,
        },
      });
      setDeployResult(result.data);
    } catch (e) {
      setDeployResult({
        success: false,
        message: "Failed to deploy. Please check your permissions and try again.",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      {!deployResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Deploy Metric View</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="catalog">Catalog</Label>
                <Input
                  id="catalog"
                  value={catalog}
                  onChange={(e) => setCatalog(e.target.value)}
                  placeholder="my_catalog"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schema">Schema</Label>
                <Input
                  id="schema"
                  value={schemaName}
                  onChange={(e) => setSchemaName(e.target.value)}
                  placeholder="my_schema"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="view">View Name</Label>
                <Input
                  id="view"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="metric_view"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Will create: <code className="font-mono">{catalog}.{schemaName}.{viewName}</code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Alert variant={deployResult.success ? "default" : "destructive"}>
          <AlertTitle>{deployResult.success ? "Deployment Successful" : "Deployment Failed"}</AlertTitle>
          <AlertDescription>{deployResult.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("review")}>
          Back
        </Button>
        {!deployResult ? (
          <Button
            onClick={handleDeploy}
            disabled={isDeploying || !catalog || !schemaName || !viewName}
          >
            {isDeploying ? "Deploying..." : "Deploy to Databricks"}
          </Button>
        ) : (
          <Button onClick={reset}>
            Start New Analysis
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/wizard/StepDeploy.tsx && git commit -m "feat: add wizard step 6 - deployment to Unity Catalog"
```

---

### Task 16: Frontend — Wire Up Wizard Route

**Files:**
- Create: `ui/src/routes/_sidebar/index.tsx` (or modify existing)
- Modify: `ui/src/routes/_sidebar/route.tsx` (update nav)

**Step 1: Create the main wizard page**

```tsx
// ui/src/routes/_sidebar/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { WizardProvider, useWizard } from "@/lib/wizard-context";
import { WizardShell } from "@/components/wizard/WizardShell";
import { StepInput } from "@/components/wizard/StepInput";
import { StepParse } from "@/components/wizard/StepParse";
import { StepDiscover } from "@/components/wizard/StepDiscover";
import { StepMap } from "@/components/wizard/StepMap";
import { StepReview } from "@/components/wizard/StepReview";
import { StepDeploy } from "@/components/wizard/StepDeploy";

function WizardContent() {
  const { step } = useWizard();

  return (
    <WizardShell>
      {step === "input" && <StepInput />}
      {step === "parse" && <StepParse />}
      {step === "discover" && <StepDiscover />}
      {step === "map" && <StepMap />}
      {step === "review" && <StepReview />}
      {step === "deploy" && <StepDeploy />}
    </WizardShell>
  );
}

export const Route = createFileRoute("/_sidebar/")({
  component: () => (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  ),
});
```

**Step 2: Update navigation in route.tsx**

Add to `navItems`:
```tsx
import { Wand2 } from "lucide-react";

const navItems = [
  {
    to: "/",
    label: "ModelGuru",
    icon: <Wand2 size={16} />,
    match: (path: string) => path === "/",
  },
];
```

**Step 3: Run type check**

```bash
# Use APX MCP: check
```

**Step 4: Commit**

```bash
git add ui/src/routes/_sidebar/index.tsx ui/src/routes/_sidebar/route.tsx && git commit -m "feat: wire up wizard route and navigation"
```

---

### Task 17: Test & Verify

**Step 1: Run full type check**

```bash
# Use APX MCP: check
```

Fix any type errors in both backend and frontend.

**Step 2: Start dev server and verify**

```bash
# Use APX MCP: start (or restart)
```

**Step 3: Test backend endpoints manually**

```bash
# Test parse endpoint
curl -X POST http://localhost:8000/api/parse-questions \
  -H "Content-Type: application/json" \
  -d '{"questions": ["What were net sales by category last month?"]}' | jq .

# Test catalogs endpoint
curl http://localhost:8000/api/catalogs | jq .
```

**Step 4: Verify frontend in browser**

- Navigate to the app URL
- Verify wizard step indicator renders
- Verify textarea and file upload zone on step 1
- Test pasting questions and proceeding through the flow

**Step 5: Check APX logs for errors**

```bash
# Use APX MCP: logs
```

**Step 6: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve type errors and integration issues"
```

---

### Task 18: Documentation

**Step 1: Create README.md**

Cover:
- What ModelGuru does (top-down question → metric view workflow)
- User journey (6 steps)
- Tech stack (APX, Foundation Model API, React Flow)
- How to run locally
- How to deploy to Databricks
- Environment variables needed (`DATABRICKS_HOST`, `DATABRICKS_TOKEN`)

**Step 2: Commit**

```bash
git add README.md && git commit -m "docs: add README with setup and usage instructions"
```
