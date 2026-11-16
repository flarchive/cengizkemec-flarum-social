import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { patch, post } from '../../common/api';

export default class RoomCreateModal extends Modal {
  name = '';
  description = '';
  visibility = 'public';
  capacity = 15;
  password = '';
  isVoice = true;
  isText = true;
  allowScreenShare = true;
  lifetime = 12;
  categoryId: number | null = null;
  categories: any[] = [];
  loading = false;
  error: string | null = null;
  editing: any = null;

  oninit(vnode: any) {
    super.oninit(vnode);
    const room = vnode.attrs.room || null;
    this.editing = room;
    this.name = room?.name || '';
    this.description = room?.description || '';
    this.visibility = room?.visibility || 'public';
    this.capacity = room?.capacity || 15;
    this.isVoice = room ? room.isVoice : true;
    this.isText = room ? room.isText : true;
    this.allowScreenShare = room ? room.allowScreenShare : true;
    this.lifetime = 12;
    this.categories = vnode.attrs.categories || [];
    const requestedCategory = Number(vnode.attrs.categoryId) || null;
    this.categoryId = this.categories.some((category: any) => Number(category.id) === requestedCategory)
      ? requestedCategory
      : this.categories.length
      ? Number(this.categories[0].id)
      : null;
  }

  className(): string {
    return 'Modal--small SocialRoomModal';
  }

  title(): string {
    return app.translator.trans(this.editing ? 'cengizkemec-social.forum.rooms.edit_title' : 'cengizkemec-social.forum.rooms.create_title') as string;
  }

  submit(): void {
    if (this.loading) return;
    this.loading = true;
    this.error = null;

    const payload = {
      name: this.name,
      description: this.description,
      visibility: this.visibility,
      capacity: this.capacity,
      password: this.password,
      is_voice: this.isVoice,
      is_text: this.isText,
      allow_screen_share: this.allowScreenShare,
      lifetime_hours: this.lifetime,
      category_id: this.categoryId,
    };

    const promise = this.editing
      ? patch(`/social/rooms/${this.editing.id}`, payload)
      : post('/social/rooms', payload);

    promise
      .then((response: any) => {
        this.attrs.oncreated?.(response.data);
        this.hide();
      })
      .catch((error: any) => (this.error = error.message))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  content(): any {
    const max = app.forum.attribute('socialEnabled') ? 25 : 25;

    return m('div', { className: 'Modal-body' }, m('form', {
      onsubmit: (event: Event) => {
        event.preventDefault();
        this.submit();
      },
    }, [
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.name')), m('input', { className: 'FormControl', value: this.name, maxlength: 100, oninput: (event: Event) => (this.name = (event.target as HTMLInputElement).value), required: true })]),
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.description')), m('textarea', { className: 'FormControl', rows: 3, maxlength: 1000, value: this.description, oninput: (event: Event) => (this.description = (event.target as HTMLTextAreaElement).value) })]),
      this.categories.length
        ? m('div', { className: 'Form-group' }, [
            m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.category')),
            m('select', {
              className: 'FormControl',
              value: String(this.categoryId ?? ''),
              onchange: (event: Event) => (this.categoryId = Number((event.target as HTMLSelectElement).value) || null),
            }, this.categories.map((category: any) => m('option', { value: category.id }, category.name))),
          ])
        : null,
      m('div', { className: 'Form-row' }, [
        m('div', { className: 'Form-group Form-group--half' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.visibility')), m('select', { className: 'FormControl', value: this.visibility, onchange: (event: Event) => (this.visibility = (event.target as HTMLSelectElement).value) }, ['public', 'private', 'invite'].map((value) => m('option', { value, selected: this.visibility === value }, app.translator.trans(`cengizkemec-social.forum.rooms.visibility_options.${value}`))))]),
        m('div', { className: 'Form-group Form-group--half' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.capacity')), m('input', { className: 'FormControl', type: 'number', min: 2, max, value: this.capacity, oninput: (event: Event) => (this.capacity = Number((event.target as HTMLInputElement).value)) })]),
      ]),
      m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.password')), m('input', { className: 'FormControl', type: 'password', value: this.password, oninput: (event: Event) => (this.password = (event.target as HTMLInputElement).value), placeholder: this.editing?.hasPassword ? app.translator.trans('cengizkemec-social.forum.rooms.password_keep') : '' })]),
      m('div', { className: 'Form-group SocialRoomModal-toggles' }, [
        m('label', { className: 'checkbox' }, [m('input', { type: 'checkbox', checked: this.isVoice, onchange: (event: Event) => (this.isVoice = (event.target as HTMLInputElement).checked) }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.voice')]),
        m('label', { className: 'checkbox' }, [m('input', { type: 'checkbox', checked: this.isText, onchange: (event: Event) => (this.isText = (event.target as HTMLInputElement).checked) }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.text')]),
        m('label', { className: 'checkbox' }, [m('input', { type: 'checkbox', checked: this.allowScreenShare, onchange: (event: Event) => (this.allowScreenShare = (event.target as HTMLInputElement).checked) }), ' ', app.translator.trans('cengizkemec-social.forum.rooms.screen_share')]),
      ]),
      !this.editing ? m('div', { className: 'Form-group' }, [m('label', {}, app.translator.trans('cengizkemec-social.forum.rooms.lifetime')), m('input', { className: 'FormControl', type: 'number', min: 1, max: 72, value: this.lifetime, oninput: (event: Event) => (this.lifetime = Number((event.target as HTMLInputElement).value)) })]) : null,
      this.error ? m('div', { className: 'Alert Alert--error' }, this.error) : null,
      m(Button, { className: 'Button Button--primary Button--block', type: 'submit', loading: this.loading, disabled: !this.name.trim() || (this.categories.length > 0 && this.categoryId === null) }, app.translator.trans(this.editing ? 'cengizkemec-social.forum.post.save' : 'cengizkemec-social.forum.rooms.create')),
    ]));
  }
}
