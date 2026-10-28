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
      const lower = key.toLowerCase();
      if (lower !== 'content-encoding' && lower !== 'set-cookie') {
        resHeaders.set(key, value);
      }
    });

    // پشتیبانی اختصاصی از جریان‌های بلادرنگ SSE (Server-Sent Events)
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
      });
    }

    const resData = await response.arrayBuffer();

    const nextResponse = new NextResponse(resData, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });

    // تنظیم و بازگرداندن امن کوکی‌ها به کلاینت (مانند condor_session) بدون خطای Double URL-Encoding
    // @ts-ignore
    if (typeof response.headers.getSetCookie === 'function') {
      // @ts-ignore
      const cookies: string[] = response.headers.getSetCookie();
      for (const cookieStr of cookies) {
        try {
          const parts = cookieStr.split(';');
          const [nameVal] = parts;
          const [rawName, ...rawValParts] = nameVal.trim().split('=');
          const cookieName = rawName.trim();
          let rawVal = rawValParts.join('=');

          // رمزگشایی یک لایه قبل از ارسال به cookies.set تا در زمان انکود مجدد Next.js دچار خطای %25 نشود
          let cookieVal = rawVal;
          try {
            cookieVal = decodeURIComponent(rawVal);
          } catch {
            cookieVal = rawVal;
          }

          let maxAge: number | undefined = undefined;
          let expires: Date | undefined = undefined;
          let path = '/';
          let httpOnly = false;
          let secure = false;
          let sameSite: 'lax' | 'strict' | 'none' = 'lax';

          for (let i = 1; i < parts.length; i++) {
            const flag = parts[i].trim();
            const lower = flag.toLowerCase();
            if (lower.startsWith('max-age=')) {
              maxAge = parseInt(flag.split('=')[1], 10);
            } else if (lower.startsWith('expires=')) {
              expires = new Date(flag.substring(flag.indexOf('=') + 1));
            } else if (lower.startsWith('path=')) {
              path = flag.split('=')[1] || '/';
            } else if (lower === 'httponly') {
              httpOnly = true;
            } else if (lower === 'secure') {
              secure = true;
            } else if (lower.startsWith('samesite=')) {
              const val = flag.split('=')[1]?.toLowerCase();
              if (val === 'strict' || val === 'none' || val === 'lax') {
                sameSite = val;
              }
            }
          }

          const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
          if (isLocalhost) {
            secure = false;
          }

          nextResponse.cookies.set({
            name: cookieName,
            value: cookieVal,
            path,
            maxAge,
            expires,
            httpOnly,
            secure,
            sameSite,
          });
        } catch {
          // fallback
        }
      }
    }

    return nextResponse;
  } catch (err: any) {
    console.error('API Proxy Error:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.',
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
