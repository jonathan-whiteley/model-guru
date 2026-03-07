import { useWizard, type WizardStep } from "@/lib/wizard-context";
import { Check } from "lucide-react";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "input", label: "Input Questions" },
  { key: "parse", label: "Parse & Highlight" },
  { key: "discover", label: "Discover Tables" },
  { key: "map", label: "Map Columns" },
  { key: "review", label: "Review" },
  { key: "deploy", label: "Deploy" },
];

export function WizardShell({ children }: { children: React.ReactNode }) {
  const { step } = useWizard();
  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="container mx-auto py-8 max-w-5xl px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6">ModelGuru</h1>
        <p className="text-muted-foreground mb-4">Business Questions &rarr; Metric View YAML</p>
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    i < currentIndex
                      ? "bg-green-600 text-white"
                      : i === currentIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < currentIndex ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={`text-sm hidden lg:inline ${
                    i === currentIndex ? "font-medium" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px mx-1 ${i < currentIndex ? "bg-green-600" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
