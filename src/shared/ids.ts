/**
 * Generate a stable, locally-unique id for a connected site. Used as the
 * SiteConnection.id — independent of the site URL so a site can be re-pointed
 * without losing its identity / overview position.
 */
export function newSiteId(): string {
  return `site-${crypto.randomUUID()}`;
}
