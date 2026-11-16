import app from 'flarum/admin/app';
import { extend } from 'flarum/common/extend';
import BasicsPage from 'flarum/admin/components/BasicsPage';

export { default as extend } from './extend';

app.initializers.add('cengizkemec-social', () => {
  extend(BasicsPage, 'homePageItems', (items: any) => {
    items.add('social', {
      path: '/social',
      label: app.translator.trans('cengizkemec-social.admin.homepage_label'),
    });
  });
});
