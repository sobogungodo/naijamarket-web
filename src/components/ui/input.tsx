import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ============================================================================
// INPUT VARIANTS
// ============================================================================

const inputVariants = cva(
  "flex w-full rounded-lg border bg-transparent text-sm text-white transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-terminal-border focus-visible:border-naija-green focus-visible:ring-1 focus-visible:ring-naija-green",
        ghost:
          "border-transparent hover:border-terminal-border focus-visible:border-naija-green",
        terminal:
          "border-naija-green/30 bg-terminal-bg font-mono text-naija-gold focus-visible:border-naija-green",
        error:
          "border-price-down focus-visible:border-price-down focus-visible:ring-1 focus-visible:ring-price-down",
      },
      inputSize: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

// ============================================================================
// INPUT COMPONENT
// ============================================================================

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, inputSize, type, leftIcon, rightIcon, error, ...props }, ref) => {
    const hasError = !!error;
    const effectiveVariant = hasError ? "error" : variant;

    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ variant: effectiveVariant, inputSize }),
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {rightIcon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(inputVariants({ variant: effectiveVariant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

// ============================================================================
// FORM FIELD WRAPPER
// ============================================================================

interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

const FormField = ({
  label,
  error,
  hint,
  required,
  children,
  className,
}: FormFieldProps) => {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-sm font-medium text-gray-300">
          {label}
          {required && <span className="text-price-down ml-1">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-price-down">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
};

export { Input, inputVariants, FormField };
