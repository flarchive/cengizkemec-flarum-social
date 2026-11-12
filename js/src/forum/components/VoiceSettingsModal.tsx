import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import SocialState from '../SocialState';
import voiceSession from '../voiceSession';
import { patch } from '../../common/api';
import { handleApiError } from '../utils';

export default class VoiceSettingsModal extends Modal {
  form: any = {};
  saving = false;
  capturing = false;

  oninit(vnode: any): void {
    super.oninit(vnode);

    const personal = SocialState.user?.voiceSettings || {};
    const config = SocialState.config.voice || {};

    this.form = {
      pushToTalk: personal.pushToTalk ?? config.pushToTalk !== false,
      pttKey: personal.pttKey || config.pttKey || 'AltLeft',
      sounds: personal.sounds ?? config.sounds !== false,
      defaultMuted: personal.defaultMuted ?? config.defaultMuted !== false,
      noiseSuppression: personal.noiseSuppression ?? config.noiseSuppression !== false,
      echoCancellation: personal.echoCancellation ?? config.echoCancellation !== false,
      autoGainControl: personal.autoGainControl ?? config.autoGainControl !== false,
    };
  }

  className(): string {
    return 'Modal--small SocialVoiceSettings';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.voice.settings_title') as string;
  }

  keyLabel(code: string): string {
    if (code === 'AltLeft') return 'Left Alt';
    if (code === 'AltRight') return 'Right Alt';
    if (code === 'ControlLeft') return 'Left Ctrl';
    if (code === 'ControlRight') return 'Right Ctrl';
    if (code === 'ShiftLeft') return 'Left Shift';
    if (code === 'ShiftRight') return 'Right Shift';
    if (code === 'Space') return 'Space';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);

    return code;
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;

    patch('/social/me/profile', { voice_settings: this.form })
      .then((response: any) => {
        const settings = response?.data?.voiceSettings || this.form;

        if (SocialState.user) SocialState.user.voiceSettings = settings;
        if (SocialState.data?.user) SocialState.data.user.voiceSettings = settings;

        voiceSession.applyUserPreferences();
        app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.voice.settings_saved') as string);
        this.hide();
      })
      .catch(handleApiError)
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }

  content(): any {
    const toggle = (key: string, label: any, help?: any) =>
      m('label', { className: 'SocialVoiceSettings-toggle' }, [
        m('input', {
          type: 'checkbox',
          checked: Boolean(this.form[key]),
          onchange: (event: Event) => (this.form[key] = (event.target as HTMLInputElement).checked),
        }),
        m('span', {}, [m('strong', {}, label), help ? m('small', {}, help) : null]),
      ]);

    return m('div', { className: 'Modal-body SocialVoiceSettings-body' }, [
      m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.forum.voice.settings_help')),
      toggle('pushToTalk', app.translator.trans('cengizkemec-social.forum.voice.ptt_enabled')),
      this.form.pushToTalk
        ? m('div', { className: 'SocialVoiceSettings-key' }, [
            m('span', {}, app.translator.trans('cengizkemec-social.forum.voice.ptt_key')),
            m(
              'button',
              {
                type: 'button',
                className: 'Button SocialVoiceSettings-keyButton' + (this.capturing ? ' is-capturing' : ''),
                onclick: () => {
                  this.capturing = true;
                  m.redraw();
                },
                onkeydown: (event: KeyboardEvent) => {
                  if (!this.capturing) return;
                  event.preventDefault();
                  event.stopPropagation();

                  if (event.code === 'Escape') {
                    this.capturing = false;
                    m.redraw();
                    return;
                  }

                  this.form.pttKey = event.code;
                  this.capturing = false;
                  m.redraw();
                },
                onblur: () => {
                  this.capturing = false;
                },
              },
              this.capturing ? app.translator.trans('cengizkemec-social.forum.voice.press_key') : this.keyLabel(this.form.pttKey)
            ),
          ])
        : null,
      toggle('sounds', app.translator.trans('cengizkemec-social.forum.voice.sounds'), app.translator.trans('cengizkemec-social.forum.voice.sounds_help')),
      toggle('defaultMuted', app.translator.trans('cengizkemec-social.forum.voice.default_muted')),
      toggle('noiseSuppression', app.translator.trans('cengizkemec-social.forum.voice.noise_suppression')),
      toggle('echoCancellation', app.translator.trans('cengizkemec-social.forum.voice.echo_cancellation')),
      toggle('autoGainControl', app.translator.trans('cengizkemec-social.forum.voice.auto_gain')),
      m('div', { className: 'SocialVoiceSettings-actions' }, [
        m(Button, { className: 'Button Button--primary Button--block', onclick: () => this.save(), loading: this.saving }, app.translator.trans('cengizkemec-social.forum.voice.save_settings')),
      ]),
    ]);
  }
}
