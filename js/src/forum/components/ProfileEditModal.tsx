import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { patch } from '../../common/api';

export default class ProfileEditModal extends Modal {
  headline = '';
  bio = '';
  customStatus = '';
  privacy = 'public';
  coverUrl = '';
  loading = false;
  uploadingCover = false;
  error: string | null = null;

  oninit(vnode: any) {
    super.oninit(vnode);
    const user = vnode.attrs.user || {};
    this.headline = user.headline || '';
    this.bio = user.bio || '';
    this.customStatus = user.customStatus || '';
    this.privacy = user.privacy || 'public';
    this.coverUrl = user.coverUrl || '';
  }

  className(): string {
    return 'Modal--small SocialProfileEditModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.profile.edit') as string;
  }

  submit(): void {
    this.loading = true;
    this.error = null;

    patch('/social/me/profile', {
      headline: this.headline,
      bio: this.bio,
      custom_status: this.customStatus,
      privacy: this.privacy,
      cover_url: this.coverUrl,
    })
      .then((response: any) => {
        // When fof/user-bio is installed, save through Flarum's own user
        // endpoint so its validation, permissions and formatter run too.
        const user = app.session.user as any;

        if (user && typeof user.bio === 'function') {
          return user.save({ bio: this.bio }).catch(() => {}).then(() => response);
        }

        return response;
      })
      .then((response: any) => {
        this.attrs.onsaved?.(response.data);
        this.hide();
      })
      .catch((error: any) => (this.error = error.message))
      .then(() => {
        this.loading = false;
        m.redraw();
      });
  }

  uploadCover(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const user = app.session.user as any;

    if (!file || !user?.canSetProfileCover?.()) return;

    this.uploadingCover = true;
    this.error = null;

    const body = new FormData();
    body.append('cover', file);

    app
      .request({
        method: 'POST',
        url: app.forum.attribute('baseUrl') + '/api/users/' + user.id() + '/cover',
        body,
        errorHandler: () => {},
      })
      .then((response: any) => {
        if (response?.data) app.store.pushPayload(response);

        const cover = user.cover?.();

        if (cover) this.coverUrl = cover;
      })
      .catch((error: any) => {
        this.error = error?.response?.errors?.[0]?.detail || error?.message || app.translator.trans('cengizkemec-social.forum.errors.generic');
      })
      .then(() => {
        this.uploadingCover = false;
        m.redraw();
      });
  }

  content(): any {
    const canSetCover = Boolean((app.session.user as any)?.canSetProfileCover?.());

    return m('div', { className: 'Modal-body' }, m('form', {
      onsubmit: (event: Event) => {
        event.preventDefault();
        this.submit();
      },
    }, [
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.profile.headline')), m('input', { className: 'FormControl', maxlength: 160, value: this.headline, oninput: (event: Event) => (this.headline = (event.target as HTMLInputElement).value) })]),
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.profile.bio')), m('textarea', { className: 'FormControl', rows: 4, maxlength: 2000, value: this.bio, oninput: (event: Event) => (this.bio = (event.target as HTMLTextAreaElement).value) })]),
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.profile.status')), m('input', { className: 'FormControl', maxlength: 120, value: this.customStatus, oninput: (event: Event) => (this.customStatus = (event.target as HTMLInputElement).value) })]),
      m('div', { className: 'Form-group' }, [
        m('label', {}, app.translator.trans('cengizkemec-social.forum.profile.cover')),
        m('input', { className: 'FormControl', type: 'url', value: this.coverUrl, placeholder: 'https://', oninput: (event: Event) => (this.coverUrl = (event.target as HTMLInputElement).value) }),
        canSetCover
          ? m('div', { className: 'SocialCoverUpload' }, [
              m('input', {
                className: 'SocialUploader-input',
                type: 'file',
                accept: 'image/*',
                onchange: (event: Event) => this.uploadCover(event),
              }),
              m(Button, {
                className: 'Button Button--link Button--small',
                type: 'button',
                loading: this.uploadingCover,
                onclick: (event: MouseEvent) => (event.currentTarget as HTMLElement).closest('.SocialCoverUpload')?.querySelector('input[type="file"]')?.click(),
              }, app.translator.trans('cengizkemec-social.forum.profile.cover_upload')),
            ])
          : null,
      ]),
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.profile.privacy')), m('select', { className: 'FormControl', value: this.privacy, onchange: (event: Event) => (this.privacy = (event.target as HTMLSelectElement).value) }, ['public', 'members', 'private'].map((value) => m('option', { value, selected: this.privacy === value }, app.translator.trans(`cengizkemec-social.forum.profile.privacy_options.${value}`))))]),
      this.error ? m('div', { className: 'Alert Alert--error' }, this.error) : null,
      m(Button, { className: 'Button Button--primary Button--block', type: 'submit', loading: this.loading }, app.translator.trans('cengizkemec-social.forum.post.save')),
    ]));
  }
}
