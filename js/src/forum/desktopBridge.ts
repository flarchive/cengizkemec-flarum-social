import app from 'flarum/forum/app';
import voiceSession from './voiceSession';

type DesktopAuthMode = 'login' | 'register';

function openAuth(mode: DesktopAuthMode): boolean {
  try {
    const componentName = mode === 'register' ? 'forum/components/SignUpModal' : 'forum/components/LogInModal';
    const component = (window as any).flarum?.reg?.get('core', componentName);

    if (!component || !app.modal) return false;

    app.modal.show(component);

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Bridge used by the War Thunder Türkiye desktop application.
 * It only exposes UI actions that are already available to the page:
 * opening the native auth modals and controlling the current voice session.
 */
export function installDesktopBridge(): void {
  (window as any).WTTRDesktop = {
    version: '1.0.0',
    openAuth,
    setPTT: (active: boolean) => voiceSession.setPushToTalkActive(Boolean(active)),
    getVoiceSettings: () => {
      const preferences = voiceSession.preferences();

      return {
        pushToTalk: Boolean(preferences.pushToTalk),
        pttKey: preferences.pttKey || 'AltLeft',
      };
    },
    getState: () => ({
      user: app.session.user
        ? {
            id: app.session.user.id(),
            username: app.session.user.username(),
            displayName: app.session.user.displayName(),
          }
        : null,
      voice: {
        connected: voiceSession.connected,
        muted: !voiceSession.microphone,
        roomId: voiceSession.roomInfo?.id ?? null,
      },
    }),
  };
}
