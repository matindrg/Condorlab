import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://localhost:4000';

async function proxyHandler(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // حذف پیشوند /api و هدایت به /api/v1
    const subPath = url.pathname.replace(/^\/api/, '');
    const targetUrl = `${API_BASE_URL}/api/v1${subPath}${url.search}`;

    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower !== 'host' && lower !== 'connection' && lower !== 'content-length') {
        headers.set(key, value);
      }
    });

    const isBodyAllowed = !['GET', 'HEAD'].includes(req.method);
    let body: ArrayBuffer | undefined = undefined;
    if (isBodyAllowed) {
      body = await req.arrayBuffer();
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      // @ts-ignore
      duplex: 'half',
      cache: 'no-store',
    });

    const resHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        resHeaders.set(key, value);
      }
    });

    // پشتیبانی کامل از بازگرداندن کوکی‌های متعدد (مانند condor_session)
    // @ts-ignore
    if (typeof response.headers.getSetCookie === 'function') {
      // @ts-ignore
      const cookies = response.headers.getSetCookie();
      if (cookies && cookies.length > 0) {
        resHeaders.delete('set-cookie');
        cookies.forEach((cookieStr: string) => {
          resHeaders.append('set-cookie', cookieStr);
        });
      }
    }

    const resData = await response.arrayBuffer();

    return new NextResponse(resData, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error('API Proxy Error:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'خطا در ارتباط با سرور کندرلب. لطفاً از فعال بودن سرویس API اطمینان حاصل فرمایید.',
        error: err?.message,
      },
      { status: 503 }
    );
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
export const OPTIONS = proxyHandler;
export const HEAD = proxyHandler;
