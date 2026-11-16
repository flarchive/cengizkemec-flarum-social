import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import { post } from '../../common/api';

const ENDPOINTS: Record<string, string> = {
  post: 'posts',
  comment: 'comments',
  media: 'media',
  message: 'messages',
};

export default class ReportModal extends Modal {
  subjectType = 'post';
  subjectId = 0;
  reason = 'spam';
  details = '';
  loading = false;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.subjectType = vnode.attrs.subjectType || 'post';
    this.subjectId = vnode.attrs.subjectId;
  }

  className(): string {
    return 'Modal--small SocialReportModal';
  }

  title(): string {
    return app.translator.trans('cengizkemec-social.forum.report.title') as string;
  }

  content(): any {
    return m('div', { className: 'Modal-body' }, m('form', {
      onsubmit: (event: Event) => {
        event.preventDefault();
        this.loading = true;
        const endpoint = ENDPOINTS[this.subjectType] || 'posts';
        post(`/social/${endpoint}/${this.subjectId}/report`, { reason: this.reason, details: this.details })
          .then(() => {
            app.alerts.show({ type: 'success' }, app.translator.trans('cengizkemec-social.forum.report.submitted'));
            this.hide();
          })
          .catch((error: any) => app.alerts.show({ type: 'error' }, error.message))
          .finally(() => {
            this.loading = false;
            m.redraw();
          });
      },
    }, [
      m('div', { className: 'Form-group' }, [
        m('label', {}, app.translator.trans('cengizkemec-social.forum.report.reason')),
        m('select', { className: 'FormControl', onchange: (event: Event) => (this.reason = (event.target as HTMLSelectElement).value) },
          ['spam', 'abuse', 'harassment', 'nsfw', 'other'].map((reason) =>
            m('option', { value: reason, selected: this.reason === reason }, app.translator.trans(`cengizkemec-social.forum.report.reasons.${reason}`))
          )
        ),
      ]),
      m('div', { className: 'Form-group' }, [
        m('label', {}, app.translator.trans('cengizkemec-social.forum.report.details')),
        m('textarea', {
          className: 'FormControl',
          rows: 4,
          maxlength: 1000,
          oninput: (event: Event) => (this.details = (event.target as HTMLTextAreaElement).value),
          placeholder: app.translator.trans('cengizkemec-social.forum.report.details_placeholder'),
        }),
      ]),
      m('div', { className: 'Form-group' }, m(Button, { className: 'Button Button--primary Button--block', type: 'submit', loading: this.loading }, app.translator.trans('cengizkemec-social.forum.report.submit'))),
    ]));
  }
}
