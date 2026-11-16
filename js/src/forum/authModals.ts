import app from 'flarum/forum/app';

/**
 * Social never renders its own login/registration form. These helpers open
 * Flarum's native modals so authentication stays identical to the rest of the
 * forum, including password reset, email confirmation and provider logins.
 */
export function openLoginModal(): void {
  app.modal.show(() => import('flarum/forum/components/LogInModal'));
}

export function openRegisterModal(): void {
  if (!app.forum.attribute('allowSignUp')) return;
  app.modal.show(() => import('flarum/forum/components/SignUpModal'));
}
