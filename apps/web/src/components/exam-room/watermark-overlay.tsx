'use client';

import React from 'react';

interface WatermarkOverlayProps {
  studentName?: string;
  studentId?: string;
  attemptId?: string;
}

export function WatermarkOverlay({
  studentName = 'دانش‌آموز کندرلب',
  studentId = 'CL-STD',
  attemptId = '',
}: WatermarkOverlayProps) {
  const text = `${studentName} • ${studentId} • ${attemptId.slice(0, 8)}`;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 pointer-events-none select-none overflow-hidden opacity-[0.035] dark:opacity-[0.05]"
      style={{
        backgroundImage: `radial-gradient(circle at center, transparent 0%, transparent 100%)`,
      }}
    >
      <div className="absolute inset-0 flex flex-wrap gap-x-24 gap-y-20 p-8 transform -rotate-12 scale-125">
        {Array.from({ length: 48 }).map((_, i) => (
          <div
            key={i}
            className="text-xs font-mono tracking-widest text-foreground font-semibold whitespace-nowrap"
          >
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
