# ModelGuru Design Document

**Date:** 2026-03-07
**Status:** Approved

## Goal

Shift Genie space creation from bottom-up (data -> questions) to top-down (questions -> data). Users input business questions, and the app outputs a Metric View YAML semantic model ready for Genie.

## Architecture

- **Frontend:** React + TypeScript + shadcn/ui + React Flow (APX framework)
- **Backend:** FastAPI + Pydantic + databricks-sdk
- **LLM:** Claude Sonnet 4.6 via Databricks Foundation Model API (`databricks-claude-sonnet-4-6`)
- **No persistence** — session state lives in the frontend wizard context

```
React Frontend (Wizard: 6 steps)
        │ REST API
FastAPI Backend
        ├── Foundation Model API (parse, score, map)
        └── Unity Catalog SDK (discover tables, deploy metric view)
```

## User Journey — Wizard Flow

### Step 1: Input Questions
- Textarea for pasting questions (one per line)
- File upload (drag & drop) for xlsx/csv — parsed server-side
- Preview as numbered list before proceeding

### Step 2: Parse & Highlight
- LLM extracts measures (green), dimensions (blue), filters (gray) with character positions
- Questions displayed with inline color highlighting
- Deduplicated entity table grouped by type, editable
- Each entity shows inferred column name and source questions

### Step 3: Discover Tables
- User selects a catalog from dropdown (populated via UC SDK)
- Backend searches all schemas in that catalog for table/column metadata
- LLM scores each table's relevance (0-100 confidence)
- Results as cards: table name, description, confidence %, checkbox
- Pre-checked for >80% confidence

### Step 4: Map Columns
- For each selected table, show columns
- Each entity gets a dropdown to map to an actual column
- Measures get an additional aggregation function dropdown (SUM, COUNT, AVG, etc.)
- LLM pre-fills best guesses, user confirms or overrides

### Step 5: Review & Edit
- Left: interactive ERD via React Flow (tables, columns, joins)
- Right: generated Metric View YAML in code block (toggle read-only/edit)
- User can adjust join relationships in the ERD

### Step 6: Deploy
- User picks target `catalog.schema.view_name`
- "Deploy to Databricks" button creates the metric view via SDK
- Success state with link to Catalog Explorer

## API Design

### `GET /api/catalogs`
Returns list of available catalogs.

### `POST /api/parse-questions`
- Input: `{questions: string[]}` or multipart file upload
- Calls Claude Sonnet 4.6 to extract measures, dimensions, filters with positions
- Returns: `{parsed_questions: ParsedQuestion[], entities: ExtractedEntity[]}`

### `POST /api/discover-tables`
- Input: `{catalog: str, entities: ExtractedEntity[]}`
- Lists all tables across all schemas in catalog via UC SDK
- LLM scores relevance of each table to the entities
- Returns: `{tables: TableSuggestion[]}`

### `POST /api/map-columns`
- Input: `{entities: ExtractedEntity[], selected_tables: str[]}`
- Fetches column details for selected tables
- LLM suggests best column + aggregation per entity
- Returns: `{mappings: ColumnMatch[]}`

### `POST /api/generate-metric-view`
- Input: `{confirmed_mappings: ConfirmedMapping[], view_name: str}`
- Pure logic: builds YAML from mappings (joins, dimensions, measures)
- Returns: `{yaml: str, erd: ERDSpec}`

### `POST /api/deploy-metric-view`
- Input: `{catalog: str, schema: str, view_name: str, yaml: str}`
- Executes `CREATE OR REPLACE VIEW ... WITH METRICS LANGUAGE YAML`
- Returns: `{success: bool, view_url: str}`

## Data Models

```python
class Highlight:
    text: str
    type: Literal["measure", "dimension", "filter"]
    start: int
    end: int

class ParsedQuestion:
    original_text: str
    highlights: list[Highlight]

class ExtractedEntity:
    name: str
    type: Literal["measure", "dimension", "filter"]
    inferred_column: str
    source_questions: list[int]

class TableSuggestion:
    table_name: str
    description: str
    confidence: float
    matched_columns: list[ColumnMatch]

class ColumnMatch:
    entity_name: str
    catalog_column: str
    confidence: float

class ConfirmedMapping:
    entity: ExtractedEntity
    table: str
    column: str
    aggregation: str | None

class MetricViewSpec:
    name: str
    source_tables: list[str]
    joins: list[JoinSpec]
    dimensions: list[DimensionSpec]
    measures: list[MeasureSpec]
    yaml: str
```

## LLM Prompt Strategy

Three focused LLM calls via Foundation Model API (`databricks-claude-sonnet-4-6`):

1. **Parse Questions** — extract measures/dims/filters with character positions, distinguish aggregatable numerics vs categorical groupings vs constraints
2. **Score Tables** — given entities + UC table metadata, score relevance 0-100 per table with reasoning
3. **Map Columns** — given entities + selected table columns, suggest best column match + aggregation function

All use JSON structured output.

## Frontend Architecture

- **State:** React Context (`WizardContext`) holds all wizard state
- **Routing:** Single route `/`, steps managed by internal wizard state
- **Key libraries:** `@xyflow/react` (ERD), `react-dropzone` (file upload), shadcn/ui (all controls)
- **Loading:** Skeleton/spinner per step with descriptive messages during LLM calls

### Component Breakdown

| Step | Components |
|------|-----------|
| Input | `QuestionInput`, `QuestionList` |
| Parse | `HighlightedQuestion`, `EntityTable` |
| Discover | `CatalogSelector`, `TableCard` |
| Map | `MappingTable` |
| Review | `ERDCanvas`, `YamlPreview` |
| Deploy | `DeployForm`, `DeployStatus` |

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM | Claude Sonnet 4.6 via FM API | In-platform, user preference |
| Catalog scope | Full catalog (all schemas) | Broad coverage without multi-catalog complexity |
| Table matching | LLM semantic scoring | More accurate than fuzzy string matching |
| ERD visualization | React Flow | Interactive, embeddable, widely used |
| YAML output | Review + deploy | Users can inspect before creating in UC |
| Persistence | None | Keeps architecture simple, session-based |
| Framework | APX (FastAPI + React) | Standard Databricks App stack |
