import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import SocialState from '../SocialState';
import { del, get, patch, post } from '../../common/api';
import { Avatar, formatBody, handleApiError, timeAgo } from '../utils';
import { subscribeRealtime } from '../realtime';
import MediaGallery from './MediaGallery';

export default class DirectThread {
  conversation: any = null;
  messages: any[] = [];
  body = '';
  loading = true;
  submitting = false;
  editing: any = null;
  editingBody = '';
  meta: any = {};
  container: HTMLElement | null = null;
  disposer: (() => void) | null = null;
  timer: number | null = null;

  oninit(vnode: any): void {
    this.conversation = vnode.attrs.conversation;
    this.load();
  }

  oncreate(): void {
    this.disposer = subscribeRealtime(`social:dm:${this.conversation.id}`, (event: any) => {
      if (event.type === 'dm.created' && event.message) {
        this.merge(event.message);
        this.scrollBottom();
        post(`/social/dm/conversations/${this.conversation.id}/read`).catch(() => {});
      }
      m.redraw();
    });

    if (!SocialState.config.realtime?.enabled) {
      const seconds = SocialState.config.realtime?.fallbackSeconds || 20;
      this.timer = window.setInterval(() => this.poll(), seconds * 1000);
    }
  }

  onremove(): void {
    this.disposer?.();
    if (this.timer) window.clearInterval(this.timer);
  }

  load(): void {
    this.loading = true;
    get(`/social/dm/conversations/${this.conversation.id}/messages`)
      .then((response: any) => {
        this.messages = response.data || [];
        this.meta = response.meta || {};
        this.scrollBottom();
      })
      .catch(handleApiError)
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  poll(): void {
    get(`/social/dm/conversations/${this.conversation.id}/messages`).then((response: any) => {
      (response.data || []).forEach((message: any) => this.merge(message, false));
      m.redraw();
    }).catch(() => {});
  }

  merge(message: any, redraw = true): void {
    if (this.messages.some((item) => item.id === message.id)) return;
    this.messages.push(message);
    if (redraw) m.redraw();
  }

  scrollBottom(): void {
    window.setTimeout(() => {
      if (this.container) this.container.scrollTop = this.container.scrollHeight;
    }, 30);
  }

  send(): void {
    if (!this.body.trim() || this.submitting) return;
    this.submitting = true;

    post(`/social/dm/conversations/${this.conversation.id}/messages`, { body: this.body })
      .then((response: any) => {
        this.body = '';
        this.merge(response.data);
        this.scrollBottom();
      })
      .catch(handleApiError)
      .finally(() => {
        this.submitting = false;
        m.redraw();
      });
  }

  saveEdit(message: any): void {
    patch(`/social/dm/messages/${message.id}`, { body: this.editingBody })
      .then((response: any) => {
        Object.assign(message, response.data);
        this.editing = null;
      })
      .catch(handleApiError)
      .finally(() => m.redraw());
  }

  remove(message: any): void {
    if (!confirm(app.translator.trans('cengizkemec-social.forum.messages.confirm_delete') as string)) return;
    del(`/social/dm/messages/${message.id}`)
      .then(() => (this.messages = this.messages.filter((item) => item.id !== message.id)))
      .catch(handleApiError);
  }

  view(vnode: any): any {
    this.attrs = vnode.attrs;
    const conversation = this.conversation;

    return m('section', { className: 'SocialDirectThread' }, [
      m('div', { className: 'SocialDirectThread-head' }, [
        conversation.user ? Avatar(conversation.user, 34) : null,
        m('div', {}, [
          m('strong', {}, conversation.user?.displayName || app.translator.trans('cengizkemec-social.forum.messages.unknown')),
          m('small', {}, conversation.user?.online ? app.translator.trans('cengizkemec-social.forum.aside.online') : app.translator.trans('cengizkemec-social.forum.messages.offline')),
        ]),
        conversation.user ? m('a', { className: 'Button Button--link Button--small', href: app.route('social.profile', { username: conversation.user.username }) }, app.translator.trans('cengizkemec-social.forum.messages.profile')) : null,
      ]),
      m('div', { className: 'SocialMessages', oncreate: (v: any) => (this.container = v.dom as HTMLElement) },
        this.loading
          ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
          : this.messages.length
          ? this.messages.map((message) =>
              m('div', { className: 'SocialMessage' + (message.user.id === SocialState.user?.id ? ' is-self' : '')}, [
                m('a', { href: app.route('social.profile', { username: message.user.username }), className: 'SocialMessage-avatar' }, Avatar(message.user, 36)),
                m('div', { className: 'SocialMessage-content' }, [
                  m('div', { className: 'SocialMessage-head' }, [
                    m('strong', {}, message.user.displayName),
                    m('span', {}, timeAgo(message.createdAt)),
                    message.canEdit || message.canDelete
                      ? m('div', { className: 'SocialMessage-actions' }, [
                          message.canEdit ? m('button', { className: 'Button Button--link Button--small', onclick: () => { this.editing = message; this.editingBody = message.body || ''; } }, app.translator.trans('cengizkemec-social.forum.post.edit')) : null,
                          message.canDelete ? m('button', { className: 'Button Button--link Button--small', onclick: () => this.remove(message) }, app.translator.trans('cengizkemec-social.forum.post.delete')) : null,
                        ])
                      : null,
                  ]),
                  this.editing?.id === message.id
                    ? m('div', {}, [
                        m('textarea', { className: 'FormControl', rows: 2, value: this.editingBody, oninput: (event: Event) => (this.editingBody = (event.target as HTMLTextAreaElement).value) }),
                        m('button', { className: 'Button Button--primary Button--small', onclick: () => this.saveEdit(message) }, app.translator.trans('cengizkemec-social.forum.post.save')),
                      ])
                    : m('div', { className: 'SocialMessage-body' }, formatBody(message.body, message.bodyHtml)),
                  message.media?.length ? m(MediaGallery, { media: message.media }) : null,
                ]),
              ])
            )
          : m('div', { className: 'SocialEmpty SocialEmpty--small' }, [m('i', { className: 'far fa-comments' }), m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.dm_empty'))]),
      ),
      m('div', { className: 'SocialMessageComposer' }, [
        m('textarea', {
          className: 'FormControl',
          rows: 1,
          maxlength: SocialState.config.limits?.messageMaxLength || 2000,
          value: this.body,
          placeholder: app.translator.trans('cengizkemec-social.forum.messages.dm_placeholder'),
          oninput: (event: Event) => (this.body = (event.target as HTMLTextAreaElement).value),
          onkeydown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              this.send();
            }
          },
        }),
        m(Button, { className: 'Button Button--primary Button--icon', icon: 'fas fa-paper-plane', loading: this.submitting, disabled: !this.body.trim(), onclick: () => this.send(), 'aria-label': app.translator.trans('cengizkemec-social.forum.messages.send') }),
      ]),
    ]);
  }
}
