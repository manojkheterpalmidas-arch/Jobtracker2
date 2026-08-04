import * as React from "react";
import { cn } from "@/components/ui/utils";

type BadgeVariant = "default" | "success" | "warning" | "muted" | "destructive" | "info" | "purple";

const variants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  muted: "border-slate-200 bg-slate-50 text-slate-700",
  destructive: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  purple: "border-violet-200 bg-violet-50 text-violet-800"
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
