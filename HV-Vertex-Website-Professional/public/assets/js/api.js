// HV VERTEX - same-origin API client for Cloudflare Workers
let csrfToken = null;

async function fetchCsrfToken() {
  const res = await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error('Could not initialize secure session.');
  csrfToken = data.token;
  return csrfToken;
}

async function ensureCsrfToken(force = false) {
  if (!force && csrfToken) return csrfToken;
  return fetchCsrfToken();
}

async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = { method, credentials: 'same-origin', headers: {} };
  if (data !== null && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    options.headers['X-CSRF-Token'] = await ensureCsrfToken();
    if (data instanceof FormData) {
      options.body = data;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
  }

  try {
    let res = await fetch(endpoint, options);
    // Refresh once if the CSRF cookie/token pair has expired or rotated.
    if (res.status === 403 && options.headers['X-CSRF-Token']) {
      csrfToken = null;
      options.headers['X-CSRF-Token'] = await ensureCsrfToken(true);
      res = await fetch(endpoint, options);
    }
    const contentType = res.headers.get('content-type') || '';
    const result = contentType.includes('application/json')
      ? await res.json()
      : { success: false, message: await res.text() };
    return { ok: res.ok, status: res.status, ...result };
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    return { ok: false, success: false, message: 'Could not connect to HV Vertex server.' };
  }
}

async function apiSubmitContact(formData) { return apiRequest('/api/contact', 'POST', formData); }
async function apiSubmitStudent(formData) { return apiRequest('/api/students', 'POST', formData); }
async function apiSubmitCareer(formData) { return apiRequest('/api/careers', 'POST', formData); }

function showFormStatus(el, ok, message) {
  if (!el) return;
  el.classList.remove('hidden');
  el.textContent = message;
  el.className = ok
    ? 'text-center font-orbitron text-xs p-3 rounded-xl bg-[#39d619]/10 text-[#39d619] border border-[#39d619]/30'
    : 'text-center font-orbitron text-xs p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30';
}

function setSubmitBusy(btn, busy, idleLabel) {
  if (!btn) return;
  btn.disabled = busy;
  btn.style.opacity = busy ? '0.7' : '1';
  const label = btn.querySelector('span') || btn;
  if (busy) {
    btn.dataset.idleLabel = btn.dataset.idleLabel || label.textContent.trim();
    label.textContent = 'Submitting…';
  } else {
    label.textContent = idleLabel || btn.dataset.idleLabel || label.textContent;
  }
}

async function handleContactSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('contact-submit-btn');
  const status = document.getElementById('contact-status-msg');
  const fullName = document.getElementById('name')?.value?.trim() || '';
  const email = document.getElementById('email')?.value?.trim() || '';
  const phone = document.getElementById('phone')?.value?.trim() || '';
  const service = document.getElementById('service-select')?.value || 'General';
  const message = document.getElementById('message')?.value?.trim() || '';

  setSubmitBusy(btn, true);
  const result = await apiSubmitContact({ full_name: fullName, email, phone, service, message });
  setSubmitBusy(btn, false, 'Send Inquiry Message');
  showFormStatus(status, result.ok && result.success, result.message || (result.ok ? 'Message sent.' : 'Submission failed.'));
  if (result.ok && result.success) event.target.reset();
}

async function handleStudentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const btn = document.getElementById('student-submit-btn');
  const status = document.getElementById('student-status-msg');
  const proofInput = document.getElementById('student-proof');
  const proofFile = proofInput?.files?.[0];
  const fullName = document.getElementById('student-name')?.value?.trim() || '';
  const email = document.getElementById('student-email')?.value?.trim() || '';
  const college = document.getElementById('student-college')?.value?.trim() || '';
  const branch = document.getElementById('student-branch')?.value?.trim() || '';
  const phone = document.getElementById('student-phone')?.value?.trim() || '';
  const hardware = document.getElementById('student-hardware')?.value?.trim() || '';
  const project = document.getElementById('student-project')?.value?.trim() || '';

  if (!proofFile) return showFormStatus(status, false, 'Please upload your student ID or bonafide certificate.');
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (!(allowedTypes.has(proofFile.type) || /\.(pdf|jpe?g|png)$/i.test(proofFile.name))) {
    proofInput.value = '';
    return showFormStatus(status, false, 'Please upload the student proof as a PDF, JPG, or PNG file.');
  }
  if (proofFile.size > 5 * 1024 * 1024) {
    proofInput.value = '';
    return showFormStatus(status, false, 'Student proof is too large. Maximum size is 5 MB.');
  }
  if (!hardware) return showFormStatus(status, false, 'Please tell us which hardware or components you need.');

  const formData = new FormData();
  formData.append('full_name', fullName);
  formData.append('email', email);
  formData.append('phone', phone);
  formData.append('college', college);
  formData.append('department', branch);
  formData.append('inquiry_type', 'Academic Discount Application');
  formData.append('hardware_required', hardware);
  formData.append('project_purpose', project);
  formData.append('student_proof', proofFile, proofFile.name);

  setSubmitBusy(btn, true);
  const result = await apiSubmitStudent(formData);
  setSubmitBusy(btn, false, 'Submit for Student Discount Coupon');
  showFormStatus(status, result.ok && result.success, result.message || (result.ok ? 'Application received.' : 'Submission failed.'));
  if (result.ok && result.success) form.reset();
}

async function handleCareerSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const btn = document.getElementById('career-submit-btn');
  const status = document.getElementById('career-status-msg');
  const resumeInput = document.getElementById('career-resume');
  const resumeFile = resumeInput?.files?.[0];
  const formData = new FormData(form);

  if (!resumeFile) return showFormStatus(status, false, 'Please upload your resume in PDF format.');
  if (!(resumeFile.type === 'application/pdf' || resumeFile.name.toLowerCase().endsWith('.pdf'))) {
    resumeInput.value = '';
    return showFormStatus(status, false, 'Please upload your resume as a PDF file.');
  }
  if (resumeFile.size > 5 * 1024 * 1024) {
    resumeInput.value = '';
    return showFormStatus(status, false, 'Resume file is too large. Maximum size is 5 MB.');
  }

  setSubmitBusy(btn, true);
  const result = await apiSubmitCareer(formData);
  setSubmitBusy(btn, false, 'Submit Application');
  showFormStatus(status, result.ok && result.success, result.message || (result.ok ? 'Application submitted.' : 'Submission failed.'));
  if (result.ok && result.success) form.reset();
}

function preselectRole(role) {
  const select = document.getElementById('role-select');
  if (!select || !role) return;
  const match = [...select.options].find((opt) => opt.value.trim().toLowerCase() === String(role).trim().toLowerCase());
  if (match) {
    select.value = match.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function setupCareerRoleButtons() {
  document.querySelectorAll('[data-career-role]').forEach((button) => {
    button.addEventListener('click', () => preselectRole(button.dataset.careerRole));
  });
}

document.addEventListener('DOMContentLoaded', setupCareerRoleButtons);

function applyContactProductPrefill() {
  const params = new URLSearchParams(window.location.search);
  const product = params.get('product') || params.get('subject') || params.get('kit');
  if (!product) return;
  const select = document.getElementById('service-select');
  const message = document.getElementById('message');
  if (select) {
    const existing = [...select.options].find((opt) => opt.value === product || opt.text.includes(product));
    if (existing) select.value = existing.value;
    else {
      const opt = new Option(product, product, true, true);
      select.add(opt, 1);
      select.value = product;
    }
  }
  if (message && !message.value.trim()) message.value = `I would like to inquire about: ${product}\n\n`;
}

document.addEventListener('DOMContentLoaded', applyContactProductPrefill);
