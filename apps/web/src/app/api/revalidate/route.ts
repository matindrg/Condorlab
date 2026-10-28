import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

/**
 * ابطال بلادرنگ کش سمت سرور (On-Demand Cache Invalidation)
 * فراخوانی از سمت پنل مدیریت، وب‌هوک سفارشات، یا اضافه شدن محصول/تغییر موجودی
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tag = url.searchParams.get('tag') || 'store-products';
    const secret = url.searchParams.get('secret') || req.headers.get('x-revalidate-secret');

    // تایید هویت ساده جهت پیشگیری از ابطال نامحدود توسط عموم
    const expectedSecret = process.env.REVALIDATION_SECRET || 'condor-revalidate-key-secure';
    if (secret && secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, message: 'کلید امنیتی ابطال نامعتبر است.' },
        { status: 401 }
      );
    }

    // ابطال آنی کش تگ
    revalidateTag(tag);

    return NextResponse.json({
      success: true,
      revalidated: true,
      tag,
      invalidatedAt: new Date().toISOString(),
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'خطا در ابطال کش تگ', error: err?.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
