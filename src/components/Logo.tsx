import React from 'react';

export const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 28, className }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      style={{ filter: 'drop-shadow(0 0 8px rgba(234, 179, 8, 0.4))' }}
    >
        <defs>
            <linearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#eab308"/>
                <stop offset="100%" stopColor="#f97316"/>
            </linearGradient>
        </defs>
        <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="url(#starGrad)"/>
        <circle cx="50" cy="50" r="10" fill="#111"/>
        <path d="M47 45 C47 45, 53 45, 53 50 C53 55, 47 55, 47 55" fill="none" stroke="#eab308" stroke-width="2"/>
    </svg>
  );
};
