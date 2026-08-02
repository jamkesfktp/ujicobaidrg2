export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  
  const { password } = req.body || {};
  
  if (password === 'kemenkes2026') {
    // Set an HttpOnly cookie valid for 1 day
    res.setHeader('Set-Cookie', 'auth_token=kemenkes_secure_idrg; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Password salah' });
  }
}
