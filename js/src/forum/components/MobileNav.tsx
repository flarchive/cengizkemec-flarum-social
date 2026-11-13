import app from 'flarum/forum/app';
import { openLoginModal, openRegisterModal } from '../authModals';

export default class MobileNav {
  view(vnode: any): any {
    const state = vnode.attrs.state;
    const current = m.route.get() || '';
    const item = (href: string, icon: string, label: any) =>
      m('a', { href, className: 'SocialMobileNav-item' + (current === href ? ' is-active' : '') }, [
        m('i', { className: icon }),
        m('span', {}, label),
      ]);
    const action = (icon: string, label: any, onclick: () => void) =>
      m('button', { type: 'button', className: 'SocialMobileNav-item', onclick }, [
        m('i', { className: icon }),
        m('span', {}, label),
      ]);

    return m('nav', { className: 'SocialMobileNav' }, [
      item(app.route('social.index'), 'fas fa-house', app.translator.trans('cengizkemec-social.forum.nav.feed')),
      item(app.route('social.explore'), 'fas fa-compass', app.translator.trans('cengizkemec-social.forum.nav.explore')),
      item(app.route('social.rooms'), 'fas fa-headset', app.translator.trans('cengizkemec-social.forum.nav.rooms')),
      state.user
        ? item(app.route('social.messages'), 'fas fa-envelope', app.translator.trans('cengizkemec-social.forum.nav.messages'))
        : action('fas fa-right-to-bracket', app.translator.trans('cengizkemec-social.forum.auth.login'), () => openLoginModal()),
      state.user
        ? item(app.route('social.profile', { username: state.user.username }), 'fas fa-user', app.translator.trans('cengizkemec-social.forum.nav.profile'))
        : action('fas fa-user-plus', app.translator.trans('cengizkemec-social.forum.auth.register'), () => openRegisterModal()),
    ]);
  }
}
