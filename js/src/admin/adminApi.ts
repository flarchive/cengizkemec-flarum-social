import app from 'flarum/admin/app';

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function url(path: string): string {
  return app.forum.attribute<string>('apiUrl') + path;
}

function detail(error: any): string {
  return error?.response?.errors?.[0]?.detail || error?.message || (app.translator.trans('cengizkemec-social.admin.errors.generic') as string);
}

export async function adminRequest<T = any>(method: string, path: string, body?: any): Promise<T> {
  const options: any = { method, url: url(path), errorHandler: () => {} };
  if (body !== undefined) options.body = body;

  try {
    return (await app.request(options)) as T;
  } catch (error: any) {
    throw new AdminApiError(detail(error), Number(error?.status || 0));
  }
}

export const adminGet = <T = any>(path: string, params: Record<string, any> = {}): Promise<T> => {
  const query = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key])))
    .join('&');

  return adminRequest<T>('GET', path + (query ? '?' + query : ''));
};

export const adminPost = <T = any>(path: string, body: any = {}): Promise<T> => adminRequest<T>('POST', path, body);
export const adminPatch = <T = any>(path: string, body: any = {}): Promise<T> => adminRequest<T>('PATCH', path, body);
export const adminDelete = <T = any>(path: string): Promise<T> => adminRequest<T>('DELETE', path);
