import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("pf-button", {
  variants: {
    variant: {
      primary: "pf-button--primary",
      secondary: "pf-button--secondary",
      ghost: "pf-button--ghost"
    },
    size: {
      sm: "pf-button--sm",
      md: "pf-button--md",
      lg: "pf-button--lg"
    }
  },
  defaultVariants: {
    variant: "primary",
    size: "md"
  }
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
