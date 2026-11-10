import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';

export default class RoomJoinModal extends Modal {
  password = '';
  loading = false;

  className(): string {
    return 'Modal--small SocialRoomJoinModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.rooms.password_title') as string;
  }

  content(): any {
    return m('div', { className: 'Modal-body' }, m('form', {
      onsubmit: (event: Event) => {
        event.preventDefault();
        this.loading = true;
        this.attrs.onjoin?.(this.password);
        this.hide();
      },
    }, [
      m('p', {}, app.translator.trans('cengizkemec-social.forum.rooms.password_text')),
      m('div', { className: 'Form-group' }, m('input', {
        className: 'FormControl',
        type: 'password',
        value: this.password,
        oninput: (event: Event) => (this.password = (event.target as HTMLInputElement).value),
        autofocus: true,
      })),
      m(Button, { className: 'Button Button--primary Button--block', type: 'submit', loading: this.loading }, app.translator.trans('cengizkemec-social.forum.voice.join')),
    ]));
  }
}
