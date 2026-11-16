import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import SocialState from '../SocialState';
import { del, get, post } from '../../common/api';
import { Avatar, handleApiError, promptLogin, timeAgo } from '../utils';
import PostCard from '../components/PostCard';
import MediaGallery from '../components/MediaGallery';
import { openLoginModal } from '../authModals';

export default class ProfilePage extends SocialPage {
  profile: any = null;
  loading = true;
  error: string | null = null;
  tab = 'posts';

  pageTitle(): string {
    return this.profile?.displayName || (app.translator.trans('cengizkemec-social.forum.profile.title') as string);
  }

  onSocialReady(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    get(`/social/profile/${encodeURIComponent(m.route.param('username'))}`)
      .then((response: any) => {
        this.profile = response.data;
        app.setTitle(this.profile.displayName);
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  follow(): void {
    if (promptLogin('follow')) return;

    const request = this.profile.isFollowing
      ? del(`/social/profile/${encodeURIComponent(this.profile.username)}/follow`)
      : post(`/social/profile/${encodeURIComponent(this.profile.username)}/follow`);

    request.then(() => this.load()).catch(handleApiError);
  }

  message(): void {
    post('/social/dm/conversations', { user_id: this.profile.id })
      .then((response: any) => m.route.set(app.route('social.messages.conversation', { id: response.data.id })))
      .catch(handleApiError);
  }

  friend(): void {
    if (promptLogin('generic')) return;

    post(`/social/friends/${this.profile.id}`)
      .then(() => this.load())
      .catch(handleApiError);
  }

  media(): any[] {
    return (this.profile?.recentPosts || []).flatMap((post: any) => post.media || []);
  }

  content(): any {
    if (this.loading) return m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }));

    if (this.error || !this.profile) {
      return m('div', { className: 'SocialPanel SocialPanel--error' }, [m('p', {}, this.error || app.translator.trans('cengizkemec-social.forum.profile.not_found')), m('a', { className: 'Button Button--primary', href: app.route('social.index') }, app.translator.trans('cengizkemec-social.forum.nav.feed'))]);
    }

    const profile = this.profile;
    const self = profile.isSelf || SocialState.user?.id === profile.id;

    return m('div', { className: 'SocialProfilePage' }, [
      m('div', { className: 'SocialProfile-cover', style: profile.coverUrl ? { backgroundImage: `url("${encodeURI(profile.coverUrl).replace(/"/g, '%22')}")` } : {} }, m('span', { className: 'SocialProfile-coverPattern' })),
      m('div', { className: 'SocialProfile-header' }, [
        m('div', { className: 'SocialProfile-avatarLarge' }, Avatar(profile, 104)),
        m('div', { className: 'SocialProfile-identity' }, [
          m('h1', {}, profile.displayName, profile.online ? m('span', { className: 'SocialProfile-online' }, app.translator.trans('cengizkemec-social.forum.aside.online')) : null),
          m('span', { className: 'SocialProfile-username' }, '@' + profile.username),
          m('div', { className: 'SocialProfile-stats' }, [
            m('span', {}, [m('strong', {}, profile.postsCount || 0), ' ', app.translator.trans('cengizkemec-social.forum.profile.posts')]),
            m('span', {}, [m('strong', {}, profile.followersCount || 0), ' ', app.translator.trans('cengizkemec-social.forum.profile.followers')]),
            m('span', {}, [m('strong', {}, profile.followingCount || 0), ' ', app.translator.trans('cengizkemec-social.forum.profile.following')]),
            profile.joinedAt ? m('span', {}, [m('i', { className: 'fas fa-calendar' }), ' ', app.translator.trans('cengizkemec-social.forum.profile.joined', { date: new Date(profile.joinedAt).toLocaleDateString() })]) : null,
          ]),
        ]),
        m('div', { className: 'SocialProfile-actions' }, self
          ? m('a', { className: 'Button', href: app.route('user', { username: profile.username }) }, [m('i', { className: 'fas fa-pen' }), ' ', app.translator.trans('cengizkemec-social.forum.profile.edit_on_flarum')])
          : [
              SocialState.user
                ? m('button', { className: 'Button' + (profile.isFollowing ? ' Button--primary' : ''), onclick: () => this.follow() }, [m('i', { className: profile.isFollowing ? 'fas fa-user-check' : 'fas fa-user-plus' }), ' ', app.translator.trans(profile.isFollowing ? 'cengizkemec-social.forum.profile.following_action' : 'cengizkemec-social.forum.profile.follow')])
                : m('button', { className: 'Button', type: 'button', onclick: () => openLoginModal() }, app.translator.trans('cengizkemec-social.forum.profile.follow')),
              profile.canMessage ? m('button', { className: 'Button', onclick: () => this.message() }, [m('i', { className: 'fas fa-envelope' }), ' ', app.translator.trans('cengizkemec-social.forum.profile.message')]) : null,
              SocialState.config.features?.friends
                ? profile.friendshipStatus === 'accepted'
                  ? m('span', { className: 'SocialBadge' }, app.translator.trans('cengizkemec-social.forum.profile.friends'))
                  : profile.friendshipStatus === 'pending'
                  ? m('span', { className: 'SocialBadge' }, app.translator.trans('cengizkemec-social.forum.profile.friend_pending'))
                  : m('button', { className: 'Button Button--link', onclick: () => this.friend() }, app.translator.trans('cengizkemec-social.forum.profile.add_friend'))
                : null,
            ]),
      ]),
      profile.bio ? m('div', { className: 'SocialProfile-bio' }, profile.bio) : null,
      m('div', { className: 'SocialProfile-tabs' }, [
        m('button', { className: 'SocialTab' + (this.tab === 'posts' ? ' is-active' : ''), onclick: () => (this.tab = 'posts') }, app.translator.trans('cengizkemec-social.forum.profile.tabs.posts')),
        m('button', { className: 'SocialTab' + (this.tab === 'media' ? ' is-active' : ''), onclick: () => (this.tab = 'media') }, app.translator.trans('cengizkemec-social.forum.profile.tabs.media')),
        m('button', { className: 'SocialTab' + (this.tab === 'about' ? ' is-active' : ''), onclick: () => (this.tab = 'about') }, app.translator.trans('cengizkemec-social.forum.profile.tabs.about')),
      ]),
      this.tab === 'posts'
        ? profile.recentPosts?.length
          ? m('div', {}, profile.recentPosts.map((post: any) => m(PostCard, { post })))
          : m('div', { className: 'SocialEmpty' }, [m('i', { className: 'far fa-comments' }), m('p', {}, app.translator.trans('cengizkemec-social.forum.profile.no_posts'))])
        : null,
      this.tab === 'media'
        ? this.media().length
          ? m(MediaGallery, { media: this.media() })
          : m('div', { className: 'SocialEmpty' }, [m('i', { className: 'fas fa-photo-film' }), m('p', {}, app.translator.trans('cengizkemec-social.forum.profile.no_media'))])
        : null,
      this.tab === 'about'
        ? m('section', { className: 'SocialPanel SocialProfile-about' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-circle-info' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.profile.about'))]),
            profile.bio ? m('p', {}, profile.bio) : m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.profile.no_bio')),
            profile.lastOnlineAt ? m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.profile.last_online', { time: timeAgo(profile.lastOnlineAt) })) : null,
          ])
        : null,
    ]);
  }
}
