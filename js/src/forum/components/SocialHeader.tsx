import app from 'flarum/forum/app';
import Dropdown from 'flarum/common/components/Dropdown';
import { Avatar } from '../utils';
import { logout } from '../logout';

export default class SocialHeader {
  changeLocale(locale: string): void {
    if (app.session.user) {
      app.session.user.savePreferences({ locale }).then(() => window.location.reload());
      return;
    }

    document.cookie = `locale=${locale}; path=/; expires=Tue, 19 Jan 2038 03:14:07 GMT`;
    window.location.reload();
  }

  /**
   * FoF Links stores its links in the Flarum store. Render the same root links
   * and groups as the forum header so a link added in the admin panel appears
   * in Social too, with the same visibility rules.
   */
  headerLinks(): any[] {
    try {
      const store: any = app.store;
      const all: any[] = typeof store.all === 'function' ? store.all('links') || [] : [];
      const roots = all
        .filter((link: any) => !link.parent?.())
        .filter((link: any) => !(link.guestOnly?.() && app.session.user))
        .filter((link: any) => !(link.isRestricted?.() && !app.session.user))
        .sort((a: any, b: any) => (a.position?.() ?? 0) - (b.position?.() ?? 0));

      return roots
        .map((link: any) => {
          const children = all
            .filter((child: any) => child.parent?.()?.id?.() === link.id?.())
            .sort((a: any, b: any) => (a.position?.() ?? 0) - (b.position?.() ?? 0));

          if (children.length) {
            return m(
              Dropdown,
              {
                className: 'SocialHeader-linksDropdown',
                buttonClassName: 'SocialHeader-link SocialHeader-linksToggle',
                label: this.linkLabel(link),
                accessibleToggleLabel: link.title?.(),
              },
              [
                link.url?.() ? this.linkAnchor(link, true) : null,
                ...children.map((child: any) => this.linkAnchor(child, true)),
              ].filter(Boolean)
            );
          }

          return link.url?.() ? this.linkAnchor(link) : null;
        })
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  linkLabel(link: any): any {
    return [link.icon?.() ? m('i', { className: link.icon() }) : null, link.title?.()].filter(Boolean);
  }

  linkAnchor(link: any, inDropdown = false): any {
    const url = String(link.url?.() || '');
    const href = url.startsWith('/') && link.isInternal?.() ? app.forum.attribute('baseUrl') + url : url;
    const newTab = Boolean(link.isNewtab?.());
    const rel = [newTab ? 'noopener noreferrer' : null, link.useRelMe?.() ? 'me' : null].filter(Boolean).join(' ') || undefined;

    return m(
      'a',
      {
        className: 'SocialHeader-link' + (inDropdown ? ' SocialHeader-link--dropdown' : ''),
        href,
        target: newTab ? '_blank' : undefined,
        rel,
      },
      this.linkLabel(link)
    );
  }

  view(vnode: any): any {
    const state = vnode.attrs.state;
    const user = state.user;
    const locales = app.data.locales || {};
    const showLanguageSelector = app.forum.attribute<boolean>('showLanguageSelector') !== false && Object.keys(locales).length > 1;

    return m('header', { className: 'SocialHeader' }, [
      m('div', { className: 'SocialHeader-left' }, [
        m(
          'button',
          {
            className: 'SocialHeader-menu Button Button--icon Button--link',
            onclick: vnode.attrs.ontoggle,
            'aria-label': app.translator.trans('cengizkemec-social.forum.nav.toggle_menu'),
          },
          m('i', { className: 'fas fa-bars' })
        ),
        m('a', { className: 'SocialBrand', href: app.route('social.index') }, [
          m('span', { className: 'SocialBrand-icon' }, m('i', { className: 'fas fa-comments' })),
          m('span', { className: 'SocialBrand-text' }, m('strong', {}, app.translator.trans('cengizkemec-social.forum.nav.social'))),
        ]),
        m('nav', { className: 'SocialHeader-nav' }, [
          m('a', { className: 'SocialHeader-link SocialHeader-forum', href: app.route('index') }, [m('i', { className: 'fas fa-house' }), ' ', app.translator.trans('cengizkemec-social.forum.nav.forum')]),
          m('a', { className: 'SocialHeader-link', href: app.route('social.explore') }, app.translator.trans('cengizkemec-social.forum.nav.explore')),
          m('a', { className: 'SocialHeader-link', href: app.route('social.index') }, app.translator.trans('cengizkemec-social.forum.nav.feed')),
          m('a', { className: 'SocialHeader-link', href: app.route('social.media') }, app.translator.trans('cengizkemec-social.forum.nav.media')),
          m('a', { className: 'SocialHeader-link', href: app.route('social.rooms') }, app.translator.trans('cengizkemec-social.forum.nav.rooms')),
          user
            ? m('a', { className: 'SocialHeader-link', href: app.route('social.messages') }, app.translator.trans('cengizkemec-social.forum.nav.messages'))
            : null,
          ...this.headerLinks(),
        ]),
      ]),
      m(
        'div',
        { className: 'SocialHeader-right' },
        [
          m(
            'div',
            { className: 'SocialHeader-search' },
            m(
              'form',
              {
                onsubmit: (event: Event) => {
                  event.preventDefault();
                  const target = event.target as HTMLFormElement;
                  const input = target.querySelector('input') as HTMLInputElement;
                  if (input?.value.trim()) {
                    m.route.set(app.route('social.explore', { q: input.value.trim() }));
                  }
                },
              },
              [
                m('i', { className: 'fas fa-search' }),
                m('input', {
                  type: 'search',
                  placeholder: app.translator.trans('cengizkemec-social.forum.nav.search_placeholder'),
                  'aria-label': app.translator.trans('cengizkemec-social.forum.nav.search_placeholder'),
                }),
              ]
            )
          ),
          showLanguageSelector
            ? m(
                'select',
                {
                  className: 'SocialHeader-locale',
                  value: app.data.locale,
                  'aria-label': app.translator.trans('cengizkemec-social.forum.nav.language'),
                  onchange: (event: Event) => this.changeLocale((event.target as HTMLSelectElement).value),
                },
                Object.keys(locales).map((locale) => m('option', { value: locale }, locales[locale]))
              )
            : null,
          user
          ? [
              m(
                'a',
                {
                  className: 'SocialHeader-notifications',
                  href: app.route('social.notifications'),
                  'aria-label': app.translator.trans('cengizkemec-social.forum.nav.notifications'),
                },
                [
                  m('i', { className: 'far fa-bell' }),
                  state.unreadNotifications > 0
                    ? m('span', { className: 'SocialHeader-badge' }, state.unreadNotifications > 99 ? '99+' : state.unreadNotifications)
                    : null,
                ]
              ),
              m('a', { className: 'SocialHeader-user', href: app.route('social.profile', { username: user.username }) }, [
                Avatar(user, 32),
                m('span', { className: 'SocialHeader-username' }, user.displayName),
              ]),
              m(
                'button',
                {
                  className: 'Button Button--icon Button--link SocialHeader-voiceSettings',
                  title: app.translator.trans('cengizkemec-social.forum.voice.settings_title'),
                  onclick: () => app.modal.show(() => import('./VoiceSettingsModal')),
                },
                m('i', { className: 'fas fa-sliders' })
              ),
              m(
                'button',
                {
                  className: 'Button Button--icon Button--link SocialHeader-logout',
                  title: app.translator.trans('cengizkemec-social.forum.auth.logout'),
                  onclick: () => logout(),
                },
                m('i', { className: 'fas fa-sign-out-alt' })
              ),
            ]
          : [
              m(
                'button',
                {
                  className: 'Button Button--link SocialHeader-login',
                  onclick: () => app.modal.show(() => import('flarum/forum/components/LogInModal')),
                },
                app.translator.trans('cengizkemec-social.forum.auth.login')
              ),
              app.forum.attribute('allowSignUp')
                ? m(
                    'button',
                    {
                      className: 'Button Button--primary SocialHeader-register',
                      onclick: () => app.modal.show(() => import('flarum/forum/components/SignUpModal')),
                    },
                    app.translator.trans('cengizkemec-social.forum.auth.register')
                  )
                : null,
            ],
        ]
      ),
    ]);
  }
}
