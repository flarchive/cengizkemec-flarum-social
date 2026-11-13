import app from 'flarum/forum/app';

export class SocialApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function apiUrl(path: string): string {
  return app.forum.attribute<string>('apiUrl') + path;
}

function extractError(error: any): string {
  const detail = error?.response?.errors?.[0]?.detail;

  if (typeof detail === 'string' && detail !== '') {
    try {
      return decodeURIComponent(detail);
    } catch (e) {
      return detail;
    }
  }

  if (error?.status === 401) {
    return app.translator.trans('cengizkemec-social.forum.errors.auth_required') as string;
  }

  if (error?.status === 403) {
    return app.translator.trans('cengizkemec-social.forum.errors.forbidden') as string;
  }

  return (error?.message as string) || (app.translator.trans('cengizkemec-social.forum.errors.generic') as string);
}

export async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const options: any = {
    method,
    url: apiUrl(path),
    errorHandler: () => {},
  };

  if (body !== undefined) {
    options.body = body;
  }

  try {
    return (await app.request(options)) as T;
  } catch (error: any) {
    throw new SocialApiError(extractError(error), Number(error?.status || 0));
  }
}

export function get<T = any>(path: string, params: Record<string, any> = {}): Promise<T> {
  const parts: string[] = [];

  const append = (key: string, value: any) => {
    if (value === undefined || value === null || value === '') return;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  };

  Object.keys(params).forEach((key) => {
    const value = params[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.keys(value).forEach((nested) => append(`${key}[${nested}]`, value[nested]));
    } else {
      append(key, value);
    }
  });

  const query = parts.length ? '?' + parts.join('&') : '';

  return request<T>('GET', path + query);
}

export function post<T = any>(path: string, body: any = {}): Promise<T> {
  return request<T>('POST', path, body);
}

export function patch<T = any>(path: string, body: any = {}): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function del<T = any>(path: string, body?: any): Promise<T> {
  return request<T>('DELETE', path, body);
}

export function uploadFile<T = any>(path: string, file: File, onProgress?: (percent: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const data = new FormData();
    data.append('file', file);

    xhr.open('POST', apiUrl(path));
    xhr.setRequestHeader('X-CSRF-Token', app.session.csrfToken);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }

    xhr.onload = () => {
      let payload: any = null;

      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (e) {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as T);
      } else {
        const detail = payload?.errors?.[0]?.detail;
        reject(new SocialApiError(detail || app.translator.trans('cengizkemec-social.forum.errors.upload_failed'), xhr.status));
      }
    };

    xhr.onerror = () => reject(new SocialApiError(app.translator.trans('cengizkemec-social.forum.errors.generic'), 0));
    xhr.send(data);
  });
}
