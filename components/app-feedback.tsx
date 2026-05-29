"use client";

import { useEffect } from "react";

export type AppFeedbackMessage = {
  id: number;
  message: string;
};

type AppFeedbackProps = {
  feedback: AppFeedbackMessage | null;
  onClose: () => void;
};

export function AppFeedback({ feedback, onClose }: AppFeedbackProps) {
  useEffect(() => {
    if (!feedback) return;

    const timeoutId = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [feedback, onClose]);

  if (!feedback) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[80] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl border border-white/15 bg-[#22101a]/95 p-4 text-white shadow-2xl backdrop-blur-xl"
      dir="rtl"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">שגיאה</div>
          <p className="mt-1 text-sm leading-6 text-white/80">{feedback.message}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 transition hover:bg-white/20 hover:text-white"
        >
          סגור
        </button>
      </div>
    </div>
  );
}
