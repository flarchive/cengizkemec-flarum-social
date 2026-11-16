import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import SocialState from './SocialState';

function isSelf(user: any): boolean {
  return Boolean(user && app.session.user && Number(user.id?.()) === Number(app.session.user.id?.()));
}

function openSocialProfile(): void {
  const username = app.session.user?.username?.();

  if (username) {
    m.route.set(app.route('social.profile', { username }));
  }
}

function openVoiceSettings(): void {
  const show = () => app.modal.show(() => import('./components/VoiceSettingsModal'));

  if (SocialState.loaded) {
    show();
  } else {
    SocialState.load().finally(show);
  }
}

/**
 * Add Social profile and voice-settings entry points to Flarum's own profile
 * and account settings pages, so members do not have to discover the Social
 * shell before editing their Social identity.
 */
export function installProfileIntegration(): void {
  (extend as any)('flarum/forum/components/UserPage', 'navItems', function (this: any, items: any) {
    if (!app.forum?.attribute<boolean>('socialEnabled') || !isSelf(this.user)) return;

    items.add(
      'socialProfile',
      m(Button, { className: 'Button', icon: 'fas fa-user-pen', onclick: openSocialProfile }, app.translator.trans('cengizkemec-social.forum.profile.social_profile')),
      55
    );

    items.add(
      'socialVoice',
      m(Button, { className: 'Button', icon: 'fas fa-headset', onclick: openVoiceSettings }, app.translator.trans('cengizkemec-social.forum.voice.settings_title')),
      54
    );
  });

  (extend as any)('flarum/forum/components/SettingsPage', 'accountItems', function (this: any, items: any) {
    if (!app.forum?.attribute<boolean>('socialEnabled') || !isSelf(this.user)) return;

    items.add(
      'socialProfile',
      m(Button, { className: 'Button', icon: 'fas fa-user-pen', onclick: openSocialProfile }, app.translator.trans('cengizkemec-social.forum.profile.social_profile')),
      85
    );

    items.add(
      'socialVoice',
      m(Button, { className: 'Button', icon: 'fas fa-headset', onclick: openVoiceSettings }, app.translator.trans('cengizkemec-social.forum.voice.settings_title')),
      84
    );
  });
}
