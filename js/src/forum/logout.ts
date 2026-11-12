import app from 'flarum/forum/app';
import SocialState from './SocialState';

/**
 * Log out without a full page reload. The native /logout endpoint destroys the
 * server session and access token; the SPA then swaps to the guest state and
 * adopts the regenerated CSRF token.
 */
export function logout(): void {
  const token = app.session.csrfToken;
  const base = app.forum.attribute<string>('baseUrl');

  fetch(base + '/logout', {
    method: 'POST',
    credentials: 'same-origin',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
    },
    body: JSON.stringify({ csrfToken: token }),
  })
    .then(async (response) => {
      // Manual redirects surface as an opaque redirect response.
      if (response.type !== 'opaqueredirect' && !response.ok) {
        throw new Error('Unable to log out');
      }

      app.session.user = null;

      try {
        await SocialState.syncSession();
      } catch (e) {
        SocialState.reset();
      }

      if (m.route.get() === app.route('social.index')) {
        m.redraw();
      } else {
        m.route.set(app.route('social.index'));
      }
    })
    .catch(() => app.session.logout());
}
