import app from 'flarum/forum/app';
import { get } from '../common/api';

export interface SocialBootstrap {
  config: any;
  user: any;
  can: Record<string, boolean>;
  unreadNotifications: number;
  stats: any;
  categories: any[];
  rooms: any[];
  channels: any[];
  onlineMembers: any[];
  offlineMembers: any[];
  leaderboards: {
    topPosters: any[];
    topLiked: any[];
    topPosts: any[];
    voiceUsers: any[];
    voiceRooms: any[];
  };
  trendingHashtags: any[];
  userId: number | null;
  csrfToken: string;
  serverTime: string;
}

class SocialState {
  loaded = false;
  loading: Promise<SocialBootstrap> | null = null;
  data: SocialBootstrap | null = null;
  error: string | null = null;

  get config(): any {
    return this.data?.config || {};
  }

  get user(): any {
    return this.data?.user || null;
  }

  get isGuest(): boolean {
    return !app.session.user;
  }

  get categories(): any[] {
    return this.data?.categories || [];
  }

  get rooms(): any[] {
    return this.data?.rooms || [];
  }

  get channels(): any[] {
    return this.data?.channels || [];
  }

  get onlineMembers(): any[] {
    return this.data?.onlineMembers || [];
  }

  get offlineMembers(): any[] {
    return this.data?.offlineMembers || [];
  }

  get leaderboards(): any {
    return this.data?.leaderboards || { topPosters: [], topLiked: [], topPosts: [], voiceUsers: [], voiceRooms: [] };
  }

  get trendingHashtags(): any[] {
    return this.data?.trendingHashtags || [];
  }

  get stats(): any {
    return this.data?.stats || {};
  }

  get unreadNotifications(): number {
    return this.data?.unreadNotifications || 0;
  }

  can(key: string): boolean {
    return Boolean(this.data?.can?.[key]);
  }

  load(force = false): Promise<SocialBootstrap> {
    if (this.loaded && !force && this.data) {
      return Promise.resolve(this.data);
    }

    if (this.loading) {
      return this.loading;
    }

    this.error = null;
    this.loading = get<SocialBootstrap>('/social/bootstrap')
      .then((data) => {
        this.data = data;
        this.loaded = true;
        this.loading = null;
        this.applyTheme();

        return data;
      })
      .catch((error: any) => {
        this.loading = null;
        this.error = error.message;
        throw error;
      });

    return this.loading;
  }

  refresh(): Promise<SocialBootstrap> {
    return this.load(true);
  }

  /**
   * Refresh the social data and adopt the regenerated session CSRF token.
   * Flarum rotates the token when a session logs in, registers or logs out;
   * without this, later write requests would fail with a token mismatch.
   */
  async syncSession(): Promise<SocialBootstrap> {
    const data = await this.load(true);

    if (data.csrfToken) {
      app.session.csrfToken = data.csrfToken;
    }

    return data;
  }

  applyTheme(): void {
    const useFlarumTheme = this.config?.appearance?.useFlarumTheme !== false;
    const accent = this.config?.appearance?.accent;

    if (useFlarumTheme || !accent) {
      // The stylesheet falls back to Flarum's own --primary-color.
      document.documentElement.style.removeProperty('--social-accent');
    } else {
      document.documentElement.style.setProperty('--social-accent', accent);
    }

    document.documentElement.classList.toggle('Social-compact', Boolean(this.config?.appearance?.compact));
  }

  setUnread(count: number): void {
    if (this.data) this.data.unreadNotifications = count;
  }

  reset(): void {
    this.loaded = false;
    this.data = null;
    this.loading = null;
  }
}

const socialState = new SocialState();
export default socialState;
