import app from 'flarum/forum/app';
import SocialState from '../SocialState';
import voiceSession from '../voiceSession';
import { Avatar } from '../utils';

export default class VoiceStage {
  view(vnode: any): any {
    const room = vnode.attrs.room;
    const voice = voiceSession;
    const connectedHere = voice.connected && voice.roomInfo?.id === room.id;
    const connectingHere = voice.connecting && voice.roomInfo?.id === room.id;

    if (!connectedHere) {
      return m('div', { className: 'SocialVoiceStage SocialVoiceStage--join' }, [
        m('div', { className: 'SocialVoiceStage-art' + (connectingHere ? ' is-connecting' : '') }, [
          m('span', { className: 'SocialVoiceStage-halo' }),
          m('span', { className: 'SocialVoiceStage-icon' }, m('i', { className: connectingHere ? 'fas fa-spinner fa-spin' : room.icon || 'fas fa-headset' })),
        ]),
        m('h2', {}, room.name),
        m('p', {}, connectingHere ? app.translator.trans('cengizkemec-social.forum.voice.connecting') : room.description || app.translator.trans('cengizkemec-social.forum.voice.join_text')),
        m('div', { className: 'SocialVoiceStage-meta' }, [
          m('span', {}, [m('i', { className: 'fas fa-user-group' }), ' ', room.participantCount || 0, ' / ', room.capacity]),
          room.isLocked ? m('span', { className: 'SocialBadge' }, app.translator.trans('cengizkemec-social.forum.rooms.locked')) : null,
          room.visibility !== 'public' ? m('span', { className: 'SocialBadge' }, app.translator.trans(`cengizkemec-social.forum.post.visibility.${room.visibility}`)) : null,
        ]),
        SocialState.user
          ? m('button', {
              className: 'Button Button--primary SocialVoiceStage-join',
              loading: connectingHere,
              disabled: connectingHere || !room.canJoin || room.isLocked,
              onclick: () => vnode.attrs.onjoin?.(),
            }, [m('i', { className: 'fas fa-headset' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.join')])
          : m('button', {
              className: 'Button Button--primary SocialVoiceStage-join',
              onclick: () => app.modal.show(() => import('flarum/forum/components/LogInModal')),
            }, [m('i', { className: 'fas fa-right-to-bracket' }), ' ', app.translator.trans('cengizkemec-social.forum.auth.login_to_join')]),
        voice.error ? m('div', { className: 'SocialVoiceStage-error' }, voice.error) : null,
      ]);
    }

    return m('div', { className: 'SocialVoiceStage' }, [
      m('div', { className: 'SocialVoiceStage-head' }, [
        m('span', { className: 'SocialVoiceStage-live' }, m('i', { className: 'fas fa-signal' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.live')),
        m('span', {}, voice.connectionState === 'reconnecting' ? app.translator.trans('cengizkemec-social.forum.voice.reconnecting') : app.translator.trans('cengizkemec-social.forum.voice.connected', { count: voice.participants.length })),
        m('button', { className: 'Button Button--link', onclick: () => voice.disconnect() }, app.translator.trans('cengizkemec-social.forum.voice.leave')),
      ]),
      voice.screenShares.length
        ? m('div', { className: 'SocialScreenShares' }, voice.screenShares.map((share: any) =>
            m('div', { className: 'SocialScreenShare' }, [
              m('video', {
                oncreate: (v: any) => {
                  try { share.track.attach(v.dom); } catch (e) {}
                },
                onremove: () => {
                  try { share.track.detach(); } catch (e) {}
                },
                onclick: (event: MouseEvent) => {
                  const video = event.currentTarget as HTMLVideoElement;
                  video.requestFullscreen?.().catch(() => {});
                },
                autoplay: true,
                playsinline: true,
                muted: true,
                title: app.translator.trans('cengizkemec-social.forum.voice.screen_fullscreen'),
              }),
              m('span', { className: 'SocialScreenShare-label' }, [
                share.participant.name,
                share.local ? ' · ' + app.translator.trans('cengizkemec-social.forum.voice.you') : '',
              ]),
            ])
          ))
        : null,
      m('div', { className: 'SocialVoiceGrid' }, voice.participants.map((participant: any) =>
        m('div', { className: 'SocialVoiceTile' + (participant.speaking ? ' is-speaking' : '') + (participant.local ? ' is-local' : '') }, [
          m('div', { className: 'SocialVoiceTile-avatar' }, [
            Avatar({ displayName: participant.name, username: participant.username, avatarUrl: participant.avatarUrl }, 72),
            participant.speaking ? m('span', { className: 'SocialVoiceTile-speaking' }) : null,
          ]),
          m('div', { className: 'SocialVoiceTile-name' }, participant.name, participant.local ? ' · ' + app.translator.trans('cengizkemec-social.forum.voice.you') : ''),
          m('div', { className: 'SocialVoiceTile-state' }, participant.muted ? m('i', { className: 'fas fa-microphone-slash' }) : m('i', { className: 'fas fa-microphone' })),
        ])
      )),
      !voice.participants.length ? m('div', { className: 'SocialVoiceStage-empty' }, app.translator.trans('cengizkemec-social.forum.voice.waiting')) : null,
      m('div', { className: 'SocialVoiceStage-actions' }, [
        m('button', { className: 'Button' + (voice.microphone ? ' Button--primary' : ''), onclick: () => voice.toggleMic() }, [m('i', { className: voice.microphone ? 'fas fa-microphone' : 'fas fa-microphone-slash' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.microphone')]),
        m('button', { className: 'Button', onclick: () => voice.toggleDeafen() }, [m('i', { className: voice.deafened ? 'fas fa-volume-xmark' : 'fas fa-volume-high' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.deafen')]),
        SocialState.config.voice?.screenSharing ? m('button', { className: 'Button' + (voice.screenSharing ? ' Button--primary' : ''), onclick: () => voice.toggleScreenShare() }, [m('i', { className: 'fas fa-display' }), ' ', app.translator.trans('cengizkemec-social.forum.voice.screen_share')]) : null,
      ]),
    ]);
  }
}
