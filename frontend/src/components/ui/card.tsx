import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("panel panel-pad", className)} {...props} />
  ),
);
Card.displayName = "Card";

export function CardHeader({ title, icon, right, className }: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  if (!title && !right) return null;
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      {title && (
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan/80">
          {icon}
          {title}
        </h2>
      )}
      {right}
    </div>
  );
}
