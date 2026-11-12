import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import { adminDelete, adminGet, adminPatch, adminPost } from '../adminApi';
import AdminRoomModal from './AdminRoomModal';

export default class AdminRoomManager {
  data: any = null;
  loading = true;
  error: string | null = null;
  categoryName = '';
  categoryIcon = 'fas fa-folder';
  editingCategoryId: number | null = null;
  editCategoryName = '';
  editCategoryIcon = 'fas fa-folder';
  channelName = '';
  channelRoom = '';
  channelCategory = '';
  channelVisibility = 'members';

  oninit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    adminGet('/social/admin/rooms')
      .then((response: any) => (this.data = response.data))
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  openRoom(room: any = null, preset: string | null = null): void {
    app.modal.show(AdminRoomModal, {
      room,
      preset,
      categories: this.data?.categories || [],
      limits: this.data?.limits || {},
      onupdated: () => this.load(),
    });
  }

  removeRoom(room: any): void {
    if (!confirm(app.translator.trans('cengizkemec-social.admin.rooms.confirm_delete') as string)) return;
    adminDelete(`/social/admin/rooms/${room.id}`).then(() => this.load()).catch((error: any) => app.alerts.show({ type: 'error' }, error.message));
  }

  addCategory(): void {
    if (!this.categoryName.trim()) return;

    adminPost('/social/admin/categories', {
      name: this.categoryName,
      icon: this.categoryIcon,
      sort_order: (this.data?.categories?.length || 0) + 1,
    })
      .then(() => {
        this.categoryName = '';
        this.load();
      })
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message));
  }

  startEditCategory(category: any): void {
    this.editingCategoryId = Number(category.id);
    this.editCategoryName = category.name || '';
    this.editCategoryIcon = category.icon || 'fas fa-folder';
    m.redraw();
  }

  cancelEditCategory(): void {
    this.editingCategoryId = null;
    this.editCategoryName = '';
    this.editCategoryIcon = 'fas fa-folder';
    m.redraw();
  }

  saveCategory(category: any): void {
    const name = this.editCategoryName.trim();

    if (!name) return;

    adminPatch(`/social/admin/categories/${category.id}`, {
      name,
      icon: this.editCategoryIcon.trim() || 'fas fa-folder',
    })
      .then(() => {
        this.cancelEditCategory();
        this.load();
      })
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message));
  }

  removeCategory(category: any): void {
    if (!confirm(app.translator.trans('cengizkemec-social.admin.rooms.confirm_category_delete') as string)) return;
    adminDelete(`/social/admin/categories/${category.id}`).then(() => this.load()).catch((error: any) => app.alerts.show({ type: 'error' }, error.message));
  }

  addChannel(): void {
    if (!this.channelName.trim()) return;

    adminPost('/social/admin/channels', {
      name: this.channelName,
      room_id: this.channelRoom || null,
      category_id: this.channelCategory || null,
      visibility: this.channelVisibility,
    })
      .then(() => {
        this.channelName = '';
        this.load();
      })
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message));
  }

  removeChannel(channel: any): void {
    if (!confirm(app.translator.trans('cengizkemec-social.admin.rooms.confirm_channel_delete') as string)) return;
    adminDelete(`/social/admin/channels/${channel.id}`).then(() => this.load()).catch((error: any) => app.alerts.show({ type: 'error' }, error.message));
  }

  view(): any {
    if (this.loading) return m('div', { className: 'SocialAdminLoading' }, m('i', { className: 'fas fa-spinner fa-spin' }));

    if (this.error) {
      return m('div', { className: 'Alert Alert--error' }, this.error);
    }

    const categories = this.data?.categories || [];
    const rooms = this.data?.rooms || [];
    const channels = this.data?.channels || [];

    return m('div', { className: 'SocialAdminRooms' }, [
      m('div', { className: 'SocialAdminSectionHead' }, [
        m('div', {}, [m('h2', {}, app.translator.trans('cengizkemec-social.admin.rooms.title')), m('p', {}, app.translator.trans('cengizkemec-social.admin.rooms.subtitle'))]),
        m('div', { className: 'SocialAdminSectionActions' }, [
          m(Button, { className: 'Button', onclick: () => this.openRoom(null, 'voice') }, [m('i', { className: 'fas fa-headset' }), ' ', app.translator.trans('cengizkemec-social.admin.rooms.create_voice')]),
          m(Button, { className: 'Button Button--primary', onclick: () => this.openRoom() }, [m('i', { className: 'fas fa-plus' }), ' ', app.translator.trans('cengizkemec-social.admin.rooms.create')]),
        ]),
      ]),

      m('section', { className: 'SocialAdminPanel' }, [
        m('h3', {}, app.translator.trans('cengizkemec-social.admin.rooms.categories')),
        m('div', { className: 'SocialAdminInlineForm' }, [
          m('input', { className: 'FormControl', placeholder: app.translator.trans('cengizkemec-social.admin.rooms.category_name'), value: this.categoryName, oninput: (event: Event) => (this.categoryName = (event.target as HTMLInputElement).value) }),
          m('input', { className: 'FormControl', value: this.categoryIcon, oninput: (event: Event) => (this.categoryIcon = (event.target as HTMLInputElement).value) }),
          m(Button, { className: 'Button', onclick: () => this.addCategory() }, app.translator.trans('cengizkemec-social.admin.rooms.add_category')),
        ]),
        m('div', { className: 'SocialAdminList' }, categories.map((category: any) =>
          this.editingCategoryId === Number(category.id)
            ? m('div', { className: 'SocialAdminList-row SocialAdminList-row--editing' }, [
                m('span', { className: 'SocialAdminList-main' }, [
                  m('input', {
                    className: 'FormControl',
                    value: this.editCategoryName,
                    placeholder: app.translator.trans('cengizkemec-social.admin.rooms.category_name'),
                    oninput: (event: Event) => (this.editCategoryName = (event.target as HTMLInputElement).value),
                  }),
                  m('input', {
                    className: 'FormControl',
                    value: this.editCategoryIcon,
                    placeholder: 'fas fa-folder',
                    'aria-label': app.translator.trans('cengizkemec-social.admin.rooms.icon'),
                    oninput: (event: Event) => (this.editCategoryIcon = (event.target as HTMLInputElement).value),
                  }),
                ]),
                m('div', { className: 'SocialAdminList-actions' }, [
                  m(Button, { className: 'Button Button--primary Button--small', onclick: () => this.saveCategory(category) }, app.translator.trans('cengizkemec-social.admin.common.save')),
                  m(Button, { className: 'Button Button--link Button--small', onclick: () => this.cancelEditCategory() }, app.translator.trans('cengizkemec-social.admin.common.cancel')),
                ]),
              ])
            : m('div', { className: 'SocialAdminList-row' }, [
                m('span', { className: 'SocialAdminList-main' }, [m('i', { className: category.icon || 'fas fa-folder' }), m('strong', {}, category.name), m('small', {}, rooms.filter((room: any) => room.categoryId === category.id).length + ' ' + app.translator.trans('cengizkemec-social.admin.rooms.rooms'))]),
                m('div', { className: 'SocialAdminList-actions' }, [
                  m(Button, { className: 'Button Button--link Button--small', onclick: () => this.startEditCategory(category) }, app.translator.trans('cengizkemec-social.admin.common.edit')),
                  m(Button, { className: 'Button Button--link Button--small', onclick: () => this.removeCategory(category) }, app.translator.trans('cengizkemec-social.admin.common.delete')),
                ]),
              ])
        )),
      ]),

      m('section', { className: 'SocialAdminPanel' }, [
        m('h3', {}, app.translator.trans('cengizkemec-social.admin.rooms.permanent_rooms')),
        m('p', { className: 'SocialAdminHint' }, app.translator.trans('cengizkemec-social.admin.rooms.capacity_hint', {
          min: 2,
          max: this.data?.limits?.maxRoomCapacity || 60,
        })),
        m('div', { className: 'SocialAdminTableWrap' }, m('table', { className: 'SocialAdminTable' }, [
          m('thead', {}, m('tr', {}, [
            m('th', {}, app.translator.trans('cengizkemec-social.admin.rooms.name')),
            m('th', {}, app.translator.trans('cengizkemec-social.admin.rooms.category')),
            m('th', {}, app.translator.trans('cengizkemec-social.admin.rooms.visibility')),
            m('th', {}, app.translator.trans('cengizkemec-social.admin.rooms.capacity')),
            m('th', {}, app.translator.trans('cengizkemec-social.admin.rooms.participants')),
            m('th', {}, app.translator.trans('cengizkemec-social.admin.rooms.type')),
            m('th', {}, ''),
          ])),
          m('tbody', {}, rooms.map((room: any) =>
            m('tr', {}, [
              m('td', {}, [
                m('i', { className: room.icon || 'fas fa-headset' }),
                ' ',
                m('strong', {}, room.name),
                room.hasPassword ? m('i', { className: 'fas fa-lock SocialAdminLock' }) : null,
                room.slug ? m('small', { className: 'SocialAdminSlug' }, '/social/rooms/' + room.slug) : null,
              ]),
              m('td', {}, room.categoryName || '—'),
              m('td', {}, app.translator.trans(`cengizkemec-social.admin.rooms.visibility_options.${room.visibility}`)),
              m('td', {}, room.capacity),
              m('td', {}, room.participantCount),
              m('td', {}, app.translator.trans(`cengizkemec-social.admin.rooms.types.${room.type}`)),
              m('td', { className: 'SocialAdminTable-actions' }, [
                m(Button, { className: 'Button Button--link Button--small', onclick: () => this.openRoom(room) }, app.translator.trans('cengizkemec-social.admin.common.edit')),
                m(Button, { className: 'Button Button--link Button--small', onclick: () => this.removeRoom(room) }, app.translator.trans('cengizkemec-social.admin.common.delete')),
              ]),
            ])
          )),
        ])),
      ]),

      m('section', { className: 'SocialAdminPanel' }, [
        m('h3', {}, app.translator.trans('cengizkemec-social.admin.rooms.channels')),
        m('div', { className: 'SocialAdminInlineForm' }, [
          m('input', { className: 'FormControl', placeholder: app.translator.trans('cengizkemec-social.admin.rooms.channel_name'), value: this.channelName, oninput: (event: Event) => (this.channelName = (event.target as HTMLInputElement).value) }),
          m('select', { className: 'FormControl', value: this.channelCategory, onchange: (event: Event) => (this.channelCategory = (event.target as HTMLSelectElement).value) }, [m('option', { value: '' }, app.translator.trans('cengizkemec-social.admin.rooms.no_category')), categories.map((category: any) => m('option', { value: category.id }, category.name))]),
          m('select', { className: 'FormControl', value: this.channelRoom, onchange: (event: Event) => (this.channelRoom = (event.target as HTMLSelectElement).value) }, [m('option', { value: '' }, app.translator.trans('cengizkemec-social.admin.rooms.standalone')), rooms.map((room: any) => m('option', { value: room.id }, room.name))]),
          m('select', { className: 'FormControl', value: this.channelVisibility, onchange: (event: Event) => (this.channelVisibility = (event.target as HTMLSelectElement).value) }, ['public', 'members', 'staff'].map((value) => m('option', { value, selected: this.channelVisibility === value }, app.translator.trans(`cengizkemec-social.admin.rooms.visibility_options.${value}`)))),
          m(Button, { className: 'Button', onclick: () => this.addChannel() }, app.translator.trans('cengizkemec-social.admin.rooms.add_channel')),
        ]),
        m('div', { className: 'SocialAdminList' }, channels.map((channel: any) =>
          m('div', { className: 'SocialAdminList-row' }, [
            m('span', { className: 'SocialAdminList-main' }, [m('i', { className: 'fas fa-hashtag' }), m('strong', {}, channel.name), m('small', {}, [channel.categoryName || app.translator.trans('cengizkemec-social.admin.rooms.no_category'), channel.description ? ' · ' + channel.description : ''].join(''))]),
            m(Button, { className: 'Button Button--link Button--small', onclick: () => this.removeChannel(channel) }, app.translator.trans('cengizkemec-social.admin.common.delete')),
          ])
        )),
      ]),
    ]);
  }
}
