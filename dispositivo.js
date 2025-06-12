export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { nome, ip, porta } = req.body;

  if (!nome || !ip || !porta) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }

  // Aqui você salvaria em banco de dados se quisesse
  console.log('Dispositivo recebido:', { nome, ip, porta });

  res.status(200).json({ sucesso: true, mensagem: 'Dispositivo cadastrado com sucesso!' });
}
