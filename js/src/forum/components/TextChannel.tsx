import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import SocialState from '../SocialState';
import { del, get, patch, post, uploadFile } from '../../common/api';
import { Avatar, formatBody, handleApiError, promptLogin, timeAgo } from '../utils';
import { subscribeRealtime } from '../realtime';
import MediaGallery from './MediaGallery';

export default class TextChannel {
  channel: any = null;
  messages: any[] = [];
  meta: any = {};
  loading = false;
  loadingMore = false;
  body = '';
  submitting = false;
  uploading = false;
  dragging = false;
  editing: any = null;
  editingBody = '';
  typers: Record<string, any> = {};
  disposer: (() => void) | null = null;
  pollTimer: number | null = null;
  typingTimer: number | null = null;
  typingSentAt = 0;
  container: HTMLElement | null = null;
  fileInput: HTMLInputElement | null = null;

  oninit(vnode: any): void {
    this.channel = vnode.attrs.channel;
    this.load();
  }

  oncreate(): void {
    if (!this.channel?.id) return;

    this.disposer = subscribeRealtime(`social:channel:${this.channel.id}`, (event: any) => {
      if (event.type === 'message.created') {
        this.merge(event.message);
        this.scrollBottom();
      } else if (event.type === 'message.updated' && event.message) {
        const existing = this.messages.find((item) => item.id === event.message.id);
        if (existing) Object.assign(existing, event.message);
      } else if (event.type === 'message.deleted') {
        this.messages = this.messages.filter((item) => item.id !== event.message_id);
      } else if (event.type === 'typing' && event.user?.id !== SocialState.user?.id) {
        this.typers[event.user.id] = { user: event.user, at: Date.now() };
        window.setTimeout(() => {
          if (Date.now() - this.typers[event.user.id]?.at > 3500) delete this.typers[event.user.id];
          m.redraw();
        }, 3600);
      }
      m.redraw();
    });

    if (!SocialState.config.realtime?.enabled) {
      const seconds = SocialState.config.realtime?.fallbackSeconds || 20;
      this.pollTimer = window.setInterval(() => this.poll(), seconds * 1000);
    }
  }

  onupdate(vnode: any): void {
    if (vnode.attrs.channel?.id !== this.channel?.id) {
      this.channel = vnode.attrs.channel;
      this.messages = [];
      this.load();
    }
  }

  onremove(): void {
    this.disposer?.();
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    if (this.typingTimer) window.clearTimeout(this.typingTimer);
  }

  load(silent = false): void {
    if (!this.channel?.id) return;
    if (!silent) this.loading = true;

    get(`/social/channels/${this.channel.id}/messages`, { limit: SocialState.config.limits?.messageMaxLength ? 40 : 40 })
      .then((response: any) => {
        this.messages = response.data || [];
        this.meta = response.meta || {};
        post(`/social/channels/${this.channel.id}/read`, {});
        this.scrollBottom();
      })
      .catch((error: any) => {
        if (!silent) handleApiError(error);
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  poll(): void {
    if (!this.channel?.id) return;
    get(`/social/channels/${this.channel.id}/messages`, { limit: 40 })
      .then((response: any) => {
        (response.data || []).forEach((message: any) => this.merge(message, false));
        m.redraw();
      })
      .catch(() => {});
  }

  loadMore(): void {
    if (!this.messages.length) return;
    this.loadingMore = true;

    get(`/social/channels/${this.channel.id}/messages`, { limit: 40, before: this.messages[0].id })
      .then((response: any) => {
        this.messages = (response.data || []).concat(this.messages);
        this.meta = response.meta || this.meta;
      })
      .finally(() => {
        this.loadingMore = false;
        m.redraw();
      });
  }

  merge(message: any, redraw = true): void {
    if (!message || this.messages.some((item) => item.id === message.id)) return;
    this.messages.push(message);
    if (redraw) m.redraw();
  }

  scrollBottom(): void {
    window.setTimeout(() => {
      if (this.container) this.container.scrollTop = this.container.scrollHeight;
    }, 30);
  }

  typing(): void {
    if (!this.channel?.id) return;
    const now = Date.now();
    if (now - this.typingSentAt < 1800) return;
    this.typingSentAt = now;
    post(`/social/channels/${this.channel.id}/typing`).catch(() => {});
  }

  send(): void {
    if (!this.body.trim() || this.submitting) return;
    if (promptLogin('message')) return;

    this.submitting = true;
    post(`/social/channels/${this.channel.id}/messages`, { body: this.body })
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

  upload(file: File): void {
    this.uploadFiles([file]);
  }

  uploadFiles(files: File[] | FileList): void {
    if (promptLogin('upload')) return;

    const max = Math.max(1, Number(SocialState.config.media?.maxAttachments) || 6);
    const selected = Array.from(files).slice(0, max);

    if (!selected.length || this.uploading) return;

    this.uploading = true;
    this.dragging = false;

    Promise.all(selected.map((file) => uploadFile('/social/media', file)))
      .then((responses: any[]) => post(`/social/channels/${this.channel.id}/messages`, {
        body: '',
        media_ids: responses.map((response) => response.data.id),
      }))
      .then((response: any) => {
        this.merge(response.data);
        this.scrollBottom();
      })
      .catch(handleApiError)
      .then(() => {
        this.uploading = false;
        m.redraw();
      });
  }

  saveEdit(message: any): void {
    patch(`/social/messages/${message.id}`, { body: this.editingBody })
      .then((response: any) => {
        Object.assign(message, response.data);
        this.editing = null;
      })
      .catch(handleApiError)
      .finally(() => m.redraw());
  }

  remove(message: any): void {
    if (!confirm(app.translator.trans('cengizkemec-social.forum.messages.confirm_delete') as string)) return;
    del(`/social/messages/${message.id}`)
      .then(() => (this.messages = this.messages.filter((item) => item.id !== message.id)))
      .catch(handleApiError);
  }

  view(vnode: any): any {
    this.attrs = vnode.attrs;
    if (!this.channel?.id) return m('div', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.messages.no_channel'));

    const typers = Object.values(this.typers);
    const title = this.attrs.title || this.channel.name;
    const description = this.attrs.description || this.channel.description;
    const icon = this.attrs.icon || 'fas fa-hashtag';

    const canUpload = Boolean(SocialState.user && SocialState.can('uploadMedia'));

    return m('section', {
      className: 'SocialTextChannel' + (this.dragging ? ' is-dragging' : ''),
      ondragover: canUpload
        ? (event: DragEvent) => {
            event.preventDefault();
            if (!this.dragging) {
              this.dragging = true;
              m.redraw();
            }
          }
        : undefined,
      ondragleave: canUpload
        ? (event: DragEvent) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            this.dragging = false;
            m.redraw();
          }
        : undefined,
      ondrop: canUpload
        ? (event: DragEvent) => {
            event.preventDefault();
            this.dragging = false;

            if (event.dataTransfer?.files?.length) {
              this.uploadFiles(event.dataTransfer.files);
            } else {
              m.redraw();
            }
          }
        : undefined,
    }, [
      this.dragging && canUpload
        ? m('div', { className: 'SocialComposer-dropHint SocialTextChannel-dropHint' }, [m('i', { className: 'fas fa-cloud-arrow-up' }), ' ', app.translator.trans('cengizkemec-social.forum.media.drop_hint')])
        : null,
      m('div', { className: 'SocialTextChannel-head' }, [
        m('i', { className: icon }),
        m('strong', {}, title),
        description ? m('span', {}, description) : null,
      ]),
      m('div', { className: 'SocialMessages', oncreate: (v: any) => (this.container = v.dom as HTMLElement) },
        this.loading
          ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
          : [
              this.meta.hasMore ? m('button', { className: 'Button Button--block Button--small', loading: this.loadingMore, onclick: () => this.loadMore() }, app.translator.trans('cengizkemec-social.forum.messages.load_older')) : null,
              this.messages.map((message) =>
                m('div', { className: 'SocialMessage'}, [
                  m('a', { href: app.route('social.profile', { username: message.user.username }), className: 'SocialMessage-avatar' }, Avatar(message.user, 36)),
                  m('div', { className: 'SocialMessage-content' }, [
                    m('div', { className: 'SocialMessage-head' }, [
                      m('a', { href: app.route('social.profile', { username: message.user.username }) }, m('strong', {}, message.user.displayName)),
                      m('span', {}, timeAgo(message.createdAt)),
                      message.editedAt ? m('span', {}, app.translator.trans('cengizkemec-social.forum.post.edited')) : null,
                      message.canEdit || message.canDelete
                        ? m('div', { className: 'SocialMessage-actions' }, [
                            message.canEdit ? m('button', { className: 'Button Button--link Button--small', onclick: () => { this.editing = message; this.editingBody = message.body || ''; } }, app.translator.trans('cengizkemec-social.forum.post.edit')) : null,
                            message.canDelete ? m('button', { className: 'Button Button--link Button--small', onclick: () => this.remove(message) }, app.translator.trans('cengizkemec-social.forum.post.delete')) : null,
                          ])
                        : null,
                    ]),
                    this.editing?.id === message.id
                      ? m('div', { className: 'SocialMessage-edit' }, [
                          m('textarea', { className: 'FormControl', rows: 2, value: this.editingBody, oninput: (event: Event) => (this.editingBody = (event.target as HTMLTextAreaElement).value) }),
                          m('button', { className: 'Button Button--primary Button--small', onclick: () => this.saveEdit(message) }, app.translator.trans('cengizkemec-social.forum.post.save')),
                        ])
                      : message.body
                      ? m('div', { className: 'SocialMessage-body' }, formatBody(message.body, message.bodyHtml))
                      : null,
                    message.media?.length ? m(MediaGallery, { media: message.media }) : null,
                  ]),
                ])
              ),
              this.messages.length === 0 ? m('div', { className: 'SocialEmpty SocialEmpty--small' }, [m('i', { className: 'far fa-comment-dots' }), m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.empty'))]) : null,
            ]
      ),
      m('div', { className: 'SocialTyping' }, typers.length ? app.translator.trans('cengizkemec-social.forum.messages.typing', { users: typers.map((item: any) => item.user.displayName).join(', ') }) : ''),
      SocialState.user
        ? m('div', { className: 'SocialMessageComposer' }, [
            m('input', {
              type: 'file',
              multiple: true,
              className: 'SocialUploader-input',
              oncreate: (v: any) => (this.fileInput = v.dom as HTMLInputElement),
              onchange: (event: Event) => {
                const files = (event.target as HTMLInputElement).files;
                if (files?.length) this.uploadFiles(files);
              },
            }),
            m(Button, { className: 'Button Button--icon Button--link', icon: 'fas fa-paperclip', onclick: () => this.fileInput?.click(), loading: this.uploading, 'aria-label': app.translator.trans('cengizkemec-social.forum.media.attach') }),
            m('textarea', {
              className: 'FormControl',
              rows: 1,
              maxlength: SocialState.config.limits?.messageMaxLength || 2000,
              value: this.body,
              placeholder: app.translator.trans('cengizkemec-social.forum.messages.placeholder', { channel: title }),
              oninput: (event: Event) => {
                this.body = (event.target as HTMLTextAreaElement).value;
                this.typing();
              },
              onpaste: (event: ClipboardEvent) => {
                const files = event.clipboardData?.files;
                if (files?.length) {
                  event.preventDefault();
                  this.uploadFiles(files);
                }
              },
              onkeydown: (event: KeyboardEvent) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  this.send();
                }
              },
            }),
            m(Button, { className: 'Button Button--primary Button--icon', icon: 'fas fa-paper-plane', loading: this.submitting, disabled: !this.body.trim(), onclick: () => this.send(), 'aria-label': app.translator.trans('cengizkemec-social.forum.messages.send') }),
          ])
        : m('button', { className: 'Button Button--block', onclick: () => promptLogin('message') }, app.translator.trans('cengizkemec-social.forum.messages.login_to_chat')),
    ]);
  }
}
