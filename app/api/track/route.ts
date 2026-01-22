// app/api/track/route.ts
import { NextRequest, NextResponse } from 'next/server';

// 用于存储访问记录（生产环境建议用数据库）
// 这里用内存存储，服务器重启后会清空
const visitLogs: Array<{
  timestamp: string;
  country: string;
  city: string;
  region: string;
  ip: string;
  event: string;
}> = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event || 'unknown';

    // 从请求头获取 IP 地址
    // Vercel 会在这些 header 中传递真实 IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

    // 使用免费的 IP 地理位置 API
    let locationData = { country: 'Unknown', city: 'Unknown', regionName: 'Unknown' };

    if (ip && ip !== 'unknown' && ip !== '::1' && ip !== '127.0.0.1') {
      try {
        // ip-api.com 是免费的，每分钟限制 45 次请求
        const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
        const geoData = await geoResponse.json();

        if (geoData.status === 'success') {
          locationData = geoData;
        }
      } catch (geoError) {
        console.error('Geolocation lookup failed:', geoError);
      }
    }

    // 记录访问日志
    const logEntry = {
      timestamp: new Date().toISOString(),
      country: locationData.country,
      city: locationData.city,
      region: locationData.regionName,
      ip: ip.substring(0, 8) + '***', // 部分隐藏 IP 保护隐私
      event: event,
    };

    visitLogs.push(logEntry);

    // 只保留最近 1000 条记录，防止内存溢出
    if (visitLogs.length > 1000) {
      visitLogs.shift();
    }

    // 打印到 Vercel 日志，方便查看
    console.log('[Visitor]', JSON.stringify(logEntry));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// GET 请求用于查看统计数据（可选，加个简单密码保护）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const password = searchParams.get('password');

  // 简单的密码保护，防止任何人都能看到数据
  if (password !== 'felix-stats') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 统计各国家/城市的访问次数
  const countryStats: Record<string, number> = {};
  const cityStats: Record<string, number> = {};

  visitLogs.forEach(log => {
    countryStats[log.country] = (countryStats[log.country] || 0) + 1;
    const cityKey = `${log.city}, ${log.country}`;
    cityStats[cityKey] = (cityStats[cityKey] || 0) + 1;
  });

  return NextResponse.json({
    totalVisits: visitLogs.length,
    byCountry: countryStats,
    byCity: cityStats,
    recentLogs: visitLogs.slice(-50), // 最近 50 条记录
  });
}