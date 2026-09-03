import { Surface } from "@/components/ui/surface";
import { onboardingCopy } from "@/lib/onboarding/copy";

export function DemoUnavailable({
  title,
  body,
}: {
  title?: string;
  body?: string;
}) {
  return (
    <Surface className="max-w-lg">
      <p className="text-sm font-semibold text-[var(--ink)]">
        {title ?? onboardingCopy.tryDemo.unavailable}
      </p>
      {body ? (
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">{body}</p>
      ) : null}
    </Surface>
  );
}
