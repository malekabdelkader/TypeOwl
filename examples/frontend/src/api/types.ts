/**
 * 🔴 Local types for endpoints without TypeOwl
 */

// /api/health is NOT registered with TypeOwl, so we define manually
export interface HealthResponse {
  status: string;
  timestamp: string;
}

// API error type (for error handling)
export interface ApiError {
  error: string;
  code?: number;
}

