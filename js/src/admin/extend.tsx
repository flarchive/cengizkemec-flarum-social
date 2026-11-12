import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import SocialAdminPage from './components/SocialAdminPage';
import { PERMISSIONS, SETTING_GROUPS } from './settings';

const permissionIcon = (permission: string): string => {
  if (permission.includes('moderate') || permission.includes('manage')) return 'fas fa-shield-halved';
  if (permission.includes('voice') || permission.includes('Room')) return 'fas fa-headset';
  if (permission.includes('Message') || permission.includes('comment')) return 'fas fa-comment';
  if (permission.includes('Media')) return 'fas fa-photo-film';
  return 'fas fa-users';
};

const admin = new Extend.Admin().page(SocialAdminPage);

PERMISSIONS.forEach(([permission, type]) => {
  admin.permission(
    () => ({
      icon: permissionIcon(permission),
      label: app.translator.trans(`cengizkemec-social.admin.permissions.${permission}`),
      permission,
    }),
    type as any
  );
});

export default [
  admin,
  new Extend.Admin().generalIndexItems('settings', () =>
    Object.keys(SETTING_GROUPS).flatMap((group) =>
      SETTING_GROUPS[group].map((item) => ({
        id: `cengizkemec-social.${item.key}`,
        label: app.translator.trans(`cengizkemec-social.admin.settings.${item.key}`),
        tree: [app.translator.trans(`cengizkemec-social.admin.tabs.${group}`) as string],
      }))
    )
  ),
];
