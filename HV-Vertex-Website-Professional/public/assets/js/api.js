// HV VERTEX - Formsubmit.co Client Handler
const FORMSUBMIT_ENDPOINT = "https://formsubmit.co/hr@hvvertex.in";

async function submitToFormsubmit(form, formData) {
  // Configure Formsubmit options
  if (!formData.has('_captcha')) formData.append('_captcha', 'false');
  if (!formData.has('_next')) formData.append('_next', window.location.origin);
  if (!formData.has('_subject')) formData.append('_subject', 'New Website Submission - HV Vertex');

  try {
    const response = await fetch(FORMSUBMIT_ENDPOINT, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const result = await response.json().catch(() => ({ success: true }));
    return {
      ok: response.ok,
      success: true,
      message: 'Form submitted successfully! We will get back to you soon.'
    };
  } catch (err) {
    console.error('Formsubmit Error:', err);
    return { ok: false, success: false, message: 'Could not connect to submission service.' };
  }
}

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
  const form = event.target;
  const btn = document.getElementById('contact-submit-btn');
  const status = document.getElementById('contact-status-msg');

  const formData = new FormData(form);

  setSubmitBusy(btn, true);
  const result = await submitToFormsubmit(form, formData);
  setSubmitBusy(btn, false, 'Send Inquiry Message');
  
  showFormStatus(status, result.ok, result.message);
  if (result.ok) form.reset();
}

async function handleStudentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const btn = document.getElementById('student-submit-btn');
  const status = document.getElementById('student-status-msg');
  const proofInput = document.getElementById('student-proof');
  const proofFile = proofInput?.files?.[0];
  const hardware = document.getElementById('student-hardware')?.value?.trim() || '';

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

  const formData = new FormData(form);
  if (proofFile && !formData.has('attachment')) {
    formData.append('attachment', proofFile, proofFile.name);
  }

  setSubmitBusy(btn, true);
  const result = await submitToFormsubmit(form, formData);
  setSubmitBusy(btn, false, 'Submit for Student Discount Coupon');
  
  showFormStatus(status, result.ok, result.message);
  if (result.ok) form.reset();
}

async function handleCareerSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const btn = document.getElementById('career-submit-btn');
  const status = document.getElementById('career-status-msg');
  const resumeInput = document.getElementById('career-resume');
  const resumeFile = resumeInput?.files?.[0];

  if (!resumeFile) return showFormStatus(status, false, 'Please upload your resume in PDF format.');
  if (!(resumeFile.type === 'application/pdf' || resumeFile.name.toLowerCase().endsWith('.pdf'))) {
    resumeInput.value = '';
    return showFormStatus(status, false, 'Please upload your resume as a PDF file.');
  }
  if (resumeFile.size > 5 * 1024 * 1024) {
    resumeInput.value = '';
    return showFormStatus(status, false, 'Resume file is too large. Maximum size is 5 MB.');
  }

  const formData = new FormData(form);
  if (resumeFile && !formData.has('attachment')) {
    formData.append('attachment', resumeFile, resumeFile.name);
  }

  setSubmitBusy(btn, true);
  const result = await submitToFormsubmit(form, formData);
  setSubmitBusy(btn, false, 'Submit Application');
  
  showFormStatus(status, result.ok, result.message);
  if (result.ok) form.reset();
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
