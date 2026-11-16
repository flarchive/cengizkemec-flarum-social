import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import { get } from '../../common/api';
import PostCard from '../components/PostCard';
import { openLoginModal } from '../authModals';

export default class BookmarksPage extends SocialPage {
  posts: any[] = [];
  loading = true;
  error: string | null = null;
  meta: any = {};

  pageTitle(): string {
    return app.translator.trans('cengizkemec-social.forum.nav.bookmarks') as string;
  }

  onSocialReady(): void {
    if (!this.state.user) {
      this.loading = false;
      return;
    }
    this.load();
  }

  load(reset = true): void {
    this.loading = reset;
    get('/social/bookmarks', { page: { offset: reset ? 0 : this.posts.length, limit: 20 } })
      .then((response: any) => {
        this.posts = reset ? response.data : this.posts.concat(response.data);
        this.meta = response.meta || {};
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  content(): any {
    if (!this.state.user) {
      return m('div', { className: 'SocialPanel SocialPanel--auth' }, [
        m('i', { className: 'far fa-bookmark' }),
        m('h2', {}, app.translator.trans('cengizkemec-social.forum.bookmarks.login_title')),
        m('p', {}, app.translator.trans('cengizkemec-social.forum.bookmarks.login_text')),
        m('button', { className: 'Button Button--primary', type: 'button', onclick: () => openLoginModal() }, app.translator.trans('cengizkemec-social.forum.auth.login')),
      ]);
    }

    return m('div', { className: 'SocialBookmarksPage' }, [
      m('div', { className: 'SocialPageHead' }, m('div', {}, [m('h1', {}, app.translator.trans('cengizkemec-social.forum.bookmarks.title')), m('p', {}, app.translator.trans('cengizkemec-social.forum.bookmarks.subtitle'))])),
      this.loading ? m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' })) : null,
      this.posts.map((post) => m(PostCard, { post, onremove: () => this.load() })),
      !this.loading && !this.posts.length ? m('div', { className: 'SocialEmpty' }, [m('i', { className: 'far fa-bookmark' }), m('h3', {}, app.translator.trans('cengizkemec-social.forum.bookmarks.empty')), m('p', {}, app.translator.trans('cengizkemec-social.forum.bookmarks.empty_text'))]) : null,
      this.meta.hasMore ? m('button', { className: 'Button Button--block SocialLoadMore', onclick: () => this.load(false) }, app.translator.trans('cengizkemec-social.forum.common.load_more')) : null,
    ]);
  }
}
