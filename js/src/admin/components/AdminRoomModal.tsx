import app from 'flarum/admin/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { adminPatch, adminPost } from '../adminApi';

export default class AdminRoomModal extends Modal {
  room: any = null;
  name = '';
  slug = '';
  description = '';
  icon = 'fas fa-headset';
  categoryId: number | null = null;
  visibility = 'public';
  capacity = 25;
  unlimitedCapacity = false;
  isVoice = true;
  isText = true;
  allowScreenShare = true;
  sortOrder = 0;
  status = 'active';
  allowedGroupIds: number[] = [];
  password = '';
  loading = false;
  error: string | null = null;

  oninit(vnode: any) {
    super.oninit(vnode);
    const room = vnode.attrs.room || null;
    const limits = vnode.attrs.limits || {};
    const preset = vnode.attrs.preset || null;
    this.room = room;

    if (!room) {
      this.capacity = Number(limits.defaultRoomCapacity) || 25;

      if (preset === 'voice') {
        this.isVoice = true;
        this.isText = true;
      }
    }

    if (room) {
      this.name = room.name;
      this.slug = room.slug || '';
      this.description = room.description || '';
      this.icon = room.icon || 'fas fa-headset';
      this.categoryId = room.categoryId;
      this.visibility = room.visibility;
      this.capacity = Number(room.capacity) || 0;
      this.unlimitedCapacity = Number(room.capacity) === 0;
      this.isVoice = room.isVoice;
      this.isText = room.isText;
      this.allowScreenShare = room.allowScreenShare;
      this.sortOrder = room.sortOrder || 0;
      this.status = room.status || 'active';
      this.allowedGroupIds = (room.allowedGroups || []).map((id: any) => Number(id));
    }
  }

  className(): string {
    return 'Modal--small SocialAdminRoomModal';
  }

  maxCapacity(): number {
    return Math.max(2, Number(this.attrs.limits?.maxRoomCapacity) || 200);
  }

  capacityValid(): boolean {
    return this.unlimitedCapacity || (Number.isFinite(this.capacity) && this.capacity >= 2 && this.capacity <= this.maxCapacity());
  }

  toggleGroup(id: number): void {
    this.allowedGroupIds = this.allowedGroupIds.includes(id)
      ? this.allowedGroupIds.filter((value) => value !== id)
      : [...this.allowedGroupIds, id];
  }

  canSave(): boolean {
    return this.name.trim().length >= 2 && (this.isVoice || this.isText) && this.capacityValid();
  }

  title(): string {
    return app.translator.trans(this.room ? 'cengizkemec-social.admin.rooms.edit' : 'cengizkemec-social.admin.rooms.create') as string;
  }

  save(): void {
    if (!this.canSave()) {
      this.error = app.translator.trans('cengizkemec-social.admin.rooms.form_invalid') as string;
      m.redraw();
      return;
    }

    this.loading = true;
    this.error = null;

    const payload = {
      name: this.name,
      slug: this.slug,
      description: this.description,
      icon: this.icon,
      category_id: this.categoryId,
      visibility: this.visibility,
      capacity: this.unlimitedCapacity ? 0 : this.capacity,
      is_voice: this.isVoice,
      is_text: this.isText,
      allow_screen_share: this.allowScreenShare,
      sort_order: this.sortOrder,
      status: this.status,
      allowed_groups: this.allowedGroupIds,
      password: this.password,
    };

    const request = this.room ? adminPatch(`/social/admin/rooms/${this.room.id}`, payload) : adminPost('/social/admin/rooms', payload);

    request
      .then(() => {
        this.attrs.onupdated?.();
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

    return m('div', { className: 'Modal-body' }, m('form', {
      onsubmit: (event: Event) => {
        event.preventDefault();
        this.save();
      },
    }, [
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.name')), m('input', { className: 'FormControl', value: this.name, oninput: (event: Event) => (this.name = (event.target as HTMLInputElement).value), required: true })]),
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.slug')),
          m('input', { className: 'FormControl', value: this.slug, placeholder: 'genel-sohbet', oninput: (event: Event) => (this.slug = (event.target as HTMLInputElement).value) }),
          m('div', { className: 'helpText' }, app.translator.trans('cengizkemec-social.admin.rooms.slug_help')),
        ]),
      ]),
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.description')), m('textarea', { className: 'FormControl', rows: 2, value: this.description, oninput: (event: Event) => (this.description = (event.target as HTMLTextAreaElement).value) })]),
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.icon')), m('input', { className: 'FormControl', value: this.icon, oninput: (event: Event) => (this.icon = (event.target as HTMLInputElement).value) })]),
        m('div', { className: 'Form-group Form-group--half' }, [m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.category')), m('select', { className: 'FormControl', value: this.categoryId || '', onchange: (event: Event) => (this.categoryId = Number((event.target as HTMLSelectElement).value) || null) }, [m('option', { value: '' }, app.translator.trans('cengizkemec-social.admin.rooms.no_category')), categories.map((category: any) => m('option', { value: category.id, selected: this.categoryId === category.id }, category.name))])]),
      ]),
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.visibility')), m('select', { className: 'FormControl', value: this.visibility, onchange: (event: Event) => (this.visibility = (event.target as HTMLSelectElement).value) }, ['public', 'members', 'private', 'staff'].map((value) => m('option', { value, selected: this.visibility === value }, app.translator.trans(`cengizkemec-social.admin.rooms.visibility_options.${value}`))))]),
        m('div', { className: 'Form-group Form-group--half' }, [
          m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.capacity')),
          m('input', {
            className: 'FormControl' + (this.capacityValid() ? '' : ' FormControl--invalid'),
            type: 'number',
            min: 2,
            max: this.maxCapacity(),
            value: this.unlimitedCapacity ? '' : this.capacity,
            disabled: this.unlimitedCapacity,
            placeholder: app.translator.trans('cengizkemec-social.admin.rooms.unlimited'),
            oninput: (event: Event) => (this.capacity = Number((event.target as HTMLInputElement).value)),
          }),
            m('label', { className: 'checkbox' }, [
            m('input', {
              type: 'checkbox',
              checked: this.unlimitedCapacity,
              onchange: (event: Event) => {
                this.unlimitedCapacity = (event.target as HTMLInputElement).checked;

                if (!this.unlimitedCapacity && (!Number.isFinite(this.capacity) || this.capacity < 2)) {
                  this.capacity = Number(this.attrs.limits?.defaultRoomCapacity) || 25;
                }
              },
            }),
            ' ',
            app.translator.trans('cengizkemec-social.admin.rooms.unlimited_capacity'),
          ]),
          m('div', { className: 'helpText' }, this.unlimitedCapacity
            ? app.translator.trans('cengizkemec-social.admin.rooms.unlimited_capacity_help')
            : app.translator.trans('cengizkemec-social.admin.rooms.capacity_help', {
                min: 2,
                max: this.maxCapacity(),
              })),
        ]),
      ]),
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.sort_order')), m('input', { className: 'FormControl', type: 'number', value: this.sortOrder, oninput: (event: Event) => (this.sortOrder = Number((event.target as HTMLInputElement).value)) })]),
        m('div', { className: 'Form-group Form-group--half' }, [m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.status')), m('select', { className: 'FormControl', value: this.status, onchange: (event: Event) => (this.status = (event.target as HTMLSelectElement).value) }, ['active', 'closed'].map((value) => m('option', { value, selected: this.status === value }, value)))]),
      ]),
      this.groupPicker(),
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.admin.rooms.password')), m('input', { className: 'FormControl', type: 'password', value: this.password, oninput: (event: Event) => (this.password = (event.target as HTMLInputElement).value), placeholder: this.room?.hasPassword ? app.translator.trans('cengizkemec-social.admin.rooms.password_keep') : '' })]),
      m('div', { className: 'Form-group SocialAdminRoomModal-flags' }, [
        m('label', { className: 'checkbox' }, [m('input', { type: 'checkbox', checked: this.isVoice, onchange: (event: Event) => (this.isVoice = (event.target as HTMLInputElement).checked) }), ' ', app.translator.trans('cengizkemec-social.admin.rooms.voice')]),
        m('label', { className: 'checkbox' }, [m('input', { type: 'checkbox', checked: this.isText, onchange: (event: Event) => (this.isText = (event.target as HTMLInputElement).checked) }), ' ', app.translator.trans('cengizkemec-social.admin.rooms.text')]),
        m('label', { className: 'checkbox' }, [m('input', { type: 'checkbox', checked: this.allowScreenShare, onchange: (event: Event) => (this.allowScreenShare = (event.target as HTMLInputElement).checked) }), ' ', app.translator.trans('cengizkemec-social.admin.rooms.screen_share')]),
      ]),
      this.isVoice && this.attrs.limits?.voiceConfigured === false
        ? m('div', { className: 'Alert Alert--warning' }, app.translator.trans('cengizkemec-social.admin.rooms.voice_not_configured_hint'))
        : null,
      this.error ? m('div', { className: 'Alert Alert--error' }, this.error) : null,
      m(Button, { className: 'Button Button--primary Button--block', type: 'submit', loading: this.loading, disabled: !this.canSave() }, app.translator.trans('cengizkemec-social.admin.common.save')),
    ]));
  }
}
