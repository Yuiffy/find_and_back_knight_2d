const url = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:4175/knight/');
url.searchParams.set('mode', 'lantern');
export const lanternUrl = url.href;
