import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import { get } from '../../common/api';
import { Avatar, timeAgo } from '../utils';

export default class StoryViewersModal extends Modal {
  story: any = null;
  users: any[] = [];
  count = 0;
  loading = true;
  error: string | null = null;

  oninit(vnode: any): void {
    super.oninit(vnode);
    this.story = vnode.attrs.story;
    this.load();
  }

  className(): string {
    return 'Modal--small SocialStoryViewersModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.stories.viewers') as string;
  }

  load(): void {
    if (!this.story?.id) {
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    get(`/social/stories/${this.story.id}/views`)
      .then((response: any) => {
        this.users = response.data?.users || [];
        this.count = Number(response.data?.count ?? this.users.length);
      })
      .catch((error: any) => {
        this.error = error?.message || (app.translator.trans('cengizkemec-social.forum.stories.viewers_error') as string);
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  content(): any {
    if (this.loading) {
      return m('div', { className: 'SocialStoryViewers-loading' }, m('i', { className: 'fas fa-spinner fa-spin' }));
    }

    if (this.error) {
      return m('div', { className: 'SocialStoryViewers-empty' }, this.error);
    }

    if (!this.users.length) {
      return m('div', { className: 'SocialStoryViewers-empty' }, app.translator.trans('cengizkemec-social.forum.stories.viewers_empty'));
    }

    return m('div', { className: 'SocialStoryViewers' }, [
      m('div', { className: 'SocialStoryViewers-count' }, [
        m('i', { className: 'far fa-eye' }),
        ' ',
        this.count,
      ]),
      m('div', { className: 'SocialStoryViewers-list' }, this.users.map((user: any) => {
        const nameStyle = user.roleColor
          ? { color: `color-mix(in srgb, ${user.roleColor} 72%, var(--heading-color))` }
          : undefined;

        return m('a', {
          className: 'SocialStoryViewers-user',
          href: app.route('social.profile', { username: user.username }),
          onclick: () => this.hide(),
        }, [
          Avatar(user, 40),
          m('span', { className: 'SocialStoryViewers-userInfo' }, [
            m('strong', { style: nameStyle, title: user.roleName || undefined }, user.displayName),
            m('small', {}, '@' + user.username),
          ]),
          user.viewedAt
            ? m('span', { className: 'SocialStoryViewers-time' }, timeAgo(user.viewedAt))
            : null,
        ]);
      })),
    ]);
  }
}
