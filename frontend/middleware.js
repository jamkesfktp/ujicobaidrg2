export const config = {
  matcher: '/data/:path*',
};

export default function middleware(request) {
  const cookieHeader = request.headers.get('cookie');
  
  if (!cookieHeader || !cookieHeader.includes('auth_token=kemenkes_secure_idrg')) {
    return new Response(JSON.stringify({ error: 'Unauthorized Access. Gembok Keamanan Vercel Aktif. Harap login.' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  // Continue the request
}
