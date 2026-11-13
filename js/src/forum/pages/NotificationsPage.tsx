import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import { get, post } from '../../common/api';
import { Avatar, timeAgo } from '../utils';
import { openLoginModal } from '../authModals';

export default class NotificationsPage extends SocialPage {
  notifications: any[] = [];
  loading = true;
  error: string | null = null;

  pageTitle(): string {
    return app.translator.trans('cengizkemec-social.forum.nav.notifications') as string;
  }

  onSocialReady(): void {
    if (!this.state.user) {
      this.loading = false;
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    get('/social/notifications')
      .then((response: any) => {
        this.notifications = response.data || [];
        post('/social/notifications/read', { all: true }).then(() => {
          this.state.setUnread(0);
          this.notifications.forEach((notification) => (notification.read = true));
          m.redraw();
        }).catch(() => {});
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  linkFor(notification: any): string {
    const data = notification.data || {};

    switch (notification.type) {
      case 'follow':
      case 'friend':
        return notification.actor ? app.route('social.profile', { username: notification.actor.username }) : app.route('social.index');
      case 'invite':
        return data.room_id ? app.route('social.room', { id: data.room_id }) : app.route('social.rooms');
      case 'mention':
        if (data.channel_id) return app.route('social.channel', { id: data.channel_id });
        if (data.post_id) return app.route('social.post', { id: data.post_id });
        return app.route('social.index');
      case 'comment':
      case 'reaction':
        return data.post_id ? app.route('social.post', { id: data.post_id }) : app.route('social.index');
      default:
        return app.route('social.index');
    }
  }

  iconFor(type: string): string {
    return {
      comment: 'far fa-comment',
      reaction: 'fas fa-heart',
      follow: 'fas fa-user-plus',
      friend: 'fas fa-user-group',
      invite: 'fas fa-door-open',
      mention: 'fas fa-at',
      moderation: 'fas fa-shield-halved',
      message: 'fas fa-envelope',
    }[type] || 'fas fa-bell';
  }

  content(): any {
    if (!this.state.user) {
      return m('div', { className: 'SocialPanel SocialPanel--auth' }, [
        m('i', { className: 'far fa-bell' }),
        m('h2', {}, app.translator.trans('cengizkemec-social.forum.notifications.login_title')),
        m('button', { className: 'Button Button--primary', type: 'button', onclick: () => openLoginModal() }, app.translator.trans('cengizkemec-social.forum.auth.login')),
      ]);
    }

    return m('div', { className: 'SocialNotificationsPage' }, [
      m('div', { className: 'SocialPageHead' }, m('div', {}, [m('h1', {}, app.translator.trans('cengizkemec-social.forum.notifications.title')), m('p', {}, app.translator.trans('cengizkemec-social.forum.notifications.subtitle'))])),
      this.loading
        ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
        : this.notifications.length
        ? m('div', { className: 'SocialNotifications' }, this.notifications.map((notification) =>
            m('a', { className: 'SocialNotification' + (notification.read ? '' : ' is-unread'), href: this.linkFor(notification)}, [
              m('span', { className: 'SocialNotification-icon' }, m('i', { className: this.iconFor(notification.type) })),
              m('span', { className: 'SocialNotification-avatar' }, notification.actor ? Avatar(notification.actor, 34) : m('i', { className: 'fas fa-bell' })),
              m('span', { className: 'SocialNotification-text' }, app.translator.trans(`cengizkemec-social.forum.notifications.types.${notification.type}`, {
                user: notification.actor?.displayName || '',
                excerpt: notification.data?.excerpt || '',
              })),
              m('span', { className: 'SocialNotification-time' }, timeAgo(notification.createdAt)),
            ])
          ))
        : m('div', { className: 'SocialEmpty' }, [m('i', { className: 'far fa-bell' }), m('h3', {}, app.translator.trans('cengizkemec-social.forum.notifications.empty')), m('p', {}, app.translator.trans('cengizkemec-social.forum.notifications.empty_text'))]),
    ]);
  }
}
