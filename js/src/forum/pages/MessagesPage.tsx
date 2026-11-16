import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import SocialState from '../SocialState';
import { get } from '../../common/api';
import { Avatar, handleApiError, timeAgo } from '../utils';
import DirectThread from '../components/DirectThread';
import NativeDialogThread from '../components/NativeDialogThread';
import { openLoginModal } from '../authModals';

export default class MessagesPage extends SocialPage {
  showAside = false;
  conversations: any[] = [];
  nativeDialogs: any[] = [];
  native = false;
  loading = true;
  error: string | null = null;

  oninit(vnode: any): void {
    // When flarum/messages is enabled, use its models and endpoints. Social
    // still renders the conversation, but permissions, notifications and
    // realtime updates stay native.
    this.native = Boolean((app as any).dialogs && typeof (app as any).dialogs.refresh === 'function');
    super.oninit(vnode);
  }

  pageTitle(): string {
    return app.translator.trans('cengizkemec-social.forum.nav.messages') as string;
  }

  onSocialReady(): void {
    if (!SocialState.user) {
      this.loading = false;
      return;
    }

    if (this.native) {
      this.loadNative();
      return;
    }

    this.load();
  }

  loadNative(): void {
    this.loading = true;
    const state: any = (app as any).dialogs;

    Promise.resolve(state.refresh?.())
      .catch(() => {})
      .then(() => {
        this.nativeDialogs = state.getAllItems?.() || [];
        this.loading = false;
        m.redraw();
      });
  }

  load(): void {
    this.loading = true;
    get('/social/dm/conversations')
      .then((response: any) => {
        this.conversations = response.data || [];
        const selected = Number(m.route.param('id'));

        if (selected && this.conversations.some((conversation) => conversation.id === selected)) {
          // Keep the active URL.
        } else if (this.conversations.length && !selected) {
          m.route.set(app.route('social.messages.conversation', { id: this.conversations[0].id }), {}, { replace: true });
        }
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  newMessage(): void {
    if (this.native) {
      app.modal.show(() => import('../components/NewNativeMessageModal'), {
        oncreated: (dialogId: string | null) => {
          this.loadNative();
          if (dialogId) m.route.set(app.route('social.messages.conversation', { id: dialogId }));
        },
      });
      return;
    }

    app.modal.show(() => import('../components/NewMessageModal'), {
      oncreated: (conversation: any) => {
        this.load();
        m.route.set(app.route('social.messages.conversation', { id: conversation.id }));
      },
    });
  }

  nativeContent(): any {
    const selectedId = String(m.route.param('id') || '');
    const selected = selectedId
      ? this.nativeDialogs.find((dialog: any) => String(dialog.id()) === selectedId) || app.store.getById('dialogs', selectedId)
      : null;
    const canSend = (app.session.user as any)?.canSendAnyMessage?.() !== false;

    const recipientOf = (dialog: any): any => {
      const recipient = dialog.recipient?.();

      if (!recipient) return null;

      return {
        id: recipient.id?.(),
        displayName: recipient.displayName?.(),
        username: recipient.username?.(),
        avatarUrl: recipient.avatarUrl?.(),
      };
    };

    return m('div', { className: 'SocialMessagesPage' }, [
      m('aside', { className: 'SocialConversationList' }, [
        m('div', { className: 'SocialConversationList-head' }, [
          m('h2', {}, app.translator.trans('cengizkemec-social.forum.messages.title')),
          canSend
            ? m('button', { className: 'Button Button--icon Button--primary', onclick: () => this.newMessage(), 'aria-label': app.translator.trans('cengizkemec-social.forum.messages.new') }, m('i', { className: 'fas fa-plus' }))
            : null,
        ]),
        this.loading
          ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
          : this.nativeDialogs.length
          ? this.nativeDialogs.map((dialog: any) => {
              const recipient = recipientOf(dialog);
              const last = dialog.lastMessage?.();
              const unread = dialog.unreadCount?.() || 0;

              return m('a', {
                key: dialog.id(),
                className: 'SocialConversation' + (String(dialog.id()) === selectedId ? ' is-active' : ''),
                href: app.route('social.messages.conversation', { id: dialog.id() }),
              }, [
                recipient ? Avatar(recipient, 40) : null,
                m('span', { className: 'SocialConversation-info' }, [
                  m('strong', {}, dialog.title?.() || recipient?.displayName || app.translator.trans('cengizkemec-social.forum.messages.unknown')),
                  m('small', {}, last?.contentPlain?.() || app.translator.trans('cengizkemec-social.forum.messages.no_messages')),
                ]),
                m('span', { className: 'SocialConversation-meta' }, [
                  dialog.lastMessageAt?.() ? m('small', {}, timeAgo(dialog.lastMessageAt().toISOString())) : null,
                  unread ? m('span', { className: 'SocialConversation-unread' }, unread) : null,
                ]),
              ]);
            })
          : m('div', { className: 'SocialConversationList-empty' }, [
              m('i', { className: 'far fa-comments' }),
              m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.no_conversations')),
              canSend ? m('button', { className: 'Button Button--primary Button--small', onclick: () => this.newMessage() }, app.translator.trans('cengizkemec-social.forum.messages.new')) : null,
            ]),
      ]),
      m('main', { className: 'SocialConversationMain' }, selected
        ? m(NativeDialogThread, { dialog: selected, key: selected.id() })
        : m('div', { className: 'SocialEmpty' }, [m('i', { className: 'fas fa-envelope-open-text' }), m('h3', {}, app.translator.trans('cengizkemec-social.forum.messages.select_title')), m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.select_text'))])),
    ]);
  }

  content(): any {
    if (!SocialState.user) {
      return m('div', { className: 'SocialPanel SocialPanel--auth' }, [
        m('i', { className: 'fas fa-envelope' }),
        m('h2', {}, app.translator.trans('cengizkemec-social.forum.messages.login_title')),
        m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.login_text')),
        m('button', { className: 'Button Button--primary', type: 'button', onclick: () => openLoginModal() }, app.translator.trans('cengizkemec-social.forum.auth.login')),
      ]);
    }

    if (this.native) return this.nativeContent();

    const selectedId = Number(m.route.param('id'));
    const selected = this.conversations.find((conversation) => conversation.id === selectedId) || null;

    return m('div', { className: 'SocialMessagesPage' }, [
      m('aside', { className: 'SocialConversationList' }, [
        m('div', { className: 'SocialConversationList-head' }, [
          m('h2', {}, app.translator.trans('cengizkemec-social.forum.messages.title')),
          m('button', { className: 'Button Button--icon Button--primary', onclick: () => this.newMessage(), 'aria-label': app.translator.trans('cengizkemec-social.forum.messages.new') }, m('i', { className: 'fas fa-plus' })),
        ]),
        this.loading
          ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
          : this.conversations.length
          ? this.conversations.map((conversation) =>
              m('a', {
                className: 'SocialConversation' + (conversation.id === selectedId ? ' is-active' : ''),
                href: app.route('social.messages.conversation', { id: conversation.id }),
              }, [
                conversation.user ? Avatar(conversation.user, 40) : null,
                m('span', { className: 'SocialConversation-info' }, [
                  m('strong', {}, conversation.user?.displayName || app.translator.trans('cengizkemec-social.forum.messages.unknown')),
                  m('small', {}, conversation.lastMessage || app.translator.trans('cengizkemec-social.forum.messages.no_messages')),
                ]),
                m('span', { className: 'SocialConversation-meta' }, [
                  conversation.lastMessageAt ? m('small', {}, timeAgo(conversation.lastMessageAt)) : null,
                  conversation.unreadCount ? m('span', { className: 'SocialConversation-unread' }, conversation.unreadCount) : null,
                ]),
              ])
            )
          : m('div', { className: 'SocialConversationList-empty' }, [m('i', { className: 'far fa-comments' }), m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.no_conversations')), m('button', { className: 'Button Button--primary Button--small', onclick: () => this.newMessage() }, app.translator.trans('cengizkemec-social.forum.messages.new'))]),
      ]),
      m('main', { className: 'SocialConversationMain' }, selected
        ? m(DirectThread, { conversation: selected})
        : m('div', { className: 'SocialEmpty' }, [m('i', { className: 'fas fa-envelope-open-text' }), m('h3', {}, app.translator.trans('cengizkemec-social.forum.messages.select_title')), m('p', {}, app.translator.trans('cengizkemec-social.forum.messages.select_text'))])),
    ]);
  }
}
