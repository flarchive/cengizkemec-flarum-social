import app from 'flarum/forum/app';
import SocialState from '../SocialState';
import { del, patch, post as apiPost } from '../../common/api';
import { Avatar, formatBody, handleApiError, promptLogin, timeAgo } from '../utils';
import MediaGallery from './MediaGallery';
import { showUserPreview, hideUserPreview } from './UserHoverPreview';

export default class CommentCard {
  editing = false;
  editingBody = '';
  saving = false;

  react(): void {
    if (promptLogin('like')) return;

    apiPost(`/social/comments/${this.attrs.comment.id}/react`, { type: 'like' })
      .then((response: any) => {
        const data = response.data;
        this.attrs.comment.reacted = data.reacted;
        this.attrs.comment.reactionsCount = data.reactionsCount;
        this.attrs.comment.reactionSummary = data.reactionSummary;
        m.redraw();
      })
      .catch(handleApiError);
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;

    patch(`/social/comments/${this.attrs.comment.id}`, { body: this.editingBody })
      .then((response: any) => {
        Object.assign(this.attrs.comment, response.data);
        this.editing = false;
        this.attrs.onupdate?.(this.attrs.comment);
      })
      .catch(handleApiError)
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }

  remove(): void {
    if (!confirm(app.translator.trans('cengizkemec-social.forum.comments.confirm_delete') as string)) return;

    del(`/social/comments/${this.attrs.comment.id}`)
      .then((response: any) => {
        this.attrs.onremove?.(this.attrs.comment, response.post?.commentsCount);
      })
      .catch(handleApiError);
  }

  view(vnode: any): any {
    this.attrs = vnode.attrs;
    const comment = vnode.attrs.comment;

    return m('div', { className: 'SocialComment' + (comment.parentId ? ' SocialComment--reply' : '') }, [
      m('a', {
        href: app.route('social.profile', { username: comment.user.username }),
        className: 'SocialComment-avatar',
        onmouseenter: (event: MouseEvent) => showUserPreview(comment.user, event),
        onmouseleave: () => hideUserPreview(),
      }, Avatar(comment.user, 34)),
      m('div', { className: 'SocialComment-content' }, [
        m('div', { className: 'SocialComment-head' }, [
          m('a', {
            href: app.route('social.profile', { username: comment.user.username }),
            onmouseenter: (event: MouseEvent) => showUserPreview(comment.user, event),
            onmouseleave: () => hideUserPreview(),
          }, m('strong', {}, comment.user.displayName)),
          m('span', { className: 'SocialComment-time' }, timeAgo(comment.createdAt)),
          comment.editedAt ? m('span', { className: 'SocialComment-time' }, '· ' + app.translator.trans('cengizkemec-social.forum.post.edited')) : null,
        ]),
        this.editing
          ? m('div', { className: 'SocialComment-edit' }, [
              m('textarea', { className: 'FormControl', rows: 3, value: this.editingBody, oninput: (event: Event) => (this.editingBody = (event.target as HTMLTextAreaElement).value) }),
              m('div', { className: 'SocialComment-editActions' }, [
                m('button', { className: 'Button Button--primary Button--small', onclick: () => this.save(), loading: this.saving }, app.translator.trans('cengizkemec-social.forum.post.save')),
                m('button', { className: 'Button Button--link Button--small', onclick: () => (this.editing = false) }, app.translator.trans('cengizkemec-social.forum.common.cancel')),
              ]),
            ])
          : m('div', { className: 'SocialComment-body' }, formatBody(comment.body, comment.bodyHtml)),
        comment.media?.length ? m(MediaGallery, { media: comment.media }) : null,
        m('div', { className: 'SocialComment-actions' }, [
          m('button', { className: 'SocialComment-action' + (comment.reacted === 'like' ? ' is-active' : ''), onclick: () => this.react() }, [
            m('i', { className: comment.reacted === 'like' ? 'fas fa-heart' : 'far fa-heart' }),
            comment.reactionsCount ? m('span', {}, comment.reactionsCount) : null,
          ]),
          SocialState.user ? m('button', { className: 'SocialComment-action', onclick: () => vnode.attrs.onreply?.(comment) }, [m('i', { className: 'fas fa-reply' }), ' ', app.translator.trans('cengizkemec-social.forum.comments.reply')]) : null,
          comment.canEdit ? m('button', { className: 'SocialComment-action', onclick: () => { this.editing = true; this.editingBody = comment.body || ''; } }, app.translator.trans('cengizkemec-social.forum.post.edit')) : null,
          comment.canDelete ? m('button', { className: 'SocialComment-action SocialComment-action--danger', onclick: () => this.remove() }, app.translator.trans('cengizkemec-social.forum.post.delete')) : null,
          comment.canReport ? m('button', { className: 'SocialComment-action', onclick: () => app.modal.show(() => import('./ReportModal'), { subjectType: 'comment', subjectId: comment.id }) }, app.translator.trans('cengizkemec-social.forum.report.action')) : null,
        ]),
      ]),
    ]);
  }
}
