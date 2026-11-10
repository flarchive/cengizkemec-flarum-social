import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { post } from '../../common/api';
import { Avatar, formatBody, timeAgo } from '../utils';

export default class StoryViewerModal extends Modal {
  group: any = null;
  index = 0;
  timer: number | null = null;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.group = vnode.attrs.group;
    this.index = vnode.attrs.index || 0;
    this.handleKey = this.handleKey.bind(this);
    window.addEventListener('keydown', this.handleKey);
    this.markViewed();
    this.schedule();
  }

  onremove(vnode: any): void {
    this.clearTimer();
    window.removeEventListener('keydown', this.handleKey);
    super.onremove(vnode);
  }

  handleKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.move(-1);
    } else if (event.key === 'Escape') {
      this.hide();
    }
  }

  clearTimer(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  schedule(): void {
    this.clearTimer();

    const story = this.current();

    // Videos advance on their own `ended` event. Images and text use the
    // familiar short story duration.
    if (!story || story.media?.type === 'video') return;

    this.timer = window.setTimeout(() => this.next(), 6000);
  }

  className(): string {
    return 'Modal--large SocialStoryViewer';
  }

  title(): string {
    return this.group?.user?.displayName || (app.translator.trans('cengizkemec-social.forum.stories.title') as string);
  }

  current(): any {
    return this.group?.stories?.[this.index];
  }

  markViewed(): void {
    const story = this.current();
    if (!story || story.viewed) return;

    post(`/social/stories/${story.id}/view`).then(() => {
      story.viewed = true;
      this.attrs.onupdate?.();
    }).catch(() => {});
  }

  move(delta: number): void {
    const stories = this.group?.stories || [];
    const next = this.index + delta;

    if (next < 0) return;

    if (next >= stories.length) {
      this.hide();
      return;
    }

    this.index = next;
    this.markViewed();
    this.schedule();
    m.redraw();
  }

  next(): void {
    this.move(1);
  }

  content(): any {
    const story = this.current();

    if (!story) return null;

    const user = this.group.user;
    const total = this.group.stories.length;

    return m('div', { className: 'SocialStoryViewer-body' }, [
      m('div', { className: 'SocialStoryViewer-progress' }, (this.group.stories || []).map((item: any, index: number) =>
        m('span', {
          key: item.id,
          className: 'SocialStoryViewer-progressBar' + (index < this.index ? ' is-done' : index === this.index ? ' is-active' : ''),
        })
      )),
      m('div', { className: 'SocialStoryViewer-head' }, [
        m('span', { className: 'SocialStoryViewer-user' }, [
          Avatar(user, 34),
          m('span', {}, [
            m('strong', {}, user.displayName),
            m('small', {}, timeAgo(story.createdAt)),
          ]),
        ]),
        m('span', { className: 'SocialStoryViewer-step' }, `${this.index + 1} / ${total}`),
      ]),
      m('div', { className: 'SocialStoryViewer-stage' }, [
        story.media?.type === 'video'
          ? m('video', {
              src: story.media.url,
              controls: true,
              autoplay: true,
              playsinline: true,
              className: 'SocialStoryViewer-media',
              onended: () => this.next(),
            })
          : story.media
          ? m('img', { src: story.media.url, alt: '', className: 'SocialStoryViewer-media' })
          : m('div', { className: 'SocialStoryViewer-text' }, formatBody(story.body, story.bodyHtml)),
        story.media && story.body
          ? m('div', { className: 'SocialStoryViewer-caption' }, formatBody(story.body, story.bodyHtml))
          : null,
        total > 1
          ? m('button', {
              className: 'SocialStoryViewer-tap SocialStoryViewer-tap--prev',
              type: 'button',
              'aria-label': app.translator.trans('cengizkemec-social.forum.stories.previous'),
              onclick: () => this.move(-1),
            })
          : null,
        total > 1
          ? m('button', {
              className: 'SocialStoryViewer-tap SocialStoryViewer-tap--next',
              type: 'button',
              'aria-label': app.translator.trans('cengizkemec-social.forum.stories.next'),
              onclick: () => this.next(),
            })
          : null,
      ]),
      m('div', { className: 'SocialStoryViewer-meta' }, [
        m('span', {}, [m('i', { className: 'far fa-eye' }), ' ', story.viewsCount || 0]),
        story.canDelete
          ? m(Button, {
              className: 'Button Button--link SocialStoryViewer-delete',
              onclick: () => {
                if (!confirm(app.translator.trans('cengizkemec-social.forum.stories.confirm_delete') as string)) return;
                import('../../common/api').then(({ del }) => del(`/social/stories/${story.id}`).then(() => this.hide()).catch((error: any) => app.alerts.show({ type: 'error' }, error.message)));
              },
            }, app.translator.trans('cengizkemec-social.forum.stories.delete'))
          : null,
      ]),
      m('div', { className: 'SocialStoryViewer-nav' }, [
        m('button', { className: 'SocialStoryViewer-arrow', disabled: this.index === 0, onclick: () => this.move(-1) }, m('i', { className: 'fas fa-chevron-left' })),
        m('button', { className: 'SocialStoryViewer-arrow', disabled: this.index >= total - 1, onclick: () => this.next() }, m('i', { className: 'fas fa-chevron-right' })),
      ]),
    ]);
  }
}
