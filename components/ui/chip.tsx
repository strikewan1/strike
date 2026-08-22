"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({
  selected = false,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium uppercase tracking-wider",
        "border transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "bg-foreground text-background border-foreground"
          : "bg-transparent text-foreground border-border hover:border-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface ChipGroupProps {
  options: Array<{ value: string; label: string }>;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function ChipGroup({
  options,
  value,
  onChange,
  multiple = false,
  className,
}: ChipGroupProps) {
  const selectedValues = multiple
    ? Array.isArray(value)
      ? value
      : []
    : Array.isArray(value)
      ? [value[0]]
      : [value].filter(Boolean);

  const handleClick = (optValue: string) => {
    if (multiple) {
      const next = selectedValues.includes(optValue)
        ? selectedValues.filter((v) => v !== optValue)
        : [...selectedValues, optValue];
      onChange(next);
    } else {
      onChange(optValue);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          selected={selectedValues.includes(opt.value)}
          onClick={() => handleClick(opt.value)}
          type="button"
        >
          {opt.label}
        </Chip>
      ))}
    </div>
  );
}
