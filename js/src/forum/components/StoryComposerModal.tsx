import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { post, uploadFile } from '../../common/api';

export default class StoryComposerModal extends Modal {
  type = 'text';
  body = '';
  visibility = 'members';
  media: any = null;
  uploading = false;
  loading = false;
  error: string | null = null;
  input: HTMLInputElement | null = null;

  className(): string {
    return 'Modal--small SocialStoryComposer';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.stories.create') as string;
  }

  upload(file: File): void {
    this.uploading = true;
    this.error = null;

    uploadFile('/social/media', file)
      .then((response: any) => {
        this.media = response.data;
        this.type = response.data.type === 'video' ? 'video' : 'image';
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.uploading = false;
        m.redraw();
      });
  }

  submit(): void {
    if (this.loading || this.uploading) return;

    if (this.type === 'text' && !this.body.trim()) {
      this.error = app.translator.trans('cengizkemec-social.forum.stories.empty_content') as string;
      return;
    }

    if (this.type !== 'text' && !this.media) {
      this.error = app.translator.trans('cengizkemec-social.forum.stories.media_required') as string;
      return;
    }

    this.loading = true;
    post('/social/stories', {
      type: this.type,
      body: this.body,
      visibility: this.visibility,
      media_id: this.media?.id,
    })
      .then(() => {
        this.attrs.oncreated?.();
        this.hide();
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  content(): any {
    return m('div', { className: 'Modal-body' }, [
      m('input', {
        type: 'file',
        accept: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm',
        className: 'SocialUploader-input',
        oncreate: (v: any) => (this.input = v.dom as HTMLInputElement),
        onchange: (event: Event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (file) this.upload(file);
        },
      }),
      m('div', { className: 'SocialStoryComposer-modes' }, [
        m(Button, { className: 'Button Button--link' + (this.type === 'text' ? ' is-active' : ''), onclick: () => (this.type = 'text') }, [m('i', { className: 'fas fa-font' }), ' ', app.translator.trans('cengizkemec-social.forum.stories.text')]),
        m(Button, { className: 'Button Button--link', onclick: () => this.input?.click(), loading: this.uploading }, [m('i', { className: 'fas fa-image' }), ' ', app.translator.trans('cengizkemec-social.forum.stories.media')]),
      ]),
      this.media
        ? m('div', { className: 'SocialStoryComposer-preview' }, [
            this.media.type === 'image'
              ? m('img', { src: this.media.url, alt: '' })
              : m('video', { src: this.media.url, controls: true }),
            m(Button, { className: 'Button Button--icon Button--link', icon: 'fas fa-times', onclick: () => (this.media = null), 'aria-label': app.translator.trans('cengizkemec-social.forum.media.remove') }),
          ])
        : null,
      m('div', { className: 'Form-group' }, m('textarea', {
        className: 'FormControl',
        rows: 3,
        maxlength: 1000,
        value: this.body,
        placeholder: app.translator.trans('cengizkemec-social.forum.stories.placeholder'),
        oninput: (event: Event) => (this.body = (event.target as HTMLTextAreaElement).value),
      })),
      m('div', { className: 'Form-group' }, m('label', {}, app.translator.trans('cengizkemec-social.forum.stories.visibility')), m('select', {
        className: 'FormControl',
        value: this.visibility,
        onchange: (event: Event) => (this.visibility = (event.target as HTMLSelectElement).value),
      }, ['public', 'members', 'private'].map((value) => m('option', { value, selected: this.visibility === value }, app.translator.trans(`cengizkemec-social.forum.stories.visibility_options.${value}`))))),
      this.error ? m('div', { className: 'Alert Alert--error' }, this.error) : null,
      m(Button, { className: 'Button Button--primary Button--block', loading: this.loading, disabled: this.uploading, onclick: () => this.submit() }, app.translator.trans('cengizkemec-social.forum.stories.publish')),
    ]);
  }
}
