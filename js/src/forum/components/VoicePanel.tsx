import app from 'flarum/forum/app';
import voiceSession from '../voiceSession';
import SocialState from '../SocialState';
import { Avatar } from '../utils';

export default class VoicePanel {
  expanded = false;

  pingSummary(): any {
    const values = voiceSession.latencyHistory
      .map((point) => point.ms)
      .filter((ms) => Number.isFinite(ms));

    const current = voiceSession.latencyMs ?? (values.length ? values[values.length - 1] : null);

    if (!values.length || current === null) {
      return { current, min: null, max: null, avg: null };
    }

    return {
      current,
      min: Math.round(Math.min(...values)),
      max: Math.round(Math.max(...values)),
      avg: Math.round(values.reduce((total, ms) => total + ms, 0) / values.length),
    };
  }

  pingColor(ms: number | null): string {
    if (ms === null) return '#8b98a5';
    if (ms <= 80) return '#23a55a';
    if (ms <= 150) return '#f0b232';

    return '#ed4245';
  }

  pingGraph(summary: any): any {
    const history = voiceSession.latencyHistory.filter((point) => Number.isFinite(point.ms));

    if (!history.length) {
      return m('div', { className: 'SocialVoicePanel-graphEmpty' }, app.translator.trans('cengizkemec-social.forum.voice.ping_waiting'));
    }

    const width = 600;
    const height = 84;
    const padX = 8;
    const padTop = 8;
    const padBottom = 10;
    const values = history.map((point) => point.ms);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = Math.max(8, (maximum - minimum) * 0.2);
    const low = Math.max(0, minimum - padding);
    const high = Math.max(maximum + padding, low + 20);
    const span = high - low;
    const xFor = (index: number) => padX + (width - padX * 2) * (values.length <= 1 ? 1 : index / (values.length - 1));
    const yFor = (ms: number) => padTop + (height - padTop - padBottom) * (1 - (ms - low) / span);
    const points = values.map((ms, index) => [xFor(index), yFor(ms)]);
    const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const last = points[points.length - 1];
    const area = `${line} L${last[0].toFixed(1)},${(height - padBottom).toFixed(1)} L${points[0][0].toFixed(1)},${(height - padBottom).toFixed(1)} Z`;
    const color = this.pingColor(summary.current);

    return m('svg', {
      className: 'SocialVoicePanel-graphSvg',
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': app.translator.trans('cengizkemec-social.forum.voice.ping_graph'),
    }, [
      m('defs', m('linearGradient', { id: 'socialVoicePingFill', x1: '0', y1: '0', x2: '0', y2: '1' }, [
        m('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.32' }),
        m('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }),
      ])),
      [0.25, 0.5, 0.75].map((ratio) => m('line', {
        className: 'SocialVoicePanel-graphGrid',
        x1: padX,
        x2: width - padX,
        y1: padTop + (height - padTop - padBottom) * ratio,
        y2: padTop + (height - padTop - padBottom) * ratio,
      })),
      m('path', { className: 'SocialVoicePanel-graphArea', d: area, fill: 'url(#socialVoicePingFill)' }),
      m('path', { className: 'SocialVoicePanel-graphLine', d: line, fill: 'none', stroke: color }),
      m('circle', { className: 'SocialVoicePanel-graphDot', cx: last[0], cy: last[1], r: 2.4, fill: color }),
    ]);
  }

  view(): any {
    const voice = voiceSession;

    if (!voice.connected && !voice.connecting && !voice.error) return null;

    const config = SocialState.config.voice || {};
    const prefs = voice.preferences();
    const ping = this.pingSummary();
    const quality = ['excellent', 'good', 'poor'].includes(voice.connectionQuality) ? voice.connectionQuality : 'unknown';
    const roomHref = voice.roomInfo
      ? app.route('social.room', { slug: voice.roomInfo.slug || voice.roomInfo.id }) + '?voice=1'
      : null;

    return m('div', { className: 'SocialVoicePanel' + (this.expanded ? ' is-expanded' : '') }, [
      m('div', { className: 'SocialVoicePanel-main' }, [
        m('div', { className: 'SocialVoicePanel-info' }, [
          m('span', { className: 'SocialVoicePanel-icon' }, m('i', { className: 'fas fa-headset' })),
          m('div', {}, [
            m('strong', {}, roomHref
              ? m('a', { className: 'SocialVoicePanel-room', href: roomHref }, voice.roomInfo?.name || app.translator.trans('cengizkemec-social.forum.voice.connecting'))
              : voice.roomInfo?.name || app.translator.trans('cengizkemec-social.forum.voice.connecting')),
            m('small', {}, voice.connecting
              ? app.translator.trans('cengizkemec-social.forum.voice.connecting')
              : voice.error || (voice.connected
                ? [
                    app.translator.trans('cengizkemec-social.forum.voice.connected', { count: voice.participants.length }),
                    ' · ',
                    voice.latencyMs !== null ? `${voice.latencyMs} ms` : '— ms',
                    voice.screenShares.length
                      ? [' · ', m('i', { className: 'fas fa-display' }), ' ', voice.screenShares.length]
                      : null,
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
                  m('span', {}, [m('small', {}, app.translator.trans('cengizkemec-social.forum.voice.quality')), m('strong', {}, app.translator.trans(`cengizkemec-social.forum.voice.qualities.${quality}`))]),
                  m('span', {}, [m('small', {}, app.translator.trans('cengizkemec-social.forum.voice.connected_for')), m('strong', {}, voice.connectedDuration())]),
                  m('span', {}, [m('small', {}, app.translator.trans('cengizkemec-social.forum.voice.server')), m('strong', {}, voice.serverHost())]),
                ])
              : null,
            voice.connected
              ? m('div', { className: 'SocialVoicePanel-graph' }, [
                  m('div', { className: 'SocialVoicePanel-graphHead' }, [
                    m('span', {}, [
                      m('i', { className: 'fas fa-chart-line' }),
                      ' ',
                      app.translator.trans('cengizkemec-social.forum.voice.ping_graph'),
                      m('small', {}, ' · ' + app.translator.trans('cengizkemec-social.forum.voice.ping_last_5')),
                    ]),
                    m('strong', { style: { color: this.pingColor(ping.current) } }, ping.current !== null ? `${ping.current} ms` : '— ms'),
                  ]),
                  this.pingGraph(ping),
                  ping.min !== null
                    ? m('div', { className: 'SocialVoicePanel-graphLegend' }, [
                        m('span', {}, `${app.translator.trans('cengizkemec-social.forum.voice.ping_min')} ${ping.min} ms`),
                        m('span', {}, `${app.translator.trans('cengizkemec-social.forum.voice.ping_avg')} ${ping.avg} ms`),
                        m('span', {}, `${app.translator.trans('cengizkemec-social.forum.voice.ping_max')} ${ping.max} ms`),
                      ])
                    : null,
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
