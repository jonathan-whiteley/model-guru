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
import type { Highlight } from "@/lib/api";

const HIGHLIGHT_BG: Record<string, string> = {
  measure: "bg-green-200/50 dark:bg-green-800/30",
  dimension: "bg-blue-200/50 dark:bg-blue-800/30",
  filter: "bg-gray-200/50 dark:bg-gray-700/30",
};

const TYPE_COLORS: Record<string, string> = {
  measure: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  dimension: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  filter: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function HighlightedText({
  text,
  highlights,
}: {
  text: string;
  highlights: Highlight[];
}) {
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
      </span>,
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

  const grouped = {
    measure: entities.filter((e) => e.type === "measure"),
    dimension: entities.filter((e) => e.type === "dimension"),
    filter: entities.filter((e) => e.type === "filter"),
  };

  return (
    <div className="space-y-6">
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
                  <HighlightedText
                    text={pq.original_text}
                    highlights={pq.highlights}
                  />
                </p>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <span className={`px-2 py-1 rounded ${HIGHLIGHT_BG.measure}`}>
              Measure
            </span>
            <span className={`px-2 py-1 rounded ${HIGHLIGHT_BG.dimension}`}>
              Dimension
            </span>
            <span className={`px-2 py-1 rounded ${HIGHLIGHT_BG.filter}`}>
              Filter
            </span>
          </div>
        </CardContent>
      </Card>

      {(["measure", "dimension", "filter"] as const).map((type) =>
        grouped[type].length > 0 ? (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={TYPE_COLORS[type]}>{type}s</Badge>
                <span className="text-sm text-muted-foreground">
                  ({grouped[type].length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Inferred Column</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped[type].map((entity) => (
                    <TableRow key={entity.name}>
                      <TableCell className="font-medium">
                        {entity.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entity.inferred_column}
                      </TableCell>
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
        ) : null,
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("input")}>
          Back
        </Button>
        <Button
          onClick={() => setStep("discover")}
          disabled={entities.length === 0}
        >
          Find Tables
        </Button>
      </div>
    </div>
  );
}
