import app from 'flarum/forum/app';
import { get } from '../../common/api';
import { roomUrl } from '../utils';

let cachedData: any = null;
let pendingRequest: Promise<any> | null = null;

/**
 * Discord/FoF-Blog style channel directory for Flarum's own index sidebar.
 * Categories contain both voice rooms and standalone text channels.
 */
export default class ForumSocialMenu {
  data: any = cachedData;
  loaded = Boolean(cachedData);

  oninit(): void {
    if (!cachedData) {
      cachedData = (window as any).__socialRoomsData || null;
    }

    this.data = cachedData;
    this.loaded = Boolean(cachedData);

    if (cachedData) return;

    pendingRequest = pendingRequest || get('/social/rooms').then((response: any) => {
      cachedData = response.data || null;
      (window as any).__socialRoomsData = cachedData;
      return cachedData;
    });

    pendingRequest
      .then((data: any) => {
        this.data = data;
        this.loaded = true;
        m.redraw();
      })
      .catch(() => {
        this.loaded = true;
        m.redraw();
      });
  }

  view(): any {
    if (!app.forum.attribute<boolean>('socialEnabled') || !app.forum.attribute<boolean>('socialForumMenu')) {
      return null;
    }

    if (!this.loaded) {
      this.data = (window as any).__socialRoomsData || this.data;

      if (!this.data) {
        return m('section', { className: 'SocialForumMenu SocialForumMenu--loading' }, m('i', { className: 'fas fa-spinner fa-spin' }));
      }
    }

    if (!this.data) return null;

    const rooms = this.data.rooms || [];
    const channels = this.data.channels || [];
    const allowedCategoryIds = (this.data.userRoomCategoryIds || []).map((id: any) => Number(id));
    const categories = (this.data.categories || [])
      .map((category: any) => ({
        category,
        rooms: rooms.filter((room: any) => Number(room.categoryId) === Number(category.id)),
        channels: channels.filter((channel: any) => Number(channel.categoryId) === Number(category.id)),
      }))
      .filter((group: any) => group.rooms.length || group.channels.length || allowedCategoryIds.includes(Number(group.category.id)));

    const other = {
      category: { id: 'other', name: app.translator.trans('cengizkemec-social.forum.nav.other_rooms'), icon: 'fas fa-door-open' },
      rooms: rooms.filter((room: any) => !room.categoryId),
      channels: channels.filter((channel: any) => !channel.categoryId),
    };

    const groups = [...categories, other].filter((group: any) => group.rooms.length || group.channels.length || allowedCategoryIds.includes(Number(group.category.id)));

    if (!groups.length) return null;

    return m('section', { className: 'SocialForumMenu' }, [
      m('div', { className: 'SocialForumMenu-head' }, [
        m('span', {}, [m('i', { className: 'fas fa-comments' }), ' ', app.translator.trans('cengizkemec-social.forum.forum_menu.title')]),
        m('a', { className: 'SocialForumMenu-all', href: app.route('social.rooms') }, app.translator.trans('cengizkemec-social.forum.forum_widget.all')),
      ]),
      groups.map((group: any) =>
        m('div', { className: 'SocialForumMenu-category' }, [
          m('div', { className: 'SocialForumMenu-categoryTitle' }, [
            group.category.icon ? m('i', { className: group.category.icon }) : null,
            m('span', {}, group.category.name),
          ]),
          allowedCategoryIds.includes(Number(group.category.id)) && this.data.canCreateRoom
            ? m('a', {
                className: 'SocialForumMenu-link SocialForumMenu-link--create',
                href: app.route('social.rooms') + '?create=1&category=' + group.category.id,
              }, [m('i', { className: 'fas fa-plus' }), m('span', {}, app.translator.trans('cengizkemec-social.forum.rooms.create_user_room'))])
            : null,
          ...group.rooms.map((room: any) =>
            m('a', {
              className: 'SocialForumMenu-link',
              href: roomUrl(room),
            }, [m('i', { className: room.icon || (room.isVoice ? 'fas fa-volume-high' : 'fas fa-hashtag') }), m('span', {}, room.name)])
          ),
          ...group.channels.map((channel: any) =>
            m('a', {
              className: 'SocialForumMenu-link SocialForumMenu-link--text',
              href: app.route('social.channel', { id: channel.id }),
            }, [m('i', { className: 'fas fa-hashtag' }), m('span', {}, channel.name)])
          ),
        ])
      ),
    ]);
  }
}
