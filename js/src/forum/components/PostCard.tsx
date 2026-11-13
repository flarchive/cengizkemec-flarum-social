import app from 'flarum/forum/app';
import SocialState from '../SocialState';
import { del, post as apiPost } from '../../common/api';
import { Avatar, formatBody, handleApiError, promptLogin, timeAgo } from '../utils';
import LinkPreview, { firstPreviewUrl } from './LinkPreview';
import CommentSection from './CommentSection';
import MediaGallery from './MediaGallery';
import { showUserPreview, hideUserPreview } from './UserHoverPreview';

const REACTIONS: Record<string, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};

export default class PostCard {
  menuOpen = false;
  reactionsOpen = false;
  reacting = false;
  bookmarked = false;
  commentsOpen = false;

  oninit(vnode: any) {
    this.bookmarked = Boolean(vnode.attrs.post?.bookmarked);
  }

  react(type: string): void {
    if (promptLogin('like')) return;
    if (this.reacting) return;

    this.reacting = true;
    apiPost(`/social/posts/${this.attrs.post.id}/react`, { type })
      .then((response: any) => {
        const data = response.data;
        this.attrs.post.reacted = data.reacted;
        this.attrs.post.reactionsCount = data.reactionsCount;
        this.attrs.post.reactionSummary = data.reactionSummary;
        this.reactionsOpen = false;
        this.attrs.onupdate?.(this.attrs.post);
        m.redraw();
      })
      .catch(handleApiError)
      .finally(() => (this.reacting = false));
  }

  bookmark(): void {
    if (promptLogin('generic')) return;

    apiPost(`/social/posts/${this.attrs.post.id}/bookmark`)
      .then((response: any) => {
        this.bookmarked = response.data.bookmarked;
        this.attrs.post.bookmarked = this.bookmarked;
        app.alerts.show({ type: 'success' }, app.translator.trans(this.bookmarked ? 'cengizkemec-social.forum.post.bookmarked' : 'cengizkemec-social.forum.post.unbookmarked'));
        m.redraw();
      })
      .catch(handleApiError);
  }

  share(): void {
    app.modal.show(() => import('./SharePostModal'), { post: this.attrs.post });
  }

  edit(): void {
    app.modal.show(() => import('./PostEditorModal'), {
      post: this.attrs.post,
      maxLength: SocialState.config.feed?.maxLength,
      onupdated: (data: any) => {
        Object.assign(this.attrs.post, data);
        this.attrs.onupdate?.(this.attrs.post);
        m.redraw();
      },
    });
  }

  remove(): void {
    if (!confirm(app.translator.trans('cengizkemec-social.forum.post.confirm_delete') as string)) return;

    del(`/social/posts/${this.attrs.post.id}`)
      .then(() => {
        app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.post.deleted'));
        this.attrs.onremove?.(this.attrs.post);
      })
      .catch(handleApiError);
  }

  pin(): void {
    apiPost(`/social/posts/${this.attrs.post.id}/pin`)
      .then((response: any) => {
        Object.assign(this.attrs.post, response.data);
        this.attrs.onupdate?.(this.attrs.post);
        m.redraw();
      })
      .catch(handleApiError);
  }

  report(): void {
    app.modal.show(() => import('./ReportModal'), { subjectType: 'post', subjectId: this.attrs.post.id });
    this.menuOpen = false;
  }

  view(vnode: any): any {
    this.attrs = vnode.attrs;
    const post = vnode.attrs.post;
    const summary = post.reactionSummary || {};
    const reacted = post.reacted;

    return m('article', { className: 'SocialPost' + (post.isPinned ? ' is-pinned' : '') }, [
      post.isPinned || post.isAnnouncement
        ? m('div', { className: 'SocialPost-badges' }, [
            post.isPinned ? m('span', { className: 'SocialBadge SocialBadge--pin' }, [m('i', { className: 'fas fa-thumbtack' }), ' ', app.translator.trans('cengizkemec-social.forum.post.pinned')]) : null,
            post.isAnnouncement ? m('span', { className: 'SocialBadge SocialBadge--announcement' }, [m('i', { className: 'fas fa-bullhorn' }), ' ', app.translator.trans('cengizkemec-social.forum.post.announcement')]) : null,
          ])
        : null,
      m('div', { className: 'SocialPost-head' }, [
        m('a', {
          href: app.route('social.profile', { username: post.user.username }),
          className: 'SocialPost-avatar',
          onmouseenter: (event: MouseEvent) => showUserPreview(post.user, event),
          onmouseleave: () => hideUserPreview(),
        }, Avatar(post.user, 42)),
        m('div', { className: 'SocialPost-meta' }, [
          m('div', { className: 'SocialPost-author' }, [
            m('a', {
              href: app.route('social.profile', { username: post.user.username }),
              onmouseenter: (event: MouseEvent) => showUserPreview(post.user, event),
              onmouseleave: () => hideUserPreview(),
            }, m('strong', {}, post.user.displayName)),
            post.user.online ? m('span', { className: 'SocialPost-online', title: app.translator.trans('cengizkemec-social.forum.aside.online') }) : null,
            m('span', { className: 'SocialPost-username' }, '@' + post.user.username),
            m('span', { className: 'SocialPost-dot' }, '·'),
            m('a', { href: app.route('social.post', { id: post.id }), className: 'SocialPost-time' }, timeAgo(post.createdAt)),
          ]),
          m('div', { className: 'SocialPost-sub' }, [
            m('span', { className: 'SocialPost-visibility' }, [
              m('i', { className: post.visibility === 'public' ? 'fas fa-globe' : post.visibility === 'private' ? 'fas fa-lock' : 'fas fa-users' }),
              ' ',
              app.translator.trans(`cengizkemec-social.forum.post.visibility.${post.visibility}`),
            ]),
            post.editedAt ? m('span', { className: 'SocialPost-edited' }, ' · ' + app.translator.trans('cengizkemec-social.forum.post.edited')) : null,
          ]),
        ]),
        post.canEdit || post.canDelete || post.canPin || post.canReport
          ? m('div', { className: 'SocialPost-menuWrap' }, [
              m('button', {
                className: 'SocialPost-menuButton Button Button--icon Button--link',
                onclick: () => (this.menuOpen = !this.menuOpen),
                'aria-label': app.translator.trans('cengizkemec-social.forum.post.more'),
              }, m('i', { className: 'fas fa-ellipsis' })),
              this.menuOpen
                ? m('div', { className: 'SocialPost-menu', onclick: () => (this.menuOpen = false) }, [
                    post.canEdit ? m('button', { className: 'SocialPost-menuItem', onclick: () => this.edit() }, [m('i', { className: 'fas fa-pen' }), ' ', app.translator.trans('cengizkemec-social.forum.post.edit')]) : null,
                    post.canPin ? m('button', { className: 'SocialPost-menuItem', onclick: () => this.pin() }, [m('i', { className: 'fas fa-thumbtack' }), ' ', app.translator.trans(post.isPinned ? 'cengizkemec-social.forum.post.unpin' : 'cengizkemec-social.forum.post.pin')]) : null,
                    post.canDelete ? m('button', { className: 'SocialPost-menuItem SocialPost-menuItem--danger', onclick: () => this.remove() }, [m('i', { className: 'fas fa-trash' }), ' ', app.translator.trans('cengizkemec-social.forum.post.delete')]) : null,
                    post.canReport ? m('button', { className: 'SocialPost-menuItem', onclick: () => this.report() }, [m('i', { className: 'fas fa-flag' }), ' ', app.translator.trans('cengizkemec-social.forum.report.action')]) : null,
                  ])
                : null,
            ])
          : null,
      ]),
      post.body ? m('div', { className: 'SocialPost-body' }, formatBody(post.body, post.bodyHtml)) : null,
      firstPreviewUrl(post.body) ? m(LinkPreview, { url: firstPreviewUrl(post.body) }) : null,
      post.media?.length ? m(MediaGallery, { media: post.media }) : null,
      m('div', { className: 'SocialPost-actions' }, [
        m('div', { className: 'SocialPost-actionWrap' }, [
          m('button', {
            type: 'button',
            className: 'SocialPost-action' + (reacted === 'like' ? ' is-active' : ''),
            onclick: () => this.react('like'),
            'aria-label': app.translator.trans('cengizkemec-social.forum.post.like'),
          }, [
            m('span', { className: 'SocialPost-reaction' }, reacted === 'like' ? '❤️' : '🤍'),
            m('span', {}, post.reactionsCount || ''),
          ]),
          m('button', {
            type: 'button',
            className: 'SocialPost-action SocialPost-reactToggle',
            onclick: () => (this.reactionsOpen = !this.reactionsOpen),
            'aria-label': app.translator.trans('cengizkemec-social.forum.post.react'),
          }, m('i', { className: 'far fa-face-smile' })),
          this.reactionsOpen
            ? m('div', { className: 'SocialReactionPicker' }, Object.keys(REACTIONS).map((type) =>
                m('button', {
                  type: 'button',
                  title: app.translator.trans(`cengizkemec-social.forum.reactions.${type}`),
                  className: 'SocialReactionPicker-item' + (reacted === type ? ' is-active' : ''),
                  onclick: () => this.react(type),
                }, REACTIONS[type])
              ))
            : null,
        ]),
        m('button', {
          type: 'button',
          className: 'SocialPost-action' + (this.commentsOpen ? ' is-active' : ''),
          onclick: () => {
            if (promptLogin('comment')) return;
            this.commentsOpen = !this.commentsOpen;
            m.redraw();
          },
          'aria-expanded': this.commentsOpen,
        }, [m('i', { className: this.commentsOpen ? 'fas fa-comment' : 'far fa-comment' }), m('span', {}, post.commentsCount || '')]),
        m('button', {
          type: 'button',
          className: 'SocialPost-action' + (this.bookmarked ? ' is-active' : ''),
          onclick: () => this.bookmark(),
          'aria-label': app.translator.trans('cengizkemec-social.forum.post.bookmark'),
        }, m('i', { className: this.bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark' })),
        m('button', {
          type: 'button',
          className: 'SocialPost-action',
          onclick: () => this.share(),
          'aria-label': app.translator.trans('cengizkemec-social.forum.post.share'),
        }, m('i', { className: 'fas fa-share' })),
        m('span', { className: 'SocialPost-spacer' }),
        Object.keys(summary).length
          ? m('div', { className: 'SocialPost-summary' }, Object.keys(summary).map((type) =>
              m('span', { className: 'SocialPost-summaryItem', title: app.translator.trans(`cengizkemec-social.forum.reactions.${type}`) }, [REACTIONS[type] || '❤️', ' ', summary[type]])
            ))
          : null,
      ]),
      this.commentsOpen ? m('div', { className: 'SocialPostComments' }, m(CommentSection, { post })) : null,
    ]);
  }
}
