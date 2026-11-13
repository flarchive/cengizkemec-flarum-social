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
  reordering = false;
  categorySaving = false;
  channelSaving = false;

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
    const name = this.categoryName.trim();

    if (!name) {
      app.alerts.show({ type: 'error' }, app.translator.trans('cengizkemec-social.admin.rooms.category_name_required') as string);
      return;
    }

    if (this.categorySaving) return;

    this.categorySaving = true;
    m.redraw();

    adminPost('/social/admin/categories', {
      name,
      icon: this.categoryIcon.trim() || 'fas fa-folder',
    })
      .then(() => {
        this.categoryName = '';
        app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.admin.rooms.category_added', { name }) as string);
        this.load();
      })
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message))
      .finally(() => {
        this.categorySaving = false;
        m.redraw();
      });
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

    if (!name) {
      app.alerts.show({ type: 'error' }, app.translator.trans('cengizkemec-social.admin.rooms.category_name_required') as string);
      return;
    }

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
    const name = this.channelName.trim();

    if (!name) {
      app.alerts.show({ type: 'error' }, app.translator.trans('cengizkemec-social.admin.rooms.channel_name_required') as string);
      return;
    }

    if (this.channelSaving) return;

    this.channelSaving = true;
    m.redraw();

    adminPost('/social/admin/channels', {
      name,
      room_id: this.channelRoom || null,
      category_id: this.channelCategory || null,
      visibility: this.channelVisibility,
    })
      .then(() => {
        this.channelName = '';
        app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.admin.rooms.channel_added', { name }) as string);
        this.load();
      })
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message))
      .finally(() => {
        this.channelSaving = false;
        m.redraw();
      });
  }

  removeChannel(channel: any): void {
    if (!confirm(app.translator.trans('cengizkemec-social.admin.rooms.confirm_channel_delete') as string)) return;
    adminDelete(`/social/admin/channels/${channel.id}`).then(() => this.load()).catch((error: any) => app.alerts.show({ type: 'error' }, error.message));
  }

  moveItem(items: any[], id: any, delta: number): any[] | null {
    const list = [...items];
    const index = list.findIndex((item) => Number(item.id) === Number(id));
    const target = index + delta;

    if (index < 0 || target < 0 || target >= list.length) return null;

    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);

    return list;
  }

  moveRoom(room: any, delta: number): void {
    if (this.reordering) return;

    const rooms = this.moveItem(this.data?.rooms || [], room.id, delta);
    if (!rooms) return;

    this.data.rooms = rooms;
    this.reordering = true;
    m.redraw();

    adminPost('/social/admin/rooms/reorder', { ids: rooms.map((item: any) => Number(item.id)) })
      .then(() => this.load())
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message))
      .finally(() => {
        this.reordering = false;
        m.redraw();
      });
  }

  moveCategory(category: any, delta: number): void {
    if (this.reordering) return;

    const categories = this.moveItem(this.data?.categories || [], category.id, delta);
    if (!categories) return;

    this.data.categories = categories;
    this.reordering = true;
    m.redraw();

    adminPost('/social/admin/categories/reorder', { ids: categories.map((item: any) => Number(item.id)) })
      .then(() => this.load())
      .catch((error: any) => app.alerts.show({ type: 'error' }, error.message))
      .finally(() => {
        this.reordering = false;
        m.redraw();
      });
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
        m('form', {
          className: 'SocialAdminInlineForm',
          onsubmit: (event: Event) => {
            event.preventDefault();
            this.addCategory();
          },
        }, [
          m('input', {
            className: 'FormControl',
            name: 'category_name',
            placeholder: app.translator.trans('cengizkemec-social.admin.rooms.category_name'),
            'aria-label': app.translator.trans('cengizkemec-social.admin.rooms.category_name'),
            value: this.categoryName,
            oninput: (event: Event) => (this.categoryName = (event.target as HTMLInputElement).value),
          }),
          m('input', {
            className: 'FormControl SocialAdminInlineForm-icon',
            name: 'category_icon',
            placeholder: 'fas fa-folder',
            'aria-label': app.translator.trans('cengizkemec-social.admin.rooms.icon'),
            title: app.translator.trans('cengizkemec-social.admin.rooms.icon'),
            value: this.categoryIcon,
            oninput: (event: Event) => (this.categoryIcon = (event.target as HTMLInputElement).value),
          }),
          m(Button, { className: 'Button', type: 'submit', loading: this.categorySaving, disabled: this.categorySaving }, app.translator.trans('cengizkemec-social.admin.rooms.add_category')),
        ]),
        m('p', { className: 'SocialAdminHint' }, app.translator.trans('cengizkemec-social.admin.rooms.empty_category_hint')),
        m('div', { className: 'SocialAdminList' }, categories.map((category: any, index: number) =>
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
                  m(Button, {
                    className: 'Button Button--link Button--small SocialAdminMove',
                    title: app.translator.trans('cengizkemec-social.admin.rooms.move_up'),
                    disabled: this.reordering || index === 0,
                    onclick: () => this.moveCategory(category, -1),
                  }, m('i', { className: 'fas fa-arrow-up' })),
                  m(Button, {
                    className: 'Button Button--link Button--small SocialAdminMove',
                    title: app.translator.trans('cengizkemec-social.admin.rooms.move_down'),
                    disabled: this.reordering || index === categories.length - 1,
                    onclick: () => this.moveCategory(category, 1),
                  }, m('i', { className: 'fas fa-arrow-down' })),
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
          m('tbody', {}, rooms.map((room: any, index: number) =>
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
                m(Button, {
                  className: 'Button Button--link Button--small SocialAdminMove',
                  title: app.translator.trans('cengizkemec-social.admin.rooms.move_up'),
                  disabled: this.reordering || index === 0,
                  onclick: () => this.moveRoom(room, -1),
                }, m('i', { className: 'fas fa-arrow-up' })),
                m(Button, {
                  className: 'Button Button--link Button--small SocialAdminMove',
                  title: app.translator.trans('cengizkemec-social.admin.rooms.move_down'),
                  disabled: this.reordering || index === rooms.length - 1,
                  onclick: () => this.moveRoom(room, 1),
                }, m('i', { className: 'fas fa-arrow-down' })),
                m(Button, { className: 'Button Button--link Button--small', onclick: () => this.openRoom(room) }, app.translator.trans('cengizkemec-social.admin.common.edit')),
                m(Button, { className: 'Button Button--link Button--small', onclick: () => this.removeRoom(room) }, app.translator.trans('cengizkemec-social.admin.common.delete')),
              ]),
            ])
          )),
        ])),
      ]),

      m('section', { className: 'SocialAdminPanel' }, [
        m('h3', {}, app.translator.trans('cengizkemec-social.admin.rooms.channels')),
        m('form', {
          className: 'SocialAdminInlineForm',
          onsubmit: (event: Event) => {
            event.preventDefault();
            this.addChannel();
          },
        }, [
          m('input', {
            className: 'FormControl',
            name: 'channel_name',
            placeholder: app.translator.trans('cengizkemec-social.admin.rooms.channel_name'),
            'aria-label': app.translator.trans('cengizkemec-social.admin.rooms.channel_name'),
            value: this.channelName,
            oninput: (event: Event) => (this.channelName = (event.target as HTMLInputElement).value),
          }),
          m('select', { className: 'FormControl', value: this.channelCategory, onchange: (event: Event) => (this.channelCategory = (event.target as HTMLSelectElement).value) }, [m('option', { value: '' }, app.translator.trans('cengizkemec-social.admin.rooms.no_category')), categories.map((category: any) => m('option', { value: category.id }, category.name))]),
          m('select', { className: 'FormControl', value: this.channelRoom, onchange: (event: Event) => (this.channelRoom = (event.target as HTMLSelectElement).value) }, [m('option', { value: '' }, app.translator.trans('cengizkemec-social.admin.rooms.standalone')), rooms.map((room: any) => m('option', { value: room.id }, room.name))]),
          m('select', { className: 'FormControl', value: this.channelVisibility, onchange: (event: Event) => (this.channelVisibility = (event.target as HTMLSelectElement).value) }, ['public', 'members', 'staff'].map((value) => m('option', { value, selected: this.channelVisibility === value }, app.translator.trans(`cengizkemec-social.admin.rooms.visibility_options.${value}`)))),
          m(Button, { className: 'Button', type: 'submit', loading: this.channelSaving, disabled: this.channelSaving }, app.translator.trans('cengizkemec-social.admin.rooms.add_channel')),
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
