import * as React from "react";
import { cn } from "../../lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps) {
  return <div className={cn("pf-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div className={cn("pf-card__header", className)} {...props} />;
}

export function CardTitle({ className, ...props }: DivProps) {
  return <h2 className={cn("pf-card__title", className)} {...props} />;
}

export function CardDescription({ className, ...props }: DivProps) {
  return <p className={cn("pf-card__description", className)} {...props} />;
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("pf-card__content", className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps) {
  return <div className={cn("pf-card__footer", className)} {...props} />;
}
