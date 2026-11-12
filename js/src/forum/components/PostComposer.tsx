import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import SocialState from '../SocialState';
import { post } from '../../common/api';
import { Avatar, promptLogin } from '../utils';
import MediaUploader from './MediaUploader';

const EMOJI = ['😀', '😂', '😍', '🔥', '🎉', '👍', '👀', '💬', '🎮', '🛩️', '❤️', '😮'];

export default class PostComposer {
  body = '';
  visibility = 'public';
  media: any[] = [];
  uploading = false;
  submitting = false;
  emojiOpen = false;
  error: string | null = null;
  textarea: HTMLTextAreaElement | null = null;
  uploader: MediaUploader | null = null;
  dragging = false;

  dropFiles(files: FileList | File[]): void {
    this.uploader?.handleFiles(
      files,
      this.media.length,
      (value: boolean) => (this.uploading = value),
      (item: any) => {
        this.media.push(item);
        m.redraw();
      }
    );
  }

  submit(): void {
    if (this.submitting || this.uploading) return;

    const text = this.body.trim();

    if (!text && !this.media.length) return;

    this.submitting = true;
    this.error = null;

    post('/social/posts', {
      body: text,
      visibility: this.visibility,
      media_ids: this.media.map((item) => item.id),
    })
      .then((response: any) => {
        this.body = '';
        this.media = [];
        this.visibility = 'public';
        this.attrs.oncreated?.(response.data);
        if (this.textarea) this.textarea.value = '';
        app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.post.published'));
      })
      .catch((error: any) => {
        this.error = error.message;
      })
      .finally(() => {
        this.submitting = false;
        m.redraw();
      });
  }

  addEmoji(emoji: string): void {
    this.body += emoji;
    this.emojiOpen = false;
    if (this.textarea) {
      this.textarea.value = this.body;
      this.textarea.focus();
    }
  }

  view(vnode: any): any {
    this.attrs = vnode.attrs;
    const state = SocialState;

    if (state.isGuest) {
      return m('div', { className: 'SocialComposer SocialComposer--guest' }, [
        m('div', { className: 'SocialComposer-guestIcon' }, m('i', { className: 'fas fa-pen-to-square' })),
        m('div', { className: 'SocialComposer-guestText' }, [
          m('strong', {}, app.translator.trans('cengizkemec-social.forum.post.guest_title')),
          m('span', {}, app.translator.trans('cengizkemec-social.forum.post.guest_text')),
        ]),
        m(Button, {
          className: 'Button Button--primary',
          onclick: () => promptLogin('post'),
        }, app.translator.trans('cengizkemec-social.forum.auth.login')),
      ]);
    }

    if (!state.can('createPost')) return null;

    const config = state.config.feed || {};
    const maxLength = config.maxLength || 5000;
    const canUpload = state.can('uploadMedia');

    return m('div', {
      className: 'SocialComposer' + (this.dragging ? ' is-dragging' : ''),
      ondragover: canUpload
        ? (event: DragEvent) => {
            event.preventDefault();
            if (!this.dragging) {
              this.dragging = true;
              m.redraw();
            }
          }
        : undefined,
      ondragleave: canUpload
        ? (event: DragEvent) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return;
            this.dragging = false;
            m.redraw();
          }
        : undefined,
      ondrop: canUpload
        ? (event: DragEvent) => {
            event.preventDefault();
            this.dragging = false;

            if (event.dataTransfer?.files?.length) {
              this.dropFiles(event.dataTransfer.files);
            } else {
              m.redraw();
            }
          }
        : undefined,
    }, m('div', { className: 'SocialComposer-inner' }, [
      this.dragging
        ? m('div', { className: 'SocialComposer-dropHint' }, [m('i', { className: 'fas fa-cloud-arrow-up' }), ' ', app.translator.trans('cengizkemec-social.forum.media.drop_hint')])
        : null,
      state.user ? Avatar(state.user, 42) : null,
      m('div', { className: 'SocialComposer-main' }, [
        m('div', { className: 'SocialComposer-top' }, [
          m('strong', {}, app.translator.trans('cengizkemec-social.forum.post.compose')),
          m('span', { className: 'SocialComposer-visibility' }, m('i', { className: 'fas fa-globe' }), m('select', {
            value: this.visibility,
            onchange: (event: Event) => (this.visibility = (event.target as HTMLSelectElement).value),
            'aria-label': app.translator.trans('cengizkemec-social.forum.post.visibility_label'),
          }, ['public', 'members', 'followers', 'private'].map((value) =>
            m('option', { value, selected: this.visibility === value }, app.translator.trans(`cengizkemec-social.forum.post.visibility.${value}`))
          ))),
        ]),
        m('textarea', {
          className: 'FormControl SocialComposer-textarea',
          rows: 3,
          maxlength: maxLength,
          value: this.body,
          placeholder: app.translator.trans('cengizkemec-social.forum.post.placeholder'),
          oncreate: (v: any) => (this.textarea = v.dom as HTMLTextAreaElement),
          oninput: (event: Event) => (this.body = (event.target as HTMLTextAreaElement).value),
        }),
        this.media.length
          ? m('div', { className: 'SocialComposer-attachments' }, this.media.map((item) =>
              m('div', { className: 'SocialComposer-attachment' }, [
                item.type === 'image'
                  ? m('img', { src: item.thumbUrl || item.url, alt: item.name || '' })
                  : m('div', { className: 'SocialComposer-file' }, [m('i', { className: item.type === 'video' ? 'fas fa-video' : 'fas fa-file-lines' }), m('span', {}, item.name)]),
                m('button', {
                  type: 'button',
                  className: 'SocialComposer-remove',
                  onclick: () => {
                    this.media = this.media.filter((media) => media.id !== item.id);
                  },
                  'aria-label': app.translator.trans('cengizkemec-social.forum.media.remove'),
                }, m('i', { className: 'fas fa-times' })),
              ])
            ))
          : null,
        this.error ? m('div', { className: 'SocialComposer-error' }, this.error) : null,
        m('div', { className: 'SocialComposer-actions' }, [
          m('div', { className: 'SocialComposer-tools' }, [
            canUpload
              ? m(MediaUploader, {
                  count: this.media.length,
                  oncreate: (vnode: any) => (this.uploader = vnode.state as MediaUploader),
                  onUploading: (value: boolean) => (this.uploading = value),
                  onUploaded: (item: any) => {
                    this.media.push(item);
                  },
                })
              : null,
            m('button', {
              type: 'button',
              className: 'Button Button--link SocialComposer-emoji',
              onclick: () => (this.emojiOpen = !this.emojiOpen),
              'aria-label': app.translator.trans('cengizkemec-social.forum.post.emoji'),
            }, m('i', { className: 'far fa-smile' })),
            this.emojiOpen
              ? m('div', { className: 'SocialEmojiPicker' }, EMOJI.map((emoji) =>
                  m('button', { type: 'button', className: 'SocialEmojiPicker-item', onclick: () => this.addEmoji(emoji) }, emoji)
                ))
              : null,
          ]),
          m('span', { className: 'SocialComposer-length' }, `${this.body.length}/${maxLength}`),
          m(Button, {
            className: 'Button Button--primary SocialComposer-submit',
            loading: this.submitting,
            disabled: this.submitting || this.uploading || (!this.body.trim() && !this.media.length),
            onclick: () => this.submit(),
          }, app.translator.trans('cengizkemec-social.forum.post.publish')),
        ]),
      ]),
    ]));
  }
}
