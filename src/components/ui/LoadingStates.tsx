import React from 'react';

// Professional loading states for top-notch UX
export interface LoadingStateProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  overlay?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingStateProps> = ({ 
  size = 'medium', 
  message, 
  overlay = false, 
  className = '' 
}) => {
  const sizeMap = {
    small: { width: 20, height: 20, border: 2 },
    medium: { width: 32, height: 32, border: 3 },
    large: { width: 48, height: 48, border: 4 }
  };

  const { width, height, border } = sizeMap[size];

  return (
    <div className={`loading-spinner ${overlay ? 'loading-overlay' : ''} ${className}`}>
      <div 
        className="spinner"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          border: `${border}px solid #e5e7eb`,
          borderTopColor: '#6366f1',
          borderRightColor: '#6366f1',
          borderBottomColor: '#6366f1',
          borderLeftColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      {message && (
        <div className="loading-message" style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
          {message}
        </div>
      )}
    </div>
  );
};

// Skeleton loading for cards
export interface SkeletonProps {
  width?: string;
  height?: string;
  lines?: number;
  className?: string;
  animated?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '20px', 
  lines = 1, 
  className = '', 
  animated = true 
}) => {
  return (
    <div className={`skeleton ${className}`} style={{ width, height }}>
      {Array.from({ length: lines }).map((_, index) => (
        <div 
          key={index}
          className={`skeleton-line ${animated ? 'animated' : ''}`}
          style={{ 
            height: '16px',
            background: '#f0f0f0',
            borderRadius: '4px',
            marginBottom: index < lines - 1 ? '8px' : '0',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {animated && (
            <div 
              className="skeleton-shimmer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 1.5s infinite'
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// Progress indicator
export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}

export const ProgressBar: React.FC<ProgressProps> = ({ 
  value, 
  max = 100, 
  label, 
  showPercentage = false, 
  color = '#6366f1',
  size = 'medium'
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const sizeMap = {
    small: { height: 4, fontSize: 11 },
    medium: { height: 8, fontSize: 13 },
    large: { height: 12, fontSize: 15 }
  };

  const { height: barHeight, fontSize } = sizeMap[size];

  return (
    <div className="progress-container">
      {label && (
        <div className="progress-label" style={{ marginBottom: '8px', fontSize, color: '#374151' }}>
          {label}
        </div>
      )}
      <div className="progress-bar" style={{ height: `${barHeight}px`, backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
        <div 
          className="progress-fill"
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: '4px',
            transition: 'width 0.3s ease-in-out'
          }}
        />
      </div>
      {showPercentage && (
        <div className="progress-percentage" style={{ marginTop: '4px', fontSize, color: '#6b7280', textAlign: 'center' }}>
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
};

// Empty state component
export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  title, 
  description, 
  icon, 
  action, 
  className = '' 
}) => {
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-icon">
        {icon}
      </div>
      <div className="empty-content">
        <h3 className="empty-title">{title}</h3>
        {description && <p className="empty-description">{description}</p>}
        {action && <div className="empty-action">{action}</div>}
      </div>
    </div>
  );
};

// CSS for loading states
export const loadingStyles = `
  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    backdrop-filter: blur(4px);
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-message {
    text-align: center;
    font-weight: 500;
  opacity: 0.8;
  }

  .skeleton {
    background: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
  }

  .skeleton-line {
    position: relative;
  background: #f0f0f0;
  }

  .skeleton-shimmer {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  .progress-container {
    width: 100%;
  }

  .progress-label {
    font-weight: 600;
    color: #374151;
  }

  .progress-bar {
    background: #f3f4f6;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    transition: width 0.3s ease-in-out;
  }

  .progress-percentage {
    font-weight: 600;
    color: #6b7280;
    text-align: center;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    min-height: 300px;
  }

  .empty-icon {
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-content h3 {
    margin: 0 0 8px 0;
    color: #374151;
    font-size: 18px;
    font-weight: 600;
  }

  .empty-content p {
    margin: 0 0 16px 0;
    color: #6b7280;
    font-size: 14px;
    line-height: 1.5;
  }

  .empty-action {
    margin-top: 24px;
  }
`;
