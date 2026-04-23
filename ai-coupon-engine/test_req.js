fetch('http://localhost:8000/api/v1/automation/login/69e5f24d2f5321814a4f035c', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
}).then(r => r.text()).then(console.log).catch(console.error);
