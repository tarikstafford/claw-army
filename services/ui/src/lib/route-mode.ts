export const BACK_OFFICE_ROUTE_PREFIXES = ['/evolution', '/tools', '/akashic'] as const;

export function isBackOfficeRoute(pathname: string): boolean {
  return BACK_OFFICE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function getNavVariant(pathname: string): 'marketing' | 'app' {
  return pathname === '/' ? 'marketing' : 'app';
}

export function getAuroraVariant(pathname: string): 'marketing' | 'front-office' | 'back-office' {
  if (pathname === '/') {
    return 'marketing';
  }

  return isBackOfficeRoute(pathname) ? 'back-office' : 'front-office';
}
