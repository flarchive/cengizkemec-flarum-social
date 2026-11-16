import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { post } from '../../common/api';

export default class RoomInviteLinkModal extends Modal {
  expiresIn = 24;
  maxUses = 0;
  creating = false;
  creatingError: string | null = null;
  link: any = null;
  copied = false;
  input: HTMLInputElement | null = null;

  className(): string {
    return 'Modal--small SocialShareModal SocialRoomInviteLinkModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.rooms.invite_link_title') as string;
  }

  fullUrl(): string {
    return this.link ? window.location.origin + this.link.url : '';
  }

  create(): void {
    if (this.creating) return;

    this.creating = true;
    this.creatingError = null;

    post(`/social/rooms/${this.attrs.room.id}/invite_link`, {
      expires_in: this.expiresIn,
      max_uses: this.maxUses,
    })
      .then((response: any) => {
        this.link = response.data;
      })
      .catch((error: any) => {
        this.creatingError = error.message;
      })
      .then(() => {
        this.creating = false;
        m.redraw();
      });
  }

  copy(): void {
    const done = () => {
      this.copied = true;
      app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.post.link_copied'));
      m.redraw();
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(this.fullUrl()).then(done).catch(() => this.selectFallback());
    } else {
      this.selectFallback();
    }
  }

  selectFallback(): void {
    this.input?.focus();
    this.input?.select();

    try {
      document.execCommand('copy');
      this.copied = true;
      app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.post.link_copied'));
    } catch (e) {
      // The input stays focused so the link can be copied manually.
    }

    m.redraw();
  }

  content(): any {
    if (!this.link) {
      return m('div', { className: 'Modal-body SocialShareModal-body' }, [
        m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.rooms.invite_link_hint')),
        m('div', { className: 'Form-group' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.invite_link_expires')),
          m('select', {
            className: 'FormControl',
            value: String(this.expiresIn),
            onchange: (event: Event) => (this.expiresIn = Number((event.target as HTMLSelectElement).value)),
          }, [
            ['1', app.translator.trans('cengizkemec-social.forum.rooms.invite_hours', { count: 1 })],
            ['24', app.translator.trans('cengizkemec-social.forum.rooms.invite_hours', { count: 24 })],
            ['168', app.translator.trans('cengizkemec-social.forum.rooms.invite_days', { count: 7 })],
            ['0', app.translator.trans('cengizkemec-social.forum.rooms.invite_never')],
          ].map(([value, label]) => m('option', { value, selected: String(this.expiresIn) === value }, label))),
        ]),
        m('div', { className: 'Form-group' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.invite_link_uses')),
          m('select', {
            className: 'FormControl',
            value: String(this.maxUses),
            onchange: (event: Event) => (this.maxUses = Number((event.target as HTMLSelectElement).value)),
          }, [
            ['0', app.translator.trans('cengizkemec-social.forum.rooms.invite_unlimited')],
            ['1', '1'],
            ['5', '5'],
            ['10', '10'],
          ].map(([value, label]) => m('option', { value, selected: String(this.maxUses) === value }, label))),
        ]),
        this.creatingError ? m('div', { className: 'Alert Alert--error' }, this.creatingError) : null,
        m(Button, { className: 'Button Button--primary Button--block', type: 'button', loading: this.creating, onclick: () => this.create() }, app.translator.trans('cengizkemec-social.forum.rooms.invite_link_create')),
      ]);
    }

    return m('div', { className: 'Modal-body SocialShareModal-body' }, [
      m('label', { className: 'SocialShareModal-label' }, app.translator.trans('cengizkemec-social.forum.rooms.invite_link')),
      m('div', { className: 'SocialShareModal-url' }, [
        m('input', {
          className: 'FormControl',
          readonly: true,
          value: this.fullUrl(),
          oncreate: (v: any) => (this.input = v.dom as HTMLInputElement),
          onclick: (event: Event) => (event.target as HTMLInputElement).select(),
        }),
        m(Button, { className: 'Button Button--primary', onclick: () => this.copy() }, this.copied
          ? app.translator.trans('cengizkemec-social.forum.post.copied')
          : app.translator.trans('cengizkemec-social.forum.post.copy')),
      ]),
      m('p', { className: 'SocialMuted' }, this.link.expiresAt
        ? app.translator.trans('cengizkemec-social.forum.rooms.invite_link_expires_at', { time: new Date(this.link.expiresAt).toLocaleString() })
        : app.translator.trans('cengizkemec-social.forum.rooms.invite_never')),
      m('p', { className: 'SocialMuted' }, this.link.maxUses
        ? app.translator.trans('cengizkemec-social.forum.rooms.invite_link_uses_left', { left: Math.max(0, this.link.maxUses - this.link.uses), max: this.link.maxUses })
        : app.translator.trans('cengizkemec-social.forum.rooms.invite_unlimited')),
      m(Button, { className: 'Button Button--link Button--block', type: 'button', onclick: () => { this.link = null; this.copied = false; } }, app.translator.trans('cengizkemec-social.forum.rooms.invite_link_create_another')),
    ]);
  }
}
