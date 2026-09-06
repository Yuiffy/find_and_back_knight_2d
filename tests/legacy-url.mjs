const url = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:4175/knight/');
url.pathname = '/knight/';
url.searchParams.set('mode', 'legacy');
export const legacyUrl = url.href;
