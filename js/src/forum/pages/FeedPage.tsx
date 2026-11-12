import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import SocialState from '../SocialState';
import { openLoginModal, openRegisterModal } from '../authModals';
import { get } from '../../common/api';
import { handleApiError } from '../utils';
import PostComposer from '../components/PostComposer';
import PostCard from '../components/PostCard';
import StoriesBar from '../components/StoriesBar';

const FILTERS = ['latest', 'popular', 'following', 'media', 'announcements', 'mine'];

export default class FeedPage extends SocialPage {
  posts: any[] = [];
  filter = 'latest';
  loading = false;
  loadingMore = false;
  error: string | null = null;
  meta: any = {};
  query: any = {};

  oninit(vnode: any): void {
    super.oninit(vnode);
    this.query = {};
    const params = m.parseQueryString(location.search.replace(/^\?/, ''));
    if (params.hashtag) this.query.hashtag = String(params.hashtag);
    if (params.q) this.query.q = String(params.q);
  }

  pageTitle(): string {
    return app.translator.trans('cengizkemec-social.forum.nav.feed') as string;
  }

  onSocialReady(): void {
    this.load();
  }

  load(reset = true): void {
    if (reset) {
      this.loading = true;
      this.posts = [];
    } else {
      this.loadingMore = true;
    }

    this.error = null;

    get('/social/feed', {
      filter: this.filter,
      q: this.query.q,
      hashtag: this.query.hashtag,
      page: { offset: reset ? 0 : this.posts.length, limit: SocialState.config.feed?.perPage || 15 },
    })
      .then((response: any) => {
        this.meta = response.meta || {};
        this.posts = reset ? response.data || [] : this.posts.concat(response.data || []);
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        this.loadingMore = false;
        m.redraw();
      });
  }

  subtitle(): any {
    const hashtag = this.query.hashtag;

    return m('div', { className: 'SocialPageHead' }, [
      m('div', {}, [
        m('h1', {}, hashtag ? '#' + hashtag : app.translator.trans('cengizkemec-social.forum.feed.title')),
        m('p', {}, hashtag ? app.translator.trans('cengizkemec-social.forum.feed.hashtag_subtitle', { tag: hashtag }) : app.translator.trans('cengizkemec-social.forum.feed.subtitle')),
      ]),
      SocialState.user
        ? m('a', { className: 'Button Button--link', href: app.route('social.explore') }, [m('i', { className: 'fas fa-compass' }), ' ', app.translator.trans('cengizkemec-social.forum.nav.explore')])
        : null,
    ]);
  }

  content(): any {
    if (!SocialState.can('viewFeed')) {
      return m('div', { className: 'SocialPanel SocialPanel--auth' }, [
        m('i', { className: 'fas fa-lock' }),
        m('h2', {}, app.translator.trans('cengizkemec-social.forum.feed.login_required_title')),
        m('p', {}, app.translator.trans('cengizkemec-social.forum.feed.login_required_text')),
        m('button', { className: 'Button Button--primary', type: 'button', onclick: () => openLoginModal() }, app.translator.trans('cengizkemec-social.forum.auth.login')),
        app.forum.attribute('allowSignUp') ? m('button', { className: 'Button Button--link', type: 'button', onclick: () => openRegisterModal() }, app.translator.trans('cengizkemec-social.forum.auth.register')) : null,
      ]);
    }

    return m('div', { className: 'SocialFeed' }, [
      m(StoriesBar),
      SocialState.user ? m(PostComposer, {
        oncreated: (post: any) => {
          this.posts.unshift(post);
          this.meta.total = (this.meta.total || 0) + 1;
        },
      }) : null,
      m('div', { className: 'SocialFeed-toolbar' }, [
        m('div', { className: 'SocialTabs' }, FILTERS.filter((filter) => !['following', 'mine'].includes(filter) || SocialState.user).map((filter) =>
          m('button', {
            className: 'SocialTab' + (this.filter === filter ? ' is-active' : ''),
            onclick: () => {
              this.filter = filter;
              this.load();
            },
          }, app.translator.trans(`cengizkemec-social.forum.feed.filters.${filter}`))
        )),
        this.meta.total !== undefined ? m('span', { className: 'SocialFeed-count' }, app.translator.trans('cengizkemec-social.forum.feed.count', { count: this.meta.total })) : null,
      ]),
      this.error ? m('div', { className: 'SocialPanel SocialPanel--error' }, [m('i', { className: 'fas fa-triangle-exclamation' }), m('p', {}, this.error), m('button', { className: 'Button Button--primary', onclick: () => this.load() }, app.translator.trans('cengizkemec-social.forum.errors.retry'))]) : null,
      this.loading
        ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
        : this.posts.length
        ? this.posts.map((post) =>
            m(PostCard, {
              post,
              onremove: (item: any) => {
                this.posts = this.posts.filter((post) => post.id !== item.id);
                this.meta.total = Math.max(0, (this.meta.total || 1) - 1);
              },
            })
          )
        : m('div', { className: 'SocialEmpty' }, [m('i', { className: 'far fa-comments' }), m('h3', {}, app.translator.trans('cengizkemec-social.forum.feed.empty')), m('p', {}, app.translator.trans('cengizkemec-social.forum.feed.empty_text'))]),
      !this.loading && this.meta.hasMore
        ? m('button', { className: 'Button Button--block SocialLoadMore', onclick: () => this.load(false), loading: this.loadingMore }, app.translator.trans('cengizkemec-social.forum.common.load_more'))
        : null,
    ]);
  }
}
