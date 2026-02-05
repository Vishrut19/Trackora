"use client";

import { cn } from "@/lib/utils";

const DEFAULT_SIZE = "default";
const SIZES = {
  sm: "gap-1 [--dot:6px]",
  default: "gap-1.5 [--dot:8px]",
  lg: "gap-2 [--dot:10px]",
} as const;

interface LoaderProps {
  size?: keyof typeof SIZES;
  className?: string;
}

/** Custom bouncing-dots loader (not ShadCN). Theme-aware via text-primary. */
function Loader({ size = DEFAULT_SIZE, className }: LoaderProps) {
  return (
    <div
      className={cn("flex items-center justify-center", SIZES[size], className)}
      role="status"
      aria-label="Loading"
    >
      <span
        className="rounded-full bg-primary opacity-80 animate-[loader-bounce_0.6s_ease-in-out_infinite_both]"
        style={{ width: "var(--dot)", height: "var(--dot)" }}
      />
      <span
        className="rounded-full bg-primary opacity-80 animate-[loader-bounce_0.6s_ease-in-out_0.1s_infinite_both]"
        style={{ width: "var(--dot)", height: "var(--dot)" }}
      />
      <span
        className="rounded-full bg-primary opacity-80 animate-[loader-bounce_0.6s_ease-in-out_0.2s_infinite_both]"
        style={{ width: "var(--dot)", height: "var(--dot)" }}
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export { Loader };
