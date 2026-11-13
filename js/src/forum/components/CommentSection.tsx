import app from 'flarum/forum/app';
import SocialState from '../SocialState';
import { get, post as apiPost } from '../../common/api';
import { handleApiError, promptLogin } from '../utils';
import { subscribeRealtime } from '../realtime';
import CommentCard from './CommentCard';
import Button from 'flarum/common/components/Button';

export default class CommentSection {
  attrs: any = {};
  comments: any[] = [];
  meta: any = {};
  loading = false;
  loadingMore = false;
  body = '';
  parent: any = null;
  submitting = false;
  disposer: (() => void) | null = null;
  timer: number | null = null;
  textarea: HTMLTextAreaElement | null = null;

  oninit(vnode: any): void {
    this.attrs = vnode.attrs;
    this.load();
  }

  oncreate(vnode: any): void {
    this.attrs = vnode.attrs;
    const postId = this.attrs.post.id;
    this.disposer = subscribeRealtime(`social:post:${postId}`, (event: any) => {
      if (event.type === 'comment.created' && event.comment) {
        this.mergeComment(event.comment);
      } else if (event.type === 'comment.deleted') {
        this.comments = this.comments.filter((item) => item.id !== event.comment_id);
        if (this.attrs.post) this.attrs.post.commentsCount = Math.max(0, (this.attrs.post.commentsCount || 1) - 1);
      }
      m.redraw();
    });

    if (!SocialState.config.realtime?.enabled) {
      const seconds = SocialState.config.realtime?.fallbackSeconds || 20;
      this.timer = window.setInterval(() => this.load(true), seconds * 1000);
    }
  }

  onremove(): void {
    this.disposer?.();
    if (this.timer) window.clearInterval(this.timer);
  }

  load(silent = false): void {
    if (this.loading && !silent) return;
    if (!silent) this.loading = true;

    get(`/social/posts/${this.attrs.post.id}/comments`, {
      page: { offset: silent ? 0 : this.comments.length, limit: 50 },
    })
      .then((response: any) => {
        if (silent) {
          response.data.forEach((comment: any) => this.mergeComment(comment, false));
        } else {
          this.comments = this.comments.concat(response.data || []);
        }
        this.meta = response.meta || {};
      })
      .catch((error: any) => {
        if (!silent) handleApiError(error);
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  mergeComment(comment: any, redraw = true): void {
    if (!comment || this.comments.some((item) => item.id === comment.id)) return;
    this.comments.push(comment);
    if (this.attrs.post) this.attrs.post.commentsCount = Math.max(this.attrs.post.commentsCount || 0, this.comments.length);
    if (redraw) m.redraw();
  }

  submit(): void {
    if (!this.body.trim() || this.submitting) return;

    if (promptLogin('comment')) return;

    this.submitting = true;

    apiPost(`/social/posts/${this.attrs.post.id}/comments`, {
      body: this.body,
      parent_id: this.parent?.id,
    })
      .then((response: any) => {
        this.body = '';
        this.parent = null;
        this.mergeComment(response.data);
        if (this.attrs.post) this.attrs.post.commentsCount = response.post?.commentsCount ?? this.attrs.post.commentsCount + 1;
        if (this.textarea) this.textarea.value = '';
      })
      .catch(handleApiError)
      .finally(() => {
        this.submitting = false;
        m.redraw();
      });
  }

  reply(comment: any): void {
    this.parent = comment;
    this.textarea?.focus();
  }

  remove(comment: any, count: number): void {
    this.comments = this.comments.filter((item) => item.id !== comment.id);
    if (this.attrs.post) this.attrs.post.commentsCount = count ?? Math.max(0, this.attrs.post.commentsCount - 1);
    m.redraw();
  }

  renderComment(comment: any): any {
    const children = this.comments.filter((item) => item.parentId === comment.id);

    return m('div', { className: 'SocialComment-thread'}, [
      m(CommentCard, {
        comment,
        onreply: (item: any) => this.reply(item),
        onremove: (item: any, count: number) => this.remove(item, count),
        onupdate: () => m.redraw(),
      }),
      children.length ? m('div', { className: 'SocialComment-children' }, children.map((child) => this.renderComment(child))) : null,
    ]);
  }

  view(vnode: any): any {
    this.attrs = vnode.attrs;
    const roots = this.comments.filter((comment) => !comment.parentId || !this.comments.some((item) => item.id === comment.parentId));

    return m('section', { className: 'SocialComments' }, [
      m('div', { className: 'SocialComments-head' }, [
        m('h2', {}, app.translator.trans('cengizkemec-social.forum.comments.title')),
        m('span', {}, this.attrs.post.commentsCount || 0),
      ]),
      SocialState.user
        ? m('div', { className: 'SocialCommentComposer' }, [
            this.parent ? m('div', { className: 'SocialCommentComposer-reply' }, [
              m('span', {}, app.translator.trans('cengizkemec-social.forum.comments.replying_to', { user: this.parent.user.displayName })),
              m('button', { className: 'Button Button--link Button--small', onclick: () => (this.parent = null) }, m('i', { className: 'fas fa-times' })),
            ]) : null,
            m('textarea', {
              className: 'FormControl',
              rows: 2,
              maxlength: 2000,
              value: this.body,
              oncreate: (v: any) => (this.textarea = v.dom as HTMLTextAreaElement),
              oninput: (event: Event) => (this.body = (event.target as HTMLTextAreaElement).value),
              placeholder: app.translator.trans('cengizkemec-social.forum.comments.placeholder'),
            }),
            m('div', { className: 'SocialCommentComposer-actions' }, [
              m('span', {}, `${this.body.length}/2000`),
              m(Button, { className: 'Button Button--primary Button--small', loading: this.submitting, disabled: !this.body.trim(), onclick: () => this.submit() }, app.translator.trans('cengizkemec-social.forum.comments.send')),
            ]),
          ])
        : m('button', { className: 'SocialCommentComposer-guest Button Button--block', onclick: () => promptLogin('comment') }, app.translator.trans('cengizkemec-social.forum.comments.login_to_comment')),
      this.loading
        ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
        : roots.length
        ? m('div', { className: 'SocialComment-list' }, roots.map((comment) => this.renderComment(comment)))
        : m('div', { className: 'SocialEmpty SocialEmpty--small' }, [m('i', { className: 'far fa-comment' }), m('p', {}, app.translator.trans('cengizkemec-social.forum.comments.empty'))]),
      this.meta.hasMore ? m('button', { className: 'Button Button--block', loading: this.loadingMore, onclick: () => this.load(false) }, app.translator.trans('cengizkemec-social.forum.common.load_more')) : null,
    ]);
  }
}
