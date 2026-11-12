import app from 'flarum/forum/app';
import classList from 'flarum/common/utils/classList';

export function avatarUrl(user: any): string | null {
  return user?.avatarUrl || user?.avatar_url || null;
}

export function userInitial(user: any): string {
  return String(user?.displayName || user?.display_name || user?.username || '?').slice(0, 1).toUpperCase();
}

export function userColor(user: any): string {
  const name = String(user?.username || 'social');
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;

  return `hsl(${hue}, 48%, 46%)`;
}

export function Avatar(user: any, size = 36): any {
  return m(
    'span',
    {
      className: classList('SocialAvatar', `SocialAvatar--${size}`),
      style: avatarUrl(user) ? { backgroundImage: `url("${avatarUrl(user)}")` } : { background: userColor(user) },
      title: user?.displayName || user?.display_name || user?.username,
    },
    avatarUrl(user) ? null : userInitial(user)
  );
}

export function formatBody(body: string | null | undefined, bodyHtml?: string | null): any[] {
  if (!body) return [];

  if (bodyHtml) {
    return [m('div', { className: 'Social-richText' }, m.trust(bodyHtml))];
  }

  const nodes: any[] = [];
  const regex = /(https?:\/\/[^\s<]+|#[\p{L}\p{N}_]+|@[A-Za-z0-9_.-]{2,30})/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    pushText(nodes, body.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('http')) {
      nodes.push(
        m(
          'a',
          { href: token, target: '_blank', rel: 'noopener noreferrer nofollow', className: 'Social-link' },
          token.replace(/^https?:\/\//, '').slice(0, 80)
        )
      );
    } else if (token.startsWith('#')) {
      nodes.push(
        m(
          'a',
          { href: app.route('social.explore', { hashtag: token.slice(1) }), className: 'Social-hashtag', 'data-hashtag': token.slice(1) },
          token
        )
      );
    } else {
      nodes.push(
        m(
          'a',
          { href: app.route('social.profile', { username: token.slice(1) }), className: 'Social-mention' },
          token
        )
      );
    }

    lastIndex = regex.lastIndex;
  }

  pushText(nodes, body.slice(lastIndex));

  return nodes;
}

function pushText(nodes: any[], text: string): void {
  if (!text) return;

  text.split('\n').forEach((line, index) => {
    if (index > 0) nodes.push(m('br'));
    if (line) nodes.push(line);
  });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return '';

  const date = new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const future = seconds < -45;
  const distance = Math.abs(seconds);

  if (distance < 45) return app.translator.trans('cengizkemec-social.forum.time.just_now') as string;

  const key = distance < 3600
    ? 'minutes'
    : distance < 86400
    ? 'hours'
    : distance < 604800
    ? 'days'
    : null;

  if (key === 'minutes') {
    return app.translator.trans(`cengizkemec-social.forum.time.${future ? 'in_' : ''}minutes`, { count: Math.max(1, Math.round(distance / 60)) }) as string;
  }

  if (key === 'hours') {
    return app.translator.trans(`cengizkemec-social.forum.time.${future ? 'in_' : ''}hours`, { count: Math.max(1, Math.round(distance / 3600)) }) as string;
  }

  if (key === 'days') {
    return app.translator.trans(`cengizkemec-social.forum.time.${future ? 'in_' : ''}days`, { count: Math.max(1, Math.round(distance / 86400)) }) as string;
  }

  return date.toLocaleDateString(app.data.locale || undefined);
}

export function promptLogin(reason = 'generic'): boolean {
  if (app.session.user) return false;

  app.modal.show(() => import('./components/GuestPromptModal'), { reason });

  return true;
}

export function openUser(user: any): string {
  return app.route('social.profile', { username: user?.username || '' });
}

export function roomUrl(room: any): string {
  return app.route('social.room', { slug: room?.slug || room?.id });
}

export function handleApiError(error: any): void {
  app.alerts.show({ type: 'error' }, error?.message || (app.translator.trans('cengizkemec-social.forum.errors.generic') as string));
}

export function username(value: string): string {
  return value.replace(/^@/, '');
}
