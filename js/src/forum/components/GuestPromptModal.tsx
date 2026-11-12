import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';

const REASONS: Record<string, string> = {
  like: 'like',
  comment: 'comment',
  voice: 'voice',
  message: 'message',
  post: 'post',
  room: 'room',
  follow: 'follow',
  upload: 'upload',
  generic: 'generic',
};

export default class GuestPromptModal extends Modal {
  reason = 'generic';

  oninit(vnode: any) {
    super.oninit(vnode);
    this.reason = vnode.attrs.reason || 'generic';
  }

  className(): string {
    return 'Modal--small SocialGuestModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.guest.title') as string;
  }

  content(): any {
    const reason = REASONS[this.reason] || 'generic';

    return m('div', { className: 'Modal-body' }, [
      m('div', { className: 'SocialGuestModal-icon' }, m('i', { className: 'fas fa-users' })),
      m('p', { className: 'SocialGuestModal-text' }, app.translator.trans(`cengizkemec-social.forum.guest.${reason}`)),
      m('div', { className: 'SocialGuestModal-actions' }, [
        m(
          'button',
          {
            className: 'Button Button--primary Button--block',
            onclick: () => app.modal.show(() => import('flarum/forum/components/LogInModal')),
          },
          app.translator.trans('cengizkemec-social.forum.auth.login')
        ),
        app.forum.attribute('allowSignUp')
          ? m(
              'button',
              {
                className: 'Button Button--link Button--block',
                onclick: () => app.modal.show(() => import('flarum/forum/components/SignUpModal')),
              },
              app.translator.trans('cengizkemec-social.forum.auth.register')
            )
          : null,
      ]),
    ]);
  }
}
