// ---------------------------------------------------------------
// Função serverless da Vercel: /api/process_payment
// Recebe os dados do Payment Brick + os itens do carrinho, RECALCULA o
// total no servidor (nunca confia no valor vindo do navegador) e cobra
// na API do Mercado Pago com o Access Token (só existe aqui no servidor).
//
// Configuração:
// 1. Vercel → Settings → Environment Variables → MP_ACCESS_TOKEN
// 2. Redeploy
// ---------------------------------------------------------------
import { CATALOG } from "./_catalog.js";

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

    // 1) Valida os itens e recalcula o total no servidor
    const items = paymentData.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ error: "Carrinho inválido" });
    }

    let totalCents = 0;
    for (const item of items) {
      const product = CATALOG[item.id];
      const qty = item.qty;
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        return res.status(400).json({ error: "Item inválido no carrinho" });
      }
      totalCents += product.cents * qty;
    }
    const transactionAmount = totalCents / 100;

    // 2) Cobra o valor calculado aqui, ignorando paymentData.transaction_amount
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Evita cobrança duplicada em caso de reenvio de rede
        "X-Idempotency-Key": paymentData.idempotencyKey || crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: transactionAmount,
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

    // status possíveis: "approved", "in_process", "pending", "rejected"
    return res.status(200).json({ status: result.status, id: result.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno ao processar pagamento" });
  }
}
