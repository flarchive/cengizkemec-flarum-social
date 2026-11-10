import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { get, post } from '../../common/api';
import { Avatar, handleApiError } from '../utils';

export default class NewMessageModal extends Modal {
  query = '';
  results: any[] = [];
  searching = false;
  creating = false;

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
      .finally(() => {
        this.searching = false;
        m.redraw();
      });
  }

  start(user: any): void {
    this.creating = true;
    post('/social/dm/conversations', { user_id: user.id })
      .then((response: any) => {
        this.attrs.oncreated?.(response.data);
        this.hide();
      })
      .catch(handleApiError)
      .finally(() => {
        this.creating = false;
        m.redraw();
      });
  }

  content(): any {
    return m('div', { className: 'Modal-body' }, [
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
        m('div', { className: 'SocialPerson' }, [
          Avatar(user, 40),
          m('span', {}, [m('strong', {}, user.displayName), m('small', {}, '@' + user.username)]),
          m(Button, { className: 'Button Button--primary Button--small', loading: this.creating, onclick: () => this.start(user) }, app.translator.trans('cengizkemec-social.forum.messages.start')),
        ])
      )),
    ]);
  }
}
