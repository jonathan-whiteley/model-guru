import { useState, useEffect } from "react";
import { useWizard } from "@/lib/wizard-context";
import { useMapColumns } from "@/lib/api";
import type { ConfirmedMapping } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

const AGGREGATIONS = ["SUM", "COUNT", "AVG", "MIN", "MAX", "COUNT_DISTINCT"];

const TYPE_COLORS: Record<string, string> = {
  measure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  dimension:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  filter: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function StepMap() {
  const { entities, selectedTables, setConfirmedMappings, setSourceTable, setStep } =
    useWizard();
  const [localMappings, setLocalMappings] = useState<ConfirmedMapping[]>([]);
  const mapMutation = useMapColumns();

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        const result = await mapMutation.mutateAsync({
          entities,
          selected_tables: selectedTables,
        });
        setLocalMappings(
          result.data.mappings.map((m) => ({
            entity_name: m.entity_name,
            entity_type: m.entity_type,
            table: m.table,
            column: m.column,
            aggregation: m.aggregation,
          })),
        );
      } catch (e) {
        console.error("Failed to map columns:", e);
      }
    };
    fetchMappings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMapping = (
    entityName: string,
    field: keyof ConfirmedMapping,
    value: string,
  ) => {
    setLocalMappings((prev) =>
      prev.map((m) =>
        m.entity_name === entityName ? { ...m, [field]: value } : m,
      ),
    );
  };

  const handleNext = () => {
    setConfirmedMappings(localMappings);
    const tableCounts: Record<string, number> = {};
    localMappings
      .filter((m) => m.entity_type === "measure")
      .forEach((m) => {
        tableCounts[m.table] = (tableCounts[m.table] || 0) + 1;
      });
    const source =
      Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      selectedTables[0];
    setSourceTable(source);
    setStep("review");
  };

  if (mapMutation.isPending) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-muted-foreground">
              Analyzing columns and suggesting mappings...
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
                      onValueChange={(v) =>
                        updateMapping(m.entity_name, "table", v)
                      }
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
                    <Input
                      className="w-40 font-mono text-sm"
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
                      <span className="text-muted-foreground text-sm">
                        &mdash;
                      </span>
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
