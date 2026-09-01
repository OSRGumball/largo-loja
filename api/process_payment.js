// ---------------------------------------------------------------
// Função serverless da Vercel: /api/process_payment
// Recebe os dados que o Payment Brick gerou no navegador e faz a
// cobrança de verdade na API do Mercado Pago, usando o Access Token
// (que fica só aqui no servidor, nunca no front-end).
//
// Como configurar:
// 1. No painel da Vercel, vá em Settings → Environment Variables
// 2. Crie a variável MP_ACCESS_TOKEN com o seu Access Token do Mercado Pago
//    (painel MP → Suas integrações → sua aplicação → Credenciais)
// 3. Redeploy o projeto para a variável entrar em vigor
// ---------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: "MP_ACCESS_TOKEN não configurado no servidor" });
  }

  try {
    const paymentData = req.body;

    // Encaminha os dados do Brick praticamente como estão — o Brick já
    // formata o corpo no formato que a API de pagamentos do MP espera
    // (token do cartão, payment_method_id, installments, payer, etc.)
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Evita cobrança duplicada em caso de reenvio de rede
        "X-Idempotency-Key": paymentData.idempotencyKey || crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: paymentData.transaction_amount,
        token: paymentData.token,
        description: "Pedido LARGO",
        installments: paymentData.installments,
        payment_method_id: paymentData.payment_method_id,
        issuer_id: paymentData.issuer_id,
        payer: paymentData.payer,
      }),
    });

    const result = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro do Mercado Pago:", result);
      return res.status(mpResponse.status).json({ error: result.message || "Falha ao processar pagamento" });
    }

    // status possíveis: "approved", "in_process", "rejected"
    return res.status(200).json({ status: result.status, id: result.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno ao processar pagamento" });
  }
}
