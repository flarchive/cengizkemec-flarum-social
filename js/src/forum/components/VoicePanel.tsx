import app from 'flarum/forum/app';
import voiceSession from '../voiceSession';
import SocialState from '../SocialState';
import { Avatar } from '../utils';

export default class VoicePanel {
  expanded = false;

  view(): any {
    const voice = voiceSession;

    if (!voice.connected && !voice.connecting && !voice.error) return null;

    const config = SocialState.config.voice || {};
    const prefs = voice.preferences();

    return m('div', { className: 'SocialVoicePanel' + (this.expanded ? ' is-expanded' : '') }, [
      m('div', { className: 'SocialVoicePanel-main' }, [
        m('div', { className: 'SocialVoicePanel-info' }, [
          m('span', { className: 'SocialVoicePanel-icon' }, m('i', { className: 'fas fa-headset' })),
          m('div', {}, [
            m('strong', {}, voice.roomInfo?.name || app.translator.trans('cengizkemec-social.forum.voice.connecting')),
            m('small', {}, voice.connecting
              ? app.translator.trans('cengizkemec-social.forum.voice.connecting')
              : voice.error || (voice.connected
                ? [
                    app.translator.trans('cengizkemec-social.forum.voice.connected', { count: voice.participants.length }),
                    ' · ',
                    voice.latencyMs !== null ? `${voice.latencyMs} ms` : '— ms',
                  ]
                : app.translator.trans('cengizkemec-social.forum.voice.connected', { count: voice.participants.length }))),
          ]),
        ]),
        m('div', { className: 'SocialVoicePanel-controls' }, [
          m('button', {
            className: 'SocialVoicePanel-button' + (voice.microphone ? ' is-active' : ''),
            title: app.translator.trans('cengizkemec-social.forum.voice.microphone'),
            onclick: () => voice.toggleMic(),
            disabled: voice.connecting,
          }, m('i', { className: voice.microphone ? 'fas fa-microphone' : 'fas fa-microphone-slash' })),
          prefs.pushToTalk
            ? m('button', {
                className: 'SocialVoicePanel-button SocialVoicePanel-ptt' + (voice.pttActive ? ' is-active' : ''),
                title: app.translator.trans('cengizkemec-social.forum.voice.ptt', { key: prefs.pttKey }),
                onpointerdown: (event: PointerEvent) => { event.preventDefault(); voice.pttActive = true; voice.enableMic(); },
                onpointerup: () => { voice.pttActive = false; voice.disableMic(); },
                onpointerleave: () => { if (voice.pttActive) { voice.pttActive = false; voice.disableMic(); } },
              }, m('i', { className: 'fas fa-tower-broadcast' }))
            : null,
          m('button', {
            className: 'SocialVoicePanel-button' + (voice.deafened ? ' is-active' : ''),
            title: app.translator.trans('cengizkemec-social.forum.voice.deafen'),
            onclick: () => voice.toggleDeafen(),
          }, m('i', { className: voice.deafened ? 'fas fa-volume-xmark' : 'fas fa-volume-high' })),
          config.screenSharing
            ? m('button', {
                className: 'SocialVoicePanel-button' + (voice.screenSharing ? ' is-active' : ''),
                title: app.translator.trans('cengizkemec-social.forum.voice.screen_share'),
                onclick: () => voice.toggleScreenShare(),
              }, m('i', { className: 'fas fa-display' }))
            : null,
          m('button', {
            className: 'SocialVoicePanel-button' + (this.expanded ? ' is-active' : ''),
            title: app.translator.trans('cengizkemec-social.forum.voice.connection_info'),
            onclick: () => (this.expanded = !this.expanded),
          }, m('i', { className: 'fas fa-circle-info' })),
          m('button', {
            className: 'SocialVoicePanel-button SocialVoicePanel-expand',
            title: app.translator.trans('cengizkemec-social.forum.voice.participants'),
            onclick: () => (this.expanded = !this.expanded),
          }, m('i', { className: this.expanded ? 'fas fa-chevron-down' : 'fas fa-chevron-up' })),
          m('button', {
            className: 'SocialVoicePanel-button SocialVoicePanel-leave',
            title: app.translator.trans('cengizkemec-social.forum.voice.leave'),
            onclick: () => voice.disconnect(),
          }, m('i', { className: 'fas fa-phone-slash' })),
        ]),
      ]),
      this.expanded
        ? m('div', { className: 'SocialVoicePanel-details' }, [
            voice.error ? m('div', { className: 'SocialVoicePanel-error' }, voice.error) : null,
            voice.connected
              ? m('div', { className: 'SocialVoicePanel-stats' }, [
                  m('span', {}, [m('small', {}, app.translator.trans('cengizkemec-social.forum.voice.ping')), m('strong', {}, voice.latencyMs !== null ? `${voice.latencyMs} ms` : '— ms')]),
                  m('span', {}, [m('small', {}, app.translator.trans('cengizkemec-social.forum.voice.quality')), m('strong', {}, app.translator.trans(`cengizkemec-social.forum.voice.qualities.${voice.connectionQuality}`))]),
                  m('span', {}, [m('small', {}, app.translator.trans('cengizkemec-social.forum.voice.connected_for')), m('strong', {}, voice.connectedDuration())]),
                  m('span', {}, [m('small', {}, app.translator.trans('cengizkemec-social.forum.voice.server')), m('strong', {}, voice.serverHost())]),
                ])
              : null,
            m('button', { className: 'Button Button--link SocialVoicePanel-settings', onclick: () => app.modal.show(() => import('./VoiceSettingsModal')) }, [
              m('i', { className: 'fas fa-sliders' }),
              ' ',
              app.translator.trans('cengizkemec-social.forum.voice.settings_title'),
            ]),
            voice.participants.map((participant: any) =>
              m('div', { className: 'SocialVoicePanel-participant' }, [
                m('span', { className: 'SocialVoicePanel-participant-avatar' }, Avatar({ displayName: participant.name, avatarUrl: participant.avatarUrl, username: participant.username }, 28)),
                m('span', { className: 'SocialVoicePanel-participant-name' }, participant.name, participant.local ? ' (' + app.translator.trans('cengizkemec-social.forum.voice.you') + ')' : ''),
                participant.muted ? m('i', { className: 'fas fa-microphone-slash' }) : m('i', { className: 'fas fa-microphone' }),
                participant.local
                  ? null
                  : m('input', {
                      type: 'range',
                      min: 0,
                      max: 100,
                      value: participant.volume,
                      title: app.translator.trans('cengizkemec-social.forum.voice.volume'),
                      oninput: (event: Event) => voice.setVolume(participant.identity, Number((event.target as HTMLInputElement).value)),
                    }),
              ])
            ),
          ])
        : null,
    ]);
  }
}
