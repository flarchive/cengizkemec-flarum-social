import app from 'flarum/forum/app';
import SocialState from './SocialState';
import { post } from '../common/api';

type PusherEntry = {
  channel: any;
  callbacks: Set<(data: any) => void>;
};

const pusherChannels = new Map<string, PusherEntry>();
const sharedSockets = new WeakSet<object>();
const SOCIAL_AUTH_PATH = '/social/realtime/auth';
const IDLE_DISCONNECT_MS = 15000;

let pusher: any = null;
let pusherLoading: Promise<any> | null = null;
let ownsPusher = false;
let idleTimer: number | null = null;

function realtimeConfig(): any {
  return SocialState.config.realtime || {};
}

function apiUrl(): string {
  return app.forum.attribute<string>('apiUrl');
}

function mapPusherChannel(channel: string): string {
  return 'private-'.concat(channel.replace(/:/g, '-'));
}

function sameConfigValue(a: any, b: any): boolean {
  return String(a ?? '') === String(b ?? '');
}

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function canShareFlarumPusher(config: any): boolean {
  const shared = (app as any).pusher;

  if (!shared || typeof shared.then !== 'function' || !app.forum) return false;

  return (
    sameConfigValue(app.forum.attribute('pusherKey'), config.pusherKey) &&
    sameConfigValue(app.forum.attribute('pusherCluster'), config.pusherCluster) &&
    sameConfigValue(app.forum.attribute('pusherHostname'), config.pusherHost)
  );
}

/**
 * Flarum's Pusher socket signs `private-user*` channels through /api/pusher/auth.
 * Social channels must use Social's own permission checks, so route only
 * `private-social-*` authorizations to Social while leaving Flarum's channels
 * on the original authorizer.
 */
function installSharedAuthorizer(socket: any): void {
  if (!socket || sharedSockets.has(socket) || !socket.config) return;

  const original = socket.config.channelAuthorizer;

  if (typeof original !== 'function') return;

  sharedSockets.add(socket);

  socket.config.channelAuthorizer = (params: any, callback: any) => {
    const name = String(params?.channelName || '');

    if (name.startsWith('private-social-')) {
      authorizeSocialChannel(params, callback);
      return;
    }

    original(params, callback);
  };
}

function authorizeSocialChannel(params: any, callback: any): void {
  let finished = false;

  const done = (error: any, data?: any) => {
    if (finished) return;
    finished = true;
    callback(error, data);
  };

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiUrl()}${SOCIAL_AUTH_PATH}`, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

    if (app.session.csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', app.session.csrfToken);
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          done(null, JSON.parse(xhr.responseText));
        } catch (error) {
          done(error);
        }
      } else {
        done(new Error(`Social realtime auth failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => done(new Error('Social realtime auth failed'));
    xhr.send(`socket_id=${encodeURIComponent(params.socketId || '')}&channel_name=${encodeURIComponent(params.channelName || '')}`);
  } catch (error) {
    done(error);
  }
}

function createOwnPusher(config: any): Promise<any> {
  pusherLoading = import('pusher-js')
    .then((module: any) => {
      const Pusher = module.default || module.Pusher || module;
      const options: any = {
        cluster: config.pusherCluster,
        forceTLS: true,
        authEndpoint: `${apiUrl()}${SOCIAL_AUTH_PATH}`,
        auth: {
          headers: {
            'X-CSRF-Token': app.session.csrfToken,
          },
        },
      };

      if (config.pusherHost) {
        options.wsHost = config.pusherHost;
        options.httpHost = config.pusherHost;
      }

      pusher = new Pusher(config.pusherKey, options);
      ownsPusher = true;

      return pusher;
    })
    .catch((error) => {
      pusherLoading = null;
      throw error;
    });

  return pusherLoading;
}

function getPusher(config: any): Promise<any> {
  if (pusher) return Promise.resolve(pusher);
  if (pusherLoading) return pusherLoading;

  if (canShareFlarumPusher(config)) {
    pusherLoading = Promise.resolve((app as any).pusher)
      .then((binding: any) => {
        const socket = binding?.pusher || binding;

        if (!socket || typeof socket.subscribe !== 'function') {
          throw new Error('Flarum Pusher socket unavailable');
        }

        pusher = socket;
        ownsPusher = false;
        installSharedAuthorizer(socket);

        return socket;
      })
      .catch(() => createOwnPusher(config));

    return pusherLoading;
  }

  return createOwnPusher(config);
}

function scheduleIdleDisconnect(): void {
  // Flarum owns the shared socket, so only close the socket Social created.
  if (!ownsPusher) return;

  clearIdleTimer();

  idleTimer = window.setTimeout(() => {
    idleTimer = null;

    if (pusherChannels.size > 0 || !ownsPusher) return;

    try {
      pusher?.disconnect();
    } catch (e) {
      // no-op
    }

    pusher = null;
    pusherLoading = null;
    ownsPusher = false;
  }, IDLE_DISCONNECT_MS);
}

function subscribePusher(channel: string, callback: (data: any) => void, config: any): () => void {
  let cancelled = false;
  let subscribedName: string | null = null;
  const mapped = mapPusherChannel(channel);

  getPusher(config)
    .then((client) => {
      if (cancelled) return;

      clearIdleTimer();

      let entry = pusherChannels.get(mapped);

      if (!entry) {
        const pusherChannel = client.subscribe(mapped);
        entry = { channel: pusherChannel, callbacks: new Set() };

        pusherChannel.bind('social', (data: any) => {
          entry?.callbacks.forEach((cb) => cb(data));
        });

        pusherChannels.set(mapped, entry);
      }

      entry.callbacks.add(callback);
      subscribedName = mapped;
    })
    .catch(() => {
      // Polling fallback remains active when Pusher cannot connect.
    });

  return () => {
    cancelled = true;

    if (!subscribedName) return;

    const entry = pusherChannels.get(subscribedName);
    if (!entry) return;

    entry.callbacks.delete(callback);

    if (!entry.callbacks.size) {
      try {
        pusher?.unsubscribe(subscribedName);
      } catch (e) {
        // no-op
      }

      pusherChannels.delete(subscribedName);
      scheduleIdleDisconnect();
    }
  };
}

function subscribeCentrifugo(channel: string, callback: (data: any) => void): () => void {
  if (!realtimeConfig().enabled) return () => {};

  let centrifuge: any = null;
  let cancelled = false;

  post('/social/realtime/token', { channel })
    .then(async (response: any) => {
      if (cancelled) return;

      const { Centrifuge } = await import('centrifuge');
      const tokens = response.data;

      centrifuge = new Centrifuge(tokens.url, { token: tokens.token });
      const subscription = centrifuge.newSubscription(tokens.channel, { token: tokens.subscriptionToken });
      subscription.on('publication', (context: any) => callback(context.data));
      subscription.subscribe();
      centrifuge.connect();
    })
    .catch(() => {
      // Polling fallback is handled by the component.
    });

  return () => {
    cancelled = true;

    try {
      centrifuge?.disconnect();
    } catch (e) {
      // no-op
    }
  };
}

export function subscribeRealtime(channel: string, callback: (data: any) => void): () => void {
  const config = realtimeConfig();

  if (!config.enabled) return () => {};

  if (config.driver === 'pusher') {
    return subscribePusher(channel, callback, config);
  }

  return subscribeCentrifugo(channel, callback);
}

export function disconnectRealtime(): void {
  clearIdleTimer();

  pusherChannels.forEach((_entry, channel) => {
    try {
      pusher?.unsubscribe(channel);
    } catch (e) {
      // no-op
    }
  });

  pusherChannels.clear();

  // Never disconnect Flarum's shared socket; Flarum owns its lifecycle.
  if (ownsPusher) {
    try {
      pusher?.disconnect();
    } catch (e) {
      // no-op
    }
  }

  pusher = null;
  pusherLoading = null;
  ownsPusher = false;
}
