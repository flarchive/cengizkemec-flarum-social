import app from 'flarum/forum/app';
import SocialState from '../SocialState';
import { get } from '../../common/api';
import { Avatar } from '../utils';

export default class StoriesBar {
  groups: any[] = [];
  loading = false;
  loaded = false;

  oninit(): void {
    if (SocialState.config.features?.stories) {
      this.load();
    }
  }

  load(): void {
    if (!SocialState.config.features?.stories) return;
    this.loading = true;
    get('/social/stories')
      .then((response: any) => {
        this.groups = response.data || [];
        this.loaded = true;
      })
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  view(): any {
    if (!SocialState.config.features?.stories) return null;

    return m('div', { className: 'SocialStories' }, [
      SocialState.user && SocialState.can('createStory')
        ? m('button', {
            className: 'SocialStory SocialStory--create',
            onclick: () => app.modal.show(() => import('./StoryComposerModal'), { oncreated: () => this.load() }),
          }, [
            m('span', { className: 'SocialStory-ring SocialStory-ring--create' }, [Avatar(SocialState.user, 52), m('span', { className: 'SocialStory-plus' }, m('i', { className: 'fas fa-plus' }))]),
            m('span', { className: 'SocialStory-name' }, app.translator.trans('cengizkemec-social.forum.stories.add')),
          ])
        : null,
      this.loading && !this.loaded
        ? m('div', { className: 'SocialStories-loading' }, m('i', { className: 'fas fa-spinner fa-spin' }))
        : this.groups.map((group) => {
            const viewed = Boolean(group.stories?.length) && group.stories.every((story: any) => story.viewed);
            const firstUnseen = (group.stories || []).findIndex((story: any) => !story.viewed);

            return m('button', {
              className: 'SocialStory' + (viewed ? ' is-viewed' : ''),
              onclick: () => app.modal.show(() => import('./StoryViewerModal'), { group, index: firstUnseen >= 0 ? firstUnseen : 0, onupdate: () => this.load() }),
            }, [
              m('span', { className: 'SocialStory-ring' }, Avatar(group.user, 52)),
              m('span', { className: 'SocialStory-name' }, group.user.displayName),
              viewed ? null : m('span', { className: 'SocialStory-dot' }),
            ]);
          }),
      this.loaded && !this.groups.length
        ? m('span', { className: 'SocialStories-empty' }, app.translator.trans('cengizkemec-social.forum.stories.empty'))
        : null,
    ]);
  }
}
