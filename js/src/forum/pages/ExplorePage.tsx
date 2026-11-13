import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import { get } from '../../common/api';
import { Avatar, roomUrl, timeAgo } from '../utils';
import PostCard from '../components/PostCard';
import MediaGallery from '../components/MediaGallery';

export default class ExplorePage extends SocialPage {
  data: any = null;
  search: any = null;
  loading = true;
  error: string | null = null;
  q = '';

  oninit(vnode: any): void {
    super.oninit(vnode);
    const params = m.parseQueryString(location.search.replace(/^\?/, ''));
    this.q = String(params.q || params.hashtag || '');
  }

  pageTitle(): string {
    return app.translator.trans('cengizkemec-social.forum.nav.explore') as string;
  }

  onSocialReady(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    Promise.all([
      get('/social/explore'),
      this.q ? get('/social/search', { q: this.q }) : Promise.resolve(null),
    ])
      .then(([explore, search]: any[]) => {
        this.data = explore.data;
        this.search = search?.data || null;
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  content(): any {
    if (this.loading) return m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }));

    if (this.error) {
      return m('div', { className: 'SocialPanel SocialPanel--error' }, [
        m('i', { className: 'fas fa-triangle-exclamation' }),
        m('p', {}, this.error),
        m('button', { className: 'Button Button--primary', onclick: () => this.load() }, app.translator.trans('cengizkemec-social.forum.errors.retry')),
      ]);
    }

    if (this.search) {
      return this.searchResults();
    }

    return m('div', { className: 'SocialExplore' }, [
      m('div', { className: 'SocialPageHead' }, m('div', {}, [
        m('h1', {}, app.translator.trans('cengizkemec-social.forum.explore.title')),
        m('p', {}, app.translator.trans('cengizkemec-social.forum.explore.subtitle')),
      ])),
      m('div', { className: 'SocialExplore-stats' }, [
        m('div', { className: 'SocialExplore-stat' }, [m('i', { className: 'fas fa-pen-nib' }), m('strong', {}, this.data.stats?.posts || 0), m('span', {}, app.translator.trans('cengizkemec-social.forum.aside.posts'))]),
        m('div', { className: 'SocialExplore-stat' }, [m('i', { className: 'fas fa-users' }), m('strong', {}, this.data.stats?.members || 0), m('span', {}, app.translator.trans('cengizkemec-social.forum.aside.members'))]),
        m('div', { className: 'SocialExplore-stat' }, [m('i', { className: 'fas fa-circle-play' }), m('strong', {}, this.data.stats?.activeStories || 0), m('span', {}, app.translator.trans('cengizkemec-social.forum.stories.title'))]),
      ]),
      m('div', { className: 'SocialExplore-grid' }, [
        m('section', { className: 'SocialPanel' }, [
          m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-fire' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.explore.trending'))]),
          this.data.trendingHashtags.length
            ? m('div', { className: 'SocialTags' }, this.data.trendingHashtags.map((item: any) =>
                m('a', { className: 'SocialTag', href: app.route('social.explore', { hashtag: item.tag }) }, [m('span', {}, '#' + item.tag), m('small', {}, item.count)])
              ))
            : m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.explore.no_trends')),
        ]),
        m('section', { className: 'SocialPanel' }, [
          m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-star' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.explore.top_creators'))]),
          this.data.topCreators.length
            ? m('div', { className: 'SocialPeople' }, this.data.topCreators.map((user: any) =>
                m('a', { className: 'SocialPerson', href: app.route('social.profile', { username: user.username }) }, [
                  Avatar(user, 40),
                  m('span', {}, [m('strong', {}, user.displayName), m('small', {}, '@' + user.username)]),
                  m('span', { className: 'SocialPerson-count' }, user.postsCount),
                ])
              ))
            : m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.explore.no_creators')),
        ]),
      ]),
      this.data.activeRooms.length
        ? m('section', { className: 'SocialPanel' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-headset' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.explore.active_rooms')), m('a', { href: app.route('social.rooms'), className: 'SocialSectionHead-link' }, app.translator.trans('cengizkemec-social.forum.common.view_all'))]),
            m('div', { className: 'SocialRoomGrid' }, this.data.activeRooms.map((room: any) =>
              m('a', { className: 'SocialRoomCard', href: roomUrl(room) }, [
                m('span', { className: 'SocialRoomCard-icon' }, m('i', { className: room.icon || 'fas fa-volume-high' })),
                m('span', { className: 'SocialRoomCard-info' }, [m('strong', {}, room.name), m('small', {}, room.description || '')]),
                m('span', { className: 'SocialRoomCard-count' }, [m('i', { className: 'fas fa-user' }), ' ', room.participantCount || 0]),
              ])
            )),
          ])
        : null,
      this.data.recentMedia.length
        ? m('section', { className: 'SocialPanel' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-photo-film' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.explore.recent_media')), m('a', { href: app.route('social.media'), className: 'SocialSectionHead-link' }, app.translator.trans('cengizkemec-social.forum.common.view_all'))]),
            m(MediaGallery, { media: this.data.recentMedia }),
          ])
        : null,
    ]);
  }

  searchResults(): any {
    const results = this.search;

    return m('div', { className: 'SocialExplore' }, [
      m('div', { className: 'SocialPageHead' }, m('div', {}, [
        m('h1', {}, app.translator.trans('cengizkemec-social.forum.explore.search_title', { query: this.q })),
        m('p', {}, app.translator.trans('cengizkemec-social.forum.explore.search_subtitle')),
      ])),
      results.users.length
        ? m('section', { className: 'SocialPanel' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-users' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.explore.people'))]),
            m('div', { className: 'SocialPeople' }, results.users.map((user: any) =>
              m('a', { className: 'SocialPerson', href: app.route('social.profile', { username: user.username }) }, [Avatar(user, 40), m('span', {}, [m('strong', {}, user.displayName), m('small', {}, '@' + user.username)])])
            )),
          ])
        : null,
      results.rooms.length
        ? m('section', { className: 'SocialPanel' }, [
            m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-headset' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.explore.rooms'))]),
            m('div', { className: 'SocialRoomGrid' }, results.rooms.map((room: any) =>
              m('a', { className: 'SocialRoomCard', href: roomUrl(room) }, [
                m('span', { className: 'SocialRoomCard-icon' }, m('i', { className: room.icon || 'fas fa-volume-high' })),
                m('span', { className: 'SocialRoomCard-info' }, [m('strong', {}, room.name), m('small', {}, room.description || '')]),
              ])
            )),
          ])
        : null,
      m('section', { className: 'SocialPanel' }, [
        m('div', { className: 'SocialSectionHead' }, [m('i', { className: 'fas fa-pen-nib' }), m('h2', {}, app.translator.trans('cengizkemec-social.forum.explore.posts'))]),
        results.posts.length
          ? results.posts.map((post: any) => m(PostCard, { post }))
          : m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.explore.no_results')),
      ]),
    ]);
  }
}
