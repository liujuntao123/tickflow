import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const backend = process.env.BACKEND_URL ?? 'http://localhost:3000';
  const url = new URL(req.url);
  const target = `${backend}/api/v1/${path.join('/')}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method)
      ? undefined
      : await req.arrayBuffer(),
    redirect: 'manual',
  };

  const res = await fetch(target, init);

  const resHeaders = new Headers(res.headers);
  resHeaders.delete('content-encoding');
  resHeaders.delete('content-length');
  resHeaders.delete('transfer-encoding');

  // 保留多个 set-cookie（refresh token 的 httpOnly cookie）
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    resHeaders.delete('set-cookie');
    for (const cookie of setCookies) resHeaders.append('set-cookie', cookie);
  }

  return new Response(res.body, { status: res.status, headers: resHeaders });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};