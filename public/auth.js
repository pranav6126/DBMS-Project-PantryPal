const $ = (selector) => document.querySelector(selector);
let mode = 'login';
function selectMode(next) {
  mode = next;
  const register = mode === 'register';
  $('#registration-fields').hidden = !register;
  $('#name').required = register;
  $('#password').minLength = register ? 8 : 1;
  $('#password').autocomplete = register ? 'new-password' : 'current-password';
  $('#password-help').hidden = !register;
  $('#auth-title').textContent = register ? 'Make room for good food.' : 'Good food starts here.';
  $('#auth-description').textContent = register ? 'Create your account and build a pantry that works for you.' : 'Sign in to see your pantry and find your next meal.';
  $('#submit').textContent = register ? 'Create my account' : 'Sign in to PantryPal';
  $('#auth-error').hidden = true;
  for (const value of ['login','register']) {
    $('#' + value + '-tab').classList.toggle('selected', value === mode);
    $('#' + value + '-tab').setAttribute('aria-pressed', String(value === mode));
  }
}
$('#login-tab').onclick = () => selectMode('login');
$('#register-tab').onclick = () => selectMode('register');
$('#auth-form').onsubmit = async (event) => {
  event.preventDefault();
  $('#submit').disabled = true;
  $('#auth-error').hidden = true;
  try {
    const body = { email: $('#email').value, password: $('#password').value };
    if (mode === 'register') Object.assign(body, { name: $('#name').value, diet_pref: $('#diet').value });
    const response = await fetch('/api/auth/' + mode, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Please try again.');
    location.replace('/');
  } catch (error) {
    $('#auth-error').textContent = error.message;
    $('#auth-error').hidden = false;
  } finally { $('#submit').disabled = false; }
};
fetch('/api/auth/me').then(response => { if (response.ok) location.replace('/'); }).catch(() => {});
