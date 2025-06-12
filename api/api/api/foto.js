export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { nomeArquivo, imagemBase64 } = req.body;

  if (!nomeArquivo || !imagemBase64) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }

  console.log(`Recebida imagem ${nomeArquivo} com tamanho ${imagemBase64.length} caracteres`);

  // Aqui, em produção, você salvaria no Firebase, S3, etc.

  res.status(200).json({ sucesso: true, mensagem: 'Imagem recebida com sucesso!' });
}
