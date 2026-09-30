const BUSINESS_EMAIL = 'hr@hvvertex.in';
const SENDER_EMAIL = 'hr@hvvertex.in';
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

async function sendEmail(env, { subject, html, text, replyTo, attachments = [] }) {
  if (!env.EMAIL) throw new Error('Cloudflare Email Service binding is not configured.');
  return env.EMAIL.send({
    to: BUSINESS_EMAIL,
    from: SENDER_EMAIL,
    subject: safeSubject(subject),
    html,
    text,
    replyTo: replyTo || undefined,
    attachments,
  });
}

async function attachmentFromFile(file) {
  if (!file) return null;
  return {
    filename: file.name,
    content: await file.arrayBuffer(),
    type: file.type || 'application/octet-stream',
    disposition: 'attachment',
  };
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

  const safe = {
    name: htmlEscape(fullName), email: htmlEscape(email), phone: htmlEscape(phone || 'Not provided'),
    service: htmlEscape(service), message: htmlEscape(message).replace(/\n/g, '<br>'),
  };

  const result = await sendEmail(env, {
    subject: `New Contact Inquiry: ${service} - ${fullName}`,
    replyTo: email,
    html: `<h2>New Contact / Quote Inquiry</h2><p><strong>Name:</strong> ${safe.name}</p><p><strong>Email:</strong> ${safe.email}</p><p><strong>Phone:</strong> ${safe.phone}</p><p><strong>Service:</strong> ${safe.service}</p><p><strong>Message:</strong></p><p>${safe.message}</p>`,
    text: `New Contact / Quote Inquiry\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nService: ${service}\nMessage:\n${message}`,
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

  if (!fullName || !validEmail(email) || !college || !hardware || !proof || typeof proof.arrayBuffer !== 'function') {
    return json({ success: false, message: 'Please provide your name, email, college, hardware requirements, and student proof.' }, 400);
  }
  if (proof.size === 0 || proof.size > MAX_FILE_BYTES) {
    return json({ success: false, message: 'Student proof must be a non-empty PDF, JPG, or PNG up to 5 MB.' }, 413);
  }
  const proofName = proof.name || 'student-proof';
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (!allowed.has(proof.type) || !/\.(pdf|jpe?g|png)$/i.test(proofName)) {
    return json({ success: false, message: 'Please upload your student proof as a PDF, JPG, or PNG file.' }, 400);
  }

  const safe = {
    name: htmlEscape(fullName), email: htmlEscape(email), phone: htmlEscape(phone || 'Not provided'),
    college: htmlEscape(college), department: htmlEscape(department || 'Not provided'),
    hardware: htmlEscape(hardware).replace(/\n/g, '<br>'), project: htmlEscape(project || 'Not provided').replace(/\n/g, '<br>'),
    proof: htmlEscape(proofName),
  };
  const attachment = await attachmentFromFile(proof);
  const result = await sendEmail(env, {
    subject: `New Student Discount Application - ${fullName}`,
    replyTo: email,
    attachments: [attachment],
    html: `<h2>Student Academic Discount Application</h2><p><strong>Name:</strong> ${safe.name}</p><p><strong>Email:</strong> ${safe.email}</p><p><strong>Phone:</strong> ${safe.phone}</p><p><strong>College / University:</strong> ${safe.college}</p><p><strong>Course / Branch / Year:</strong> ${safe.department}</p><p><strong>Request:</strong> Academic Discount Application</p><p><strong>Hardware / Components Required:</strong></p><p>${safe.hardware}</p><p><strong>Project / Purpose:</strong></p><p>${safe.project}</p><p><strong>Student Proof:</strong> Attached: ${safe.proof}</p>`,
    text: `Student Academic Discount Application\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nCollege / University: ${college}\nCourse / Branch / Year: ${department || 'Not provided'}\nRequest: Academic Discount Application\nHardware / Components Required:\n${hardware}\nProject / Purpose:\n${project || 'Not provided'}\nStudent Proof: Attached: ${proofName}`,
  });

  return json({ success: true, message: 'Student discount application received! Your student proof has been attached to the application email.', messageId: result.messageId }, 201);
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
  const resume = form.get('resume');

  if (!fullName || !validEmail(email) || !role || !resume || typeof resume.arrayBuffer !== 'function') {
    return json({ success: false, message: 'Please provide your name, email, selected job role, and resume PDF.' }, 400);
  }
  if (resume.size === 0 || resume.size > MAX_FILE_BYTES) {
    return json({ success: false, message: 'Resume must be a non-empty PDF up to 5 MB.' }, 413);
  }
  if (resume.type !== 'application/pdf' || !/\.pdf$/i.test(resume.name || '')) {
    return json({ success: false, message: 'Please upload your resume as a PDF file.' }, 400);
  }
  if (!validUrl(portfolio)) {
    return json({ success: false, message: 'Please provide a valid portfolio, GitHub, or LinkedIn URL.' }, 400);
  }

  const safePortfolio = portfolio
    ? `<a href="${htmlEscape(portfolio)}" rel="noopener noreferrer">${htmlEscape(portfolio)}</a>`
    : 'Not provided';
  const safe = {
    name: htmlEscape(fullName), email: htmlEscape(email), phone: htmlEscape(phone || 'Not provided'),
    role: htmlEscape(role), experience: htmlEscape(experience || 'Not specified'),
    portfolio: safePortfolio, resume: htmlEscape(resume.name), message: htmlEscape(message || '').replace(/\n/g, '<br>'),
  };
  const attachment = await attachmentFromFile(resume);
  const result = await sendEmail(env, {
    subject: `New Job Application: ${role} - ${fullName}`,
    replyTo: email,
    attachments: [attachment],
    html: `<h2>Job Application</h2><p><strong>Name:</strong> ${safe.name}</p><p><strong>Email:</strong> ${safe.email}</p><p><strong>Phone:</strong> ${safe.phone}</p><p><strong>Role:</strong> ${safe.role}</p><p><strong>Experience:</strong> ${safe.experience}</p><p><strong>Portfolio / LinkedIn / GitHub:</strong> ${safe.portfolio}</p><p><strong>Resume:</strong> Attached: ${safe.resume}</p><p><strong>Message:</strong></p><p>${safe.message}</p>`,
    text: `Job Application\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nRole: ${role}\nExperience: ${experience || 'Not specified'}\nPortfolio / LinkedIn / GitHub: ${portfolio || 'Not provided'}\nResume: Attached: ${resume.name}\nMessage:\n${message || ''}`,
  });

  return json({ success: true, message: 'Application submitted successfully! Your resume has been attached to the application email.', messageId: result.messageId }, 201);
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

    const assetResponse = await env.ASSETS.fetch(request);
    return setSecurityHeaders(assetResponse);
  },
};
