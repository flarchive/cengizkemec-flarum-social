import app from 'flarum/forum/app';
import SocialState from './SocialState';
import { post } from '../common/api';

let pusher: any = null;
let pusherLoading: Promise<any> | null = null;

type PusherEntry = {
  channel: any;
  callbacks: Set<(data: any) => void>;
};

const pusherChannels = new Map<string, PusherEntry>();

function realtimeConfig(): any {
  return SocialState.config.realtime || {};
}

function mapPusherChannel(channel: string): string {
  return 'private-'.concat(channel.replace(/:/g, '-'));
}

function getPusher(config: any): Promise<any> {
  if (pusher) return Promise.resolve(pusher);
  if (pusherLoading) return pusherLoading;

  pusherLoading = import('pusher-js')
    .then((module: any) => {
      const Pusher = module.default || module.Pusher || module;
      const options: any = {
        cluster: config.pusherCluster,
        forceTLS: true,
        authEndpoint: `${app.forum.attribute('apiUrl')}/social/realtime/auth`,
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

      return pusher;
    })
    .catch((error) => {
      pusherLoading = null;
      throw error;
    });

  return pusherLoading;
}

function subscribePusher(channel: string, callback: (data: any) => void, config: any): () => void {
  let cancelled = false;
  let subscribedName: string | null = null;
  const mapped = mapPusherChannel(channel);

  getPusher(config)
    .then((client) => {
      if (cancelled) return;

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
  pusherChannels.forEach((_entry, channel) => {
    try {
      pusher?.unsubscribe(channel);
    } catch (e) {
      // no-op
    }
  });

  pusherChannels.clear();

  try {
    pusher?.disconnect();
  } catch (e) {
    // no-op
  }

  pusher = null;
  pusherLoading = null;
}
