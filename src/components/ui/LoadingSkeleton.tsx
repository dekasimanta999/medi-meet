import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'text' | 'avatar' | 'button' | 'table';
  lines?: number;
  height?: string;
  width?: string;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  type = 'card', 
  lines = 3, 
  height = '20px',
  width = '100%',
  className = ''
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-block',
    background: 'linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 100%)',
    backgroundSize: '200% 100%',
    borderRadius: '8px',
    animation: 'shimmer 1.5s infinite',
    height: height || '20px',
    width: width || '100%'
  };

  const variants = {
    card: (
      <div style={{ ...baseStyle, padding: '16px', borderRadius: '12px' }} />
    ),
    text: (
      <div style={{ ...baseStyle, height: '14px', width: '80%' }} />
    ),
    avatar: (
      <div 
        style={{ 
          ...baseStyle, 
          width: '48px', 
          height: '48px', 
          borderRadius: '50%' 
        }} 
      />
    ),
    button: (
      <div style={{ ...baseStyle, width: '60px', height: '36px', borderRadius: '6px' }} />
    ),
    table: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} style={{ ...baseStyle, height: '16px' }} />
        ))}
      </div>
    )
  };

  return variants[type] || variants.card;
};

export const LoadingSpinner: React.FC<{ size?: 'small' | 'medium' | 'large' }> = ({ size = 'medium' }) => {
  const sizeMap = {
    small: { width: '20px', height: '20px', border: '2px' },
    medium: { width: '32px', height: '32px', border: '3px' },
    large: { width: '48px', height: '48px', border: '4px' }
  };

  return (
    <div 
      style={{
        display: 'inline-block',
        border: '2px solid #e5e7eb',
        borderTop: '2px solid #6366f1',
        borderRadius: '50%',
        ...sizeMap[size],
        animation: 'spin 1s linear infinite',
        margin: '0 8px'
      }}
    >
      <div 
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid transparent',
          borderTop: `2px solid #6366f1`,
          borderRadius: '50%',
          animation: 'spin 0.5s linear infinite reverse'
        }}
      />
    </div>
  );
};
