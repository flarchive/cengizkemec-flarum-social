import app from 'flarum/forum/app';
import SocialState from '../SocialState';
import { get, post } from '../../common/api';
import { Avatar, handleApiError, timeAgo } from '../utils';

/**
 * Global user hover card. It is mounted once at the app root so feed posts,
 * comments, search results and the right rail can all show the same preview.
 */
class UserHoverPreview {
  member: any = null;
  user: any = null;
  social: any = null;
  loading = false;
  top = 0;
  left = 0;
  timer: number | null = null;
  hideTimer: number | null = null;

  clearTimers(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.timer = null;
    this.hideTimer = null;
  }

  show(member: any, event: MouseEvent): void {
    if (!member?.username) return;

    this.clearTimers();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.member = member;
    this.user = null;
    this.social = null;
    this.loading = true;
    this.top = Math.max(10, Math.min(rect.top, window.innerHeight - 420));
    this.left = Math.max(10, rect.left - 326);
    m.redraw();

    this.timer = window.setTimeout(() => {
      app.store
        .find('users', member.id)
        .then((user: any) => (this.user = user))
        .catch(() => {})
        .then(() => {
          this.loading = false;
          m.redraw();
        });

      get(`/social/profile/${encodeURIComponent(member.username)}`)
        .then((response: any) => {
          this.social = response.data;
          m.redraw();
        })
        .catch(() => {});
    }, 260);
  }

  hide(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.hideTimer = window.setTimeout(() => {
      this.member = null;
      this.user = null;
      this.social = null;
      this.loading = false;
      m.redraw();
    }, 200);
  }

  keep(): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  canMessage(): boolean {
    if (!app.session.user || !this.member) return false;

    const id = Number(this.social?.id || this.member.id);

    return Boolean(id) && id !== Number(app.session.user.id());
  }

  message(): void {
    const social = this.social;
    const member = this.member;

    if (!social?.id && !member?.id) return;

    const user = {
      id: social?.id || member.id,
      username: social?.username || member.username,
      displayName: social?.displayName || member.displayName,
      avatarUrl: social?.avatarUrl || member.avatarUrl,
    };

    const nativeMessages = Boolean((app as any).dialogs && typeof (app as any).dialogs.refresh === 'function');

    if (nativeMessages) {
      app.modal.show(() => import('./NewNativeMessageModal'), {
        user,
        oncreated: (dialogId: string | null) => {
          if (dialogId) m.route.set(app.route('social.messages.conversation', { id: dialogId }));
        },
      });
      return;
    }

    post('/social/dm/conversations', { user_id: user.id })
      .then((response: any) => m.route.set(app.route('social.messages.conversation', { id: response.data.id })))
      .catch(handleApiError);
  }

  addFriend(): void {
    const social = this.social;
    const id = social?.id || this.member?.id;

    if (!id || social?.friendshipStatus) return;

    post(`/social/friends/${id}`)
      .then(() => {
        if (this.social) this.social.friendshipStatus = 'pending';
        m.redraw();
      })
      .catch(handleApiError);
  }

  view(): any {
    const member = this.member;

    if (!member) return null;

    const model = this.user;
    const social = this.social;
    const bio = model?.bio?.() || social?.bio || member.bio || null;
    const cover = model?.cover?.() || model?.attribute?.('cover') || social?.coverUrl || member.coverUrl || null;
    const joined = model?.joinTime?.();
    const posts = model?.commentCount?.() ?? social?.postsCount ?? null;
    const discussions = model?.discussionCount?.() ?? null;
    const friendStatus = social?.friendshipStatus;

    return m('div', {
      className: 'SocialUserPreview',
      style: { top: `${this.top}px`, left: `${this.left}px` },
      onmouseenter: () => this.keep(),
      onmouseleave: () => this.hide(),
    }, [
      cover
        ? m('div', {
            className: 'SocialUserPreview-cover',
            style: { backgroundImage: `url("${encodeURI(cover).replace(/"/g, '%22')}")` },
          })
        : null,
      m('div', { className: 'SocialUserPreview-head' }, [
        m('span', { className: 'SocialUserPreview-avatar' }, Avatar({ displayName: member.displayName, username: member.username, avatarUrl: member.avatarUrl }, 52)),
        m('div', {}, [m('strong', {}, member.displayName), m('small', {}, '@' + member.username)]),
      ]),
      this.loading && !model
        ? m('div', { className: 'SocialUserPreview-loading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
        : [
            bio ? m('p', { className: 'SocialUserPreview-bio' }, bio) : null,
            m('div', { className: 'SocialUserPreview-meta' }, [
              joined ? m('span', {}, [m('i', { className: 'fas fa-calendar' }), ' ', new Date(joined).toLocaleDateString(app.data.locale || undefined)]) : null,
              posts !== null ? m('span', {}, [m('i', { className: 'fas fa-comment' }), ' ', posts]) : null,
              discussions !== null ? m('span', {}, [m('i', { className: 'fas fa-comments' }), ' ', discussions]) : null,
            ]),
          ],
      m('a', { className: 'Button Button--primary Button--block SocialUserPreview-link', href: app.route('user', { username: member.username }) }, app.translator.trans('cengizkemec-social.forum.aside.open_flarum_profile')),
      m('div', { className: 'SocialUserPreview-actions' }, [
        this.canMessage()
          ? m('button', { className: 'Button Button--link Button--small', type: 'button', onclick: () => this.message() }, [m('i', { className: 'fas fa-envelope' }), ' ', app.translator.trans('cengizkemec-social.forum.profile.message')])
          : null,
        friendStatus === 'accepted'
          ? m('span', { className: 'SocialBadge' }, app.translator.trans('cengizkemec-social.forum.profile.friends'))
          : friendStatus === 'pending'
          ? m('span', { className: 'SocialBadge' }, app.translator.trans('cengizkemec-social.forum.profile.friend_pending'))
          : SocialState.config.features?.friends && Number(social?.id || member.id) !== Number(app.session.user?.id)
          ? m('button', { className: 'Button Button--link Button--small', type: 'button', onclick: () => this.addFriend() }, [m('i', { className: 'fas fa-user-plus' }), ' ', app.translator.trans('cengizkemec-social.forum.profile.add_friend')])
          : null,
      ]),
    ]);
  }
}

const preview = new UserHoverPreview();

export function showUserPreview(member: any, event: MouseEvent): void {
  preview.show(member, event);
}

export function hideUserPreview(): void {
  preview.hide();
}

export default preview;
