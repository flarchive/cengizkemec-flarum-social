import app from 'flarum/admin/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { adminPatch, adminPost } from '../adminApi';

export default class AdminChannelModal extends Modal {
  channel: any = null;
  name = '';
  slug = '';
  icon = 'fas fa-hashtag';
  description = '';
  categoryId: number | null = null;
  roomId: number | null = null;
  visibility = 'members';
  position = 0;
  isLocked = false;
  allowedGroupIds: number[] = [];
  loading = false;
  error: string | null = null;

  oninit(vnode: any): void {
    super.oninit(vnode);
    const channel = vnode.attrs.channel || null;
    this.channel = channel;

    if (channel) {
      this.name = channel.name || '';
      this.slug = channel.slug || '';
      this.icon = channel.icon || 'fas fa-hashtag';
      this.description = channel.description || '';
      this.categoryId = channel.categoryId ?? null;
      this.roomId = channel.roomId ?? null;
      this.visibility = channel.visibility || 'members';
      this.position = Number(channel.position) || 0;
      this.isLocked = Boolean(channel.isLocked);
      this.allowedGroupIds = (channel.allowedGroups || []).map((id: any) => Number(id));
    }
  }

  className(): string {
    return 'Modal--small SocialAdminChannelModal';
  }

  title(): string {
    return app.translator.trans(this.channel ? 'cengizkemec-social.admin.rooms.edit_channel' : 'cengizkemec-social.admin.rooms.add_channel') as string;
  }

  canSave(): boolean {
    return this.name.trim().length >= 2;
  }

  toggleGroup(id: number): void {
    this.allowedGroupIds = this.allowedGroupIds.includes(id)
      ? this.allowedGroupIds.filter((value) => value !== id)
      : [...this.allowedGroupIds, id];
  }

  save(): void {
    if (!this.canSave()) {
      this.error = app.translator.trans('cengizkemec-social.admin.rooms.channel_name_required') as string;
      m.redraw();
      return;
    }

    this.loading = true;
    this.error = null;

    const payload = {
      name: this.name,
      slug: this.slug,
      icon: this.icon,
      description: this.description,
      category_id: this.categoryId,
      room_id: this.roomId,
      visibility: this.visibility,
      position: this.position,
      is_locked: this.isLocked,
      allowed_groups: this.allowedGroupIds,
    };

    const request = this.channel
      ? adminPatch(`/social/admin/channels/${this.channel.id}`, payload)
      : adminPost('/social/admin/channels', payload);

    request
      .then(() => {
        this.attrs.onupdated?.();
        app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.admin.rooms.channel_updated', { name: this.name }) as string);
        this.hide();
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  groupPicker(): any {
    const groups = this.attrs.groups || [];

    if (!groups.length) return null;

    return m('div', { className: 'Form-group' }, [
      m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.allowed_groups')),
      m('div', { className: 'SocialAdminGroupPicker' }, groups.map((group: any) =>
        m('label', { className: 'checkbox SocialAdminGroupPicker-item', key: group.id }, [
          m('input', {
            type: 'checkbox',
            checked: this.allowedGroupIds.includes(Number(group.id)),
            onchange: () => this.toggleGroup(Number(group.id)),
          }),
          group.icon ? m('i', { className: group.icon }) : null,
          ' ',
          group.name,
          group.color ? m('span', { className: 'SocialAdminGroupPicker-dot', style: { background: group.color } }) : null,
        ])
      )),
      m('div', { className: 'helpText' }, app.translator.trans('cengizkemec-social.admin.rooms.allowed_groups_help')),
    ]);
  }

  content(): any {
    const categories = this.attrs.categories || [];
    const rooms = this.attrs.rooms || [];

    return m('div', { className: 'Modal-body' }, m('form', {
      onsubmit: (event: Event) => {
        event.preventDefault();
        this.save();
      },
    }, [
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.channel_name')),
          m('input', { className: 'FormControl', value: this.name, oninput: (event: Event) => (this.name = (event.target as HTMLInputElement).value), required: true }),
        ]),
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.slug')),
          m('input', { className: 'FormControl', value: this.slug, placeholder: app.translator.trans('cengizkemec-social.admin.rooms.channel_slug_auto'), oninput: (event: Event) => (this.slug = (event.target as HTMLInputElement).value) }),
          m('div', { className: 'helpText' }, app.translator.trans('cengizkemec-social.admin.rooms.channel_slug_help')),
        ]),
      ]),
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.icon')),
          m('input', { className: 'FormControl', value: this.icon, placeholder: 'fas fa-hashtag', oninput: (event: Event) => (this.icon = (event.target as HTMLInputElement).value) }),
        ]),
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.category')),
          m('select', { className: 'FormControl', value: this.categoryId || '', onchange: (event: Event) => (this.categoryId = Number((event.target as HTMLSelectElement).value) || null) }, [
            m('option', { value: '' }, app.translator.trans('cengizkemec-social.admin.rooms.no_category')),
            categories.map((category: any) => m('option', { value: category.id, selected: this.categoryId === Number(category.id) }, category.name)),
          ]),
        ]),
      ]),
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.channel_room')),
          m('select', { className: 'FormControl', value: this.roomId || '', onchange: (event: Event) => (this.roomId = Number((event.target as HTMLSelectElement).value) || null) }, [
            m('option', { value: '' }, app.translator.trans('cengizkemec-social.admin.rooms.standalone')),
            rooms.map((room: any) => m('option', { value: room.id, selected: this.roomId === Number(room.id) }, room.name)),
          ]),
        ]),
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.visibility')),
          m('select', { className: 'FormControl', value: this.visibility, onchange: (event: Event) => (this.visibility = (event.target as HTMLSelectElement).value) }, ['public', 'members', 'staff'].map((value) => m('option', { value, selected: this.visibility === value }, app.translator.trans(`cengizkemec-social.admin.rooms.visibility_options.${value}`)))),
        ]),
      ]),
      m('div', { className: 'Form-group' }, [
        m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.description')),
        m('textarea', { className: 'FormControl', rows: 2, value: this.description, oninput: (event: Event) => (this.description = (event.target as HTMLTextAreaElement).value) }),
      ]),
      this.groupPicker(),
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.sort_order')),
          m('input', { className: 'FormControl', type: 'number', value: this.position, oninput: (event: Event) => (this.position = Number((event.target as HTMLInputElement).value)) }),
        ]),
        m('div', { className: 'Form-group Form-group--half SocialAdminChannelModal-flags' }, [
          m('label', { className: 'checkbox' }, [
            m('input', { type: 'checkbox', checked: this.isLocked, onchange: (event: Event) => (this.isLocked = (event.target as HTMLInputElement).checked) }),
            ' ',
            app.translator.trans('cengizkemec-social.admin.rooms.channel_locked'),
          ]),
        ]),
      ]),
      this.error ? m('div', { className: 'Alert Alert--error' }, this.error) : null,
      m(Button, { className: 'Button Button--primary Button--block', type: 'submit', loading: this.loading, disabled: !this.canSave() }, app.translator.trans('cengizkemec-social.admin.common.save')),
    ]));
  }
}
