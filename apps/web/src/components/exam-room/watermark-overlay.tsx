'use client';

import React, { useEffect, useRef, useCallback } from 'react';

interface WatermarkOverlayProps {
  studentName?: string;
  studentId?: string;
  attemptId?: string;
  onTamperDetected?: () => void;
}

export function WatermarkOverlay({
  studentName = 'دانش‌آموز کندرلب',
  studentId = 'CL-STD',
  attemptId = '',
  onTamperDetected,
}: WatermarkOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text = `${studentName} • ${studentId.slice(0, 8)} • ${attemptId.slice(0, 8)}`;

  // رندر متن واترمارک روی بوم Canvas
  const drawWatermark = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = 'rgba(150, 150, 150, 0.045)';
    ctx.textBaseline = 'middle';

    const angle = (-18 * Math.PI) / 180;
    const stepX = 280;
    const stepY = 140;

    ctx.save();
    ctx.rotate(angle);

    for (let x = -width; x < width * 2; x += stepX) {
      for (let y = -height; y < height * 2; y += stepY) {
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();
  }, [text]);

  // ری‌سایز خودکار بوم
  useEffect(() => {
    drawWatermark();
    const handleResize = () => drawWatermark();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWatermark]);

  // سامانه ناظر ضد دستکاری (MutationObserver Anti-Tamper Guard)
  // در صورتی که کاربر با Inspect Element اقدام به حذف، مخفی‌سازی یا تغییر opacity نماید،
  // ناظر بلادرنگ المان را بازسازی کرده و وضعیت ضدتقلب را حفظ می‌کند.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === 'undefined') return;

    const enforceStyles = () => {
      if (!container) return;
      const expectedDisplay = 'block';
      const expectedPointerEvents = 'none';

      if (
        container.style.display === 'none' ||
        container.style.visibility === 'hidden' ||
        parseFloat(container.style.opacity || '1') === 0
      ) {
        container.style.display = expectedDisplay;
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        container.style.pointerEvents = expectedPointerEvents;
        drawWatermark();
        onTamperDetected?.();
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          // اگر کنواس از داخل والد حذف شد
          if (!container.contains(canvasRef.current)) {
            if (canvasRef.current) {
              container.appendChild(canvasRef.current);
              drawWatermark();
              onTamperDetected?.();
            }
          }
        } else if (m.type === 'attributes') {
          enforceStyles();
        }
      }
    });

    observer.observe(container, {
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
      childList: true,
      subtree: true,
    });

    // بررسی دوره‌ای ثانویه (هر ۳ ثانیه) جهت اطمینان از حضور در DOM
    const interval = setInterval(enforceStyles, 3000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [drawWatermark, onTamperDetected]);

  return (
    <div
      ref={containerRef}
      id="condor-security-watermark"
      aria-hidden="true"
      className="fixed inset-0 z-50 pointer-events-none select-none overflow-hidden"
      style={{
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        pointerEvents: 'none',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
}
