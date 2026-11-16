import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import SocialState from '../SocialState';
import SocialHeader from './SocialHeader';
import SocialNav from './SocialNav';
import SocialAside from './SocialAside';
import SocialNewsWidget from './SocialNewsWidget';
import MobileNav from './MobileNav';
import { post } from '../../common/api';
import { updateSocialSeo } from '../seo';

export default class SocialPage extends Page {
  protected bodyClass = 'SocialPage-body';
  protected state = SocialState;
  error: string | null = null;
  drawerOpen = false;
  showAside = true;
  janitorTimer: number | null = null;

  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
    m.redraw.sync();
  }

  closeDrawer(): void {
    if (!this.drawerOpen) return;

    this.drawerOpen = false;
    m.redraw.sync();
  }

  oninit(vnode: any): void {
    super.oninit(vnode);
    document.body.classList.add('SocialPage-body-active');
    this.loadState();

    this.janitorTimer = window.setInterval(() => this.runJanitor(), 10000);
  }

  onremove(vnode: any): void {
    if (this.janitorTimer !== null) window.clearInterval(this.janitorTimer);
    this.janitorTimer = null;
    document.body.classList.remove('SocialPage-body-active');
    super.onremove(vnode);
  }

  onupdate(vnode: any): void {
    super.onupdate(vnode);
    updateSocialSeo();
  }

  runJanitor(): void {
    post('/social/presence/janitor')
      .then((response: any) => {
        if (response?.data?.deleted > 0) {
          return this.state.refresh().then(() => m.redraw());
        }

        return null;
      })
      .catch(() => {});
  }

  loadState(): void {
    this.error = null;
    this.state
      .load()
      .then(() => {
        this.onSocialReady();
        app.setTitle(this.pageTitle());
        app.setTitleCount(0);
        m.redraw.sync();
      })
      .catch((error: any) => {
        this.error = error.message;
        m.redraw.sync();
      });
  }

  onSocialReady(): void {
    // Subclasses load their own data here.
  }

  pageTitle(): string {
    return app.translator.trans('cengizkemec-social.forum.nav.feed') as string;
  }

  subtitle(): any {
    return null;
  }

  content(): any {
    return null;
  }

  view(): any {
    const error = this.error || this.state.error;

    if (error && !this.state.loaded) {
      return m('div', { className: 'SocialApp SocialApp--error' }, m('div', { className: 'SocialError' }, [
        m('i', { className: 'fas fa-triangle-exclamation' }),
        m('h2', {}, app.translator.trans('cengizkemec-social.forum.errors.title')),
        m('p', {}, error),
        m('button', { className: 'Button Button--primary', onclick: () => this.loadState() }, app.translator.trans('cengizkemec-social.forum.errors.retry')),
        m('a', { className: 'Button Button--link', href: app.route('index') }, app.translator.trans('cengizkemec-social.forum.errors.back_to_forum')),
      ]));
    }

    if (!this.state.loaded) {
      return m('div', { className: 'SocialApp SocialApp--loading' }, m(LoadingIndicator, { display: 'block' }));
    }

    if (!this.state.config.enabled) {
      return m('div', { className: 'SocialApp SocialApp--disabled' }, m('div', { className: 'SocialError' }, [
        m('i', { className: 'fas fa-lock' }),
        m('h2', {}, app.translator.trans('cengizkemec-social.forum.disabled.title')),
        m('p', {}, app.translator.trans('cengizkemec-social.forum.disabled.text')),
        m('a', { className: 'Button Button--primary', href: app.route('index') }, app.translator.trans('cengizkemec-social.forum.errors.back_to_forum')),
      ]));
    }

    const showAside = this.showAside && this.state.config.appearance?.sidebar !== false;

    return m('div', { className: 'SocialApp' + (this.state.config.appearance?.compact ? ' SocialApp--compact' : '') }, [
      m(SocialHeader, {
        state: this.state,
        ontoggle: () => this.toggleDrawer(),
      }),
      m(SocialNewsWidget),
      m('div', { className: 'SocialLayout' + (showAside ? '' : ' SocialLayout--noAside') }, [
        m('div', { className: 'SocialLayout-nav' }, m(SocialNav, { state: this.state })),
        m('main', { className: 'SocialLayout-main' }, [
          this.subtitle(),
          m('div', { className: 'SocialContent' }, this.content()),
        ]),
        showAside ? m('div', { className: 'SocialLayout-aside' }, m(SocialAside, { state: this.state })) : null,
      ]),
      this.state.config.appearance?.mobileBottomNav !== false ? m(MobileNav, { state: this.state }) : null,
      this.drawerOpen
        ? m('div', { className: 'SocialDrawer', onclick: (event: Event) => {
            if (event.target === event.currentTarget) this.closeDrawer();
          } }, m('div', { className: 'SocialDrawer-panel' }, m(SocialNav, { state: this.state, onclose: () => this.closeDrawer() })))
        : null,
    ]);
  }
}
