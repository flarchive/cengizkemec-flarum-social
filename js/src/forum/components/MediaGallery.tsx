import app from 'flarum/forum/app';

export default class MediaGallery {
  view(vnode: any): any {
    const media: any[] = vnode.attrs.media || [];

    if (!media.length) return null;

    const open = (item: any, index: number) => {
      if (item.type === 'document') {
        window.open(item.url, '_blank', 'noopener');
        return;
      }
      app.modal.show(() => import('./MediaViewerModal'), { media: item, items: media, index });
    };

    return m(
      'div',
      { className: 'SocialMediaGallery SocialMediaGallery--count-' + Math.min(media.length, 4) },
      media.map((item, index) =>
        m(
          'button',
          {
            className: 'SocialMediaGallery-item SocialMediaGallery-item--' + item.type,
            onclick: () => open(item, index),
            type: 'button',
            'aria-label': app.translator.trans('cengizkemec-social.forum.media.preview'),
          },
          item.type === 'image'
            ? m('img', { src: item.thumbUrl || item.url, alt: item.name || '', loading: 'lazy' })
            : item.type === 'video'
            ? [
                m('video', { src: item.url, preload: 'metadata', muted: true, playsinline: true }),
                m('span', { className: 'SocialMediaGallery-play' }, m('i', { className: 'fas fa-play' })),
              ]
            : [m('i', { className: 'fas fa-file-lines' }), m('span', {}, item.name)],
          media.length > 4 && index === 3 ? m('span', { className: 'SocialMediaGallery-more' }, '+' + (media.length - 4)) : null
        )
      )
    );
  }
}
