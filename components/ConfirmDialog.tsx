"use client";

import { t } from "@/lib/translations";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title = t.confirm.deleteTitle,
  message = t.confirm.deleteMessage,
  confirmLabel = t.confirm.deleteButton,
  cancelLabel = t.confirm.cancelButton,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-9 h-9 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 text-center">{title}</h2>
        <p className="text-gray-600 text-center text-lg">{message}</p>
        <div className="flex gap-3 w-full mt-2">
          <button
            onClick={onCancel}
            className="flex-1 h-14 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-14 rounded-xl bg-red-600 text-white font-bold text-lg hover:bg-red-700 active:bg-red-800 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
