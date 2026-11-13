import app from 'flarum/forum/app';

const cache = new Map<string, any>();
const pending = new Map<string, Promise<any>>();

const MEDIA_HOSTS = /(?:youtube\.com|youtu\.be|twitter\.com|x\.com|vimeo\.com|soundcloud\.com|twitch\.tv)/i;

/**
 * Use datlechin/flarum-link-preview when it is installed. The extension
 * exposes its settings as forum attributes, so Social can fetch the same card
 * data without depending on its PHP classes or JavaScript internals.
 */
export function firstPreviewUrl(body: string | null | undefined): string | null {
  if (!body) return null;

  const matches = body.match(/https?:\/\/[^\s<>"']+/gi) || [];

  for (const raw of matches) {
    const url = raw.replace(/[),.;!?]+$/, '');

    if (MEDIA_HOSTS.test(url)) continue;
    if (/\.(?:png|jpe?g|gif|webp|svg|mp4|webm|mp3|pdf)(?:\?|#|$)/i.test(url)) continue;

    return url;
  }

  return null;
}

export default class LinkPreview {
  data: any = null;
  loading = false;
  failed = false;
  url: string | null = null;

  oninit(vnode: any): void {
    this.url = vnode.attrs.url;

    if (!this.url) return;

    if (cache.has(this.url)) {
      this.data = cache.get(this.url);
      return;
    }

    if (!this.enabled()) {
      this.failed = true;
      return;
    }

    this.loading = true;

    let request = pending.get(this.url);

    if (!request) {
      request = app.request({
        method: 'POST',
        url: app.forum.attribute('baseUrl') + '/api/datlechin-link-preview',
        body: { url: this.url },
        errorHandler: () => {},
      });

      pending.set(this.url, request);
    }

    request
      .then((response: any) => {
        const preview = response?.data;
        cache.set(this.url as string, preview);
        this.data = preview;
      })
      .catch(() => {
        this.failed = true;
      })
      .finally(() => {
        pending.delete(this.url as string);
        this.loading = false;
        m.redraw();
      });
  }

  enabled(): boolean {
    return app.forum.attribute('datlechin-link-preview.maxPreviewsPerPost') !== undefined;
  }

  view(): any {
    if (!this.enabled() || this.failed || !this.data) return null;
    if (this.data.error) return null;

    const preview = this.data;
    const image = preview.image?.url;

    return m(
      'a',
      {
        className: 'SocialLinkPreview' + (image ? ' SocialLinkPreview--image' : ''),
        href: this.url,
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      },
      [
        image ? m('span', { className: 'SocialLinkPreview-image', style: { backgroundImage: `url("${image}")` } }) : null,
        m('span', { className: 'SocialLinkPreview-body' }, [
          m('span', { className: 'SocialLinkPreview-site' }, [
            preview.favicon ? m('img', { src: preview.favicon, alt: '', loading: 'lazy' }) : null,
            preview.siteName || new URL(this.url as string).hostname,
          ]),
          preview.title ? m('strong', { className: 'SocialLinkPreview-title' }, preview.title) : null,
          preview.description ? m('span', { className: 'SocialLinkPreview-description' }, preview.description) : null,
        ]),
      ]
    );
  }
}
