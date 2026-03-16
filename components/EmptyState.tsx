"use client";

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      {icon && (
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
          {icon}
        </div>
      )}
      <p className="text-gray-500 text-lg text-center font-medium px-4">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
