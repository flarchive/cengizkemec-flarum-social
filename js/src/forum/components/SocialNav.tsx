import app from 'flarum/forum/app';
import { openLoginModal } from '../authModals';
import SocialState from '../SocialState';
import voiceSession from '../voiceSession';
import { Avatar, promptLogin, roomUrl } from '../utils';

export default class SocialNav {
  forumTags: any[] = [];

  oninit(): void {
    if (app.forum.attribute<boolean>('socialForumCategories') === false) return;

    const apply = (tags: any[]) => {
      this.forumTags = (tags || []).filter((tag: any) => tag.isPrimary?.() && !tag.isHidden?.());
      m.redraw();
    };

    const existing = app.store.all('tags') || [];
    if (existing.length) apply(existing);

    app.store
      .find('tags')
      .then(apply)
      .catch(() => {});
  }

  view(vnode: any): any {
    const state = vnode.attrs.state || SocialState;
    const current = m.route.get() || '';
    const close = vnode.attrs.onclose;

    const link = (href: string, icon: string, label: any) =>
      m(
        'a',
        {
          href,
          className: 'SocialNav-link' + (current === href || (href !== app.route('social.index') && current.startsWith(href)) ? ' is-active' : ''),
          onclick: close,
        },
        [m('i', { className: icon }), m('span', {}, label)]
      );

    const voiceRooms = state.rooms.filter((room: any) => room.isVoice);
    const textRooms = state.rooms.filter((room: any) => !room.isVoice);
    const channels = state.channels || [];

    const joinVoice = (event: Event, room: any) => {
      event.preventDefault();
      close?.();

      if (!state.user) {
        promptLogin('voice');
        return;
      }

      if (!room.isVoice || !room.canJoin || room.isLocked) {
        m.route.set(roomUrl(room));
        return;
      }

      const openRoom = () => m.route.set(roomUrl(room));

      if (room.hasPassword) {
        app.modal.show(() => import('./RoomJoinModal'), {
          onjoin: (password: string) => {
            // Enter the room immediately; the persistent voice panel shows the
            // connection progress while LiveKit is reached in the background.
            openRoom();
            voiceSession.connect(room, password);
          },
        });
        return;
      }

      openRoom();
      voiceSession.connect(room);
    };

    const roomLink = (room: any, isVoice: boolean) => {
      const connected = isVoice && voiceSession.connected && voiceSession.roomInfo?.id === room.id;

      const liveMembers =
        connected && voiceSession.participants.length
          ? voiceSession.participants.map((participant: any) => ({
              id: participant.identity,
              username: participant.username,
              displayName: participant.name,
              avatarUrl: participant.avatarUrl,
              muted: participant.muted,
              speaking: participant.speaking,
              local: participant.local,
              role: 'member',
            }))
          : room.participants || [];

      const roomHref = roomUrl(room);
      const roomNode = m(
        'a',
        {
          href: roomHref,
          className:
            'SocialNav-room' +
            (current === roomHref ? ' is-active' : '') +
            (connected ? ' is-connected' : '') +
            (room.isVoice ? ' SocialNav-room--voice' : ''),
          onclick: (event: Event) => (room.isVoice ? joinVoice(event, room) : close?.()),
        },
        [
          m('i', { className: room.icon || (room.isVoice ? 'fas fa-volume-high' : 'fas fa-hashtag') }),
          m('span', { className: 'SocialNav-room-name' }, room.name),
          connected ? m('span', { className: 'SocialNav-voiceDot', title: app.translator.trans('cengizkemec-social.forum.voice.live') }) : null,
          isVoice && (room.type === 'permanent' || room.participantCount > 0)
            ? m(
                'span',
                { className: 'SocialNav-count', title: app.translator.trans('cengizkemec-social.forum.rooms.participants') },
                room.type === 'permanent' && room.capacity
                  ? `${room.participantCount ?? 0}/${room.capacity}`
                  : room.participantCount ?? 0
              )
            : null,
        ]
      );

      if (!isVoice) return roomNode;

      return m('div', { className: 'SocialNav-voiceBlock' }, [
        roomNode,
        liveMembers.length
          ? m(
              'div',
              { className: 'SocialNav-voiceMembers' },
              liveMembers.map((member: any) =>
                m(
                  'a',
                  {
                    className: 'SocialNav-voiceMember' + (member.speaking ? ' is-speaking' : ''),
                    href: member.username ? app.route('social.profile', { username: member.username }) : undefined,
                    title: member.displayName,
                  },
                  [
                    m('span', { className: 'SocialNav-voiceAvatar' }, Avatar({ displayName: member.displayName, username: member.username, avatarUrl: member.avatarUrl }, 20)),
                    m('span', { className: 'SocialNav-voiceMember-name' }, member.displayName, member.local ? ' (' + app.translator.trans('cengizkemec-social.forum.voice.you') + ')' : ''),
                    member.role === 'owner' ? m('i', { className: 'fas fa-crown SocialNav-voiceOwner', title: app.translator.trans('cengizkemec-social.forum.rooms.roles.owner') }) : null,
                    member.speaking
                      ? m('i', { className: 'fas fa-volume-high SocialNav-voiceSpeaking' })
                      : member.muted
                      ? m('i', { className: 'fas fa-microphone-slash' })
                      : m('i', { className: 'fas fa-microphone' }),
                  ]
                )
              )
            )
          : null,
      ]);
    };

    const channelLink = (channel: any) => m(
      'a',
      {
        href: app.route('social.channel', { id: channel.id }),
        className: 'SocialNav-channel' + (current === app.route('social.channel', { id: channel.id }) ? ' is-active' : ''),
        onclick: close,
      },
      [m('i', { className: 'fas fa-hashtag' }), m('span', {}, channel.name)]
    );

    const categoryTree = (() => {
      const allowedCategoryIds = (state.userRoomCategoryIds || []).map((id: any) => Number(id));
      const canCreate = Boolean(state.user && state.can('createRoom'));

      const groups = state.categories.map((category: any) => ({
        category,
        rooms: state.rooms.filter((room: any) => Number(room.categoryId) === Number(category.id)),
        channels: channels.filter((channel: any) => Number(channel.categoryId) === Number(category.id)),
      }));

      const other = {
        category: { id: 'other', name: app.translator.trans('cengizkemec-social.forum.nav.other_rooms'), icon: 'fas fa-door-open' },
        rooms: state.rooms.filter((room: any) => !room.categoryId),
        channels: channels.filter((channel: any) => !channel.categoryId),
      };

      return [...groups, other]
        .filter((group) => group.rooms.length || group.channels.length || allowedCategoryIds.includes(Number(group.category.id)))
        .map((group) => {
          const allowed = allowedCategoryIds.includes(Number(group.category.id));
          const createHref = app.route('social.rooms') + '?create=1&category=' + group.category.id;

          return m('div', { className: 'SocialNav-category' }, [
            m('div', { className: 'SocialNav-category-title' }, [
              group.category.icon ? m('i', { className: group.category.icon }) : null,
              m('span', {}, group.category.name),
            ]),
            allowed && canCreate
              ? m('a', { className: 'SocialNav-createRoom', href: createHref, onclick: close }, [
                  m('i', { className: 'fas fa-plus' }),
                  m('span', {}, app.translator.trans('cengizkemec-social.forum.rooms.create_user_room')),
                ])
              : null,
            ...group.rooms.map((room: any) => roomLink(room, Boolean(room.isVoice))),
            ...group.channels.map((channel: any) => channelLink(channel)),
          ]);
        });
    })();

    return m('aside', { className: 'SocialNav' }, [
      m('div', { className: 'SocialNav-user' }, state.user
        ? m('a', { href: app.route('social.profile', { username: state.user.username }), className: 'SocialNav-me', onclick: close }, [
            m('span', { className: 'SocialNav-me-avatar', style: state.user.avatarUrl ? { backgroundImage: `url("${state.user.avatarUrl}")` } : {} }, state.user.avatarUrl ? null : String(state.user.displayName || '?').slice(0, 1).toUpperCase()),
            m('span', {}, [m('strong', {}, state.user.displayName), m('small', {}, '@' + state.user.username)]),
          ])
        : m('div', { className: 'SocialNav-guest' }, [
            m('strong', {}, app.translator.trans('cengizkemec-social.forum.guest.sidebar_title')),
            m('p', {}, app.translator.trans('cengizkemec-social.forum.guest.sidebar_text')),
            m('button', { className: 'Button Button--primary Button--block', type: 'button', onclick: () => openLoginModal() }, app.translator.trans('cengizkemec-social.forum.auth.login')),
          ])),

      m('nav', { className: 'SocialNav-primary' }, [
        link(app.route('social.index'), 'fas fa-house', app.translator.trans('cengizkemec-social.forum.nav.feed')),
        link(app.route('social.explore'), 'fas fa-compass', app.translator.trans('cengizkemec-social.forum.nav.explore')),
        link(app.route('social.media'), 'fas fa-photo-film', app.translator.trans('cengizkemec-social.forum.nav.media')),
        link(app.route('social.rooms'), 'fas fa-headset', app.translator.trans('cengizkemec-social.forum.nav.rooms')),
        state.user ? link(app.route('social.messages'), 'fas fa-envelope', app.translator.trans('cengizkemec-social.forum.nav.messages')) : null,
        state.user ? link(app.route('social.bookmarks'), 'far fa-bookmark', app.translator.trans('cengizkemec-social.forum.nav.bookmarks')) : null,
        state.user ? link(app.route('social.notifications'), 'far fa-bell', app.translator.trans('cengizkemec-social.forum.nav.notifications')) : null,
      ]),

      m('div', { className: 'SocialNav-section SocialNav-section--voice' }, [
        m('div', { className: 'SocialNav-heading' }, [
          m('span', {}, app.translator.trans('cengizkemec-social.forum.nav.channels')),
          voiceSession.connected ? m('span', { className: 'SocialNav-headingLive' }, m('i', { className: 'fas fa-signal' })) : null,
        ]),
        voiceRooms.length || textRooms.length || channels.length
          ? categoryTree
          : m('div', { className: 'SocialNav-empty' }, app.translator.trans('cengizkemec-social.forum.aside.no_rooms')),
        state.can.createRoom
          ? m('a', { className: 'SocialNav-create', href: app.route('social.rooms', { create: 1 }), onclick: close }, [
              m('i', { className: 'fas fa-plus' }),
              m('span', {}, app.translator.trans('cengizkemec-social.forum.rooms.create')),
            ])
          : null,
      ]),

      this.forumTags.length
        ? m('div', { className: 'SocialNav-section SocialNav-section--forum' }, [
            m('div', { className: 'SocialNav-heading' }, app.translator.trans('cengizkemec-social.forum.nav.forum')),
            m('a', { className: 'SocialNav-link', href: app.route('index'), onclick: close }, [
              m('i', { className: 'far fa-comments' }),
              m('span', {}, app.translator.trans('core.forum.index.all_discussions_link')),
            ]),
            this.forumTags.map((tag: any) =>
              m('a', { className: 'SocialNav-link', href: app.route('tag', { tags: tag.slug() }), onclick: close }, [
                m('i', { className: tag.icon?.() || 'fas fa-tag' }),
                m('span', {}, tag.name?.() || tag.slug?.()),
              ])
            ),
          ])
        : null,

      m('div', { className: 'SocialNav-footer' }, [
        m('span', { className: 'SocialNav-stat' }, [m('strong', {}, state.stats.online || 0), ' ', app.translator.trans('cengizkemec-social.forum.nav.online')]),
        m('span', { className: 'SocialNav-stat' }, [m('strong', {}, state.stats.members || 0), ' ', app.translator.trans('cengizkemec-social.forum.nav.members')]),
        m('a', { href: app.route('social.explore'), className: 'SocialNav-footer-link' }, app.translator.trans('cengizkemec-social.forum.nav.explore')),
      ]),
    ]);
  }
}
