import * as React from "react";
import { cn } from "@/components/ui/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-offset-background transition-all placeholder:text-muted-foreground hover:border-slate-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
