import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { get } from '../../common/api';
import { Avatar, handleApiError } from '../utils';

/**
 * Start a native flarum/messages conversation without leaving Social.
 * The first message creates the dialog on Flarum's own endpoint, so all
 * messaging permissions and notifications apply unchanged.
 */
export default class NewNativeMessageModal extends Modal {
  query = '';
  results: any[] = [];
  selected: any = null;
  body = '';
  searching = false;
  submitting = false;
  error: string | null = null;

  oninit(vnode: any): void {
    super.oninit(vnode);

    if (vnode.attrs.user) {
      this.selected = vnode.attrs.user;
    }
  }

  className(): string {
    return 'Modal--small SocialNewMessageModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.messages.new') as string;
  }

  search(): void {
    if (this.query.trim().length < 2) return;

    this.searching = true;

    get('/social/search', { q: this.query.trim() })
      .then((response: any) => (this.results = response.data?.users || []))
      .catch(handleApiError)
      .then(() => {
        this.searching = false;
        m.redraw();
      });
  }

  submit(): void {
    if (!this.selected || !this.body.trim() || this.submitting) return;

    this.submitting = true;
    this.error = null;

    app.store
      .createRecord('dialog-messages')
      .save(
        {
          content: this.body,
          users: [{ id: this.selected.id }],
        },
        { params: { include: ['dialog'] } }
      )
      .then((message: any) => {
        const dialogId =
          message?.data?.relationships?.dialog?.data?.id ||
          message?.dialog?.()?.id?.();

        this.attrs.oncreated?.(dialogId);
        this.hide();
      })
      .catch((error: any) => {
        this.error = error?.response?.errors?.[0]?.detail || error?.message || app.translator.trans('cengizkemec-social.forum.errors.generic');
      })
      .then(() => {
        this.submitting = false;
        m.redraw();
      });
  }

  content(): any {
    const canSend = (app.session.user as any)?.canSendAnyMessage?.() !== false;

    if (!canSend) {
      return m('div', { className: 'Modal-body' }, m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.messages.cannot_send')));
    }

    return m('div', { className: 'Modal-body' }, [
      this.selected
        ? m('div', { className: 'SocialPerson SocialPerson--selected' }, [
            Avatar(this.selected, 40),
            m('span', {}, [m('strong', {}, this.selected.displayName), m('small', {}, '@' + this.selected.username)]),
            m('button', { type: 'button', className: 'Button Button--link Button--small', onclick: () => (this.selected = null) }, app.translator.trans('cengizkemec-social.forum.common.cancel')),
          ])
        : [
            m('form', {
              onsubmit: (event: Event) => {
                event.preventDefault();
                this.search();
              },
            }, m('input', {
              className: 'FormControl',
              value: this.query,
              placeholder: app.translator.trans('cengizkemec-social.forum.messages.search_user'),
              oninput: (event: Event) => (this.query = (event.target as HTMLInputElement).value),
            })),
            this.searching ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' })) : null,
            m('div', { className: 'SocialPeople' }, this.results.map((user: any) =>
              m('button', {
                type: 'button',
                className: 'SocialPerson SocialPerson--button',
                key: user.id,
                onclick: () => {
                  this.selected = user;
                  this.results = [];
                },
              }, [
                Avatar(user, 40),
                m('span', {}, [m('strong', {}, user.displayName), m('small', {}, '@' + user.username)]),
              ])
            )),
          ],
      this.selected
        ? m('div', { className: 'Form-group' }, m('textarea', {
            className: 'FormControl',
            rows: 4,
            value: this.body,
            placeholder: app.translator.trans('cengizkemec-social.forum.messages.dm_placeholder'),
            oninput: (event: Event) => (this.body = (event.target as HTMLTextAreaElement).value),
          }))
        : null,
      this.error ? m('div', { className: 'Alert Alert--error' }, this.error) : null,
      m(Button, {
        className: 'Button Button--primary Button--block',
        type: 'button',
        loading: this.submitting,
        disabled: !this.selected || !this.body.trim(),
        onclick: () => this.submit(),
      }, app.translator.trans('cengizkemec-social.forum.messages.start')),
    ]);
  }
}
