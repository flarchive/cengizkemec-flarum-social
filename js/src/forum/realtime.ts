import app from 'flarum/forum/app';
import SocialState from './SocialState';

type RealtimeEntry = {
  logical: string;
  callbacks: Set<(data: any) => void>;
  channel: any | null;
};

type Driver = 'flarum' | 'pusher';

const entries = new Map<string, RealtimeEntry>();
const authorizedSockets = new WeakSet<object>();
const SOCIAL_AUTH_PATH = '/social/websocket/auth';
const SOCKET_CHECK_MS = 2000;
const AUTH_RETRY_MS = 8000;

let socket: any = null;
let sharedPusherSocket: any = null;
let ownPusher: any = null;
let ownPusherLoading: Promise<any | null> | null = null;
let ownsPusher = false;
let connecting = false;
let pusherWaitSince: number | null = null;
let socketTimer: number | null = null;
const retryTimers = new Map<string, number>();

function realtimeConfig(): any {
  return SocialState.config.realtime || {};
}

function enabled(): boolean {
  return Boolean(realtimeConfig().enabled);
}

function driver(): Driver {
  return realtimeConfig().driver === 'pusher' ? 'pusher' : 'flarum';
}

function apiUrl(): string {
  return app.forum.attribute<string>('apiUrl');
}

function mapChannel(channel: string): string {
  return 'private-'.concat(channel.replace(/:/g, '-'));
}

function flarumSocket(): any | null {
  const candidate = (app as any).websocket;

  return candidate && typeof candidate.subscribe === 'function' ? candidate : null;
}

function sameConfigValue(a: any, b: any): boolean {
  return String(a ?? '') === String(b ?? '');
}

function canShareFlarumPusher(config: any): boolean {
  if (!app.forum) return false;

  return (
    sameConfigValue(app.forum.attribute('pusherKey'), config.pusherKey) &&
    sameConfigValue(app.forum.attribute('pusherCluster'), config.pusherCluster) &&
    sameConfigValue(app.forum.attribute('pusherHostname'), config.pusherHost)
  );
}

function directPusherSocket(): any | null {
  const binding = (app as any).pusher;

  if (!binding || typeof binding.then === 'function') return null;

  const candidate = binding?.pusher || binding;

  return candidate && typeof candidate.subscribe === 'function' ? candidate : null;
}

/**
 * Flarum's own sockets sign Flarum channels through their extension auth
 * endpoint. Social channels need Social's permission checks, so route only
 * `private-social-*` authorizations to Social and leave every other channel
 * on the original authorizer.
 */
function installAuthorizer(target: any): void {
  if (!target || authorizedSockets.has(target)) return;

  const config = target.config;

  if (!config || typeof config.channelAuthorizer !== 'function') return;

  const original = config.channelAuthorizer;

  authorizedSockets.add(target);

  config.channelAuthorizer = (params: any, callback: any) => {
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
    xhr.setRequestHeader('Accept', 'application/json');

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
        done(new Error(`Social websocket auth failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => done(new Error('Social websocket auth failed'));
    xhr.send(`socket_id=${encodeURIComponent(params.socketId || '')}&channel_name=${encodeURIComponent(params.channelName || '')}`);
  } catch (error) {
    done(error);
  }
}

function createOwnPusher(): Promise<any | null> {
  if (ownPusher) return Promise.resolve(ownPusher);
  if (ownPusherLoading) return ownPusherLoading;

  const config = realtimeConfig();

  if (!config.pusherKey) return Promise.resolve(null);

  ownPusherLoading = import('pusher-js')
    .then((module: any) => {
      const Pusher = module.default || module.Pusher || module;
      const options: any = {
        cluster: config.pusherCluster || 'mt1',
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

      ownPusher = new Pusher(config.pusherKey, options);
      ownsPusher = true;

      return ownPusher;
    })
    .catch(() => null)
    .finally(() => {
      ownPusherLoading = null;
    });

  return ownPusherLoading;
}

async function resolveSocket(): Promise<any | null> {
  if (driver() === 'pusher') {
    const config = realtimeConfig();

    if (!canShareFlarumPusher(config)) {
      return createOwnPusher();
    }

    const direct = directPusherSocket();

    if (direct) {
      pusherWaitSince = null;

      return direct;
    }

    const binding = (app as any).pusher;

    if (binding && typeof binding.then === 'function') {
      try {
        const resolved = await binding;
        const candidate = resolved?.pusher || resolved;

        if (candidate && typeof candidate.subscribe === 'function') {
          sharedPusherSocket = candidate;
          pusherWaitSince = null;

          return candidate;
        }
      } catch (e) {
        // Fall through to Social's own Pusher connection.
      }
    }

    // flarum/pusher creates its socket in Application.mount, which can run
    // just after Social's first component mounts. Wait briefly so Social can
    // share that socket instead of opening a second connection.
    pusherWaitSince ??= Date.now();

    if (Date.now() - pusherWaitSince < 10000) {
      return null;
    }

    return createOwnPusher();
  }

  return flarumSocket();
}

function clearRetry(logical: string): void {
  const timer = retryTimers.get(logical);

  if (timer !== undefined) {
    window.clearTimeout(timer);
    retryTimers.delete(logical);
  }
}

function scheduleRetry(entry: RealtimeEntry): void {
  clearRetry(entry.logical);

  retryTimers.set(
    entry.logical,
    window.setTimeout(() => {
      retryTimers.delete(entry.logical);

      if (entries.has(entry.logical) && socket) {
        subscribeOnSocket(entry);
      }
    }, AUTH_RETRY_MS)
  );
}

function subscribeOnSocket(entry: RealtimeEntry): void {
  if (!socket || entry.channel) return;

  const mapped = mapChannel(entry.logical);

  try {
    const channel = socket.subscribe(mapped);
    entry.channel = channel;

    channel.bind('social', (data: any) => {
      entry.callbacks.forEach((callback) => callback(data));
    });

    channel.bind('pusher:subscription_error', () => {
      entry.channel = null;
      clearRetry(entry.logical);

      try {
        socket?.unsubscribe(mapped);
      } catch (e) {
        // no-op
      }

      scheduleRetry(entry);
    });
  } catch (error) {
    entry.channel = null;
    scheduleRetry(entry);
  }
}

function attach(target: any): void {
  if (!target || !entries.size) return;

  if (socket !== target) {
    entries.forEach((entry) => {
      if (entry.channel && socket) {
        try {
          socket.unsubscribe(mapChannel(entry.logical));
        } catch (e) {
          // no-op
        }
      }

      entry.channel = null;
    });

    if (ownsPusher && socket && socket !== target) {
      try {
        socket.disconnect();
      } catch (e) {
        // no-op
      }

      ownPusher = null;
      ownsPusher = false;
    }

    socket = target;
  }

  installAuthorizer(target);
  entries.forEach((entry) => subscribeOnSocket(entry));
  ensureSocketWatcher();
}

async function connect(): Promise<void> {
  if (connecting) return;

  connecting = true;

  try {
    const target = await resolveSocket();

    if (target) attach(target);
  } finally {
    connecting = false;
  }
}

function checkSocket(): void {
  if (!entries.size) {
    stopSocketWatcher();
    return;
  }

  if (driver() === 'pusher') {
    if (!canShareFlarumPusher(realtimeConfig())) {
      if (!socket) connect();

      return;
    }

    const direct = directPusherSocket();

    if (direct && direct !== socket) {
      connect();
      return;
    }

    if (sharedPusherSocket && sharedPusherSocket !== socket) {
      connect();
      return;
    }

    if (!socket) connect();

    return;
  }

  const target = flarumSocket();

  if (target && target !== socket) {
    connect();
  } else if (!socket) {
    connect();
  }
}

function ensureSocketWatcher(): void {
  if (socketTimer !== null || typeof window === 'undefined') return;

  socketTimer = window.setInterval(checkSocket, SOCKET_CHECK_MS);
}

function stopSocketWatcher(): void {
  if (socketTimer !== null) {
    window.clearInterval(socketTimer);
    socketTimer = null;
  }
}

function unsubscribe(entry: RealtimeEntry): void {
  const mapped = mapChannel(entry.logical);

  clearRetry(entry.logical);

  if (!entry.channel) return;

  try {
    socket?.unsubscribe(mapped);
  } catch (e) {
    // no-op
  }

  entry.channel = null;
}

/**
 * Subscribe a component to one of Social's logical channels.
 *
 * The default transport is Flarum's bundled realtime extension and its shared
 * websocket. With `realtime_driver = pusher`, Social reuses the existing
 * flarum/pusher socket when possible. When neither is available this is a
 * no-op and components keep using their polling fallback.
 */
export function subscribeRealtime(channel: string, callback: (data: any) => void): () => void {
  if (!enabled()) return () => {};

  let entry = entries.get(channel);

  if (!entry) {
    entry = { logical: channel, callbacks: new Set(), channel: null };
    entries.set(channel, entry);
  }

  entry.callbacks.add(callback);
  connect();
  ensureSocketWatcher();

  return () => {
    const active = entries.get(channel);

    if (!active) return;

    active.callbacks.delete(callback);

    if (!active.callbacks.size) {
      unsubscribe(active);
      entries.delete(channel);
    }

    if (!entries.size) {
      stopSocketWatcher();
      socket = null;
      sharedPusherSocket = null;

      if (ownsPusher && ownPusher) {
        try {
          ownPusher.disconnect();
        } catch (e) {
          // no-op
        }
      }

      ownPusher = null;
      ownsPusher = false;
      pusherWaitSince = null;
    }
  };
}

/**
 * Whether Social currently has a live socket. Components use this to skip
 * their periodic refresh while realtime is healthy, and to keep a safety net
 * while it is connecting or reconnecting.
 */
export function isRealtimeConnected(): boolean {
  return Boolean(entries.size && socket && socket.connection && socket.connection.state === 'connected');
}

export function disconnectRealtime(): void {
  entries.forEach(unsubscribe);
  entries.clear();
  retryTimers.forEach((timer) => window.clearTimeout(timer));
  retryTimers.clear();
  stopSocketWatcher();

  if (ownsPusher && ownPusher) {
    try {
      ownPusher.disconnect();
    } catch (e) {
      // no-op
    }
  }

  socket = null;
  sharedPusherSocket = null;
  ownPusher = null;
  ownPusherLoading = null;
  ownsPusher = false;
  pusherWaitSince = null;
}
