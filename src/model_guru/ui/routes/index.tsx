import { createFileRoute } from "@tanstack/react-router";
import { WizardProvider, useWizard } from "@/lib/wizard-context";
import { WizardShell } from "@/components/wizard/WizardShell";
import { StepInput } from "@/components/wizard/StepInput";
import { StepParse } from "@/components/wizard/StepParse";
import { StepDiscover } from "@/components/wizard/StepDiscover";
import { StepMap } from "@/components/wizard/StepMap";
import { StepReview } from "@/components/wizard/StepReview";
import { StepDeploy } from "@/components/wizard/StepDeploy";

function WizardContent() {
  const { step } = useWizard();
  return (
    <WizardShell>
      {step === "input" && <StepInput />}
      {step === "parse" && <StepParse />}
      {step === "discover" && <StepDiscover />}
      {step === "map" && <StepMap />}
      {step === "review" && <StepReview />}
      {step === "deploy" && <StepDeploy />}
    </WizardShell>
  );
}

export const Route = createFileRoute("/")({
  component: () => (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  ),
});
