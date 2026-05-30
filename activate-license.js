// Cloudflare Pages Function — /api/activate-license
// Verifies a Lemon Squeezy license key and returns a signed Pro token
//
// Environment variables needed in Cloudflare Pages:
//   LS_API_KEY       — your Lemon Squeezy API key (from LS dashboard → API)
//   LS_STORE_ID      — your Lemon Squeezy store ID
//   LS_PRODUCT_ID    — your product ID (optional, for extra validation)

export async function onRequestPost({ request, env }) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { license_key } = await request.json();

    if (!license_key) {
      return new Response(JSON.stringify({ activated: false, error: 'No license key provided' }), { status: 400, headers });
    }

    const apiKey = env.LS_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ activated: false, error: 'Server not configured. Contact support@rightpdfkit.com' }), { status: 500, headers });
    }

    // ── Validate with Lemon Squeezy API ──
    const LS_PRODUCT_ID = '1100029';
    const lsRes = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        license_key,
        instance_name: 'RightPDFKit Browser'
      })
    });

    const lsData = await lsRes.json();
    console.log('LS Response:', JSON.stringify(lsData));

    // Check if valid
    const isValid = lsData?.valid === true || lsData?.activated === true;
    const isActive = lsData?.license_key?.status === 'active';

    if (!isValid && !isActive) {
      const errMsg = lsData?.error || lsData?.message || 'License key is invalid or expired';
      return new Response(JSON.stringify({ activated: false, error: errMsg }), { headers });
    }

    // ── Build Pro token ──
    const email = lsData?.meta?.customer_email || lsData?.license_key?.customer_email || 'pro';
    const expiresAt = lsData?.license_key?.expires_at;
    
    let expiry;
    if (expiresAt) {
      expiry = new Date(expiresAt).getTime();
    } else {
      // No expiry = lifetime or subscription (default 31 days)
      expiry = Date.now() + 31 * 24 * 60 * 60 * 1000;
    }

    const tokenData = {
      expires: expiry,
      plan: 'pro',
      email: email,
      license: license_key.substring(0, 8) + '…',
      activated_at: new Date().toISOString()
    };

    const token = btoa(JSON.stringify(tokenData));

    return new Response(JSON.stringify({
      activated: true,
      token,
      email,
      days_remaining: Math.ceil((expiry - Date.now()) / 86400000),
      message: 'Pro activated successfully!'
    }), { headers });

  } catch (e) {
    console.error('License activation error:', e);
    return new Response(JSON.stringify({ 
      activated: false, 
      error: 'Verification failed. Try again or contact support@rightpdfkit.com' 
    }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
