import { useState } from "react";
import { useWizard } from "@/lib/wizard-context";
import { useDeployMetricView } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle } from "lucide-react";

export function StepDeploy() {
  const {
    yamlContent,
    selectedCatalog,
    deployResult,
    setDeployResult,
    setStep,
    reset,
  } = useWizard();
  const [catalog, setCatalog] = useState(selectedCatalog);
  const [schemaName, setSchemaName] = useState("");
  const [viewName, setViewName] = useState("metric_view");
  const deployMutation = useDeployMetricView();

  const handleDeploy = async () => {
    try {
      const result = await deployMutation.mutateAsync({
        catalog,
        schema_name: schemaName,
        view_name: viewName,
        yaml_content: yamlContent,
      });
      setDeployResult(result.data);
    } catch {
      setDeployResult({
        success: false,
        message:
          "Failed to deploy. Please check your permissions and try again.",
      });
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
              Will create:{" "}
              <code className="font-mono bg-muted px-1 rounded">
                {catalog}.{schemaName}.{viewName}
              </code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Alert variant={deployResult.success ? "default" : "destructive"}>
          {deployResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {deployResult.success
              ? "Deployment Successful"
              : "Deployment Failed"}
          </AlertTitle>
          <AlertDescription>{deployResult.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            setDeployResult(null);
            setStep("review");
          }}
        >
          Back
        </Button>
        {!deployResult ? (
          <Button
            onClick={handleDeploy}
            disabled={
              deployMutation.isPending || !catalog || !schemaName || !viewName
            }
          >
            {deployMutation.isPending ? "Deploying..." : "Deploy to Databricks"}
          </Button>
        ) : (
          <Button onClick={reset}>Start New Analysis</Button>
        )}
      </div>
    </div>
  );
}
