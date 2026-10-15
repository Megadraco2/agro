import * as React from 'react';
import { cn } from './utils';

type InputProps = React.ComponentProps<'input'> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        className={cn(
          'w-full rounded-lg border border-border px-3 py-2 text-sm',
          error && 'border-red-500',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && (
        <span role="alert" className="block text-sm text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

type SelectOption = { value: string; label: string };

type SelectProps = Omit<React.ComponentProps<'select'>, 'children'> & {
  label: string;
  error?: string;
  options: SelectOption[];
};

export function Select({
  label,
  error,
  options,
  className,
  ...props
}: SelectProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <select
        className={cn(
          'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm',
          error && 'border-red-500',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="block text-sm text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
