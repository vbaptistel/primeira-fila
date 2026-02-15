import * as React from "react";
import { cn } from "../../lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("pf-skeleton", className)} {...props} />
  );
}

export { Skeleton };
