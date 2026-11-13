import app from 'flarum/forum/app';
import { Room, RoomEvent, Track } from 'livekit-client';
import SocialState from './SocialState';
import sounds from './sounds';
import { get, post } from '../common/api';

class VoiceSession {
  room: Room | null = null;
  roomInfo: any = null;
  connected = false;
  connecting = false;
  error: string | null = null;
  microphone = false;
  deafened = false;
  screenSharing = false;
  pttActive = false;
  participants: any[] = [];
  screenShares: any[] = [];
  connectionState = 'disconnected';
  latencyMs: number | null = null;
  latencyHistory: { at: number; ms: number }[] = [];
  connectionQuality: string = 'unknown';
  connectedAt: number | null = null;
  statsInterval: number | null = null;
  heartbeat: number | null = null;
  audioElements = new Map<string, HTMLAudioElement>();
  keyHandler: ((event: KeyboardEvent) => void) | null = null;
  keyUpHandler: ((event: KeyboardEvent) => void) | null = null;
  announcedScreenShares = new Set<string>();
  manualMuted = false;
  backgrounded = false;
  backgroundMicForced = false;
  micBeforeBackground = false;
  backgroundListenersInstalled = false;
  afkInterval: number | null = null;
  afkLastActivity = Date.now();
  afkMoving = false;
  afkAlertId: number | null = null;
  previousRoomInfo: any = null;
  deafenedBeforeAfk = false;
  afkListenersInstalled = false;
  private onVisibilityChange = () => this.handleBackgroundChange();
  private onWindowBlur = () => this.handleBackgroundChange();
  private onWindowFocus = () => this.handleBackgroundChange();
  private onAfkActivity = () => this.markActivity();

  async connect(roomInfo: any, password = ''): Promise<void> {
    if (this.connecting) return;
    if (this.connected && this.roomInfo?.id === roomInfo.id) return;

    if (this.connected) await this.disconnect();

    this.connecting = true;
    this.error = null;
    this.roomInfo = roomInfo;
    m.redraw();

    try {
      const response: any = await post(`/social/rooms/${roomInfo.id}/join`, { voice: true, password });
      const voice = response.data?.voice;

      if (!voice?.token) throw new Error(app.translator.trans('cengizkemec-social.forum.voice.not_configured') as string);

      this.roomInfo = response.data.room || roomInfo;

      const config = SocialState.config.voice || {};
      const prefs = this.preferences();
      const roomOptions: any = {
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: prefs.echoCancellation,
          noiseSuppression: prefs.noiseSuppression,
          autoGainControl: prefs.autoGainControl,
        },
      };

      if (config.turn?.urls?.length) {
        roomOptions.rtcConfig = {
          iceServers: [
            {
              urls: config.turn.urls,
              username: config.turn.username || undefined,
              credential: config.turn.credential || undefined,
            },
          ],
        };
      }

      const room = new Room(roomOptions);

      this.registerEvents(room);
      await room.connect(voice.url, voice.token);
      await room.localParticipant.setMicrophoneEnabled(!prefs.defaultMuted);

      this.room = room;
      this.connected = true;
      this.connecting = false;
      this.connectionState = 'connected';
      this.connectedAt = Date.now();
      this.manualMuted = false;
      this.latencyHistory = [];
      this.announcedScreenShares.clear();

      try {
        await room.startAudio();
      } catch (e) {
        // Browser may require another user gesture; the persistent panel exposes one.
      }

      this.heartbeat = window.setInterval(() => {
        post(`/social/rooms/${this.roomInfo.id}/heartbeat`).catch(() => {});
      }, 5000);

      this.statsInterval = window.setInterval(() => this.refreshStats(), 5000);
      this.refreshStats();

      this.installPtt();
      this.installBackgroundListeners();
      this.installAfkMonitor();
      sounds.join();
      this.refresh();
    } catch (error: any) {
      this.connecting = false;
      this.connected = false;
      this.connectionState = 'disconnected';
      this.error = error?.message || (app.translator.trans('cengizkemec-social.forum.voice.error') as string);
      this.roomInfo = roomInfo;
      m.redraw();
    }
  }

  registerEvents(room: Room): void {
    const refresh = () => this.refresh();

    room.on(RoomEvent.ParticipantConnected, () => {
      sounds.join();
      refresh();
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      sounds.leave();
      refresh();
    });
    room.on(RoomEvent.ActiveSpeakersChanged, () => {
      if (room.localParticipant?.isSpeaking) this.markActivity();
      refresh();
    });
    room.on(RoomEvent.ConnectionQualityChanged, refresh);
    room.on(RoomEvent.LocalTrackPublished, (publication: any) => {
      if (publication?.source === Track.Source.ScreenShare) {
        this.announceScreenShare('start', publication);
      }

      refresh();
    });
    room.on(RoomEvent.LocalTrackUnpublished, (publication: any) => {
      if (publication?.source === Track.Source.ScreenShare) {
        this.announceScreenShare('stop', publication);
      }

      refresh();
    });
    room.on(RoomEvent.TrackPublished, (publication: any) => {
      if (publication.source === Track.Source.ScreenShare) {
        this.subscribeToScreenShare(publication);
      }
      refresh();
    });
    room.on(RoomEvent.DataReceived, (payload: any, participant: any, _kind?: any, topic?: string) => {
      if (topic !== 'social.screenshare' || !participant) return;

      try {
        const message = JSON.parse(new TextDecoder().decode(payload));

        if (message?.type === 'start') {
          this.handleRemoteScreenShare(participant, message);
        }
      } catch (e) {
        // Ignore malformed data packets from other clients.
      }
    });
    room.on(RoomEvent.TrackUnpublished, refresh);
    room.on(RoomEvent.TrackMuted, refresh);
    room.on(RoomEvent.TrackUnmuted, refresh);
    room.on(RoomEvent.TrackSubscribed, (track: any) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        element.autoplay = true;
        element.style.display = 'none';
        element.dataset.socialIdentity = track.sid;
        document.body.appendChild(element);
        this.audioElements.set(track.sid, element);
      }

      refresh();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
      const element = this.audioElements.get(track.sid);
      element?.remove();
      this.audioElements.delete(track.sid);
      try {
        track.detach();
      } catch (e) {}
      refresh();
    });
    room.on(RoomEvent.Disconnected, () => {
      this.connected = false;
      this.connectionState = 'disconnected';
      this.cleanup();
      m.redraw();
    });
    room.on(RoomEvent.Reconnecting, () => {
      this.connectionState = 'reconnecting';
      m.redraw();
    });
    room.on(RoomEvent.Reconnected, () => {
      this.connectionState = 'connected';
      this.latencyHistory = [];
      this.refresh();
    });
  }

  refresh(): void {
    if (!this.room) return;

    const local = this.room.localParticipant;
    const participants: any[] = [];

    if (local) {
      participants.push(this.participantData(local, true));
    }

    this.room.remoteParticipants.forEach((participant: any) => {
      participants.push(this.participantData(participant, false));
    });

    this.participants = participants;
    this.microphone = Boolean(local?.isMicrophoneEnabled);
    this.screenSharing = Boolean(local?.isScreenShareEnabled);

    const shares: any[] = [];

    local?.videoTrackPublications?.forEach((publication: any) => {
      if (publication.source === Track.Source.ScreenShare && publication.track) {
        shares.push({ participant: this.participantData(local, true), track: publication.track, local: true });
      }
    });

    this.room.remoteParticipants.forEach((participant: any) => {
      participant.videoTrackPublications?.forEach((publication: any) => {
        if (publication.source === Track.Source.ScreenShare) {
          // Ask LiveKit explicitly; some room configurations disable
          // auto-subscribe for video while audio remains subscribed.
          this.subscribeToScreenShare(publication);

          if (publication.track) {
            shares.push({ participant: this.participantData(participant, false), track: publication.track, local: false });
          }
        }
      });
    });

    this.screenShares = shares;

    if (this.deafened) {
      this.participants.forEach((participant) => this.applyVolume(participant.identity, 0));
    }

    m.redraw();
  }

  protected subscribeToScreenShare(publication: any): void {
    if (!publication || publication.isSubscribed || !publication.setSubscribed) return;

    try {
      const result = publication.setSubscribed(true);

      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    } catch (e) {
      // LiveKit may already have changed subscription state.
    }
  }

  localDisplayName(): string {
    if (!this.room) return '';

    return this.participantData(this.room.localParticipant, true).name;
  }

  protected announceScreenShare(type: 'start' | 'stop', publication: any): void {
    if (!this.room || !this.connected) return;

    const sid = String(publication?.trackSid || publication?.track?.sid || 'screen-share');

    if (type === 'start') {
      if (this.announcedScreenShares.has(sid)) return;
      this.announcedScreenShares.add(sid);
    } else {
      this.announcedScreenShares.delete(sid);
    }

    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        type,
        name: this.localDisplayName(),
        roomId: this.roomInfo?.id,
        at: Date.now(),
      }));

      this.room.localParticipant
        .publishData(payload, { reliable: true, topic: 'social.screenshare' })
        .catch(() => {});
    } catch (e) {
      // Notifications are best-effort; the video track itself already works.
    }
  }

  protected handleRemoteScreenShare(participant: any, message: any): void {
    const name = message?.name
      || this.participantData(participant, false).name
      || participant?.name
      || participant?.identity
      || '';

    const title = app.translator.trans('cengizkemec-social.forum.voice.screen_share_started_title') as string;
    const body = app.translator.trans('cengizkemec-social.forum.voice.screen_share_started', { name }) as string;

    sounds.screenShare();
    this.notifyDesktop(title, body);

    let alertId: number | null = null;
    const roomLink = this.roomInfo
      ? app.route('social.room', { slug: this.roomInfo.slug || this.roomInfo.id }) + '?voice=1'
      : null;

    alertId = app.alerts.show(
      {
        type: 'success',
        icon: 'fas fa-display',
        title,
        controls: roomLink
          ? [m('a', {
              className: 'Button Button--link SocialVoicePanel-watch',
              href: roomLink,
              onclick: () => {
                if (alertId !== null) app.alerts.dismiss(alertId);
              },
            }, app.translator.trans('cengizkemec-social.forum.voice.watch'))]
          : [],
      },
      body
    );

    if (this.roomInfo?.id) {
      window.dispatchEvent(new CustomEvent('social:screenshare-started', { detail: { roomId: this.roomInfo.id } }));
    }
  }

  protected notifyDesktop(title: string, body: string): void {
    if (!this.preferences().desktopNotifications) return;

    try {
      if (!('Notification' in window) || !window.isSecureContext) return;
      if (Notification.permission !== 'granted') return;

      const notification = new Notification(title, {
        body,
        tag: `social-voice-screenshare-${this.roomInfo?.id || 'room'}`,
      });

      notification.onclick = () => {
        window.focus();

        if (this.roomInfo) {
          m.route.set(app.route('social.room', { slug: this.roomInfo.slug || this.roomInfo.id }) + '?voice=1');
        }

        notification.close();
      };
    } catch (e) {
      // Some browsers disallow constructed notifications from a page context.
    }
  }

  participantData(participant: any, local: boolean): any {
    let metadata: any = {};

    try {
      metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
    } catch (e) {
      metadata = {};
    }

    return {
      identity: participant.identity,
      sid: participant.sid,
      name: metadata.displayName || participant.name || metadata.username || participant.identity,
      username: metadata.username || participant.identity,
      avatarUrl: metadata.avatar_url || null,
      local,
      speaking: participant.isSpeaking,
      muted: local ? !this.microphone : !participant.isMicrophoneEnabled,
      volume: this.volumes?.[participant.identity] ?? 100,
      connectionQuality: participant.connectionQuality,
    };
  }

  async refreshStats(): Promise<void> {
    if (!this.room) return;

    const engine: any = (this.room as any).engine;
    const transports = [engine?.pcManager?.publisher, engine?.pcManager?.subscriber].filter(Boolean);

    try {
      let rtt: number | null = null;
      let fallbackRtt: number | null = null;

      for (const transport of transports) {
        const report = await transport?.getStats?.();
        if (!report) continue;

        report.forEach((stat: any) => {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && typeof stat.currentRoundTripTime === 'number') {
            const ms = stat.currentRoundTripTime * 1000;

            if (stat.nominated || stat.selected) rtt = ms;
            else if (fallbackRtt === null) fallbackRtt = ms;
          } else if (stat.type === 'remote-inbound-rtp' && typeof stat.roundTripTime === 'number' && fallbackRtt === null) {
            fallbackRtt = stat.roundTripTime * 1000;
          }
        });
      }

      const measured = rtt ?? fallbackRtt;

      if (measured !== null && Number.isFinite(measured) && measured >= 0) {
        this.latencyMs = Math.round(measured);
        this.recordLatency(this.latencyMs);
      }

      this.connectionQuality = String((this.room.localParticipant as any)?.connectionQuality || this.connectionQuality || 'unknown');
      m.redraw();
    } catch (e) {
      // Stats are informational; never interrupt the call for them.
    }
  }

  protected recordLatency(ms: number): void {
    const now = Date.now();
    const cutoff = now - 5 * 60 * 1000;

    this.latencyHistory.push({ at: now, ms });
    this.latencyHistory = this.latencyHistory.filter((point) => point.at >= cutoff);
  }

  connectedDuration(): string {
    if (!this.connectedAt) return '';

    const seconds = Math.max(0, Math.floor((Date.now() - this.connectedAt) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;

    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
      : `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  serverHost(): string {
    const url = SocialState.config?.voice?.url || '';

    try {
      return new URL(url.replace(/^ws/, 'http')).host;
    } catch (e) {
      return url;
    }
  }

  preferences(): any {
    const config = SocialState.config.voice || {};
    const personal = SocialState.user?.voiceSettings || {};

    return {
      pushToTalk: personal.pushToTalk ?? config.pushToTalk !== false,
      pttKey: personal.pttKey || config.pttKey || 'AltLeft',
      sounds: personal.sounds ?? config.sounds !== false,
      defaultMuted: personal.defaultMuted ?? config.defaultMuted !== false,
      noiseSuppression: personal.noiseSuppression ?? config.noiseSuppression !== false,
      echoCancellation: personal.echoCancellation ?? config.echoCancellation !== false,
      autoGainControl: personal.autoGainControl ?? config.autoGainControl !== false,
      backgroundMic: personal.backgroundMic ?? false,
      desktopNotifications: personal.desktopNotifications ?? false,
    };
  }

  applyUserPreferences(): void {
    if (this.connected) this.installPtt();
    else this.removePtt();

    if (this.deafened) {
      this.participants.forEach((participant) => this.applyVolume(participant.identity, 0));
    }

    m.redraw();
  }

  volumes: Record<string, number> = {};

  applyVolume(identity: string, volume: number): void {
    this.volumes[identity] = volume;

    if (!this.room) return;

    const participant = this.room.remoteParticipants.get(identity);
    if (participant && typeof (participant as any).setVolume === 'function') {
      (participant as any).setVolume(volume / 100);
    }
  }

  setVolume(identity: string, volume: number): void {
    this.applyVolume(identity, volume);
    m.redraw();
  }

  toggleDeafen(): void {
    this.markActivity();
    this.deafened = !this.deafened;

    this.participants.forEach((participant) => {
      this.applyVolume(participant.identity, this.deafened ? 0 : 100);
    });

    if (this.deafened) sounds.deafen();
    else sounds.undeafen();

    m.redraw();
  }

  async toggleMic(): Promise<void> {
    if (!this.room) return;
    this.markActivity();
    const next = !this.microphone;
    await this.room.localParticipant.setMicrophoneEnabled(next);
    this.manualMuted = !next;
    this.backgroundMicForced = false;

    if (next) sounds.unmute();
    else sounds.mute();

    this.refresh();
  }

  async enableMic(): Promise<void> {
    if (!this.room || this.microphone) return;
    this.markActivity();
    await this.room.localParticipant.setMicrophoneEnabled(true);
    this.refresh();
  }

  async disableMic(): Promise<void> {
    if (!this.room || !this.microphone) return;
    await this.room.localParticipant.setMicrophoneEnabled(false);
    this.refresh();
  }

  async toggleScreenShare(): Promise<void> {
    if (!this.room) return;

    try {
      this.markActivity();
      await this.room.localParticipant.setScreenShareEnabled(!this.screenSharing);
      this.refresh();
    } catch (error: any) {
      const denied = error?.name === 'NotAllowedError' || /permission|denied/i.test(String(error?.message || ''));
      const message = denied
        ? app.translator.trans('cengizkemec-social.forum.voice.screen_permission_denied')
        : error?.message || app.translator.trans('cengizkemec-social.forum.voice.screen_error');

      this.error = message as string;
      app.alerts.show({ type: 'error' }, message);
      m.redraw();
    }
  }

  setPushToTalkActive(active: boolean): void {
    if (!this.connected || this.manualMuted || this.deafened) {
      this.pttActive = false;
      this.disableMic().catch(() => {});
      return;
    }

    this.pttActive = active;

    if (active) this.enableMic().catch(() => {});
    else this.disableMic().catch(() => {});

    m.redraw();
  }

  installPtt(): void {
    this.removePtt();

    const prefs = this.preferences();

    if (!prefs.pushToTalk) return;

    const key = prefs.pttKey;

    this.keyHandler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.code !== key && event.key !== key) return;

      event.preventDefault();
      this.pttActive = true;
      this.enableMic();
    };

    this.keyUpHandler = (event: KeyboardEvent) => {
      if (event.code !== key && event.key !== key) return;
      this.pttActive = false;
      this.disableMic();
    };

    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  removePtt(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
    this.keyHandler = null;
    this.keyUpHandler = null;
  }

  installBackgroundListeners(): void {
    if (this.backgroundListenersInstalled) return;
    this.backgroundListenersInstalled = true;
    this.backgrounded = document.hidden || !document.hasFocus();

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);
  }

  removeBackgroundListeners(): void {
    if (!this.backgroundListenersInstalled) return;
    this.backgroundListenersInstalled = false;
    this.backgrounded = false;
    this.backgroundMicForced = false;

    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('focus', this.onWindowFocus);
  }

  protected handleBackgroundChange(): void {
    if (!this.connected) return;

    const background = document.hidden || !document.hasFocus();
    if (background === this.backgrounded) return;

    this.backgrounded = background;

    if (background) {
      // Browsers do not deliver keyup/keydown while another window owns focus.
      const wasPttActive = this.pttActive;
      this.pttActive = false;

      const prefs = this.preferences();

      if (prefs.backgroundMic && !this.manualMuted) {
        if (!this.microphone) {
          this.micBeforeBackground = false;
          this.backgroundMicForced = true;
          this.enableMic();
        } else if (wasPttActive) {
          // The keyup was lost. Keep the microphone for background mode, but
          // restore the muted push-to-talk state when the window returns.
          this.micBeforeBackground = false;
          this.backgroundMicForced = true;
        }
      } else if (wasPttActive && this.microphone) {
        this.disableMic();
      }
    } else {
      this.markActivity();

      if (this.backgroundMicForced) {
        this.backgroundMicForced = false;

        if (!this.micBeforeBackground && !this.manualMuted && !this.pttActive) {
          this.disableMic();
        }
      }
    }

    m.redraw();
  }

  markActivity(): void {
    this.afkLastActivity = Date.now();
  }

  afkConfig(): { roomId: number; timeout: number } {
    const config = SocialState.config.voice || {};

    return {
      roomId: Number(config.afkRoomId || 0),
      timeout: Number(config.afkTimeoutMinutes || 0),
    };
  }

  installAfkMonitor(): void {
    this.removeAfkMonitor();

    if (!this.connected || !this.roomInfo) return;

    const config = this.afkConfig();

    if (!config.roomId || config.timeout <= 0 || Number(this.roomInfo.id) === config.roomId) {
      return;
    }

    this.afkLastActivity = Date.now();
    this.afkListenersInstalled = true;
    this.afkInterval = window.setInterval(() => this.checkAfk(), 15000);

    document.addEventListener('keydown', this.onAfkActivity, true);
    document.addEventListener('pointerdown', this.onAfkActivity, true);
    document.addEventListener('pointermove', this.onAfkActivity, true);
    document.addEventListener('wheel', this.onAfkActivity, true);
    document.addEventListener('touchstart', this.onAfkActivity, true);
  }

  removeAfkMonitor(): void {
    if (this.afkInterval !== null) window.clearInterval(this.afkInterval);
    this.afkInterval = null;

    if (!this.afkListenersInstalled) return;
    this.afkListenersInstalled = false;

    document.removeEventListener('keydown', this.onAfkActivity, true);
    document.removeEventListener('pointerdown', this.onAfkActivity, true);
    document.removeEventListener('pointermove', this.onAfkActivity, true);
    document.removeEventListener('wheel', this.onAfkActivity, true);
    document.removeEventListener('touchstart', this.onAfkActivity, true);
  }

  checkAfk(): void {
    if (!this.connected || this.afkMoving || !this.roomInfo) return;

    const config = this.afkConfig();

    if (!config.roomId || config.timeout <= 0 || Number(this.roomInfo.id) === config.roomId) {
      return;
    }

    if (Date.now() - this.afkLastActivity < config.timeout * 60 * 1000) return;

    this.moveToAfk(config.roomId);
  }

  async moveToAfk(afkRoomId: number): Promise<void> {
    if (this.afkMoving || !this.connected || !this.roomInfo) return;

    this.afkMoving = true;
    this.removeAfkMonitor();

    const previous = this.roomInfo;

    try {
      const response: any = await get(`/social/rooms/${afkRoomId}`);
      const afkRoom = response.data;

      if (!afkRoom?.isVoice || !afkRoom.canJoin || afkRoom.isLocked) {
        this.afkLastActivity = Date.now();
        return;
      }

      this.previousRoomInfo = previous;
      this.deafenedBeforeAfk = this.deafened;
      await this.disconnect();
      await this.connect(afkRoom);

      if (this.connected) {
        if (!this.deafened) this.toggleDeafen();
        await this.disableMic();
        this.manualMuted = true;
        this.afkLastActivity = Date.now();
        this.showAfkAlert();
      } else {
        this.previousRoomInfo = null;

        if (previous) await this.connect(previous);
      }
    } catch (e) {
      this.previousRoomInfo = null;

      if (previous) await this.connect(previous);
    } finally {
      this.afkMoving = false;

      if (this.connected && this.roomInfo && Number(this.roomInfo.id) !== this.afkConfig().roomId) {
        this.installAfkMonitor();
      }
    }
  }

  showAfkAlert(): void {
    const title = app.translator.trans('cengizkemec-social.forum.voice.afk_moved_title') as string;
    const body = app.translator.trans('cengizkemec-social.forum.voice.afk_moved') as string;

    this.afkAlertId = app.alerts.show(
      {
        type: 'warning',
        icon: 'fas fa-moon',
        title,
        controls: this.previousRoomInfo
          ? [m('button', {
              className: 'Button Button--link',
              onclick: () => this.returnFromAfk(),
            }, app.translator.trans('cengizkemec-social.forum.voice.afk_return'))]
          : [],
      },
      body
    );
  }

  async returnFromAfk(): Promise<void> {
    if (this.afkMoving || !this.previousRoomInfo) return;

    this.afkMoving = true;
    const previous = this.previousRoomInfo;

    try {
      const response: any = await get(`/social/rooms/${previous.id}`);
      const room = response.data;

      if (!room?.isVoice || !room.canJoin || room.isLocked) {
        app.alerts.show({ type: 'error' }, app.translator.trans('cengizkemec-social.forum.voice.afk_return_failed'));
        return;
      }

      await this.connect(room);

      if (this.connected) {
        this.previousRoomInfo = null;

        if (this.afkAlertId !== null) {
          app.alerts.dismiss(this.afkAlertId);
          this.afkAlertId = null;
        }

        if (this.deafened && !this.deafenedBeforeAfk) {
          this.toggleDeafen();
        }

        this.deafenedBeforeAfk = false;
      }
    } catch (e) {
      app.alerts.show({ type: 'error' }, app.translator.trans('cengizkemec-social.forum.voice.afk_return_failed'));
    } finally {
      this.afkMoving = false;
    }
  }

  async disconnect(): Promise<void> {
    const roomId = this.roomInfo?.id;

    this.cleanup();
    this.connected = false;
    this.connecting = false;
    this.room = null;
    this.roomInfo = null;
    this.connectionState = 'disconnected';
    this.participants = [];
    this.screenShares = [];
    this.microphone = false;
    this.screenSharing = false;
    this.error = null;
    this.latencyMs = null;
    this.latencyHistory = [];
    this.connectionQuality = 'unknown';
    this.announcedScreenShares.clear();
    this.manualMuted = false;
    this.backgroundMicForced = false;
    this.afkLastActivity = Date.now();

    if (!this.afkMoving) {
      this.previousRoomInfo = null;
      this.deafenedBeforeAfk = false;

      if (this.afkAlertId !== null) {
        app.alerts.dismiss(this.afkAlertId);
        this.afkAlertId = null;
      }
    }

    if (roomId) {
      post(`/social/rooms/${roomId}/leave`).catch(() => {});
      sounds.leave();
    }

    m.redraw();
  }

  cleanup(): void {
    this.removePtt();
    this.removeBackgroundListeners();
    this.removeAfkMonitor();

    if (this.heartbeat) window.clearInterval(this.heartbeat);
    this.heartbeat = null;

    if (this.statsInterval) window.clearInterval(this.statsInterval);
    this.statsInterval = null;

    this.audioElements.forEach((element) => element.remove());
    this.audioElements.clear();

    try {
      this.room?.disconnect();
    } catch (e) {}
  }
}

export default new VoiceSession();
