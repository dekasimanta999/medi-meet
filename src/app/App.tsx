import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Suspense } from 'react';

// Error boundary component
interface ErrorBoundaryProps {
  error?: { message?: string };
  resetErrorBoundary?: () => void;
  children: React.ReactNode;
}

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ error, resetErrorBoundary, children }) => {
  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        fontFamily: 'Arial, sans-serif',
        background: '#f8f9fa',
        color: '#333'
      }}>
        <div style={{ 
          textAlign: 'center', 
          padding: '20px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '400px'
        }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '16px' }}>Oops! Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: '16px' }}>
            {error?.message || 'An unexpected error occurred'}
          </p>
          <button 
            onClick={resetErrorBoundary}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {  return (    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}