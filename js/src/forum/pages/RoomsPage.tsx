import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import SocialState from '../SocialState';
import { get } from '../../common/api';
import { channelUrl, handleApiError, promptLogin, roomCapacityLabel, roomUrl } from '../utils';
import RoomCreateModal from '../components/RoomCreateModal';

export default class RoomsPage extends SocialPage {
  data: any = null;
  loading = true;
  error: string | null = null;

  pageTitle(): string {
    return app.translator.trans('cengizkemec-social.forum.nav.rooms') as string;
  }

  onSocialReady(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    get('/social/rooms')
      .then((response: any) => {
        this.data = response.data;
        const params = m.parseQueryString(location.search.replace(/^\?/, ''));
        if (params.create && SocialState.can('createRoom')) {
          this.openCreate(Number(params.category) || null);
        }
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  openCreate(categoryId: number | null = null): void {
    const categories = this.userRoomCategories();
    const selected = categories.length
      ? Number(categories.some((category: any) => Number(category.id) === Number(categoryId)) ? categoryId : categories[0].id)
      : null;

    app.modal.show(() => import('../components/RoomCreateModal'), {
      categoryId: selected,
      categories,
      oncreated: (room: any) => {
        this.load();
        m.route.set(roomUrl(room));
      },
    });
  }

  allowedCategoryIds(): number[] {
    return (this.data?.userRoomCategoryIds || []).map((id: any) => Number(id));
  }

  userRoomCategories(): any[] {
    const ids = this.allowedCategoryIds();

    return (this.data?.categories || []).filter((category: any) => ids.includes(Number(category.id)));
  }

  canCreateInCategory(category: any): boolean {
    return this.allowedCategoryIds().includes(Number(category.id));
  }

  grouped(categoryId: number | null): any[] {
    return (this.data?.rooms || []).filter((room: any) => (categoryId === null ? !room.categoryId : room.categoryId === categoryId));
  }

  roomCard(room: any): any {
    return m('a', { className: 'SocialRoomCard', href: roomUrl(room) }, [
      m('span', { className: 'SocialRoomCard-icon' + (room.participantCount ? ' is-live' : '') }, m('i', { className: room.icon || 'fas fa-volume-high' })),
      m('span', { className: 'SocialRoomCard-info' }, [
        m('strong', {}, room.name),
        m('small', {}, room.description || ''),
        m('span', { className: 'SocialRoomCard-tags' }, [
          room.type === 'temporary' ? m('span', { className: 'SocialTag SocialTag--small' }, app.translator.trans('cengizkemec-social.forum.rooms.temporary')) : null,
          room.visibility !== 'public' ? m('span', { className: 'SocialTag SocialTag--small' }, app.translator.trans(`cengizkemec-social.forum.post.visibility.${room.visibility}`)) : null,
          room.hasPassword ? m('span', { className: 'SocialTag SocialTag--small' }, m('i', { className: 'fas fa-lock' })) : null,
        ]),
      ]),
      m('span', { className: 'SocialRoomCard-count' }, [m('i', { className: 'fas fa-user-group' }), ' ', roomCapacityLabel(room)]),
    ]);
  }

  channelCard(channel: any): any {
    return m('a', { className: 'SocialRoomCard SocialRoomCard--text', href: channelUrl(channel) }, [
      m('span', { className: 'SocialRoomCard-icon' }, m('i', { className: channel.icon || 'fas fa-hashtag' })),
      m('span', { className: 'SocialRoomCard-info' }, [
        m('strong', {}, channel.name),
        m('small', {}, channel.description || ''),
        m('span', { className: 'SocialRoomCard-tags' }, [
          channel.visibility !== 'public' ? m('span', { className: 'SocialTag SocialTag--small' }, app.translator.trans(`cengizkemec-social.forum.post.visibility.${channel.visibility}`)) : null,
        ]),
      ]),
      m('span', { className: 'SocialRoomCard-count' }, app.translator.trans('cengizkemec-social.forum.nav.text_channels')),
    ]);
  }

  categoryIntro(category: any): any {
    if (!this.canCreateInCategory(category)) return null;

    const canCreate = Boolean(this.data?.canCreateRoom);
    const noteKey = canCreate
      ? 'cengizkemec-social.forum.rooms.user_room_category_note'
      : !SocialState.user
      ? 'cengizkemec-social.forum.rooms.user_room_category_note_guest'
      : 'cengizkemec-social.forum.rooms.user_room_category_note_forbidden';

    return m('div', { className: 'SocialCategoryIntro' }, [
      m('div', { className: 'SocialCategoryIntro-text' }, [
        m('i', { className: 'fas fa-circle-info' }),
        m('p', {}, app.translator.trans(noteKey)),
      ]),
      canCreate
        ? m('button', { className: 'Button Button--primary Button--small', type: 'button', onclick: () => this.openCreate(category.id) }, [
            m('i', { className: 'fas fa-plus' }),
            ' ',
            app.translator.trans('cengizkemec-social.forum.rooms.create_user_room'),
          ])
        : !SocialState.user
        ? m('button', { className: 'Button Button--primary Button--small', type: 'button', onclick: () => promptLogin('room') }, app.translator.trans('cengizkemec-social.forum.rooms.login_to_create'))
        : null,
    ]);
  }

  content(): any {
    if (this.loading) return m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }));

    if (this.error) {
      return m('div', { className: 'SocialPanel SocialPanel--error' }, [
        m('p', {}, this.error),
        m('button', { className: 'Button Button--primary', onclick: () => this.load() }, app.translator.trans('cengizkemec-social.forum.errors.retry')),
      ]);
    }

    const rooms = this.data?.rooms || [];
    const categories = this.data?.categories || [];
    const channels = SocialState.channels || [];
    const temporary = rooms.filter((room: any) => room.type === 'temporary' && !room.categoryId);
    const channelsFor = (categoryId: number | null) =>
      channels.filter((channel: any) => (categoryId === null ? !channel.categoryId : Number(channel.categoryId) === categoryId));

    return m('div', { className: 'SocialRoomsPage' }, [
      m('div', { className: 'SocialPageHead' }, [
        m('div', {}, [m('h1', {}, app.translator.trans('cengizkemec-social.forum.rooms.title')), m('p', {}, app.translator.trans('cengizkemec-social.forum.rooms.subtitle'))]),
        this.data?.canCreateRoom
          ? m('button', { className: 'Button Button--primary', onclick: () => this.openCreate() }, [m('i', { className: 'fas fa-plus' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.create')])
          : !SocialState.user
          ? m('button', { className: 'Button Button--primary', onclick: () => promptLogin('room') }, app.translator.trans('cengizkemec-social.forum.rooms.login_to_create'))
          : null,
      ]),
      temporary.length
        ? m('section', { className: 'SocialPanel' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-clock' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.rooms.user_rooms'))]),
            m('div', { className: 'SocialRoomGrid' }, temporary.map((room) => this.roomCard(room))),
          ])
        : null,
      categories.map((category: any) => {
        const hasContent = this.grouped(category.id).length || channelsFor(category.id).length;

        if (!hasContent && !this.canCreateInCategory(category)) return null;

        return m('section', { className: 'SocialPanel' }, [
          m('div', { className: 'SocialSectionHead' }, [m('i', { className: category.icon || 'fas fa-folder' }), m('h2', {}, category.name), category.description ? m('span', { className: 'SocialSectionHead-text' }, category.description) : null]),
          this.categoryIntro(category),
          m('div', { className: 'SocialRoomGrid' }, [
            ...this.grouped(category.id).map((room) => this.roomCard(room)),
            ...channelsFor(category.id).map((channel) => this.channelCard(channel)),
          ]),
        ]);
      }),
      this.grouped(null).length || channelsFor(null).length
        ? m('section', { className: 'SocialPanel' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-door-open' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.rooms.uncategorized'))]),
            m('div', { className: 'SocialRoomGrid' }, [
              ...this.grouped(null).map((room) => this.roomCard(room)),
              ...channelsFor(null).map((channel) => this.channelCard(channel)),
            ]),
          ])
        : null,
      !rooms.length && !categories.some((category: any) => this.canCreateInCategory(category))
        ? m('div', { className: 'SocialEmpty' }, [m('i', { className: 'fas fa-headset' }), m('h3', {}, app.translator.trans('cengizkemec-social.forum.rooms.empty')), m('p', {}, app.translator.trans('cengizkemec-social.forum.rooms.empty_text'))])
        : null,
    ]);
  }
}
