import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { patch } from '../../common/api';

export default class PostEditorModal extends Modal {
  body = '';
  visibility = 'public';
  loading = false;
  error: string | null = null;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.body = vnode.attrs.post?.body || '';
    this.visibility = vnode.attrs.post?.visibility || 'public';
  }

  className(): string {
    return 'Modal--small SocialComposerModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.post.edit') as string;
  }

  content(): any {
    return m('div', { className: 'Modal-body' }, m('form', {
      onsubmit: (event: Event) => {
        event.preventDefault();
        this.loading = true;
        this.error = null;

        patch(`/social/posts/${this.attrs.post.id}`, { body: this.body, visibility: this.visibility })
          .then((response: any) => {
            this.attrs.onupdated?.(response.data);
            this.hide();
          })
          .catch((error: any) => {
            this.error = error.message;
          })
          .finally(() => {
            this.loading = false;
            m.redraw();
          });
      },
    }, [
      m('div', { className: 'Form-group' }, m('textarea', {
        className: 'FormControl SocialComposer-textarea',
        rows: 7,
        maxlength: this.attrs.maxLength || 5000,
        value: this.body,
        oninput: (event: Event) => (this.body = (event.target as HTMLTextAreaElement).value),
      })),
      m('div', { className: 'Form-group' }, m('select', {
        className: 'FormControl',
        value: this.visibility,
        onchange: (event: Event) => (this.visibility = (event.target as HTMLSelectElement).value),
      }, ['public', 'members', 'followers', 'private'].map((value) =>
        m('option', { value, selected: this.visibility === value }, app.translator.trans(`cengizkemec-social.forum.post.visibility.${value}`))
      ))),
      this.error ? m('div', { className: 'Alert Alert--error' }, this.error) : null,
      m('div', { className: 'Form-group' }, m(Button, { className: 'Button Button--primary Button--block', type: 'submit', loading: this.loading }, app.translator.trans('cengizkemec-social.forum.post.save'))),
    ]));
  }
}
