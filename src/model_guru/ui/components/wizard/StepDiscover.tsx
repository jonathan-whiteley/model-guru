import { Suspense } from "react";
import { useWizard } from "@/lib/wizard-context";
import { useListCatalogsSuspense, useDiscoverTables } from "@/lib/api";
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

function CatalogSelector({
  onSelect,
}: {
  onSelect: (catalog: string) => void;
}) {
  const { data } = useListCatalogsSuspense();
  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a catalog" />
      </SelectTrigger>
      <SelectContent>
        {data.data.catalogs.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 80)
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  if (confidence >= 60)
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
}

export function StepDiscover() {
  const {
    entities,
    tables,
    setTables,
    selectedTables,
    setSelectedTables,
    setSelectedCatalog,
    setStep,
  } = useWizard();
  const discoverMutation = useDiscoverTables();

  const handleCatalogSelect = async (catalog: string) => {
    setSelectedCatalog(catalog);
    try {
      const result = await discoverMutation.mutateAsync({ catalog, entities });
      setTables(result.data.tables);
      setSelectedTables(
        result.data.tables
          .filter((t) => t.confidence > 80)
          .map((t) => t.table_name),
      );
    } catch (e) {
      console.error("Failed to discover tables:", e);
    }
  };

  const toggleTable = (tableName: string) => {
    setSelectedTables(
      selectedTables.includes(tableName)
        ? selectedTables.filter((t) => t !== tableName)
        : [...selectedTables, tableName],
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

      {discoverMutation.isPending && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-muted-foreground">
                Searching Unity Catalog for relevant tables...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!discoverMutation.isPending && tables.length > 0 && (
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
