import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import { Avatar, timeAgo } from '../utils';

function plainUser(model: any): any {
  if (!model) return null;

  return {
    id: model.id?.(),
    displayName: model.displayName?.(),
    username: model.username?.(),
    avatarUrl: model.avatarUrl?.(),
  };
}

/**
 * A Social-styled thread backed by flarum/messages models and endpoints.
 * Flarum keeps ownership of permissions, formatting, notifications and
 * realtime delivery; Social only provides the layout.
 */
export default class NativeDialogThread {
  dialog: any = null;
  messages: any[] = [];
  loading = true;
  body = '';
  submitting = false;
  container: HTMLElement | null = null;
  timer: number | null = null;

  oninit(vnode: any): void {
    this.dialog = vnode.attrs.dialog;
    this.load();
    this.timer = window.setInterval(() => this.poll(), 20000);
  }

  onremove(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
  }

  load(): void {
    this.loading = true;

    app.store
      .find('dialog-messages', {
        filter: { dialog: this.dialog.id() },
        sort: '-number',
        page: { limit: 50 },
      })
      .then((messages: any[]) => {
        this.messages = (messages || []).slice().reverse();
        this.markRead();
        this.scrollBottom();
      })
      .catch(() => {})
      .then(() => {
        this.loading = false;
        m.redraw();
      });
  }

  poll(): void {
    app.store
      .find('dialog-messages', {
        filter: { dialog: this.dialog.id() },
        sort: '-number',
        page: { limit: 20 },
      })
      .then((messages: any[]) => {
        (messages || []).slice().reverse().forEach((message: any) => this.merge(message));
        m.redraw();
      })
      .catch(() => {});
  }

  merge(message: any): void {
    if (this.messages.some((item: any) => item.id() === message.id())) return;
    this.messages.push(message);
  }

  markRead(): void {
    const last = this.messages[this.messages.length - 1];

    if (!last) return;

    this.dialog.save({ lastReadMessageId: Number(last.id()) }).catch(() => {});
  }

  scrollBottom(): void {
    window.setTimeout(() => {
      if (this.container) this.container.scrollTop = this.container.scrollHeight;
    }, 30);
  }

  send(): void {
    if (!this.body.trim() || this.submitting) return;

    this.submitting = true;

    app.store
      .createRecord('dialog-messages')
      .save({
        content: this.body,
        relationships: {
          dialog: { data: { id: this.dialog.id(), type: 'dialogs' } },
        },
      })
      .then((message: any) => {
        this.body = '';
        this.merge(message);
        this.markRead();
        this.scrollBottom();
      })
      .catch((error: any) => {
        const detail = error?.response?.errors?.[0]?.detail;
        app.alerts.show({ type: 'error' }, detail || app.translator.trans('cengizkemec-social.forum.errors.generic'));
      })
      .then(() => {
        this.submitting = false;
        m.redraw();
      });
  }

  remove(message: any): void {
    if (!confirm(app.translator.trans('cengizkemec-social.forum.messages.confirm_delete') as string)) return;

    message.delete().then(() => {
      this.messages = this.messages.filter((item: any) => item.id() !== message.id());
      m.redraw();
    });
  }

  view(): any {
    const recipientModel = this.dialog.recipient?.();
    const recipient = plainUser(recipientModel);
    const canSend = this.dialog.canSendMessage?.() !== false;

    return m('section', { className: 'SocialDirectThread' }, [
      m('div', { className: 'SocialDirectThread-head' }, [
        recipient ? Avatar(recipient, 34) : null,
        m('div', {}, [
          m('strong', {}, recipient?.displayName || this.dialog.title?.() || app.translator.trans('cengizkemec-social.forum.messages.unknown')),
          m('small', {}, app.translator.trans('cengizkemec-social.forum.messages.native_hint')),
        ]),
        recipient?.username
          ? m('a', { className: 'Button Button--link Button--small', href: app.route('user', { username: recipient.username }) }, app.translator.trans('cengizkemec-social.forum.messages.forum_profile'))
          : null,
      ]),
      m('div', { className: 'SocialMessages', oncreate: (v: any) => (this.container = v.dom as HTMLElement) },
        this.loading
          ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
          : this.messages.length
          ? this.messages.map((message: any) => {
              const user = plainUser(message.user?.());
              const self = user?.id === app.session.user?.id();
              const html = message.contentHtml?.();

              return m('div', { className: 'SocialMessage' + (self ? ' is-self' : ''), key: message.id() }, [
                user ? m('a', { href: app.route('user', { username: user.username }), className: 'SocialMessage-avatar' }, Avatar(user, 36)) : null,
                m('div', { className: 'SocialMessage-content' }, [
                  m('div', { className: 'SocialMessage-head' }, [
                    m('strong', {}, user?.displayName || app.translator.trans('cengizkemec-social.forum.messages.unknown')),
                    m('span', {}, timeAgo(message.createdAt?.()?.toISOString?.() || null)),
                    message.canDelete?.()
                      ? m('div', { className: 'SocialMessage-actions' }, m('button', { className: 'Button Button--link Button--small', onclick: () => this.remove(message) }, app.translator.trans('cengizkemec-social.forum.post.delete')))
                      : null,
                  ]),
                  m('div', { className: 'SocialMessage-body' }, html ? m.trust(html) : message.contentPlain?.() || ''),
                ]),
              ]);
            })
          : m('div', { className: 'SocialEmpty SocialEmpty--small' }, [m('i', { className: 'far fa-comments' }), m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.dm_empty'))]),
      ),
      canSend
        ? m('div', { className: 'SocialMessageComposer' }, [
            m('textarea', {
              className: 'FormControl',
              rows: 1,
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
          ])
        : m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.messages.cannot_reply')),
    ]);
  }
}
