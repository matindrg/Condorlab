import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://localhost:4000';

/**
 * کش سمت سرور نسل جدید بر پایه تگ Next.js (Layer 2 Server-Side Tag-Based Cache)
 * این تابع تمامی درخواست‌های کاتالوگ فروشگاه را کش کرده و با تگ 'store-products' نشانه‌گذاری می‌کند.
 * تا زمانی که تغییری در محصولات ایجاد نشود یا تگ ابطال نگردد، هیچ ترافیکی به دیتابیس تحمیل نمی‌شود.
 */
const getCachedStoreProducts = unstable_cache(
  async (category?: string, volume?: string, search?: string) => {
    const query = new URLSearchParams();
    if (category && category !== 'all') query.set('category', category);
    if (volume) query.set('volume', volume);
    if (search) query.set('search', search);

    const targetUrl = `${API_BASE_URL}/api/v1/exams${query.toString() ? `?${query.toString()}` : ''}`;
    
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
      },
      next: {
        tags: ['store-products'],
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch store products: ${response.status}`);
    }

    const data = await response.json();
    return {
      data,
      fetchedAt: Date.now(),
      version: response.headers.get('x-store-version') || `v_${Date.now().toString(36)}`,
    };
  },
  ['condorlab-store-products-v1'],
  {
    tags: ['store-products'],
    revalidate: 3600, // ۱ ساعت کش پایدار سرور (Revalidate on-demand via revalidateTag)
  }
);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') || undefined;
    const volume = url.searchParams.get('volume') || undefined;
    const search = url.searchParams.get('search') || undefined;

    // تفکیک دسترسی احراز هویت شده از کاتالوگ عمومی (Single Source of Truth & Zero User Desync)
    const hasAuth = req.cookies.has('condor_session') || req.headers.has('authorization');

    if (hasAuth) {
      // برای کاربران احراز هویت شده، واکشی مستقیم با هدایت هدرها و کوکی‌های سشن صورت می‌گیرد تا وضعیت شرکت کاربر محاسبه شود
      const query = new URLSearchParams();
      if (category && category !== 'all') query.set('category', category);
      if (volume) query.set('volume', volume);
      if (search) query.set('search', search);

      const targetUrl = `${API_BASE_URL}/api/v1/exams${query.toString() ? `?${query.toString()}` : ''}`;
      const fwdHeaders = new Headers();
      req.headers.forEach((v, k) => {
        const lower = k.toLowerCase();
        if (lower !== 'host' && lower !== 'connection') {
          fwdHeaders.set(k, v);
        }
      });

      const userRes = await fetch(targetUrl, {
        headers: fwdHeaders,
        cache: 'no-store',
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        return NextResponse.json(userData, {
          status: 200,
          headers: {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'x-condor-cache': 'USER-SESSION-DYNAMIC',
          },
        });
      }
    }

    // کاتالوگ پایه برای نمایش بدون احراز هویت مستقیماً از کش تگ‌خورده لایه ۲ سرور بارگذاری می‌شود
    const cached = await getCachedStoreProducts(category, volume, search);

    // پاسخ با هدرهای ETag و Stale-While-Revalidate استاندارد مرورگر
    return NextResponse.json(cached.data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'x-store-version': cached.version,
        'ETag': `W/"${cached.version}"`,
        'x-condor-cache': 'HIT-SERVER-LAYER2',
      },
    });
  } catch (err: any) {
    console.error('Store Caching Route Error:', err);
    // در صورت بروز خطا در کش، فال‌بک مستقیم به بک‌اند
    try {
      const url = new URL(req.url);
      const targetUrl = `${API_BASE_URL}/api/v1/exams${url.search}`;
      const directRes = await fetch(targetUrl, { cache: 'no-store' });
      const directData = await directRes.json();
      return NextResponse.json(directData, { status: directRes.status });
    } catch (fallbackErr: any) {
      return NextResponse.json(
        {
          success: false,
          message: 'خطا در ارتباط با سرور کاتالوگ فروشگاه.',
          error: fallbackErr?.message || err?.message,
        },
        { status: 503 }
      );
    }
  }
}
