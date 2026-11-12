import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import SocialState from '../SocialState';
import { del, get, uploadFile } from '../../common/api';
import { handleApiError } from '../utils';
import MediaViewerModal from '../components/MediaViewerModal';

export default class MediaPage extends SocialPage {
  media: any[] = [];
  meta: any = {};
  scope = 'library';
  type = '';
  loading = true;
  uploading = false;
  error: string | null = null;
  input: HTMLInputElement | null = null;

  pageTitle(): string {
    return app.translator.trans('cengizkemec-social.forum.nav.media') as string;
  }

  onSocialReady(): void {
    this.scope = SocialState.user ? 'library' : 'library';
    this.load();
  }

  load(reset = true): void {
    this.loading = reset;
    this.error = null;

    get('/social/media', {
      scope: this.scope,
      type: this.type,
      page: { offset: reset ? 0 : this.media.length, limit: 24 },
    })
      .then((response: any) => {
        this.meta = response.meta || {};
        this.media = reset ? response.data : this.media.concat(response.data);
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  upload(file: File): void {
    this.uploading = true;
    uploadFile('/social/media', file)
      .then((response: any) => {
        this.media.unshift(response.data);
        app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.media.uploaded'));
      })
      .catch(handleApiError)
      .finally(() => {
        this.uploading = false;
        m.redraw();
      });
  }

  remove(item: any): void {
    if (!confirm(app.translator.trans('cengizkemec-social.forum.media.confirm_delete') as string)) return;

    del(`/social/media/${item.id}`)
      .then(() => {
        this.media = this.media.filter((media) => media.id !== item.id);
      })
      .catch(handleApiError);
  }

  content(): any {
    return m('div', { className: 'SocialMediaPage' }, [
      m('div', { className: 'SocialPageHead' }, [
        m('div', {}, [m('h1', {}, app.translator.trans('cengizkemec-social.forum.media.title')), m('p', {}, app.translator.trans('cengizkemec-social.forum.media.subtitle'))]),
        SocialState.user && SocialState.can('uploadMedia')
          ? m('div', {}, [
              m('input', {
                type: 'file',
                accept: (SocialState.config.media?.allowedMimes || []).join(','),
                className: 'SocialUploader-input',
                oncreate: (v: any) => (this.input = v.dom as HTMLInputElement),
                onchange: (event: Event) => {
                  const file = (event.target as HTMLInputElement).files?.[0];
                  if (file) this.upload(file);
                },
              }),
              m('button', { className: 'Button Button--primary', onclick: () => this.input?.click(), loading: this.uploading }, [m('i', { className: 'fas fa-upload' }), ' ', app.translator.trans('cengizkemec-social.forum.media.upload')]),
            ])
          : null,
      ]),
      m('div', { className: 'SocialTabs' }, [
        SocialState.user ? m('button', { className: 'SocialTab' + (this.scope === 'library' ? ' is-active' : ''), onclick: () => { this.scope = 'library'; this.load(); } }, app.translator.trans('cengizkemec-social.forum.media.library')) : null,
        SocialState.user ? m('button', { className: 'SocialTab' + (this.scope === 'mine' ? ' is-active' : ''), onclick: () => { this.scope = 'mine'; this.load(); } }, app.translator.trans('cengizkemec-social.forum.media.mine')) : null,
        m('span', { className: 'SocialTabs-separator' }),
        ['', 'image', 'video', 'document'].map((type) =>
          m('button', { className: 'SocialTab' + (this.type === type ? ' is-active' : ''), onclick: () => { this.type = type; this.load(); } }, app.translator.trans(type ? `cengizkemec-social.forum.media.types.${type}` : 'cengizkemec-social.forum.media.all'))
        ),
      ]),
      this.error ? m('div', { className: 'SocialPanel SocialPanel--error' }, [m('p', {}, this.error), m('button', { className: 'Button Button--primary', onclick: () => this.load() }, app.translator.trans('cengizkemec-social.forum.errors.retry'))]) : null,
      this.loading
        ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
        : this.media.length
        ? m('div', { className: 'SocialMediaGrid' }, this.media.map((item, index) =>
            m('div', { className: 'SocialMediaCard'}, [
              m('button', { className: 'SocialMediaCard-preview', onclick: () => app.modal.show(MediaViewerModal, { media: item, items: this.media, index }) }, [
                item.type === 'image' ? m('img', { src: item.thumbUrl || item.url, alt: item.name || '', loading: 'lazy' }) : null,
                item.type === 'video' ? [m('video', { src: item.url, preload: 'metadata' }), m('span', { className: 'SocialMediaCard-play' }, m('i', { className: 'fas fa-play' }))] : null,
                item.type === 'document' ? [m('i', { className: 'fas fa-file-lines' }), m('span', {}, item.name)] : null,
              ]),
              m('div', { className: 'SocialMediaCard-meta' }, [
                m('span', { className: 'SocialMediaCard-name' }, item.name || item.type),
                SocialState.user && (SocialState.user.id === item.userId || SocialState.can('moderateMedia'))
                  ? m('button', { className: 'Button Button--icon Button--link SocialMediaCard-delete', onclick: () => this.remove(item), 'aria-label': app.translator.trans('cengizkemec-social.forum.media.delete') }, m('i', { className: 'fas fa-trash' }))
                  : null,
              ]),
            ])
          ))
        : m('div', { className: 'SocialEmpty' }, [m('i', { className: 'fas fa-photo-film' }), m('h3', {}, app.translator.trans('cengizkemec-social.forum.media.empty')), m('p', {}, app.translator.trans('cengizkemec-social.forum.media.empty_text'))]),
      this.meta.hasMore ? m('button', { className: 'Button Button--block SocialLoadMore', onclick: () => this.load(false) }, app.translator.trans('cengizkemec-social.forum.common.load_more')) : null,
    ]);
  }
}
