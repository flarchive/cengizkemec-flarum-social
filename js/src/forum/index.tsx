import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import { get } from '../common/api';
import HeaderPrimary from 'flarum/forum/components/HeaderPrimary';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LinkButton from 'flarum/common/components/LinkButton';
import VoicePanel from './components/VoicePanel';
import ForumVoiceWidget from './components/ForumVoiceWidget';
import ForumSocialMenu from './components/ForumSocialMenu';
import userHoverPreview from './components/UserHoverPreview';
import { installNativeAuthBridge } from './auth';
import { installProfileIntegration } from './profileIntegration';

export { default as extend } from './extend';

app.initializers.add('cengizkemec-social', () => {
  installNativeAuthBridge();
  installProfileIntegration();

  extend(HeaderPrimary.prototype, 'items', (items: any) => {
    if (!app.forum.attribute<boolean>('socialNavigation')) return;

    const position = app.forum.attribute<string>('socialNavPosition') || 'both';

    if (position === 'header' || position === 'both') {
      items.add(
        'social',
        m(LinkButton, { href: '/social', icon: 'fas fa-users' }, app.translator.trans('cengizkemec-social.forum.nav.social')),
        50
      );
    }
  });

  extend(IndexSidebar.prototype, 'navItems', (items: any) => {
    if (!app.forum.attribute<boolean>('socialNavigation')) return;

    const position = app.forum.attribute<string>('socialNavPosition') || 'both';

    if (position === 'sidebar' || position === 'both') {
      items.add(
        'social',
        m(LinkButton, { href: '/social', icon: 'fas fa-users' }, app.translator.trans('cengizkemec-social.forum.nav.social')),
        90
      );
    }
  });

  extend(IndexSidebar.prototype, 'items', (items: any) => {
    if (!app.forum.attribute<boolean>('socialForumVoiceWidget') || !app.forum.attribute<boolean>('socialVoiceEnabled')) return;

    items.add('socialVoiceWidget', m(ForumVoiceWidget, { key: 'socialVoiceWidget' }), -10);
  });

  extend(IndexSidebar.prototype, 'items', (items: any) => {
    if (!app.forum.attribute<boolean>('socialEnabled') || !app.forum.attribute<boolean>('socialForumMenu')) return;

    items.add('socialMenu', m(ForumSocialMenu, { key: 'socialMenu' }), -20);
  });

  app.beforeMount(() => {
    if (app.forum.attribute<boolean>('socialEnabled') && app.forum.attribute<boolean>('socialForumMenu') && !(window as any).__socialRoomsData) {
      get('/social/rooms')
        .then((response: any) => {
          (window as any).__socialRoomsData = response.data;
          m.redraw();
        })
        .catch(() => {});
    }

    const accent = app.forum.attribute<string>('socialAccentColor');
    if (accent) document.documentElement.style.setProperty('--social-accent', accent);

    const customCss = app.forum.attribute<string>('socialCustomCss') || '';
    let style = document.getElementById('social-custom-css') as HTMLStyleElement | null;

    if (!style) {
      style = document.createElement('style');
      style.id = 'social-custom-css';
      document.head.appendChild(style);
    }

    style.textContent = customCss;

    // Most social views render plain anchors for flexibility. Intercept
    // same-origin /social links so every navigation stays inside the SPA
    // instead of triggering a full document reload.
    if (!(window as any).__socialSpaLinks) {
      (window as any).__socialSpaLinks = true;

      document.addEventListener('click', (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const target = event.target as Element | null;
        const anchor = target && typeof target.closest === 'function' ? (target.closest('a') as HTMLAnchorElement | null) : null;

        if (!anchor) return;
        if (anchor.target && anchor.target !== '_self') return;
        if (anchor.hasAttribute('download')) return;

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;

        let url: URL;
        try {
          url = new URL(anchor.href, window.location.href);
        } catch (e) {
          return;
        }

        if (url.origin !== window.location.origin) return;

        // Keep the SPA alive for all normal Flarum routes, so the persistent
        // voice panel keeps its LiveKit connection while browsing the forum.
        // Admin, API, asset and logout URLs intentionally use full navigation.
        if (/^\/(admin|api|assets|logout)(\/|$)/.test(url.pathname)) return;

        event.preventDefault();

        const next = url.pathname + url.search + url.hash;
        if (next !== m.route.get()) m.route.set(next);
      });
    }

    if (!document.getElementById('social-voice-panel-root')) {
      const root = document.createElement('div');
      root.id = 'social-voice-panel-root';
      document.body.appendChild(root);
      m.mount(root, VoicePanel);
    }

    if (!document.getElementById('social-user-preview-root')) {
      const root = document.createElement('div');
      root.id = 'social-user-preview-root';
      document.body.appendChild(root);
      m.mount(root, userHoverPreview);
    }
  });
});
