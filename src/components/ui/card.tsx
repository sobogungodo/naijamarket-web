import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ============================================================================
// CARD VARIANTS
// ============================================================================

const cardVariants = cva("rounded-xl border transition-colors", {
  variants: {
    variant: {
      default: "bg-terminal-surface border-terminal-border",
      elevated: "bg-terminal-elevated border-terminal-border shadow-card",
      outline: "bg-transparent border-terminal-border",
      ghost: "bg-transparent border-transparent",
      interactive:
        "bg-terminal-surface border-terminal-border hover:border-naija-green/50 cursor-pointer",
      highlight:
        "bg-gradient-to-br from-naija-green/10 to-naija-gold/10 border-naija-green/30",
      price: "bg-terminal-surface border-terminal-border hover:border-naija-green/50",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      default: "p-4",
      lg: "p-6",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "default",
  },
});

// ============================================================================
// CARD COMPONENTS
// ============================================================================

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold text-white leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-gray-400", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4 border-t border-terminal-border", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// ============================================================================
// PRICE CARD COMPONENT
// ============================================================================

interface PriceCardProps {
  itemName: string;
  market: string;
  price: number;
  previousPrice?: number;
  changePercent?: number;
  unit?: string;
  confidence?: number;
  updatedAt?: string;
  onClick?: () => void;
  className?: string;
}

const PriceCard = ({
  itemName,
  market,
  price,
  previousPrice,
  changePercent,
  unit,
  confidence,
  updatedAt,
  onClick,
  className,
}: PriceCardProps) => {
  const isPositive = (changePercent ?? 0) >= 0;

  return (
    <Card
      variant="price"
      className={cn("cursor-pointer", className)}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{itemName}</h3>
          <p className="text-2xs text-gray-500">{market}</p>
        </div>
        {unit && (
          <span className="text-2xs font-mono px-2 py-0.5 bg-terminal-muted text-gray-400 rounded">
            {unit}
          </span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-mono font-bold text-white">
          ₦{price.toLocaleString()}
        </span>
        {changePercent !== undefined && (
          <span
            className={cn(
              "text-sm font-medium",
              isPositive ? "text-price-up" : "text-price-down"
            )}
          >
            {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Previous Price */}
      {previousPrice && (
        <p className="text-xs text-gray-500 mb-3">
          Prev: ₦{previousPrice.toLocaleString()}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-terminal-border/50">
        {confidence !== undefined && (
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-terminal-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  confidence >= 80
                    ? "bg-price-up"
                    : confidence >= 60
                    ? "bg-naija-gold"
                    : "bg-price-down"
                )}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-2xs text-gray-500">{confidence}%</span>
          </div>
        )}
        {updatedAt && (
          <span className="text-2xs text-gray-500 font-mono">{updatedAt}</span>
        )}
      </div>
    </Card>
  );
};

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

const StatCard = ({
  label,
  value,
  subtext,
  icon,
  trend,
  trendValue,
  className,
}: StatCardProps) => {
  return (
    <Card variant="default" className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-mono font-bold text-white">{value}</span>
        {trend && trendValue && (
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up"
                ? "text-price-up"
                : trend === "down"
                ? "text-price-down"
                : "text-gray-500"
            )}
          >
            {trendValue}
          </span>
        )}
      </div>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </Card>
  );
};

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
  PriceCard,
  StatCard,
};
