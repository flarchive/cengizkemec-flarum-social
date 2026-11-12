import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import SocialState from '../SocialState';
import voiceSession from '../voiceSession';
import { del, get, post } from '../../common/api';
import { Avatar, handleApiError, promptLogin, timeAgo } from '../utils';
import VoiceStage from '../components/VoiceStage';
import TextChannel from '../components/TextChannel';
import { openLoginModal } from '../authModals';

export default class RoomPage extends SocialPage {
  room: any = null;
  loading = true;
  error: string | null = null;
  tab = 'voice';
  menuOpen = false;
  loginPrompted = false;
  pendingInvite: string | null = null;

  pageTitle(): string {
    return this.room?.name || (app.translator.trans('cengizkemec-social.forum.nav.rooms') as string);
  }

  onSocialReady(): void {
    const token = new URLSearchParams(window.location.search).get('invite');

    if (token) {
      this.pendingInvite = token;
      this.acceptInvite(token);
      return;
    }

    this.load();
  }

  onupdate(vnode: any): void {
    super.onupdate(vnode);

    if (this.pendingInvite && SocialState.user) {
      const token = this.pendingInvite;
      this.pendingInvite = null;
      this.acceptInvite(token);
    }
  }

  acceptInvite(token: string): void {
    this.loading = true;
    this.error = null;

    get(`/social/invites/${encodeURIComponent(token)}`)
      .then((response: any) => {
        const data = response.data;

        if (data.requiresLogin) {
          this.room = data.room;
          this.loading = false;

          if (!this.loginPrompted) {
            this.loginPrompted = true;
            openLoginModal();
          }

          m.redraw();
          return;
        }

        this.pendingInvite = null;
        this.room = data.room;
        app.setTitle(data.room.name);

        // Do not keep the secret token in the address bar after redemption.
        window.history.replaceState({}, '', app.route('social.room', { slug: data.room.slug }));

        if (data.room.isVoice && data.room.canJoin) {
          voiceSession.connect(data.room).then(() => this.load());
        } else {
          this.load();
        }
      })
      .catch((error: any) => {
        this.error = error.message;
        this.loading = false;
        m.redraw();
      });
  }

  openTextTab(): void {
    if (!SocialState.user) {
      if (!this.loginPrompted) {
        this.loginPrompted = true;
        openLoginModal();
      }
      return;
    }

    this.tab = 'text';
  }

  load(): void {
    this.loading = true;
    this.error = null;

    get(`/social/rooms/${m.route.param('slug') || m.route.param('id')}`)
      .then((response: any) => {
        const room = response.data;

        if (!this.room || this.room.id !== room.id) {
          // Voice rooms are chat-first: joining from the sidebar starts voice
          // in the background while the room's own text chat is shown.
          this.tab = room.isText ? 'text' : 'voice';
        }

        this.room = room;
        app.setTitle(this.room.name);

        // Text-only rooms are conversations. Guests are sent straight to
        // Flarum's own login/sign-up modal instead of a blank chat panel.
        if (!SocialState.user && room.isText && !room.isVoice && !this.loginPrompted) {
          this.loginPrompted = true;
          openLoginModal();
        }
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  joinVoice(): void {
    if (!SocialState.user) {
      promptLogin('voice');
      return;
    }

    if (!this.room) return;

    if (this.room.hasPassword) {
      app.modal.show(() => import('../components/RoomJoinModal'), {
        onjoin: (password: string) => voiceSession.connect(this.room, password).then(() => this.load()),
      });
      return;
    }

    voiceSession.connect(this.room).then(() => this.load());
  }

  action(action: string, userId?: number): void {
    const payload: any = {};
    if (userId) payload.user_id = userId;

    post(`/social/rooms/${this.room.id}/${action}`, payload)
      .then(() => {
        this.load();
      })
      .catch(handleApiError);
  }

  removeRoom(): void {
    if (!confirm(app.translator.trans('cengizkemec-social.forum.rooms.confirm_delete') as string)) return;

    del(`/social/rooms/${this.room.id}`)
      .then(() => m.route.set(app.route('social.rooms')))
      .catch(handleApiError);
  }

  openInvite(mode = 'invite'): void {
    app.modal.show(() => import('../components/InviteUserModal'), { roomId: this.room.id, mode, onsuccess: () => this.load() });
  }

  openInviteLink(): void {
    app.modal.show(() => import('../components/RoomInviteLinkModal'), { room: this.room });
  }

  openEdit(): void {
    app.modal.show(() => import('../components/RoomCreateModal'), { room: this.room, oncreated: () => this.load() });
  }

  voiceBar(): any {
    const room = this.room;

    if (!room?.isVoice) return null;

    const voice = voiceSession;
    const connected = voice.connected && voice.roomInfo?.id === room.id;
    const connecting = voice.connecting && voice.roomInfo?.id === room.id;
    const members = connected ? voice.participants : room.participants || [];

    return m('div', { className: 'SocialVoiceBar' + (connected ? ' is-connected' : '') + (connecting ? ' is-connecting' : '') }, [
      m('span', { className: 'SocialVoiceBar-icon' }, m('i', { className: connected ? 'fas fa-signal' : connecting ? 'fas fa-spinner fa-spin' : 'fas fa-headset' })),
      m('div', { className: 'SocialVoiceBar-info' }, [
        m('strong', {}, connected
          ? app.translator.trans('cengizkemec-social.forum.voice.connected', { count: voice.participants.length })
          : connecting
          ? app.translator.trans('cengizkemec-social.forum.voice.connecting')
          : app.translator.trans('cengizkemec-social.forum.voice.not_joined')),
        m('div', { className: 'SocialVoiceBar-members' }, members.slice(0, 8).map((member: any) =>
          m('span', { className: 'SocialVoiceBar-member', title: member.name || member.displayName }, [
            Avatar({ displayName: member.name || member.displayName, username: member.username, avatarUrl: member.avatarUrl }, 20),
            m('span', {}, member.name || member.displayName),
          ])
        )),
      ]),
      m('div', { className: 'SocialVoiceBar-actions' }, [
        connected
          ? [
              m('button', { className: 'Button Button--icon', title: app.translator.trans('cengizkemec-social.forum.voice.microphone'), onclick: () => voice.toggleMic() }, m('i', { className: voice.microphone ? 'fas fa-microphone' : 'fas fa-microphone-slash' })),
              m('button', { className: 'Button Button--icon', title: app.translator.trans('cengizkemec-social.forum.voice.deafen'), onclick: () => voice.toggleDeafen() }, m('i', { className: voice.deafened ? 'fas fa-volume-xmark' : 'fas fa-volume-high' })),
              m('button', { className: 'Button Button--danger Button--icon', title: app.translator.trans('cengizkemec-social.forum.voice.leave'), onclick: () => voice.disconnect() }, m('i', { className: 'fas fa-phone-slash' })),
            ]
          : connecting
          ? null
          : m('button', { className: 'Button Button--primary', onclick: () => this.joinVoice(), disabled: !room.canJoin || room.isLocked }, [m('i', { className: 'fas fa-headset' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.join')]),
      ]),
      voice.error && voice.roomInfo?.id === room.id ? m('div', { className: 'SocialVoiceBar-error' }, voice.error) : null,
    ]);
  }

  participantRow(participant: any): any {
    return m('div', { className: 'SocialRoomParticipant'}, [
      Avatar(participant, 34),
      m('span', { className: 'SocialRoomParticipant-name' }, [
        m('strong', {}, participant.displayName),
        m('small', {}, '@' + participant.username),
      ]),
      participant.role !== 'member' ? m('span', { className: 'SocialBadge SocialBadge--role' }, app.translator.trans(`cengizkemec-social.forum.rooms.roles.${participant.role}`)) : null,
      this.room.canManage && participant.id !== SocialState.user?.id && participant.id !== this.room.owner?.id
        ? m('div', { className: 'SocialRoomParticipant-actions' }, [
            m('button', { className: 'Button Button--icon Button--link', title: app.translator.trans('cengizkemec-social.forum.voice.mute'), onclick: () => this.action('mute', participant.id) }, m('i', { className: 'fas fa-microphone-slash' })),
            m('button', { className: 'Button Button--icon Button--link', title: app.translator.trans('cengizkemec-social.forum.rooms.kick'), onclick: () => this.action('kick', participant.id) }, m('i', { className: 'fas fa-user-minus' })),
            m('button', { className: 'Button Button--icon Button--link', title: app.translator.trans('cengizkemec-social.forum.rooms.ban'), onclick: () => this.action('ban', participant.id) }, m('i', { className: 'fas fa-ban' })),
          ])
        : null,
    ]);
  }

  content(): any {
    if (this.loading) return m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }));

    if (this.error || !this.room) {
      return m('div', { className: 'SocialPanel SocialPanel--error' }, [
        m('p', {}, this.error || app.translator.trans('cengizkemec-social.forum.rooms.not_found')),
        m('a', { className: 'Button Button--primary', href: app.route('social.rooms') }, app.translator.trans('cengizkemec-social.forum.nav.rooms')),
      ]);
    }

    const room = this.room;
    const channel = room.channels?.[0];
    const voiceActive = voiceSession.connected && voiceSession.roomInfo?.id === room.id;

    return m('div', { className: 'SocialRoomPage' }, [
      m('div', { className: 'SocialRoomHeader' }, [
        m('a', { className: 'SocialBack', href: app.route('social.rooms') }, [m('i', { className: 'fas fa-arrow-left' }), ' ', app.translator.trans('cengizkemec-social.forum.nav.rooms')]),
        m('div', { className: 'SocialRoomHeader-main' }, [
          m('span', { className: 'SocialRoomHeader-icon' }, m('i', { className: room.icon || 'fas fa-headset' })),
          m('div', {}, [
            m('h1', {}, room.name),
            m('p', {}, room.description || ''),
            m('div', { className: 'SocialRoomHeader-meta' }, [
              m('span', {}, [m('i', { className: 'fas fa-user-group' }), ' ', room.participantCount ?? 0, ' / ', room.capacity]),
              room.category ? m('span', {}, [m('i', { className: room.category.icon || 'fas fa-folder' }), ' ', room.category.name]) : null,
              room.owner ? m('span', {}, [m('i', { className: 'fas fa-crown' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.owner'), ': ', room.owner.displayName]) : null,
              room.expiresAt ? m('span', {}, [m('i', { className: 'fas fa-clock' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.expires', { time: timeAgo(room.expiresAt) })]) : null,
            ]),
          ]),
        ]),
        m('div', { className: 'SocialRoomHeader-actions' }, [
          room.isVoice
            ? voiceActive
              ? m('button', { className: 'Button Button--danger', onclick: () => voiceSession.disconnect() }, [m('i', { className: 'fas fa-phone-slash' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.leave')])
              : m('button', { className: 'Button Button--primary', onclick: () => this.joinVoice(), disabled: !room.canJoin || room.isLocked }, [m('i', { className: 'fas fa-headset' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.join')])
            : null,
          room.canManage
            ? m('div', { className: 'SocialPost-menuWrap' }, [
                m('button', { className: 'Button Button--icon Button--link', onclick: () => (this.menuOpen = !this.menuOpen), 'aria-label': app.translator.trans('cengizkemec-social.forum.rooms.manage') }, m('i', { className: 'fas fa-gear' })),
                this.menuOpen
                  ? m('div', { className: 'SocialPost-menu', onclick: () => (this.menuOpen = false) }, [
                      m('button', { className: 'SocialPost-menuItem', onclick: () => this.openEdit() }, [m('i', { className: 'fas fa-pen' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.edit')]),
                      m('button', { className: 'SocialPost-menuItem', onclick: () => this.openInvite('invite') }, [m('i', { className: 'fas fa-user-plus' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.invite')]),
                      m('button', { className: 'SocialPost-menuItem', onclick: () => this.openInviteLink() }, [m('i', { className: 'fas fa-link' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.invite_link')]),
                      m('button', { className: 'SocialPost-menuItem', onclick: () => this.openInvite('transfer') }, [m('i', { className: 'fas fa-crown' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.transfer')]),
                      m('button', { className: 'SocialPost-menuItem', onclick: () => this.action(room.isLocked ? 'reopen' : 'close') }, [m('i', { className: room.isLocked ? 'fas fa-lock-open' : 'fas fa-lock' }), ' ', app.translator.trans(room.isLocked ? 'cengizkemec-social.forum.rooms.reopen' : 'cengizkemec-social.forum.rooms.close')]),
                      m('button', { className: 'SocialPost-menuItem SocialPost-menuItem--danger', onclick: () => this.removeRoom() }, [m('i', { className: 'fas fa-trash' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.delete')]),
                    ])
                  : null,
              ])
            : null,
        ]),
      ]),

      this.voiceBar(),

      m('div', { className: 'SocialRoomTabs' }, [
        room.isVoice ? m('button', { className: 'SocialTab' + (this.tab === 'voice' ? ' is-active' : ''), onclick: () => (this.tab = 'voice') }, [m('i', { className: 'fas fa-headset' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.voice')]) : null,
        room.isText ? m('button', { className: 'SocialTab' + (this.tab === 'text' ? ' is-active' : ''), onclick: () => this.openTextTab() }, [m('i', { className: 'fas fa-hashtag' }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.text')]) : null,
      ]),

      m('div', { className: 'SocialRoomLayout' }, [
        m('div', { className: 'SocialRoomMain' }, [
          this.tab === 'voice' && room.isVoice
            ? m(VoiceStage, { room, onjoin: () => this.joinVoice() })
            : null,
          this.tab === 'text' && room.isText
            ? SocialState.user && channel
              ? m(TextChannel, {
                  channel,
                  title: room.name,
                  description: room.description || '',
                  icon: room.icon || 'fas fa-headset',
                })
              : m('div', { className: 'SocialPanel SocialPanel--auth' }, [
                  m('i', { className: 'fas fa-comments' }),
                  m('h3', {}, app.translator.trans('cengizkemec-social.forum.messages.login_to_chat')),
                  m('button', { className: 'Button Button--primary', type: 'button', onclick: () => openLoginModal() }, app.translator.trans('cengizkemec-social.forum.auth.login')),
                ])
            : null,
        ]),
        m('aside', { className: 'SocialRoomSidebar' }, [
          m('section', { className: 'SocialPanel' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-users' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.rooms.participants')), m('span', { className: 'SocialSectionHead-count' }, room.participants?.length || 0)]),
            room.canJoin && !voiceActive
              ? m('button', { className: 'Button Button--primary Button--block', onclick: () => this.joinVoice() }, [m('i', { className: 'fas fa-headset' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.join')])
              : null,
            (room.participants || []).length
              ? m('div', { className: 'SocialRoomParticipants' }, room.participants.map((participant: any) => this.participantRow(participant)))
              : m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.rooms.no_participants')),
          ]),
          m('section', { className: 'SocialPanel SocialRoomDetails' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-circle-info' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.rooms.details'))]),
            m('dl', {}, [
              m('dt', {}, app.translator.trans('cengizkemec-social.forum.rooms.type')),
              m('dd', {}, app.translator.trans(`cengizkemec-social.forum.rooms.types.${room.type}`)),
              m('dt', {}, app.translator.trans('cengizkemec-social.forum.rooms.visibility')),
              m('dd', {}, app.translator.trans(`cengizkemec-social.forum.post.visibility.${room.visibility}`)),
              m('dt', {}, app.translator.trans('cengizkemec-social.forum.rooms.capacity')),
              m('dd', {}, `${room.capacity}`),
              room.hasPassword ? m('dt', {}, app.translator.trans('cengizkemec-social.forum.rooms.password')) : null,
              room.hasPassword ? m('dd', {}, m('i', { className: 'fas fa-lock' })) : null,
            ]),
          ]),
        ]),
      ]),
    ]);
  }
}
