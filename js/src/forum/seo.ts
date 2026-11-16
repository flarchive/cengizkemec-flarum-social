import app from 'flarum/forum/app';

function upsert(selector: string, create: () => HTMLElement, apply: (element: HTMLElement) => void): void {
  let element = document.head.querySelector(selector) as HTMLElement | null;

  if (!element) {
    element = create();
    document.head.appendChild(element);
  }

  apply(element);
}

/**
 * Keep canonical and Open Graph metadata in sync with the current Social SPA
 * route. This complements FoF SEO without touching or depending on its code.
 */
export function updateSocialSeo(): void {
  const url = window.location.origin + window.location.pathname + window.location.search;
  const title = document.title || (app.forum.attribute('title') as string);
  const description =
    (document.head.querySelector('meta[name="description"]') as HTMLMetaElement | null)?.content ||
    (app.translator.trans('cengizkemec-social.forum.aside.community_text') as string);

  upsert('link[rel="canonical"]', () => {
    const link = document.createElement('link');
    link.rel = 'canonical';
    return link;
  }, (element) => ((element as HTMLLinkElement).href = url));

  upsert('meta[property="og:title"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:title');
    return meta;
  }, (element) => element.setAttribute('content', title));

  upsert('meta[property="og:description"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:description');
    return meta;
  }, (element) => element.setAttribute('content', description));

  upsert('meta[property="og:url"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:url');
    return meta;
  }, (element) => element.setAttribute('content', url));

  upsert('meta[property="og:type"]', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:type');
    return meta;
  }, (element) => element.setAttribute('content', 'website'));
}
