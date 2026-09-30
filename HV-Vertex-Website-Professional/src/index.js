const BUSINESS_EMAIL = 'hr@hvvertex.in';
const SENDER_EMAIL = 'hr@hvvertex.in';
const WEB3FORMS_KEY = 'cce5df4d-f1e3-417a-aa46-dc6a871b73e7';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CONTACT_MESSAGE = 5000;
const MAX_NAME = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function safeSubject(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 180);
}

function clean(value, max = 10000) {
  return String(value ?? '').trim().slice(0, max);
}

function validEmail(value) {
  return EMAIL_RE.test(String(value || '').trim().toLowerCase());
}

function validUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function corsHeaders() {
  return {};
}

function setSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function constantTimeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function issueCsrfToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function csrfResponse(token) {
  return json({ success: true, token }, 200, {
    'Set-Cookie': `hv_csrf=${token}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax; Secure`,
  });
}

function validCsrf(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const cookieToken = getCookie(request, 'hv_csrf');
  const headerToken = request.headers.get('X-CSRF-Token');
  return constantTimeEqual(cookieToken, headerToken);
}

async function checkRateLimit(env, bindingName, key) {
  const limiter = env[bindingName];
  if (!limiter) return true;
  const result = await limiter.limit({ key });
  return result.success;
}

function clientKey(request, pathname) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return `${pathname}:${ip}`;
}

async function sendEmailViaWeb3Forms({ subject, text, replyTo }) {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      subject: safeSubject(subject),
      replyto: replyTo,
      message: text,
    }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.message || 'Failed to send message.');
  return { messageId: data.success ? 'sent' : null };
}

async function sendContact(request, env) {
  if (!(await checkRateLimit(env, 'CONTACT_LIMITER', clientKey(request, '/api/contact')))) {
    return json({ success: false, message: 'Too many submissions. Please try again later.' }, 429);
  }
  const data = await request.json().catch(() => null);
  if (!data) return json({ success: false, message: 'Invalid form submission.' }, 400);

  const fullName = clean(data.full_name, MAX_NAME);
  const email = clean(data.email, 254).toLowerCase();
  const phone = clean(data.phone, 50);
  const service = clean(data.service, 160) || 'General';
  const message = clean(data.message, MAX_CONTACT_MESSAGE);

  if (!fullName || !validEmail(email) || !message || fullName.length > MAX_NAME || message.length > MAX_CONTACT_MESSAGE) {
    return json({ success: false, message: 'Please provide a valid full name, email, and message.' }, 400);
  }

  const textBody = `New Contact / Quote Inquiry\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nService: ${service}\nMessage:\n${message}`;

  const result = await sendEmailViaWeb3Forms({
    subject: `New Contact Inquiry: ${service} - ${fullName}`,
    replyTo: email,
    text: textBody,
  });

  return json({ success: true, message: 'Thank you! Your message has been received. Our team will contact you shortly.', messageId: result.messageId }, 201);
}

async function sendStudent(request, env) {
  if (!(await checkRateLimit(env, 'STUDENT_LIMITER', clientKey(request, '/api/students')))) {
    return json({ success: false, message: 'Too many submissions. Please try again later.' }, 429);
  }
  const form = await request.formData();
  const fullName = clean(form.get('full_name'), MAX_NAME);
  const email = clean(form.get('email'), 254).toLowerCase();
  const phone = clean(form.get('phone'), 50);
  const college = clean(form.get('college'), 200);
  const department = clean(form.get('department'), 160);
  const hardware = clean(form.get('hardware_required'), 5000);
  const project = clean(form.get('project_purpose'), 5000);
  const proof = form.get('student_proof');

  if (!fullName || !validEmail(email) || !college || !hardware) {
    return json({ success: false, message: 'Please provide your name, email, college, and hardware requirements.' }, 400);
  }

  const textBody = `Student Academic Discount Application\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nCollege / University: ${college}\nCourse / Branch / Year: ${department || 'Not provided'}\nHardware / Components Required:\n${hardware}\nProject / Purpose:\n${project || 'Not provided'}\n*(Note: Student proof file was submitted via form).*`;

  const result = await sendEmailViaWeb3Forms({
    subject: `New Student Discount Application - ${fullName}`,
    replyTo: email,
    text: textBody,
  });

  return json({ success: true, message: 'Student discount application received successfully!', messageId: result.messageId }, 201);
}

async function sendCareer(request, env) {
  if (!(await checkRateLimit(env, 'CAREER_LIMITER', clientKey(request, '/api/careers')))) {
    return json({ success: false, message: 'Too many applications. Please try again later.' }, 429);
  }
  const form = await request.formData();
  const fullName = clean(form.get('full_name'), MAX_NAME);
  const email = clean(form.get('email'), 254).toLowerCase();
  const phone = clean(form.get('phone'), 50);
  const role = clean(form.get('role'), 200);
  const experience = clean(form.get('experience'), 2000);
  const portfolio = clean(form.get('portfolio_link'), 1000);
  const message = clean(form.get('message'), 5000);

  if (!fullName || !validEmail(email) || !role) {
    return json({ success: false, message: 'Please provide your name, email, and selected job role.' }, 400);
  }
  if (!validUrl(portfolio)) {
    return json({ success: false, message: 'Please provide a valid portfolio, GitHub, or LinkedIn URL.' }, 400);
  }

  const textBody = `Job Application\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nRole: ${role}\nExperience: ${experience || 'Not specified'}\nPortfolio / LinkedIn / GitHub: ${portfolio || 'Not provided'}\nMessage:\n${message || ''}\n*(Note: Resume file was submitted via form).*`;

  const result = await sendEmailViaWeb3Forms({
    subject: `New Job Application: ${role} - ${fullName}`,
    replyTo: email,
    text: textBody,
  });

  return json({ success: true, message: 'Application submitted successfully!', messageId: result.messageId }, 201);
}

async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (url.pathname === '/api/csrf' && request.method === 'GET') return csrfResponse(issueCsrfToken());
  if (url.pathname === '/api/health' && request.method === 'GET') return json({ status: 'ok', service: 'HV VERTEX ELECTRONICS Cloudflare Worker API', timestamp: new Date().toISOString() });
  if (!sameOrigin(request)) return json({ success: false, message: 'Cross-origin request blocked.' }, 403);
  if (!validCsrf(request)) return json({ success: false, message: 'Invalid CSRF token.' }, 403);

  try {
    if (url.pathname === '/api/contact' && request.method === 'POST') return await sendContact(request, env);
    if (url.pathname === '/api/students' && request.method === 'POST') return await sendStudent(request, env);
    if (url.pathname === '/api/careers' && request.method === 'POST') return await sendCareer(request, env);
    return json({ success: false, message: 'API endpoint not found.' }, 404);
  } catch (error) {
    console.error('API error:', error);
    return json({ success: false, message: 'Unable to process the request right now. Please try again later.' }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/api/')) {
      return setSecurityHeaders(await handleApi(request, env, ctx));
    }

    const pathToAsset = {
      '/': '/index.html',
      '/home': '/index.html',
      '/products': '/products.html',
      '/students': '/students.html',
      '/about': '/about.html',
      '/careers': '/careers.html',
      '/contact': '/contact.html'
    };

    const target = pathToAsset[url.pathname] || url.pathname;
    
    try {
      const assetUrl = new URL(target, request.url);
      const assetResponse = await env.ASSETS.fetch(assetUrl);
      if (assetResponse.status !== 404) {
        return setSecurityHeaders(assetResponse);
      }
    } catch (e) {}

    try {
      const notFoundUrl = new URL('/404.html', request.url);
      const notFound = await env.ASSETS.fetch(notFoundUrl);
      return setSecurityHeaders(new Response(notFound.body, { status: 404, headers: notFound.headers }));
    } catch (e) {
      return new Response("Not Found", { status: 404 });
    }
  },
};
