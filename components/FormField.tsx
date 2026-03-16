"use client";

import { t } from "@/lib/translations";

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

export function FormField({
  label,
  error,
  required,
  children,
  hint,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-base font-semibold text-gray-800">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <span className="text-sm text-gray-500">{hint}</span>
      )}
      {error && (
        <span className="text-sm text-red-600 font-medium flex items-center gap-1">
          ⚠ {error}
        </span>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full h-14 px-4 rounded-xl border-2 text-lg font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors
        ${error
          ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200"
          : "border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-200"
        } ${className}`}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, className = "", children, ...props }: SelectProps) {
  return (
    <select
      className={`w-full h-14 px-4 rounded-xl border-2 text-lg font-medium text-gray-900 focus:outline-none focus:ring-2 transition-colors appearance-none bg-white
        ${error
          ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200"
          : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
        } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function RequiredBadge() {
  return (
    <span className="text-xs text-gray-500 font-normal">
      ({t.common.required})
    </span>
  );
}
