import * as React from "react";
import { cn } from "@/components/ui/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold leading-none text-slate-800", className)} {...props} />;
}
