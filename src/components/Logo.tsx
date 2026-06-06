import React from 'react';

export const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 28, className }) => {
  // Use a unique ID per instance to avoid gradient conflicts when multiple Logos are rendered
  const id = React.useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      style={{ filter: 'drop-shadow(0 0 10px rgba(234, 179, 8, 0.5))' }}
    >
      <defs>
        <linearGradient id={`sg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      {/* Clean 4-pointed star — no extra decorations */}
      <path
        d="M50 5 L56 44 L95 50 L56 56 L50 95 L44 56 L5 50 L44 44 Z"
        fill={`url(#sg${id})`}
      />
    </svg>
  );
};
