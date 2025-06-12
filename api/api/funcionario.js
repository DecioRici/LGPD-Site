export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { matricula, nome, cartao } = req.body;

  if (!matricula || !nome || !cartao) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }

  console.log('Funcionário recebido:', { matricula, nome, cartao });

  res.status(200).json({ sucesso: true, mensagem: 'Funcionário cadastrado com sucesso!' });
}
