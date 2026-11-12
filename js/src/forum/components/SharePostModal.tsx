import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';

export default class SharePostModal extends Modal {
  url = '';
  copied = false;
  input: HTMLInputElement | null = null;

  oninit(vnode: any): void {
    super.oninit(vnode);
    this.url = window.location.origin + app.route('social.post', { id: vnode.attrs.post.id });
  }

  className(): string {
    return 'Modal--small SocialShareModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.post.share_title') as string;
  }

  copy(): void {
    const done = () => {
      this.copied = true;
      app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.post.link_copied'));
      m.redraw();
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(this.url).then(done).catch(() => this.selectFallback());
    } else {
      this.selectFallback();
    }
  }

  selectFallback(): void {
    this.input?.focus();
    this.input?.select();
    try {
      document.execCommand('copy');
      this.copied = true;
      app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.post.link_copied'));
    } catch (e) {
      // The URL remains visible and selectable in the input.
    }
    m.redraw();
  }

  nativeShare(): void {
    if (!navigator.share) return;

    navigator.share({ url: this.url, title: document.title }).catch(() => {});
  }

  content(): any {
    const post = this.attrs.post;
    const text = encodeURIComponent((post.body || '').slice(0, 200));
    const url = encodeURIComponent(this.url);

    return m('div', { className: 'Modal-body SocialShareModal-body' }, [
      m('label', { className: 'SocialShareModal-label' }, app.translator.trans('cengizkemec-social.forum.post.share_url')),
      m('div', { className: 'SocialShareModal-url' }, [
        m('input', {
          className: 'FormControl',
          readonly: true,
          value: this.url,
          oncreate: (v: any) => (this.input = v.dom as HTMLInputElement),
          onclick: (event: Event) => (event.target as HTMLInputElement).select(),
        }),
        m(Button, { className: 'Button Button--primary', onclick: () => this.copy() }, this.copied
          ? app.translator.trans('cengizkemec-social.forum.post.copied')
          : app.translator.trans('cengizkemec-social.forum.post.copy')),
      ]),
      m('div', { className: 'SocialShareModal-networks' }, [
        m('a', { className: 'Button SocialShareModal-network SocialShareModal-network--x', href: `https://x.com/intent/post?text=${text}&url=${url}`, target: '_blank', rel: 'noopener noreferrer' }, [
          m('i', { className: 'fab fa-x-twitter' }),
          ' ',
          app.translator.trans('cengizkemec-social.forum.post.share_on_x'),
        ]),
        m('a', { className: 'Button SocialShareModal-network SocialShareModal-network--facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}`, target: '_blank', rel: 'noopener noreferrer' }, [
          m('i', { className: 'fab fa-facebook-f' }),
          ' ',
          app.translator.trans('cengizkemec-social.forum.post.share_on_facebook'),
        ]),
        navigator.share
          ? m(Button, { className: 'Button', onclick: () => this.nativeShare() }, [m('i', { className: 'fas fa-share-nodes' }), ' ', app.translator.trans('cengizkemec-social.forum.post.share_native')])
          : null,
      ]),
    ]);
  }
}
