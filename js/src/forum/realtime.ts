import app from 'flarum/forum/app';
import SocialState from './SocialState';
import { post } from '../common/api';

export function subscribeRealtime(channel: string, callback: (data: any) => void): () => void {
  if (!SocialState.config.realtime?.enabled) return () => {};

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
