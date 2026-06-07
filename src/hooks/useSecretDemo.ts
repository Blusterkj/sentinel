// src/hooks/useSecretDemo.ts
import { useEffect, useRef } from 'react';

const SEQUENCE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
];

export function useSecretDemo(onActivate: () => void): void {
  const bufferRef = useRef<string[]>([]);
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      bufferRef.current = [...bufferRef.current, e.key].slice(-SEQUENCE.length);
      if (bufferRef.current.join(',') === SEQUENCE.join(',')) {
        bufferRef.current = [];
        activateRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
