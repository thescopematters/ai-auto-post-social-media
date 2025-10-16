/**
 * Standardized API response utilities
 * Provides consistent response formats across all endpoints
 */

import { Response } from 'express';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: any[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Send a successful response
 * @param res Express Response object
 * @param data Response data payload
 * @param message Optional success message
 * @param statusCode HTTP status code (default: 200)
 * @param meta Optional metadata (pagination, etc.)
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta,
  };
  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param res Express Response object
 * @param error Error message
 * @param statusCode HTTP status code (default: 500)
 * @param errors Optional array of detailed errors
 */
export const errorResponse = (
  res: Response,
  error: string,
  statusCode: number = 500,
  errors?: any[]
): Response => {
  const response: ApiResponse = {
    success: false,
    error,
    errors,
  };
  return res.status(statusCode).json(response);
};

/**
 * Send a paginated response
 * @param res Express Response object
 * @param data Array of data items
 * @param page Current page number
 * @param limit Items per page
 * @param total Total number of items
 * @param message Optional success message
 */
export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): Response => {
  const totalPages = Math.ceil(total / limit);
  return successResponse(
    res,
    data,
    message,
    200,
    {
      page,
      limit,
      total,
      totalPages,
    }
  );
};
