/**
 * shiprocketHttpClient.ts
 *
 * Dedicated HTTP client and centralized authentication manager for Shiprocket API v2.
 * Enforces token caching with TTL, request timeouts, response validation,
 * and sanitized structured logging (credentials & tokens strictly masked).
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ShiprocketAuthConfig {
  baseUrl: string;
  email?: string;
  password?: string;
}

export class ShiprocketHttpClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private isAuthenticating: Promise<string> | null = null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.SHIPROCKET_API_BASE_URL || 'https://apiv2.shiprocket.in').replace(/\/+$/, '');
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 20000, // 20s timeout
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Request interceptor: attach bearer token and log safely
    this.client.interceptors.request.use((config) => {
      // Never log headers containing Authorization
      const safeUrl = `${config.baseURL || ''}${config.url || ''}`;
      if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_SHIPROCKET === 'true') {
        console.log(`[SHIPROCKET HTTP] ${config.method?.toUpperCase()} ${safeUrl}`);
      }
      return config;
    });

    // Response interceptor: structured logging without secrets
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const safeError = this.sanitizeError(error);
        return Promise.reject(safeError);
      }
    );
  }

  /**
   * Check whether real Shiprocket credentials are configured
   */
  public hasCredentials(): boolean {
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;
    return Boolean(email && password && email.trim() !== '' && password.trim() !== '');
  }

  /**
   * Centralized Authentication with Token Caching
   * Caches token in-memory and reuses it until 1 hour before expiry (~9 days)
   */
  public async getAuthToken(): Promise<string> {
    const now = new Date();

    // 1. Return cached token if valid (with 1-hour grace window)
    if (this.token && this.tokenExpiresAt && this.tokenExpiresAt.getTime() - now.getTime() > 60 * 60 * 1000) {
      return this.token;
    }

    // 2. Concurrency protection: If auth is in-flight, await the existing promise
    if (this.isAuthenticating) {
      return this.isAuthenticating;
    }

    this.isAuthenticating = this.authenticate();
    try {
      const token = await this.isAuthenticating;
      return token;
    } finally {
      this.isAuthenticating = null;
    }
  }

  /**
   * Authenticate against Shiprocket POST /v1/external/auth/login
   */
  private async authenticate(): Promise<string> {
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password || email.trim() === '' || password.trim() === '') {
      throw new Error('Shiprocket credentials not configured: SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are required');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/external/auth/login`,
        { email: email.trim(), password: password.trim() },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      if (!response.data || !response.data.token) {
        throw new Error('Shiprocket authentication returned malformed response: token missing');
      }

      const token = response.data.token;
      this.token = token;

      // Shiprocket tokens last 10 days. We set expiry to 9 days to ensure safe refresh.
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 9);
      this.tokenExpiresAt = expiry;

      console.log('✓ [Shiprocket] Authenticated successfully. Token cached for 9 days.');
      return token;
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message || 'Unknown authentication failure';
      // Strictly prevent credentials leaking into error messages or logs
      console.error(`✗ [Shiprocket] Authentication failed (HTTP ${status || 'ERR'}): ${msg}`);
      throw new Error(`Shiprocket authentication failed: ${msg}`);
    }
  }

  /**
   * Execute Authenticated Request
   */
  public async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const token = await this.getAuthToken();
    const headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };

    const response: AxiosResponse<T> = await this.client.request<T>({
      ...config,
      headers,
    });

    return response.data;
  }

  /**
   * Reset internal token cache (for testing or re-authentication)
   */
  public resetTokenCache(): void {
    this.token = null;
    this.tokenExpiresAt = null;
    this.isAuthenticating = null;
  }

  /**
   * Set mock token for testing token cache and pre-expiry window
   */
  public setMockTokenForTesting(token: string, daysValid: number = 9): void {
    this.token = token;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + daysValid);
    this.tokenExpiresAt = expiry;
  }

  /**
   * Sanitize error to prevent leaking authorization headers or payload secrets
   */
  private sanitizeError(error: any): Error {
    const status = error.response?.status;
    const responseData = error.response?.data;
    const message = responseData?.message || responseData?.error || error.message || 'Network error';

    const safeError = new Error(`Shiprocket API Error [${status || 'TIMEOUT/NETWORK'}]: ${message}`);
    (safeError as any).statusCode = status;
    (safeError as any).responseData = responseData;
    return safeError;
  }
}

export const shiprocketHttpClient = new ShiprocketHttpClient();
