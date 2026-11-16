import app from 'flarum/forum/app';
import { get, post } from '../../common/api';
import SocialState from '../SocialState';
import { Avatar, handleApiError, roomCapacityLabel, roomUrl, timeAgo } from '../utils';
import SocialWidgets from './SocialWidgets';

export default class SocialAside {
  discussions: any[] = [];
  discussionsLoaded = false;
  previewMember: any = null;
  previewUser: any = null;
  previewSocial: any = null;
  previewLoading = false;
  previewTop = 0;
  previewLeft = 0;
  previewTimer: number | null = null;
  previewHideTimer: number | null = null;

  oninit(): void {
    app.store
      .find('discussions', { sort: '-lastPostedAt', page: { limit: 10 } })
      .then((discussions: any) => {
        this.discussions = discussions || [];
      })
      .catch(() => {})
      .finally(() => {
        this.discussionsLoaded = true;
        m.redraw();
      });
  }

  onremove(): void {
    this.clearPreviewTimers();
  }

  clearPreviewTimers(): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    if (this.previewHideTimer !== null) window.clearTimeout(this.previewHideTimer);
    this.previewTimer = null;
    this.previewHideTimer = null;
  }

  showPreview(member: any, event: MouseEvent): void {
    this.clearPreviewTimers();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.previewMember = member;
    this.previewUser = null;
    this.previewSocial = null;
    this.previewLoading = true;
    this.previewTop = Math.max(10, Math.min(rect.top, window.innerHeight - 410));
    this.previewLeft = Math.max(10, rect.left - 326);
    m.redraw();

    this.previewTimer = window.setTimeout(() => {
      app.store
        .find('users', member.id)
        .then((user: any) => {
          this.previewUser = user;
        })
        .catch(() => {})
        .finally(() => {
          this.previewLoading = false;
          m.redraw();
        });

      get(`/social/profile/${encodeURIComponent(member.username)}`)
        .then((response: any) => {
          this.previewSocial = response.data;
          m.redraw();
        })
        .catch(() => {});
    }, 260);
  }

  hidePreview(): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    this.previewHideTimer = window.setTimeout(() => {
      this.previewMember = null;
      this.previewUser = null;
      this.previewSocial = null;
      this.previewLoading = false;
      m.redraw();
    }, 200);
  }

  keepPreview(): void {
    if (this.previewHideTimer !== null) window.clearTimeout(this.previewHideTimer);
    this.previewHideTimer = null;
  }

  previewCanMessage(): boolean {
    if (!app.session.user || !this.previewMember) return false;

    const social = this.previewSocial;
    const memberId = Number(social?.id || this.previewMember.id);

    if (!memberId || memberId === Number(app.session.user.id())) return false;

    return social ? Boolean(social.canMessage) : true;
  }

  messagePreview(): void {
    const social = this.previewSocial;
    const member = this.previewMember;

    if (!social?.id && !member?.id) return;

    const user = {
      id: social?.id || member.id,
      username: social?.username || member.username,
      displayName: social?.displayName || member.displayName,
      avatarUrl: social?.avatarUrl || member.avatarUrl,
    };

    const nativeMessages = Boolean((app as any).dialogs && typeof (app as any).dialogs.refresh === 'function');

    if (nativeMessages) {
      app.modal.show(() => import('./NewNativeMessageModal'), {
        user,
        oncreated: (dialogId: string | null) => {
          if (dialogId) m.route.set(app.route('social.messages.conversation', { id: dialogId }));
        },
      });
      return;
    }

    post('/social/dm/conversations', { user_id: user.id })
      .then((response: any) => m.route.set(app.route('social.messages.conversation', { id: response.data.id })))
      .catch(handleApiError);
  }

  addPreviewFriend(): void {
    const social = this.previewSocial;
    const userId = social?.id || this.previewMember?.id;

    if (!userId || social?.friendshipStatus) return;

    post(`/social/friends/${userId}`)
      .then(() => {
        if (this.previewSocial) this.previewSocial.friendshipStatus = 'pending';
        m.redraw();
      })
      .catch(handleApiError);
  }

  memberRow(user: any, online: boolean, count?: number | string): any {
    const nameStyle = user.roleColor
      ? { color: `color-mix(in srgb, ${user.roleColor} 72%, var(--heading-color))` }
      : undefined;

    return m(
      'a',
      {
        className: 'SocialAside-member' + (online ? '' : ' is-offline'),
        href: app.route('user', { username: user.username }),
        title: user.roleName ? `${user.displayName} · ${user.roleName}` : user.displayName,
        onmouseenter: (event: MouseEvent) => this.showPreview(user, event),
        onmouseleave: () => this.hidePreview(),
      },
      [
        m('span', { className: 'SocialAside-avatar-wrap' }, [Avatar(user, 34), online ? m('span', { className: 'SocialAside-dot' }) : m('span', { className: 'SocialAside-dot SocialAside-dot--offline' })]),
        m('span', { className: 'SocialAside-member-name', style: nameStyle }, user.displayName),
        count !== undefined ? m('span', { className: 'SocialAside-member-count' }, count) : null,
      ]
    );
  }

  formatDuration(seconds: number): string {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.round((total % 3600) / 60);

    return hours > 0
      ? app.translator.trans('cengizkemec-social.forum.aside.duration_hours', { hours, minutes }) as string
      : app.translator.trans('cengizkemec-social.forum.aside.duration_minutes', { minutes }) as string;
  }

  statItem(icon: string, value: any, label: string): any {
    return m('div', { className: 'SocialStatsWidget-item' }, [
      m('i', { className: icon }),
      m('strong', {}, Number(value || 0).toLocaleString()),
      m('span', {}, app.translator.trans(label)),
    ]);
  }

  leaderboardCard(state: any): any {    const boards = state.leaderboards || {};

    const memberGroup = (title: string, users: any[], count: (user: any) => any) =>
      users?.length
        ? m('div', { className: 'SocialLeaderboard-group' }, [
            m('h4', { className: 'SocialLeaderboard-title' }, app.translator.trans(title)),
            m('div', { className: 'SocialAside-members' }, users.map((user: any) =>
              this.memberRow(user, Boolean(user.online), count(user))
            )),
          ])
        : null;

    const postGroup = (title: string, posts: any[], rooms = false) =>
      posts?.length
        ? m('div', { className: 'SocialLeaderboard-group' }, [
            m('h4', { className: 'SocialLeaderboard-title' }, app.translator.trans(title)),
            posts.map((item: any) => m('a', {
              className: 'SocialLeaderboard-post',
              href: rooms ? roomUrl(item) : app.route('social.post', { id: item.id }),
            }, [
              m('span', { className: 'SocialLeaderboard-post-body' }, rooms ? item.name : item.body),
              m('small', {}, rooms
                ? [m('i', { className: 'fas fa-headset' }), ' ', this.formatDuration(item.voiceSeconds)]
                : [m('i', { className: 'fas fa-heart' }), ' ', item.reactionsCount]),
            ])),
          ])
        : null;

    const groups = [
      memberGroup('cengizkemec-social.forum.aside.most_posts', boards.topPosters || [], (user) => user.postsCount),
      memberGroup('cengizkemec-social.forum.aside.most_liked', boards.topLiked || [], (user) => user.likesCount),
      postGroup('cengizkemec-social.forum.aside.top_posts', boards.topPosts || []),
      memberGroup('cengizkemec-social.forum.aside.top_voice', boards.voiceUsers || [], (user) => this.formatDuration(user.voiceSeconds)),
      postGroup('cengizkemec-social.forum.aside.top_voice_rooms', boards.voiceRooms || [], true),
    ].filter(Boolean);

    if (!groups.length) {
      return m('section', { className: 'SocialAside-card SocialLeaderboard' }, [
        m('div', { className: 'SocialAside-heading' }, app.translator.trans('cengizkemec-social.forum.aside.top_lists')),
        m('p', { className: 'SocialAside-empty' }, app.translator.trans('cengizkemec-social.forum.aside.no_leaderboard')),
      ]);
    }

    return m('section', { className: 'SocialAside-card SocialLeaderboard' }, [
      m('div', { className: 'SocialAside-heading' }, app.translator.trans('cengizkemec-social.forum.aside.top_lists')),
      ...groups,
    ]);
  }

  userPreview(): any {
    if (!this.previewMember) return null;

    const model = this.previewUser;
    const member = this.previewMember;
    const social = this.previewSocial;
    const bio = model?.bio?.() || social?.bio || member.bio || null;
    const cover = model?.cover?.() || model?.attribute?.('cover') || social?.coverUrl || member.coverUrl || null;
    const joined = model?.joinTime?.();
    const posts = model?.commentCount?.() ?? null;
    const discussions = model?.discussionCount?.() ?? null;

    return m(
      'div',
      {
        className: 'SocialUserPreview',
        style: { top: `${this.previewTop}px`, left: `${this.previewLeft}px` },
        onmouseenter: () => this.keepPreview(),
        onmouseleave: () => this.hidePreview(),
      },
      [
        cover
          ? m('div', {
              className: 'SocialUserPreview-cover',
              style: { backgroundImage: `url("${encodeURI(cover).replace(/"/g, '%22')}")` },
            })
          : null,
        m('div', { className: 'SocialUserPreview-head' }, [
          m('span', { className: 'SocialUserPreview-avatar' }, Avatar({ displayName: member.displayName, username: member.username, avatarUrl: member.avatarUrl }, 52)),
          m('div', {}, [m('strong', {}, member.displayName), m('small', {}, '@' + member.username)]),
        ]),
        this.previewLoading && !model
          ? m('div', { className: 'SocialUserPreview-loading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
          : [
              bio ? m('p', { className: 'SocialUserPreview-bio' }, bio) : null,
              m('div', { className: 'SocialUserPreview-meta' }, [
                joined ? m('span', {}, [m('i', { className: 'fas fa-calendar' }), ' ', model.joinTime?.() ? new Date(model.joinTime()).toLocaleDateString(app.data.locale || undefined) : '']) : null,
                posts !== null ? m('span', {}, [m('i', { className: 'fas fa-comment' }), ' ', posts]) : null,
                discussions !== null ? m('span', {}, [m('i', { className: 'fas fa-comments' }), ' ', discussions]) : null,
              ]),
            ],
        m('a', { className: 'Button Button--primary Button--block SocialUserPreview-link', href: app.route('user', { username: member.username }) }, app.translator.trans('cengizkemec-social.forum.aside.open_flarum_profile')),
        m('div', { className: 'SocialUserPreview-actions' }, [
          this.previewCanMessage()
            ? m('button', { className: 'Button Button--link Button--small', type: 'button', onclick: () => this.messagePreview() }, [m('i', { className: 'fas fa-envelope' }), ' ', app.translator.trans('cengizkemec-social.forum.profile.message')])
            : null,
          social?.friendshipStatus === 'accepted'
            ? m('span', { className: 'SocialBadge' }, app.translator.trans('cengizkemec-social.forum.profile.friends'))
            : social?.friendshipStatus === 'pending'
            ? m('span', { className: 'SocialBadge' }, app.translator.trans('cengizkemec-social.forum.profile.friend_pending'))
            : SocialState.config.features?.friends && Number(social?.id || member.id) !== Number(app.session.user?.id)
            ? m('button', { className: 'Button Button--link Button--small', type: 'button', onclick: () => this.addPreviewFriend() }, [m('i', { className: 'fas fa-user-plus' }), ' ', app.translator.trans('cengizkemec-social.forum.profile.add_friend')])
            : null,
        ]),
      ]
    );
  }

  view(vnode: any): any {
    const state = vnode.attrs.state;
    const rooms = state.rooms.filter((room: any) => room.isVoice && room.participantCount > 0).slice(0, 4);

    const widgets: Record<string, any> = {
      online: m('section', { className: 'SocialAside-card' }, [
        m('div', { className: 'SocialAside-heading' }, [
          m('span', {}, app.translator.trans('cengizkemec-social.forum.aside.online')),
          m('span', { className: 'SocialAside-live' }),
        ]),
        state.onlineMembers.length
          ? m('div', { className: 'SocialAside-members' }, state.onlineMembers.map((user: any) => this.memberRow(user, true)))
          : m('p', { className: 'SocialAside-empty' }, app.translator.trans('cengizkemec-social.forum.aside.no_online')),
      ]),

      offline: state.offlineMembers.length
        ? m('section', { className: 'SocialAside-card' }, [
            m('div', { className: 'SocialAside-heading' }, [
              m('span', {}, app.translator.trans('cengizkemec-social.forum.aside.offline')),
              m('span', { className: 'SocialAside-count' }, state.offlineMembers.length),
            ]),
            m('div', { className: 'SocialAside-members SocialAside-members--offline' }, state.offlineMembers.map((user: any) => this.memberRow(user, false))),
          ])
        : null,

      leaderboards: this.leaderboardCard(state),

      hashtags: state.trendingHashtags?.length
        ? m('section', { className: 'SocialAside-card' }, [
            m('div', { className: 'SocialAside-heading' }, [
              m('span', {}, app.translator.trans('cengizkemec-social.forum.explore.trending')),
              m('a', { className: 'SocialAside-heading-link', href: app.route('social.explore') }, app.translator.trans('cengizkemec-social.forum.nav.explore')),
            ]),
            m('div', { className: 'SocialTags SocialTags--aside' }, state.trendingHashtags.map((item: any) =>
              m('a', { className: 'SocialTag', href: app.route('social.explore', { hashtag: item.tag }) }, [
                m('span', {}, '#' + item.tag),
                m('small', {}, item.count),
              ])
            )),
          ])
        : null,

      voiceRooms: rooms.length
        ? m('section', { className: 'SocialAside-card' }, [
            m('div', { className: 'SocialAside-heading' }, app.translator.trans('cengizkemec-social.forum.aside.active_voice')),
            rooms.map((room: any) =>
              m('a', { className: 'SocialAside-room', href: roomUrl(room) }, [
                m('span', { className: 'SocialAside-room-icon' }, m('i', { className: room.icon || 'fas fa-volume-high' })),
                m('span', { className: 'SocialAside-room-info' }, [m('strong', {}, room.name), m('small', {}, roomCapacityLabel(room))]),
                m('span', { className: 'SocialAside-room-live' }, m('i', { className: 'fas fa-signal' })),
              ])
            ),
          ])
        : null,

      widgets: m(SocialWidgets),

      forumLatest: m('section', { className: 'SocialAside-card' }, [
        m('div', { className: 'SocialAside-heading' }, [
          m('span', {}, app.translator.trans('cengizkemec-social.forum.aside.forum_latest')),
          m('a', { className: 'SocialAside-heading-link', href: app.route('index') }, app.translator.trans('cengizkemec-social.forum.nav.forum')),
        ]),
        this.discussions.length
          ? m('div', { className: 'SocialAside-forumPosts' }, this.discussions.map((discussion: any) =>
              m('a', {
                className: 'SocialAside-forumPost',
                href: app.route('discussion', { id: discussion.id(), slug: discussion.slug() }),
              }, [
                m('span', { className: 'SocialAside-forumPost-title' }, discussion.title()),
                m('small', {}, [
                  discussion.lastPostedUser?.()?.displayName?.() || '',
                  ' · ',
                  timeAgo(discussion.lastPostedAt?.()?.toISOString?.() || null),
                ]),
              ])
            ))
          : m('p', { className: 'SocialAside-empty' }, this.discussionsLoaded
              ? app.translator.trans('cengizkemec-social.forum.aside.no_forum_posts')
              : app.translator.trans('cengizkemec-social.forum.common.loading')),
      ]),

      stats: m('section', { className: 'SocialAside-card SocialStatsWidget' }, [
        m('div', { className: 'SocialAside-heading' }, app.translator.trans('cengizkemec-social.forum.aside.social_stats')),
        m('div', { className: 'SocialStatsWidget-grid' }, [
          this.statItem('fas fa-pen', state.stats.posts, 'cengizkemec-social.forum.aside.posts'),
          this.statItem('far fa-comments', state.stats.comments, 'cengizkemec-social.forum.aside.comments'),
          this.statItem('fas fa-users', state.stats.members, 'cengizkemec-social.forum.aside.members'),
          this.statItem('fas fa-door-open', state.stats.rooms, 'cengizkemec-social.forum.aside.rooms'),
          this.statItem('far fa-images', state.stats.media, 'cengizkemec-social.forum.aside.media'),
          this.statItem('fas fa-microphone', state.stats.voiceParticipants, 'cengizkemec-social.forum.aside.in_voice'),
        ]),
      ]),
    };

    const defaultOrder = ['online', 'offline', 'leaderboards', 'hashtags', 'voiceRooms', 'widgets', 'forumLatest', 'stats'];
    const configured = String(state.config.appearance?.asideOrder || '')
      .split(',')
      .map((key: string) => key.trim())
      .filter(Boolean);

    const order = configured.length ? configured : defaultOrder;
    const seen = new Set<string>();
    const sections: any[] = [];

    order.forEach((key: string) => {
      if (widgets[key] && !seen.has(key)) {
        sections.push(widgets[key]);
        seen.add(key);
      }
    });

    defaultOrder.forEach((key: string) => {
      if (widgets[key] && !seen.has(key)) {
        sections.push(widgets[key]);
        seen.add(key);
      }
    });

    return m('aside', { className: 'SocialAside' }, [...sections, this.userPreview()]);
  }
}
