import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import SocialState from './SocialState';

function isSocialRoute(): boolean {
  return window.location.pathname === '/social' || window.location.pathname.startsWith('/social/');
}

async function hydrateUser(userId: number | string | null): Promise<void> {
  if (!userId) return;

  try {
    const user = app.store.getById('users', String(userId)) || (await app.store.find('users', userId));
    if (user) app.session.user = user;
  } catch (e) {
    // The server session is open even if the user payload cannot be loaded.
  }
}

function close(modal: any): void {
  modal.hide();
  m.redraw();
}

/**
 * Flarum's native login and sign-up modals reload the whole page. Inside the
 * Social SPA we keep them on screen but refresh the session, CSRF token and
 * user model in place instead. Outside Social the core behaviour is untouched.
 */
export function installNativeAuthBridge(): void {
  // Social has its own integrated header. Stop Flarum's primary/secondary
  // header components from rendering on Social routes (CSS alone would leave
  // their stateful dropdowns running and can throw while the session changes).
  (override as any)('flarum/forum/components/HeaderPrimary', 'view', function (original: any) {
    if (isSocialRoute()) return null;
    return original();
  });

  (override as any)('flarum/forum/components/HeaderSecondary', 'view', function (original: any) {
    if (isSocialRoute()) return null;
    return original();
  });

  // Use module paths so Flarum can attach these overrides when the lazily
  // loaded core modals are imported for the first time.
  (override as any)('flarum/forum/components/LogInModal', 'onsubmit', function (original: any, event: SubmitEvent) {
    if (!isSocialRoute()) return original(event);

    event.preventDefault();

    const modal: any = this;
    modal.loading = true;

    app.session
      .login(modal.loginParams(), { errorHandler: modal.onerror.bind(modal) })
      .then(async (response: any) => {
        const userId = response?.userId ?? null;

        try {
          await SocialState.syncSession();
        } catch (e) {}

        await hydrateUser(userId);
        close(modal);
      }, () => modal.loaded());
  });

  (override as any)('flarum/forum/components/SignUpModal', 'onsubmit', function (original: any, event: SubmitEvent) {
    if (!isSocialRoute()) return original(event);

    event.preventDefault();

    const modal: any = this;
    modal.loading = true;

    app
      .request({
        method: 'POST',
        url: app.forum.attribute('baseUrl') + '/register',
        body: modal.submitData(),
        errorHandler: (error: any) => modal.onerror(error),
      })
      .then(async (response: any) => {
        if (response?.data) app.store.pushPayload(response);

        const userId = response?.data?.id ?? null;

        try {
          await SocialState.syncSession();
        } catch (e) {}

        await hydrateUser(userId);
        close(modal);
      }, () => modal.loaded());
  });
}
