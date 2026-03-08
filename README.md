<p align="center">
  <img src="https://img.shields.io/badge/Databricks-App-FF3621?style=for-the-badge&logo=databricks&logoColor=white" alt="Databricks App"/>
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
</p>

# Model Genie

> **Shift Genie space creation from bottom-up (data first) to top-down (questions first).**
>
> Users input business questions, and Model Genie extracts measures, dimensions, and filters, discovers matching Unity Catalog tables, maps columns, and generates a deployable Metric View YAML semantic model.

---

## How It Works

Model Genie guides you through a **6-step wizard**:

| Step | Name | What Happens |
|:----:|------|--------------|
| 1 | **Input Questions** | Paste or upload (CSV/XLSX) 10-20 business questions |
| 2 | **Parse & Extract** | LLM extracts measures, dimensions, and filters with highlighted annotations |
| 3 | **Discover Tables** | Select a catalog; the app searches all schemas for relevant tables, ranked by confidence |
| 4 | **Map Columns** | Review and confirm entity-to-column mappings with suggested aggregations |
| 5 | **Review** | Inspect the generated Metric View YAML and interactive ERD diagram |
| 6 | **Deploy** | Deploy the Metric View directly to Unity Catalog |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Python, FastAPI, Pydantic |
| **Frontend** | React, TypeScript, shadcn/ui, TanStack Router & Query, React Flow |
| **LLM** | Databricks Foundation Model API (`databricks-claude-sonnet-4-6`) |
| **Infrastructure** | Databricks SDK (`WorkspaceClient`), Unity Catalog, Metric Views |
| **Build** | [APX framework](https://github.com/databricks-solutions/apx) (uv + bun), Databricks Asset Bundle (DAB) |

---

## Getting Started

### Prerequisites

- [uv](https://docs.astral.sh/uv/) and [bun](https://bun.sh/) installed
- Databricks CLI configured with a profile (default: `DEFAULT`)

### Local Development

```bash
# Start the dev server (backend + frontend + OpenAPI watcher)
apx start

# Check types (Python + TypeScript)
apx check

# View logs
apx logs
```

### Deploy to Databricks

```bash
databricks bundle deploy --target dev
```

---

## Project Structure

```
src/model_guru/
  backend/
    app.py              # FastAPI entrypoint
    models.py           # Pydantic request/response models
    llm.py              # Foundation Model API client
    routers/
      parse.py          # POST /api/parse-questions, /api/upload-questions
      discover.py       # GET /api/catalogs, POST /api/discover-tables
      mapping.py        # POST /api/map-columns
      generate.py       # POST /api/generate-metric-view
      deploy.py         # POST /api/deploy-metric-view
  ui/
    lib/
      api.ts            # Auto-generated API client (DO NOT EDIT)
      wizard-context.tsx # Wizard state management
    components/wizard/  # Step components (StepInput, StepParse, etc.)
    routes/
      index.tsx         # Main wizard page
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/parse-questions` | Extract entities from business questions |
| `POST` | `/api/upload-questions` | Upload CSV/XLSX file of questions |
| `GET` | `/api/catalogs` | List available Unity Catalog catalogs |
| `POST` | `/api/discover-tables` | Find relevant tables for extracted entities |
| `POST` | `/api/map-columns` | Map entities to table columns |
| `POST` | `/api/generate-metric-view` | Generate Metric View YAML and ERD |
| `POST` | `/api/deploy-metric-view` | Deploy Metric View to Unity Catalog |
