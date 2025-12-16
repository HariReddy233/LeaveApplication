'use client';

import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '@/lib/auth';
import api from '@/lib/api';

type SSEEvent = {
  type: string;
  message: string;
  leaveId?: number;
  employeeName?: string;
  leaveType?: string;
  status?: string;
  approver?: string;
};

type UseSSEOptions = {
  onNewLeave?: (event: SSEEvent) => void;
  onLeaveStatusUpdate?: (event: SSEEvent) => void;
  onLeaveDeleted?: (event: SSEEvent) => void;
  enabled?: boolean;
};

/**
 * Custom hook for Server-Sent Events (SSE) real-time updates
 */
export function useSSE(options: UseSSEOptions = {}) {
  const { onNewLeave, onLeaveStatusUpdate, onLeaveDeleted, enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const connectSSE = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          console.log('No auth token, skipping SSE connection');
          return;
        }

        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Create SSE connection with authentication token as query parameter
        // (EventSource doesn't support custom headers)
        // Use the same baseURL logic as api.ts to avoid duplicate /api/v1
        let baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        // Remove trailing slash if present
        baseURL = baseURL.replace(/\/$/, '');
        // Ensure baseURL ends with /api/v1 (same as api.ts)
        if (!baseURL.endsWith('/api/v1')) {
          if (baseURL.endsWith('/api')) {
            baseURL = `${baseURL}/v1`;
          } else {
            baseURL = `${baseURL}/api/v1`;
          }
        }
        const eventSource = new EventSource(
          `${baseURL}/SSE/events?token=${encodeURIComponent(token)}`,
          {
            withCredentials: true
          }
        );

        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('✅ SSE connection established');
          setIsConnected(true);
          setError(null);
        };

        eventSource.onmessage = (event) => {
          try {
            const data: SSEEvent = JSON.parse(event.data);
            
            // Handle different event types
            switch (data.type) {
              case 'connected':
                console.log('SSE:', data.message);
                break;
              case 'new_leave':
                console.log('📬 New leave application:', data);
                onNewLeave?.(data);
                break;
              case 'leave_status_update':
                console.log('📬 Leave status updated:', data);
                onLeaveStatusUpdate?.(data);
                break;
              case 'leave_deleted':
                console.log('📬 Leave deleted:', data);
                onLeaveDeleted?.(data);
                break;
              default:
                console.log('SSE event:', data);
            }
          } catch (err) {
            console.error('Error parsing SSE event:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('SSE connection error:', err);
          setIsConnected(false);
          setError('Connection lost. Reconnecting...');
          
          // Auto-reconnect after 3 seconds
          setTimeout(() => {
            if (enabled) {
              connectSSE();
            }
          }, 3000);
        };
      } catch (err: any) {
        console.error('Failed to establish SSE connection:', err);
        setError(err.message || 'Failed to connect');
        setIsConnected(false);
      }
    };

    connectSSE();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, onNewLeave, onLeaveStatusUpdate, onLeaveDeleted]);

  return {
    isConnected,
    error,
    reconnect: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      // Trigger reconnection
      const token = getAuthToken();
      if (token && enabled) {
        // Use the same baseURL logic as api.ts to avoid duplicate /api/v1
        let baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        // Remove trailing slash if present
        baseURL = baseURL.replace(/\/$/, '');
        // Ensure baseURL ends with /api/v1 (same as api.ts)
        if (!baseURL.endsWith('/api/v1')) {
          if (baseURL.endsWith('/api')) {
            baseURL = `${baseURL}/v1`;
          } else {
            baseURL = `${baseURL}/api/v1`;
          }
        }
        const eventSource = new EventSource(
          `${baseURL}/SSE/events?token=${encodeURIComponent(token)}`,
          {
            withCredentials: true
          }
        );
        eventSourceRef.current = eventSource;
      }
    }
  };
}

