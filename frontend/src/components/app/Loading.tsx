import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Loading({
  label = "Loading…",
  error = false,
  className,
}: {
  label?: string;
  error?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center justify-center gap-3 py-20 text-center",
        className,
      )}
    >
      {error ? (
        <AlertTriangle className="size-6 text-severe" />
      ) : (
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      )}
      <p className={cn("text-sm", error ? "text-severe" : "text-muted-foreground")}>{label}</p>
    </div>
  );
}
