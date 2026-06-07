// src/components/DemoTrigger.tsx
import React, { useRef } from 'react';

interface DemoTriggerProps {
  onActivate: () => void;
  children: React.ReactNode;
}

const TAP_COUNT = 5;
const TAP_WINDOW_MS = 3000;

export const DemoTrigger: React.FC<DemoTriggerProps> = ({ onActivate, children }) => {
  const tapsRef = useRef<number[]>([]);
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;

  const handleTap = () => {
    const now = Date.now();
    // Keep only taps within the window
    tapsRef.current = [...tapsRef.current, now].filter(t => now - t <= TAP_WINDOW_MS);
    if (tapsRef.current.length >= TAP_COUNT) {
      tapsRef.current = [];
      activateRef.current();
    }
  };

  return (
    <div onClick={handleTap} style={{ cursor: 'default' }}>
      {children}
    </div>
  );
};
