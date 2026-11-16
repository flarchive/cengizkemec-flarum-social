import app from 'flarum/forum/app';
import { get } from '../../common/api';
import { roomUrl } from '../utils';

/**
 * Compact voice-room widget for Flarum's own index sidebar. It reuses the
 * public Social rooms endpoint so guests and members see exactly the rooms
 * they are allowed to see, without loading the whole Social SPA.
 */
export default class ForumVoiceWidget {
  rooms: any[] = [];
  loaded = false;

  oninit(): void {
    get('/social/rooms')
      .then((response: any) => {
        this.rooms = response.data?.rooms || [];
      })
      .catch(() => {})
      .then(() => {
        this.loaded = true;
        m.redraw();
      });
  }

  view(): any {
    if (!app.forum.attribute<boolean>('socialForumVoiceWidget') || !app.forum.attribute<boolean>('socialVoiceEnabled')) return null;

    if (!this.loaded) {
      return m('section', { className: 'SocialForumWidget SocialForumWidget--loading' }, m('i', { className: 'fas fa-spinner fa-spin' }));
    }

    const rooms = this.rooms
      .filter((room: any) => room.isVoice && Number(room.participantCount) > 0)
      .slice(0, 6);

    return m('section', { className: 'SocialForumWidget' }, [
      m('div', { className: 'SocialForumWidget-head' }, [
        m('span', {}, [m('i', { className: 'fas fa-headset' }), ' ', app.translator.trans('cengizkemec-social.forum.forum_widget.title')]),
        m('a', { className: 'SocialForumWidget-all', href: app.route('social.rooms') }, app.translator.trans('cengizkemec-social.forum.forum_widget.all')),
      ]),
      rooms.length
        ? m('div', { className: 'SocialForumWidget-bubbles' }, rooms.map((room: any) =>
            m('a', {
              className: 'SocialForumWidget-bubble',
              href: roomUrl(room),
              title: room.name,
              key: room.id,
            }, [
              m('span', { className: 'SocialForumWidget-bubble-icon' }, m('i', { className: room.icon || 'fas fa-volume-high' })),
              m('span', { className: 'SocialForumWidget-bubble-count' }, room.participantCount),
              m('span', { className: 'SocialForumWidget-bubble-name' }, room.name),
            ])
          ))
        : m('p', { className: 'SocialForumWidget-empty' }, app.translator.trans('cengizkemec-social.forum.forum_widget.empty')),
      m('a', { className: 'SocialForumWidget-open', href: app.route('social.rooms') }, app.translator.trans('cengizkemec-social.forum.forum_widget.open')),
    ]);
  }
}
