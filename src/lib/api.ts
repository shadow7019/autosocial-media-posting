/**
 * Lightweight fetch wrappers for the AutoSocial frontend.
 *
 * - `apiGet`             : GET JSON
 * - `apiPost`            : POST JSON
 * - `apiPatch`           : PATCH JSON
 * - `apiPut`             : PUT JSON
 * - `apiDelete`          : DELETE JSON
 * - `apiPostForm`        : POST multipart/form-data with optional XHR upload progress.
 * - `apiPostFormMultiple`: same as `apiPostForm` but bundles many File entries under
 *                          one field name (`files` by default) for batch / folder uploads.
 *
 * All requests use relative URLs so they hit the Next.js API routes through
 * the same origin. Cross-port routing for the websocket mini-service is
 * handled via the `XTransformPort` query string at the socket layer, not here.
 */

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      (isJson && body && typeof body === "object" && "error" in body
        ? String((body as Record<string, unknown>).error)
        : typeof body === "string" && body
          ? body
          : `Request failed with status ${res.status}`);
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

export async function apiGet<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    method: "GET",
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
    ...init,
  });
  return parseResponse<T>(res);
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
  return parseResponse<T>(res);
}

export async function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
  return parseResponse<T>(res);
}

export async function apiDelete<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    ...init,
  });
  return parseResponse<T>(res);
}

/**
 * POST multipart/form-data with optional progress callback.
 * Uses XHR so we can read upload progress events, which fetch does not
 * support on the upload side.
 *
 * Returns a promise that resolves to the parsed JSON response, and reports
 * `onProgress(percent)` with an integer 0-100.
 */
export function apiPostForm<T = unknown>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path, true);
    xhr.setRequestHeader("Accept", "application/json");

    if (onProgress) {
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      const contentType = xhr.getResponseHeader("content-type") || "";
      const isJson = contentType.includes("application/json");
      const body = isJson ? safeJsonParse(xhr.responseText) : xhr.responseText;

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else {
        const message =
          isJson && body && typeof body === "object" && "error" in body
            ? String((body as Record<string, unknown>).error)
            : typeof body === "string" && body
              ? body
              : `Request failed with status ${xhr.status}`;
        reject(new ApiError(message, xhr.status, body));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError("Network error during upload", 0, null));
    };
    xhr.onabort = () => {
      reject(new ApiError("Upload aborted", 0, null));
    };

    xhr.send(formData);
  });
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * POST a FormData containing multiple File entries under the same field name
 * (`files` by default) — used for folder / batch uploads.
 *
 * Same XHR-based progress reporting as `apiPostForm`, but the `onProgress`
 * callback represents the aggregate upload of the whole batch (the browser
 * only fires one progress stream per request anyway).
 */
export function apiPostFormMultiple<T = unknown>(
  path: string,
  files: File[],
  onProgress?: (percent: number) => void,
  options?: {
    fieldName?: string;
    extraFields?: Record<string, string>;
  },
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const formData = new FormData();
    const fieldName = options?.fieldName ?? "files";
    for (const f of files) {
      formData.append(fieldName, f, (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    }
    if (options?.extraFields) {
      for (const [k, v] of Object.entries(options.extraFields)) {
        formData.append(k, v);
      }
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", path, true);
    xhr.setRequestHeader("Accept", "application/json");

    if (onProgress) {
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      const contentType = xhr.getResponseHeader("content-type") || "";
      const isJson = contentType.includes("application/json");
      const body = isJson ? safeJsonParse(xhr.responseText) : xhr.responseText;

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else {
        const message =
          isJson && body && typeof body === "object" && "error" in body
            ? String((body as Record<string, unknown>).error)
            : typeof body === "string" && body
              ? body
              : `Request failed with status ${xhr.status}`;
        reject(new ApiError(message, xhr.status, body));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError("Network error during upload", 0, null));
    };
    xhr.onabort = () => {
      reject(new ApiError("Upload aborted", 0, null));
    };

    xhr.send(formData);
  });
}
