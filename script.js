// script.js
async function login() {
  const ip = document.getElementById('ip').value;
  const port = document.getElementById('port').value;
  const user = document.getElementById('user').value;
  const password = document.getElementById('password').value;
  const nome = document.getElementById('nome').value;

  try {
    const res = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, user, password, nome })
    });

    const data = await res.json();
    if (res.ok) {
      document.getElementById('status').innerText = `${data.device} está ONLINE ✅`;
      document.getElementById('status').style.color = "lime";
    } else {
      document.getElementById('status').innerText = `${data.device} está OFFLINE ❌`;
      document.getElementById('status').style.color = "red";
    }
  } catch (error) {
    document.getElementById('status').innerText = "Erro na conexão com o backend.";
    document.getElementById('status').style.color = "orange";
  }
}
