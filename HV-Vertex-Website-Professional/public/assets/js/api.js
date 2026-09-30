// HV VERTEX - Web3Forms Client Handler
const WEB3FORMS_ACCESS_KEY = "cce5df4d-f1e3-417a-aa46-dc6a871b73e7";

async function submitToWeb3Forms(form, formData) {
  // Always append the Web3Forms access key
  formData.append('access_key', WEB3FORMS_ACCESS_KEY);
  
  // Optional redirect back home or to success state after submission
  if (!formData.has('redirect')) {
    formData.append('redirect', window.location.origin);
  }

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    return {
      ok: response.ok && result.success,
      success: result.success,
      message: result.message || (result.success ? 'Successfully sent!' : 'Submission failed.')
    };
  } catch (err) {
    console.error('Web3Forms Error:', err);
    return { ok: false, success: false, message: 'Could not connect to submission server.' };
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
  const result = await submitToWeb3Forms(form, formData);
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
  // Ensure correct field naming for Web3Forms attachment parsing
  if (proofFile && !formData.has('attachment')) {
    formData.append('attachment', proofFile, proofFile.name);
  }

  setSubmitBusy(btn, true);
  const result = await submitToWeb3Forms(form, formData);
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
  const result = await submitToWeb3Forms(form, formData);
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
