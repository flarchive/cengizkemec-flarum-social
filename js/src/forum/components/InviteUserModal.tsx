import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { get, post } from '../../common/api';
import { Avatar, handleApiError } from '../utils';

export default class InviteUserModal extends Modal {
  query = '';
  results: any[] = [];
  searching = false;
  inviting = false;
  mode = 'invite';
  roomId = 0;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.roomId = vnode.attrs.roomId;
    this.mode = vnode.attrs.mode || 'invite';
  }

  className(): string {
    return 'Modal--small SocialInviteModal';
  }

  title(): string {
    return app.translator.trans(this.mode === 'transfer' ? 'cengizkemec-social.forum.rooms.transfer_title' : 'cengizkemec-social.forum.rooms.invite_title') as string;
  }

  search(): void {
    if (this.query.trim().length < 2) return;
    this.searching = true;

    get('/social/search', { q: this.query.trim() })
      .then((response: any) => (this.results = response.data?.users || []))
      .catch(handleApiError)
      .finally(() => {
        this.searching = false;
        m.redraw();
      });
  }

  invite(user: any): void {
    if (this.inviting) return;
    this.inviting = true;

    const action = this.mode === 'transfer' ? 'transfer' : 'invite';

    post(`/social/rooms/${this.roomId}/${action}`, { user_id: user.id })
      .then(() => {
        app.alerts.show({ type: 'success' }, app.translator.trans(this.mode === 'transfer' ? 'cengizkemec-social.forum.rooms.transferred' : 'cengizkemec-social.forum.rooms.invited'));
        this.attrs.onsuccess?.(user);
        this.hide();
      })
      .catch(handleApiError)
      .finally(() => {
        this.inviting = false;
        m.redraw();
      });
  }

  content(): any {
    return m('div', { className: 'Modal-body' }, [
      m('div', { className: 'Form-group' }, m('form', {
        onsubmit: (event: Event) => {
          event.preventDefault();
          this.search();
        },
      }, m('input', {
        className: 'FormControl',
        value: this.query,
        placeholder: app.translator.trans('cengizkemec-social.forum.rooms.search_user'),
        oninput: (event: Event) => (this.query = (event.target as HTMLInputElement).value),
      }))),
      this.searching ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' })) : null,
      m('div', { className: 'SocialPeople' }, this.results.map((user: any) =>
        m('div', { className: 'SocialPerson' }, [
          Avatar(user, 40),
          m('span', {}, [m('strong', {}, user.displayName), m('small', {}, '@' + user.username)]),
          m(Button, { className: 'Button Button--primary Button--small', loading: this.inviting, onclick: () => this.invite(user) }, app.translator.trans(this.mode === 'transfer' ? 'cengizkemec-social.forum.rooms.transfer' : 'cengizkemec-social.forum.rooms.invite')),
        ])
      )),
    ]);
  }
}
