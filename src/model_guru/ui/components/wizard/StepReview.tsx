import { useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWizard } from "@/lib/wizard-context";
import { useGenerateMetricView } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function TableNode({
  data,
}: {
  data: { label: string; columns: string[] };
}) {
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
    yamlContent,
    setYamlContent,
    erdNodes,
    erdEdges,
    setErd,
    setStep,
  } = useWizard();
  const [isEditing, setIsEditing] = useState(false);
  const [editableYaml, setEditableYaml] = useState("");
  const generateMutation = useGenerateMetricView();

  useEffect(() => {
    const generate = async () => {
      try {
        const result = await generateMutation.mutateAsync({
          confirmed_mappings: confirmedMappings,
          source_table: sourceTable,
          view_name: "metric_view",
        });
        setYamlContent(result.data.yaml_content);
        setEditableYaml(result.data.yaml_content);
        setErd(result.data.erd.nodes, result.data.erd.edges);
      } catch (e) {
        console.error("Failed to generate metric view:", e);
      }
    };
    generate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flowNodes: Node[] = erdNodes.map((node, i) => ({
    id: node.id,
    type: "tableNode",
    position: { x: (i % 3) * 280, y: Math.floor(i / 3) * 200 },
    data: {
      label: node.table_name.split(".").pop() || node.table_name,
      columns: node.columns,
    },
  }));

  const flowEdges: Edge[] = erdEdges.map((edge, i) => ({
    id: `e-${i}`,
    source: edge.source,
    target: edge.target,
    label: `${edge.source_column} \u2192 ${edge.target_column}`,
    type: "smoothstep",
  }));

  const handleSaveYaml = () => {
    setYamlContent(editableYaml);
    setIsEditing(false);
  };

  if (generateMutation.isPending) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-muted-foreground">
              Generating Metric View YAML...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Metric View YAML</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                isEditing ? handleSaveYaml() : setIsEditing(true)
              }
            >
              {isEditing ? "Save" : "Edit"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              className="font-mono text-sm min-h-[384px]"
              value={editableYaml}
              onChange={(e) => setEditableYaml(e.target.value)}
              rows={20}
            />
          ) : (
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono whitespace-pre-wrap">
              {yamlContent}
            </pre>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("map")}>
          Back
        </Button>
        <Button onClick={() => setStep("deploy")}>Deploy to Databricks</Button>
      </div>
    </div>
  );
}
