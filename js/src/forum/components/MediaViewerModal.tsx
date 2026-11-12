import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';

export default class MediaViewerModal extends Modal {
  items: any[] = [];
  index = 0;
  touchStartX: number | null = null;
  touchStartY: number | null = null;

  oninit(vnode: any): void {
    super.oninit(vnode);

    const attrs = vnode.attrs || {};
    const items = Array.isArray(attrs.items) && attrs.items.length ? attrs.items : attrs.media ? [attrs.media] : [];

    this.items = items.slice();
    this.index = Number.isInteger(attrs.index) ? Math.max(0, Math.min(items.length - 1, attrs.index)) : 0;

    if (!items.length) return;

    const selected = attrs.media;
    const found = this.items.findIndex((item: any) => item === selected || (selected && item.id === selected.id));

    if (found >= 0) this.index = found;

    this.handleKey = this.handleKey.bind(this);
    window.addEventListener('keydown', this.handleKey);
  }

  onremove(vnode: any): void {
    window.removeEventListener('keydown', this.handleKey);
    super.onremove(vnode);
  }

  handleKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  className(): string {
    return 'Modal--large SocialMediaViewer';
  }

  current(): any {
    return this.items[this.index] || null;
  }

  previous(): void {
    if (this.items.length < 2) return;
    this.index = (this.index - 1 + this.items.length) % this.items.length;
    m.redraw();
  }

  next(): void {
    if (this.items.length < 2) return;
    this.index = (this.index + 1) % this.items.length;
    m.redraw();
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    this.index = index;
    m.redraw();
  }

  title(): string {
    const media = this.current();
    return media?.name || (app.translator.trans('cengizkemec-social.forum.media.preview') as string);
  }

  renderItem(media: any): any {
    if (media.type === 'image') {
      return m('img', {
        className: 'SocialMediaViewer-media',
        src: media.url,
        alt: media.name || '',
        draggable: false,
      });
    }

    if (media.type === 'video') {
      return m('video', {
        className: 'SocialMediaViewer-media',
        src: media.url,
        controls: true,
        autoplay: true,
        playsinline: true,
      });
    }

    return m('div', { className: 'SocialMediaViewer-document' }, [
      m('i', { className: 'fas fa-file-lines' }),
      m('p', {}, media.name),
      m('a', { className: 'Button Button--primary', href: media.url, target: '_blank', rel: 'noopener noreferrer' }, app.translator.trans('cengizkemec-social.forum.media.open')),
    ]);
  }

  swipeStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.touchStartX = touch?.clientX ?? null;
    this.touchStartY = touch?.clientY ?? null;
  }

  swipeEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];

    if (this.touchStartX === null || this.touchStartY === null || !touch) return;

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    this.touchStartX = null;
    this.touchStartY = null;

    // Only treat a clear horizontal gesture as navigation so vertical page
    // scrolling and normal taps keep working.
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX < 0) this.next();
    else this.previous();
  }

  content(): any {
    const media = this.current();

    if (!media) return null;

    const multiple = this.items.length > 1;

    return m('div', { className: 'SocialMediaViewer-body SocialMediaViewer-carousel' }, [
      m('div', {
        className: 'SocialMediaViewer-stage',
        ontouchstart: (event: TouchEvent) => this.swipeStart(event),
        ontouchend: (event: TouchEvent) => this.swipeEnd(event),
      }, [
        this.renderItem(media),
        multiple
          ? m('button', {
              className: 'SocialMediaViewer-nav SocialMediaViewer-nav--prev',
              type: 'button',
              onclick: () => this.previous(),
              'aria-label': app.translator.trans('cengizkemec-social.forum.media.previous'),
            }, m('i', { className: 'fas fa-chevron-left' }))
          : null,
        multiple
          ? m('button', {
              className: 'SocialMediaViewer-nav SocialMediaViewer-nav--next',
              type: 'button',
              onclick: () => this.next(),
              'aria-label': app.translator.trans('cengizkemec-social.forum.media.next'),
            }, m('i', { className: 'fas fa-chevron-right' }))
          : null,
      ]),
      multiple
        ? m('div', { className: 'SocialMediaViewer-footer' }, [
            m('span', { className: 'SocialMediaViewer-counter' }, `${this.index + 1} / ${this.items.length}`),
            m('div', { className: 'SocialMediaViewer-dots' }, this.items.map((item: any, index: number) =>
              m('button', {
                type: 'button',
                className: 'SocialMediaViewer-dot' + (index === this.index ? ' is-active' : ''),
                onclick: () => this.goTo(index),
                'aria-label': `${index + 1} / ${this.items.length}`,
              })
            )),
          ])
        : null,
    ]);
  }
}
