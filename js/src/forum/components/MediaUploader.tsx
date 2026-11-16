import app from 'flarum/forum/app';
import { uploadFile } from '../../common/api';
import SocialState from '../SocialState';

export default class MediaUploader {
  uploading = false;
  progress = 0;
  error: string | null = null;
  input: HTMLInputElement | null = null;

  handleFiles(files: FileList | File[], count = 0, onUploading?: (value: boolean) => void, onUploaded?: (item: any) => void): void {
    if (!files || !files.length) return;

    const config = SocialState.config?.media || {};
    const remaining = Math.max(0, (config.maxAttachments || 6) - count);
    const selected = Array.from(files).slice(0, remaining);

    if (!selected.length) return;

    this.uploading = true;
    this.error = null;
    onUploading?.(true);

    let done = 0;

    const next = () => {
      done++;
      this.progress = Math.round((done / selected.length) * 100);
      if (done >= selected.length) {
        this.uploading = false;
        parent.attrs.onUploading?.(false);
        m.redraw();
      }
    };

    selected.forEach((file) => {
      uploadFile('/social/media', file, (percent) => {
        this.progress = percent;
        m.redraw();
      })
        .then((response: any) => {
          onUploaded?.(response.data);
        })
        .catch((error: any) => {
          this.error = error.message;
        })
        .finally(next);
    });
  }

  upload(files: FileList | File[], parent: any): void {
    this.handleFiles(files, parent.attrs.count || 0, parent.attrs.onUploading, parent.attrs.onUploaded);
  }

  view(vnode: any): any {
    const config = SocialState.config?.media || {};
    const accept = (config.allowedMimes || []).join(',');
    const maxMb = Math.max(config.maxImageMb || 10, config.maxVideoMb || 100, config.maxDocumentMb || 20);

    return m('div', {
      className: 'SocialUploader' + (this.uploading ? ' is-uploading' : ''),
      ondragover: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.add('is-dragging');
      },
      ondragleave: (event: DragEvent) => event.currentTarget.classList.remove('is-dragging'),
      ondrop: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('is-dragging');
        if (event.dataTransfer?.files) this.upload(event.dataTransfer.files, vnode);
      },
    }, [
      m('input', {
        type: 'file',
        multiple: true,
        accept,
        className: 'SocialUploader-input',
        oncreate: (v: any) => (this.input = v.dom as HTMLInputElement),
        onchange: (event: Event) => {
          const input = event.target as HTMLInputElement;
          if (input.files) this.upload(input.files, vnode);
          input.value = '';
        },
      }),
      m(
        'button',
        {
          type: 'button',
          className: 'Button Button--link SocialUploader-button',
          disabled: this.uploading,
          onclick: (event: Event) => {
            event.preventDefault();
            this.input?.click();
          },
        },
        this.uploading
          ? [m('i', { className: 'fas fa-spinner fa-spin' }), ' ', this.progress + '%']
          : [m('i', { className: 'fas fa-paperclip' }), ' ', app.translator.trans('cengizkemec-social.forum.media.attach')]
      ),
      m('span', { className: 'SocialUploader-hint' }, app.translator.trans('cengizkemec-social.forum.media.hint', { max: maxMb })),
      this.error ? m('span', { className: 'SocialUploader-error' }, this.error) : null,
    ]);
  }
}
