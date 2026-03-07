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
  const [error, setError] = useState<string | null>(null);
  const parseMutation = useParseQuestions();
  const uploadMutation = useUploadQuestions();

  const handleParse = async () => {
    const questions = text
      .split("\n")
      .map((q) => q.replace(/^\d+[.)]\s*/, "").replace(/^[-\u2022]\s*/, "").trim())
      .filter(Boolean);

    if (questions.length === 0) {
      setError("Please enter at least one question.");
      return;
    }

    setError(null);
    try {
      const result = await parseMutation.mutateAsync({ questions });
      setQuestions(questions);
      setParsedQuestions(result.data.parsed_questions);
      setEntities(result.data.entities);
      setStep("parse");
    } catch {
      setError("Failed to parse questions. Please try again.");
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadMutation.mutateAsync(formData);
        const questions = result.data.parsed_questions.map((pq) => pq.original_text);
        setQuestions(questions);
        setParsedQuestions(result.data.parsed_questions);
        setEntities(result.data.entities);
        setStep("parse");
      } catch {
        setError("Failed to upload and parse file. Please try again.");
      }
    },
    [setQuestions, setParsedQuestions, setEntities, setStep, uploadMutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  const isLoading = parseMutation.isPending || uploadMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enter Your Business Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={
              "What were net sales by category last month?\nHow many weekly units sold in west region?\nShow Y over Y performance of store 123 over last 12 months\nWhat were product XYZ's gross sales last week?"
            }
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
            <p className="text-xs text-muted-foreground mt-2">One question per row</p>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
