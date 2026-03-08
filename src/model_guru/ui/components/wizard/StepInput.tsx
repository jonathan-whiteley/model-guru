import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useWizard } from "@/lib/wizard-context";
import { useParseQuestions, useUploadQuestions } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
function GenieLampIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="currentColor">
      {/* Smoke wisps */}
      <path d="M15.5 2c-.4 1.2-1.6 1.8-1.2 3.2.2.6.8 1 .6 1.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M17.5 3c-.3.8-1 1.2-.8 2.2" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      {/* Spout */}
      <path d="M13 12.5L18 9.5c.4-.2.6.1.4.4L16 12.5H13z"/>
      {/* Lamp body */}
      <ellipse cx="9.5" cy="15" rx="6.5" ry="3.5"/>
      {/* Lid */}
      <path d="M5.5 11.5C5.5 11.5 7 9 9.5 9s4 2.5 4 2.5H5.5z"/>
      {/* Lid knob */}
      <circle cx="9.5" cy="8.2" r="1"/>
      {/* Handle */}
      <path d="M3 13.5C1.5 13 .8 12 1.2 10.8c.4-1 1.5-1.5 2.5-1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Base */}
      <path d="M6 18.5l-.8 1.5h8.6l-.8-1.5"/>
      <ellipse cx="9.5" cy="20.5" rx="4.5" ry="1"/>
    </svg>
  );
}

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
              "What were net sales by category last month?\nHow many weekly units sold in west region?\nWhat were product XYZ's gross sales last week?"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <Button onClick={handleParse} disabled={isLoading || !text.trim()} className="gap-2">
            {isLoading ? (
              "Analyzing questions..."
            ) : (
              <>
                <GenieLampIcon className="w-5 h-5" />
                Analyze Questions
              </>
            )}
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
