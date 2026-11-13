import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import SocialState from '../SocialState';
import TextChannel from '../components/TextChannel';
import { openLoginModal } from '../authModals';
import { channelUrl } from '../utils';

export default class ChannelPage extends SocialPage {
  showAside = false;
  loginPrompted = false;

  pageTitle(): string {
    return this.channel()?.name || (app.translator.trans('cengizkemec-social.forum.nav.text_channels') as string);
  }

  onSocialReady(): void {
    if (!SocialState.user && !this.loginPrompted) {
      this.loginPrompted = true;
      openLoginModal();
    }
  }

  channel(): any {
    const key = String(m.route.param('id') || '');

    return this.state.allChannels.find((channel: any) => String(channel.slug || '') === key || String(channel.id) === key);
  }

  content(): any {
    const channel = this.channel();

    if (!channel) {
      return m('div', { className: 'SocialPanel SocialPanel--error' }, [m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.channel_not_found')), m('a', { className: 'Button Button--primary', href: app.route('social.index') }, app.translator.trans('cengizkemec-social.forum.nav.feed'))]);
    }

    return m('div', { className: 'SocialChannelPage' }, [
      m('div', { className: 'SocialPageHead' }, m('div', {}, [
        m('h1', {}, [m('i', { className: channel.icon || 'fas fa-hashtag' }), ' ', channel.name]),
        m('p', {}, channel.description || ''),
        channel.roomId
          ? m('p', { className: 'SocialMuted' }, [
              m('i', { className: 'fas fa-headset' }),
              ' ',
              m('a', { href: app.route('social.room', { slug: channel.roomSlug || channel.roomId }) }, channel.roomName || app.translator.trans('cengizkemec-social.forum.nav.rooms')),
            ])
          : null,
      ])),
      SocialState.user
        ? m(TextChannel, { channel })
        : m('div', { className: 'SocialPanel SocialPanel--auth' }, [
            m('i', { className: 'fas fa-lock' }),
            m('h2', {}, app.translator.trans('cengizkemec-social.forum.messages.login_title')),
            m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.login_text')),
            m('button', { className: 'Button Button--primary', type: 'button', onclick: () => openLoginModal() }, app.translator.trans('cengizkemec-social.forum.auth.login')),
          ]),
    ]);
  }
}
