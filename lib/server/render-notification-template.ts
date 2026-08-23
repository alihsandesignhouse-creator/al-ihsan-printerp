/**
 * Replaces `{{key}}` tokens in a stored notification template
 * (lib/types/tenant.ts NotificationTemplates / lib/server/plan-features.ts
 * DEFAULT_NOTIFICATION_TEMPLATES) with real values. Unknown tokens are left
 * untouched rather than blanked out, so a typo in a tenant's custom
 * template degrades gracefully instead of silently dropping text.
 */
export function renderNotificationTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key]! : match
  );
}
