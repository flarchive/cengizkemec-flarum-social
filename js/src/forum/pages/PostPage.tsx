import app from 'flarum/forum/app';
import SocialPage from '../components/SocialPage';
import { get } from '../../common/api';
import PostCard from '../components/PostCard';
import CommentSection from '../components/CommentSection';

export default class PostPage extends SocialPage {
  post: any = null;
  loading = true;
  error: string | null = null;

  pageTitle(): string {
    return this.post ? String(this.post.body || '').slice(0, 60) : (app.translator.trans('cengizkemec-social.forum.post.title') as string);
  }

  onSocialReady(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    get(`/social/posts/${m.route.param('id')}`)
      .then((response: any) => {
        this.post = response.data;
        app.setTitle(String(this.post.body || '').slice(0, 60));
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  content(): any {
    if (this.loading) {
      return m('div', { className: 'SocialLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }));
    }

    if (this.error || !this.post) {
      return m('div', { className: 'SocialPanel SocialPanel--error' }, [
        m('i', { className: 'fas fa-triangle-exclamation' }),
        m('p', {}, this.error || app.translator.trans('cengizkemec-social.forum.post.not_found')),
        m('a', { className: 'Button Button--primary', href: app.route('social.index') }, app.translator.trans('cengizkemec-social.forum.nav.feed')),
      ]);
    }

    return m('div', { className: 'SocialPostPage' }, [
      m('div', { className: 'SocialPageHead' }, [
        m('div', {}, [
          m('a', { href: app.route('social.index'), className: 'SocialBack' }, [m('i', { className: 'fas fa-arrow-left' }), ' ', app.translator.trans('cengizkemec-social.forum.post.back')]),
          m('h1', {}, app.translator.trans('cengizkemec-social.forum.post.title')),
        ]),
      ]),
      m(PostCard, {
        post: this.post,
        onremove: () => m.route.set(app.route('social.index')),
        onupdate: () => m.redraw(),
      }),
      m(CommentSection, { post: this.post }),
    ]);
  }
}
