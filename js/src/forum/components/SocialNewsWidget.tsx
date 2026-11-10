import app from 'flarum/forum/app';

/**
 * Renders the lines configured by fof/news-widget at the top of Social.
 * The widget extension stores its lines in the forum attribute
 * `fof-news-widget.lines`; reading that attribute keeps this integration
 * optional and avoids depending on forum-widgets-core internals.
 */
export default class SocialNewsWidget {
  lines: string[] = [];
  index = 0;
  rotation: number | null = null;

  oninit(): void {
    // Only mirror the FoF news widget when its extension is actually enabled.
    // Social does not maintain a separate announcement/news list.
    const extensions = (window as any).flarum?.extensions || {};
    if (!extensions['fof-news-widget']) return;

    const configured = app.forum.attribute<any>('fof-news-widget.lines');

    if (Array.isArray(configured)) {
      this.lines = configured.filter((line) => typeof line === 'string' && line.trim() !== '');
    } else if (typeof configured === 'string' && configured !== '') {
      try {
        const decoded = JSON.parse(configured);
        this.lines = Array.isArray(decoded) ? decoded : [configured];
      } catch (e) {
        this.lines = [configured];
      }
    }
  }

  oncreate(): void {
    if (this.lines.length <= 1) return;

    this.rotation = window.setInterval(() => {
      this.index = (this.index + 1) % this.lines.length;
      m.redraw();
    }, 7000);
  }

  onremove(): void {
    if (this.rotation !== null) window.clearInterval(this.rotation);
    this.rotation = null;
  }

  view(): any {
    if (!this.lines.length) return null;

    return m('div', { className: 'SocialNewsWidget', role: 'status' }, [
      m('span', { className: 'SocialNewsWidget-icon' }, m('i', { className: 'fas fa-bullhorn' })),
      m('div', { className: 'SocialNewsWidget-lines' }, this.lines.map((line, index) =>
        m('div', {
          className:
            'SocialNewsWidget-line' +
            (index === this.index ? ' is-current' : '') +
            (index === (this.index - 1 + this.lines.length) % this.lines.length ? ' is-previous' : ''),
        }, m.trust(line))
      )),
    ]);
  }
}
