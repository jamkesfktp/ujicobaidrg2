import React, { useState, useEffect } from 'react';
import { Lock, Shield, ArrowRight } from 'lucide-react';

const Login = ({ onLoginSuccess , globalMonth, globalDrg}) => {
  const [password, setPassword] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captcha, setCaptcha] = useState({ a: 0, b: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateCaptcha();
  }, []);

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setCaptcha({ a: num1, b: num2 });
    setCaptchaAnswer('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Verifikasi Captcha
    if (parseInt(captchaAnswer) !== (captcha.a + captcha.b)) {
      setError('Jawaban Captcha salah. Coba lagi.');
      generateCaptcha();
      return;
    }

    setLoading(true);

    try {
      // Local dev bypass since Edge Middleware won't run on local Vite
      if (import.meta.env.DEV) {
        if (password === 'kemenkes2026') {
          localStorage.setItem('auth', 'true');
          onLoginSuccess();
        } else {
          setError('Password salah.');
          generateCaptcha();
        }
        setLoading(false);
        return;
      }

      // Vercel API Login Call
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('auth', 'true');
        onLoginSuccess();
      } else {
        setError(data.message || 'Gagal login.');
        generateCaptcha();
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan koneksi.');
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #00B1A0, #008a70, #8CC63F)',
      backgroundSize: '400% 400%',
      animation: 'gradientBG 15s ease infinite',
      fontFamily: 'Quattrocento Sans, sans-serif'
    }}>
      <style>
        {`
          @keyframes gradientBG {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}
      </style>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '48px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield size={40} color="white" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Secure Dashboard</h1>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.95rem' }}>Analisis Kebijakan iDRG Nasional</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fca5a5', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', textAlign: 'center', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password Akses</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.6)' }} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                style={{
                  width: '100%', padding: '14px 16px 14px 44px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none', transition: 'all 0.3s ease'
                }}
                onFocus={e => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                onBlur={e => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verifikasi Keamanan</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px 20px', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', letterSpacing: '2px', border: '1px solid rgba(255, 255, 255, 0.1)', flexShrink: 0 }}>
                {captcha.a} + {captcha.b} =
              </div>
              <input 
                type="number" 
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                placeholder="Hasil"
                style={{
                  width: '100%', padding: '14px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', color: 'white', fontSize: '1.1rem', fontWeight: 700, outline: 'none', textAlign: 'center', transition: 'all 0.3s ease'
                }}
                onFocus={e => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                onBlur={e => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%', padding: '16px', background: 'white', color: '#008a70', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s ease', opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {loading ? 'Memverifikasi...' : (
              <>Buka Dashboard <ArrowRight size={18} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
