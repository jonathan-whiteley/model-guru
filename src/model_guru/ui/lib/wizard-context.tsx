import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  ParsedQuestion,
  ExtractedEntity,
  TableSuggestion,
  ColumnMapping,
  ConfirmedMapping,
  ERDNode,
  ERDEdge,
} from "@/lib/api";

export type WizardStep = "input" | "parse" | "discover" | "map" | "review" | "deploy";

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
  yamlContent: string;
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
  setYamlContent: (yaml: string) => void;
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
  yamlContent: "",
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
    setYamlContent: (yamlContent) => setState((s) => ({ ...s, yamlContent })),
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
