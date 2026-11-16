import app from 'flarum/forum/app';

/**
 * Reuse homepage widgets registered through fof/forum-widgets-core in the
 * Social right rail. The core extension normally only renders them on its
 * IndexPage; reading the widget manager directly lets the same widget classes
 * and their state run inside Social without patching the widget extension.
 */
export default class SocialWidgets {
  view(): any {
    const manager = (app as any).widgets;

    if (!manager || typeof manager.get !== 'function') return null;

    // Sidebar widgets and widgets normally placed at the end of the index
    // should all live in the Social right rail. The `top` placement is handled
    // by SocialNewsWidget so the news fader keeps its full-width position.
    const placements = ['start_top', 'start_bottom', 'end', 'bottom'];
    const widgets: any[] = [];

    placements.forEach((placement) => {
      try {
        widgets.push(...manager.get(placement));
      } catch (e) {
        // A widget from an unloaded extension must not break Social.
      }
    });

    const renderable = widgets
      .filter((widget) => widget && widget.component)
      .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));

    if (!renderable.length) return null;

    return m('div', { className: 'SocialWidgets' }, renderable.map((widget) =>
      m('section', { className: 'SocialAside-card SocialWidget' },
        widget.component.component
          ? widget.component.component({ state: widget.state })
          : m(widget.component, { state: widget.state })
      )
    ));
  }
}
