import { icon } from './icons.js';

export function mountDevReset() {
  const button = document.createElement('button');
  button.className = 'dev-reset-button';
  button.title = 'Reset town (development)';
  button.innerHTML = `${icon('rotateCcw')} Reset`;
  const dialog = document.createElement('dialog');
  dialog.className = 'dev-reset-dialog';
  dialog.setAttribute('aria-labelledby', 'dev-reset-title');
  dialog.innerHTML = `<h2 id="dev-reset-title">Reset this town?</h2>
    <p>Town Hall, selected homes, gems and customization will start over. Project files, saved residents and chat history stay intact. Future schedules will be paused.</p>
    <p class="dev-reset-error" role="alert"></p>
    <div class="dev-reset-actions"><button data-cancel autofocus>Cancel</button><button data-confirm>${icon('rotateCcw')} Reset town</button></div>`;
  document.body.append(button, dialog);
  const confirm = dialog.querySelector('[data-confirm]'), cancel = dialog.querySelector('[data-cancel]');
  let pending = false;
  button.addEventListener('click', () => {
    dialog.querySelector('[role="alert"]').textContent = '';
    if (!dialog.open) dialog.showModal();
  });
  cancel.addEventListener('click', () => { if (!pending) dialog.close(); });
  dialog.addEventListener('cancel', e => { if (pending) e.preventDefault(); });
  confirm.addEventListener('click', async () => {
    if (pending) return;
    pending = true; confirm.disabled = true; cancel.disabled = true;
    try {
      const response = await fetch('/api/gameplay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reset', confirmed: true }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Reset failed.');
      localStorage.removeItem('agent-world:mayor-martin-seen');
      location.reload();
    } catch (error) {
      dialog.querySelector('[role="alert"]').textContent = error.message;
      pending = false; confirm.disabled = false; cancel.disabled = false;
    }
  });
}
