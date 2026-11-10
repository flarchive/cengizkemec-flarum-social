import app from 'flarum/admin/app';
import Form from 'flarum/common/components/Form';
import Button from 'flarum/common/components/Button';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import { SETTING_GROUPS, SettingItem } from '../settings';
import { adminGet, adminPost } from '../adminApi';
import AdminRoomManager from '../components/AdminRoomManager';

export default class SocialAdminPage extends ExtensionPage {
  tab = 'overview';
  overview: any = null;
  reports: any[] = [];
  cleanupLogs: any[] = [];
  moderationLogs: any[] = [];
  loading = false;
  actionLoading = false;
  cleanupResult: any = null;
  error: string | null = null;

  oninit(vnode: any): void {
    super.oninit(vnode);
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = null;

    Promise.all([
      adminGet('/social/admin/overview'),
      adminGet('/social/admin/reports', { status: 'open' }),
      adminGet('/social/admin/cleanup/logs'),
      adminGet('/social/admin/moderation/logs'),
    ])
      .then(([overview, reports, cleanupLogs, moderationLogs]: any[]) => {
        this.overview = overview.data;
        this.reports = reports.data || [];
        this.cleanupLogs = cleanupLogs.data || [];
        this.moderationLogs = moderationLogs.data || [];
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return (bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
  }

  runCleanup(dry: boolean): void {
    this.actionLoading = true;
    this.cleanupResult = null;

    adminPost('/social/admin/cleanup', { dry_run: dry, only: 'all' })
      .then((response: any) => {
        this.cleanupResult = response.data;
        this.loadDashboard();
      })
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message))
      .finally(() => {
        this.actionLoading = false;
        m.redraw();
      });
  }

  resolveReport(report: any, action: 'none' | 'delete'): void {
    if (action === 'delete' && !confirm(app.translator.trans('cengizkemec-social.admin.reports.confirm_delete') as string)) return;

    this.actionLoading = true;

    adminPost(`/social/admin/reports/${report.id}/resolve`, { status: 'resolved', action })
      .then(() => this.loadDashboard())
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message))
      .finally(() => {
        this.actionLoading = false;
        m.redraw();
      });
  }

  settingComponent(item: SettingItem): any {
    const options: Record<string, string> = {};

    if (item.options) {
      Object.keys(item.options).forEach((value) => {
        options[value] = app.translator.trans(`cengizkemec-social.admin.options.${item.key}.${value}`) as string;
      });
    }

    return this.buildSettingComponent({
      setting: `cengizkemec-social.${item.key}`,
      label: app.translator.trans(`cengizkemec-social.admin.settings.${item.key}`),
      help: item.help ? app.translator.trans(`cengizkemec-social.admin.settings.${item.key}_help`) : undefined,
      type: item.type || 'bool',
      options,
      min: item.min,
      max: item.max,
      step: item.step,
    });
  }

  settingsTab(group: string): any {
    const items = SETTING_GROUPS[group] || [];

    return m(Form, {}, [
      m('div', { className: 'SocialAdminSectionHead' }, m('div', {}, [
        m('h2', {}, app.translator.trans(`cengizkemec-social.admin.tabs.${group}`)),
        m('p', {}, app.translator.trans(`cengizkemec-social.admin.tabs.${group}_help`)),
      ])),
      group === 'general'
        ? m('div', { className: 'SocialAdminNote' }, [m('i', { className: 'fas fa-circle-info' }), ' ', app.translator.trans('cengizkemec-social.admin.notes.localization')])
        : null,
      group === 'media'
        ? m('div', { className: 'SocialAdminNote' }, [m('i', { className: 'fas fa-circle-info' }), ' ', app.translator.trans('cengizkemec-social.admin.notes.s3')])
        : null,
      group === 'messages'
        ? m('div', { className: 'SocialAdminNote' }, [m('i', { className: 'fas fa-circle-info' }), ' ', app.translator.trans('cengizkemec-social.admin.notes.realtime')])
        : null,
      ...items.map((item) => this.settingComponent(item)),
      m('div', { className: 'Form-group Form-controls' }, [this.submitButton(), this.resetButton()]),
    ]);
  }

  overviewTab(): any {
    if (this.loading && !this.overview) return m('div', { className: 'SocialAdminLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }));

    if (this.error) {
      return m('div', { className: 'Alert Alert--error' }, [this.error, m('button', { className: 'Button Button--link', onclick: () => this.loadDashboard() }, app.translator.trans('cengizkemec-social.admin.common.retry'))]);
    }

    const data = this.overview || {};
    const card = (icon: string, value: any, label: any) => m('div', { className: 'SocialAdminCard' }, [
      m('span', { className: 'SocialAdminCard-icon' }, m('i', { className: icon })),
      m('strong', {}, value ?? 0),
      m('span', {}, label),
    ]);

    return m('div', { className: 'SocialAdminOverview' }, [
      m('div', { className: 'SocialAdminSectionHead' }, [
        m('div', {}, [m('h2', {}, app.translator.trans('cengizkemec-social.admin.tabs.overview')), m('p', {}, app.translator.trans('cengizkemec-social.admin.tabs.overview_help'))]),
        m('div', { className: 'SocialAdminActions' }, [
          m('button', { className: 'Button', onclick: () => this.loadDashboard(), loading: this.loading }, [m('i', { className: 'fas fa-rotate' }), ' ', app.translator.trans('cengizkemec-social.admin.common.refresh')]),
          m('button', { className: 'Button Button--primary', onclick: () => this.runCleanup(true), loading: this.actionLoading }, [m('i', { className: 'fas fa-flask' }), ' ', app.translator.trans('cengizkemec-social.admin.cleanup.dry_run')]),
        ]),
      ]),
      m('div', { className: 'SocialAdminCards' }, [
        card('fas fa-users', data.users?.total, app.translator.trans('cengizkemec-social.admin.overview.users')),
        card('fas fa-user-check', data.users?.active30d, app.translator.trans('cengizkemec-social.admin.overview.active_users')),
        card('fas fa-pen-nib', data.posts, app.translator.trans('cengizkemec-social.admin.overview.posts')),
        card('far fa-comments', data.comments, app.translator.trans('cengizkemec-social.admin.overview.comments')),
        card('far fa-message', data.messages, app.translator.trans('cengizkemec-social.admin.overview.messages')),
        card('fas fa-envelope', data.directMessages, app.translator.trans('cengizkemec-social.admin.overview.direct_messages')),
        card('fas fa-headset', data.rooms?.participants, app.translator.trans('cengizkemec-social.admin.overview.voice_participants')),
        card('fas fa-photo-film', data.media?.records, app.translator.trans('cengizkemec-social.admin.overview.media_files')),
        card('fas fa-hard-drive', this.formatBytes(data.media?.storage?.bytes || data.media?.bytes || 0), app.translator.trans('cengizkemec-social.admin.overview.storage')),
        card('fas fa-flag', data.reports?.open, app.translator.trans('cengizkemec-social.admin.overview.open_reports')),
      ]),
      m('div', { className: 'SocialAdminSplit' }, [
        m('section', { className: 'SocialAdminPanel' }, [
          m('h3', {}, app.translator.trans('cengizkemec-social.admin.overview.services')),
          m('ul', { className: 'SocialAdminStatusList' }, [
            m('li', {}, [m('span', {}, 'LiveKit'), m('span', { className: 'SocialAdminStatus ' + (data.livekit?.configured ? 'is-ok' : 'is-off') }, data.livekit?.configured ? app.translator.trans('cengizkemec-social.admin.overview.configured') : app.translator.trans('cengizkemec-social.admin.overview.not_configured'))]),
            m('li', {}, [m('span', {}, app.translator.trans('cengizkemec-social.admin.overview.realtime')), m('span', { className: 'SocialAdminStatus ' + (data.realtime?.configured ? 'is-ok' : 'is-off') }, data.realtime?.configured ? app.translator.trans('cengizkemec-social.admin.overview.configured') : app.translator.trans('cengizkemec-social.admin.overview.not_configured'))]),
            m('li', {}, [m('span', {}, app.translator.trans('cengizkemec-social.admin.overview.cleanup')), m('span', { className: 'SocialAdminStatus ' + (data.cleanup?.enabled ? 'is-ok' : 'is-off') }, data.cleanup?.enabled ? app.translator.trans('cengizkemec-social.admin.overview.enabled') : app.translator.trans('cengizkemec-social.admin.overview.disabled'))]),
            m('li', {}, [m('span', {}, app.translator.trans('cengizkemec-social.admin.overview.permanent_rooms')), m('span', {}, data.rooms?.permanent ?? 0)]),
            m('li', {}, [m('span', {}, app.translator.trans('cengizkemec-social.admin.overview.temporary_rooms')), m('span', {}, data.rooms?.temporary ?? 0)]),
          ]),
        ]),
        m('section', { className: 'SocialAdminPanel' }, [
          m('h3', {}, app.translator.trans('cengizkemec-social.admin.cleanup.title')),
          m('p', {}, app.translator.trans('cengizkemec-social.admin.cleanup.text')),
          m('div', { className: 'SocialAdminActions' }, [
            m('button', { className: 'Button', onclick: () => this.runCleanup(true), loading: this.actionLoading }, app.translator.trans('cengizkemec-social.admin.cleanup.dry_run')),
            m('button', { className: 'Button Button--danger', onclick: () => { if (confirm(app.translator.trans('cengizkemec-social.admin.cleanup.confirm') as string)) this.runCleanup(false); }, loading: this.actionLoading }, app.translator.trans('cengizkemec-social.admin.cleanup.run')),
          ]),
          this.cleanupResult ? m('pre', { className: 'SocialAdminResult' }, JSON.stringify(this.cleanupResult, null, 2)) : null,
        ]),
      ]),
      m('section', { className: 'SocialAdminPanel' }, [
        m('h3', {}, app.translator.trans('cengizkemec-social.admin.reports.title')),
        this.reports.length
          ? m('div', { className: 'SocialAdminList' }, this.reports.map((report: any) =>
              m('div', { className: 'SocialAdminList-row' }, [
                m('span', { className: 'SocialAdminList-main' }, [
                  m('i', { className: 'fas fa-flag' }),
                  m('strong', {}, report.type + ' #' + report.subjectId),
                  m('small', {}, report.reason + ' · ' + (report.reporter?.displayName || '') + ' · ' + (report.excerpt || '')),
                ]),
                m('div', { className: 'SocialAdminList-actions' }, [
                  m('button', { className: 'Button Button--small', onclick: () => this.resolveReport(report, 'none'), loading: this.actionLoading }, app.translator.trans('cengizkemec-social.admin.reports.resolve')),
                  m('button', { className: 'Button Button--danger Button--small', onclick: () => this.resolveReport(report, 'delete'), loading: this.actionLoading }, app.translator.trans('cengizkemec-social.admin.reports.resolve_delete')),
                ]),
              ])
            ))
          : m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.admin.reports.empty')),
      ]),
      m('section', { className: 'SocialAdminPanel' }, [
        m('h3', {}, app.translator.trans('cengizkemec-social.admin.cleanup.logs')),
        m('div', { className: 'SocialAdminList' }, this.cleanupLogs.map((log: any) =>
          m('div', { className: 'SocialAdminList-row' }, [
            m('span', { className: 'SocialAdminList-main' }, [m('i', { className: 'fas fa-clock' }), m('strong', {}, log.type), m('small', {}, new Date(log.createdAt).toLocaleString() + ' · ' + log.durationMs + ' ms')]),
            m('span', { className: 'SocialAdminMuted' }, log.dryRun ? app.translator.trans('cengizkemec-social.admin.cleanup.dry_run_short') : app.translator.trans('cengizkemec-social.admin.cleanup.real_run')),
          ])
        )),
      ]),
    ]);
  }

  moderationTab(): any {
    return m('div', {}, [
      this.settingsTab('moderation'),
      m('section', { className: 'SocialAdminPanel' }, [
        m('h3', {}, app.translator.trans('cengizkemec-social.admin.reports.title')),
        this.reports.length
          ? m('div', { className: 'SocialAdminList' }, this.reports.map((report: any) =>
              m('div', { className: 'SocialAdminList-row' }, [
                m('span', { className: 'SocialAdminList-main' }, [m('i', { className: 'fas fa-flag' }), m('strong', {}, report.type + ' #' + report.subjectId), m('small', {}, report.reason + ' · ' + (report.excerpt || ''))]),
                m('div', { className: 'SocialAdminList-actions' }, [
                  m('button', { className: 'Button Button--small', onclick: () => this.resolveReport(report, 'none') }, app.translator.trans('cengizkemec-social.admin.reports.resolve')),
                  m('button', { className: 'Button Button--danger Button--small', onclick: () => this.resolveReport(report, 'delete') }, app.translator.trans('cengizkemec-social.admin.reports.resolve_delete')),
                ]),
              ])
            ))
          : m('p', { className: 'SocialMuted' }, app.translator.trans('cengizkemec-social.admin.reports.empty')),
      ]),
      m('section', { className: 'SocialAdminPanel' }, [
        m('h3', {}, app.translator.trans('cengizkemec-social.admin.reports.logs')),
        m('div', { className: 'SocialAdminList' }, this.moderationLogs.map((log: any) =>
          m('div', { className: 'SocialAdminList-row' }, [
            m('span', { className: 'SocialAdminList-main' }, [m('i', { className: 'fas fa-shield-halved' }), m('strong', {}, log.action), m('small', {}, (log.actor?.displayName || '') + ' · ' + new Date(log.createdAt).toLocaleString())]),
            m('span', { className: 'SocialAdminMuted' }, log.targetType ? log.targetType + ' #' + log.targetId : ''),
          ])
        )),
      ]),
    ]);
  }

  content(): any {
    const tabs = ['overview', 'general', 'guest', 'feed', 'media', 'retention', 'voice', 'rooms', 'messages', 'moderation'];

    return m('div', { className: 'SocialAdminPage' }, [
      m('div', { className: 'SocialAdminTabs' }, tabs.map((tab) =>
        m('button', { className: 'SocialAdminTab' + (this.tab === tab ? ' is-active' : ''), onclick: () => (this.tab = tab) }, app.translator.trans(`cengizkemec-social.admin.tabs.${tab}`))
      )),
      m('div', { className: 'SocialAdminContent' }, [
        this.tab === 'overview' ? this.overviewTab() : null,
        this.tab === 'rooms' ? m(AdminRoomManager) : null,
        this.tab === 'moderation' ? this.moderationTab() : null,
        !['overview', 'rooms', 'moderation'].includes(this.tab) ? this.settingsTab(this.tab) : null,
      ]),
      m('div', { className: 'SocialAdminCredit' }, [
        m('i', { className: 'fas fa-code' }),
        ' ',
        app.translator.trans('cengizkemec-social.admin.credit'),
        ' ',
        m('a', {
          href: 'https://cengizkemec.com.tr/',
          target: '_blank',
          rel: 'noopener noreferrer',
        }, 'Cengiz Kemec'),
      ]),
    ]);
  }
}
