import type { APIResponse } from '@playwright/test';

import type { Http } from '../http';
import { LoginResponseSchema } from '../schemas';

/** POST /users/login */
export class AuthApi {
  constructor(private readonly http: Http) {}

  /** Raw response, for tests that expect a rejected login. */
  loginRequest(email: string, password: string): Promise<APIResponse> {
    return this.http.post('/users/login', { email, password });
  }

  /** Returns the access token of a successful login. */
  async login(email: string, password: string): Promise<string> {
    const body = await this.http.parse(
      await this.loginRequest(email, password),
      'POST /users/login',
      LoginResponseSchema,
    );
    return body.access_token;
  }
}
