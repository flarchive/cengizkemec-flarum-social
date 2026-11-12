import app from 'flarum/forum/app';
import { Room, RoomEvent, Track } from 'livekit-client';
import SocialState from './SocialState';
import sounds from './sounds';
import { post } from '../common/api';

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
  connectionQuality: string = 'unknown';
  connectedAt: number | null = null;
  statsInterval: number | null = null;
  heartbeat: number | null = null;
  audioElements = new Map<string, HTMLAudioElement>();
  keyHandler: ((event: KeyboardEvent) => void) | null = null;
  keyUpHandler: ((event: KeyboardEvent) => void) | null = null;

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
    room.on(RoomEvent.ActiveSpeakersChanged, refresh);
    room.on(RoomEvent.ConnectionQualityChanged, refresh);
    room.on(RoomEvent.LocalTrackPublished, refresh);
    room.on(RoomEvent.LocalTrackUnpublished, refresh);
    room.on(RoomEvent.TrackPublished, (publication: any) => {
      if (publication.source === Track.Source.ScreenShare) {
        this.subscribeToScreenShare(publication);
      }
      refresh();
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
    const transport = engine?.pcManager?.publisher || engine?.pcManager?.subscriber;

    try {
      const report = await transport?.getStats?.();

      if (report) {
        let rtt: number | null = null;

        report.forEach((stat: any) => {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && typeof stat.currentRoundTripTime === 'number') {
            rtt = stat.currentRoundTripTime;
          } else if (stat.type === 'remote-inbound-rtp' && typeof stat.roundTripTime === 'number') {
            rtt = stat.roundTripTime;
          }
        });

        if (rtt !== null) this.latencyMs = Math.round(rtt * 1000);
      }

      this.connectionQuality = String((this.room.localParticipant as any)?.connectionQuality || this.connectionQuality || 'unknown');
      m.redraw();
    } catch (e) {
      // Stats are informational; never interrupt the call for them.
    }
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
    const next = !this.microphone;
    await this.room.localParticipant.setMicrophoneEnabled(next);

    if (next) sounds.unmute();
    else sounds.mute();

    this.refresh();
  }

  async enableMic(): Promise<void> {
    if (!this.room || this.microphone) return;
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

    if (roomId) {
      post(`/social/rooms/${roomId}/leave`).catch(() => {});
      sounds.leave();
    }

    m.redraw();
  }

  cleanup(): void {
    this.removePtt();

    if (this.heartbeat) window.clearInterval(this.heartbeat);
    this.heartbeat = null;

    this.audioElements.forEach((element) => element.remove());
    this.audioElements.clear();

    try {
      this.room?.disconnect();
    } catch (e) {}
  }
}

export default new VoiceSession();
