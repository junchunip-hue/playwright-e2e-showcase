import type { APIRequestContext, APIResponse } from '@playwright/test';
import { z } from 'zod';

import { type ValidationErrors, ValidationErrorsSchema } from './schemas';

/**
 * Shared HTTP layer for the resource clients: status check first, then the response contract.
 * Every JSON body goes through a schema from ./schemas, so any test that touches the API also checks the contract.
 */
export class Http {
  constructor(private readonly request: APIRequestContext) {}

  async get<S extends z.ZodType>(path: string, schema: S, token?: string): Promise<z.infer<S>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return this.parse(await this.request.get(path, { headers }), `GET ${path}`, schema);
  }

  /** Raw GET (any status), for tests that assert on a rejected request. Without a token it is anonymous. */
  getRaw(path: string, token?: string): Promise<APIResponse> {
    return this.request.get(path, { headers: headers(token) });
  }

  /** Raw POST, for tests that assert on the status of a rejected request. */
  post(path: string, data: unknown, token?: string): Promise<APIResponse> {
    return this.request.post(path, { data, headers: headers(token) });
  }

  /** Raw PUT. */
  put(path: string, data: unknown, token?: string): Promise<APIResponse> {
    return this.request.put(path, { data, headers: headers(token) });
  }

  /** Fails on a non-2xx status first, then on a body that breaks the contract (field paths and received values). */
  async parse<S extends z.ZodType>(res: APIResponse, label: string, schema: S): Promise<z.infer<S>> {
    await this.ensureOk(res, label);
    return validate(await res.json(), label, schema);
  }

  async ensureOk(res: APIResponse, label: string): Promise<void> {
    if (res.ok()) return;
    // Include the start of the body: server errors (e.g. Laravel debug output) are otherwise invisible in CI.
    const body = (await res.text()).slice(0, 500);
    throw new Error(`${label} failed: ${res.status()}\n${body}`);
  }

  /** Field errors of a rejected request (422 validation, 409 conflict). */
  async validationErrors(res: APIResponse, label: string): Promise<ValidationErrors> {
    return this.body(res, `${label} error body`, ValidationErrorsSchema);
  }

  /** Validates a body regardless of status, for tests that expect a rejection. */
  async body<S extends z.ZodType>(res: APIResponse, label: string, schema: S): Promise<z.infer<S>> {
    return validate(await res.json(), label, schema);
  }
}

function headers(token?: string): Record<string, string> {
  return { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function validate<S extends z.ZodType>(body: unknown, label: string, schema: S): z.infer<S> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const received = result.error.issues
    .map((i) => `  ${i.path.join('.') || '(root)'} = ${JSON.stringify(valueAt(body, i.path))?.slice(0, 120)}`)
    .join('\n');
  throw new Error(`${label} does not match its schema:\n${z.prettifyError(result.error)}\nReceived:\n${received}`);
}

function valueAt(value: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>((v, key) => (v as Record<PropertyKey, unknown> | undefined)?.[key], value);
}
