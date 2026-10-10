// ---------------------------------------------------------------
// Função serverless da Vercel: /api/process_payment  (API de ORDERS)
// Recebe os dados do Payment Brick + os itens do carrinho, RECALCULA o
// total no servidor (nunca confia no valor vindo do navegador), cria uma
// order no Mercado Pago e devolve um status simples pro front.
//
// Configuração:
// 1. Vercel → Settings → Environment Variables → MP_ACCESS_TOKEN
// 2. Redeploy
// 3. Webhook: configurado no painel do Mercado Pago (Suas integrações →
//    sua aplicação → Webhooks), pois a Orders API não aceita
//    notification_url no corpo da requisição.
// ---------------------------------------------------------------
import { CATALOG } from "./_catalog.js";

// Converte o status da order/transação do MP em 3 estados pro front.
function normalizeStatus(order) {
  const payment = order?.transactions?.payments?.[0];
  const s = payment?.status || order?.status;
  if (s === "processed") return "approved";
  if (["action_required", "created", "in_process", "processing", "pending"].includes(s)) return "pending";
  return "rejected";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: "MP_ACCESS_TOKEN não configurado no servidor" });
  }

  try {
    const { formData, selectedPaymentMethod, items } = req.body || {};

    if (!formData || typeof formData !== "object") {
      return res.status(400).json({ error: "Dados de pagamento inválidos" });
    }

    // 1) Valida os itens e recalcula o total no servidor
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
    const amount = (totalCents / 100).toFixed(2); // string "00.00", como a API exige

    // 2) Monta o método de pagamento (cartão ou Pix)
    const methodId = formData.payment_method_id;
    if (!methodId || !formData.payer?.email) {
      return res.status(400).json({ error: "Dados do pagador incompletos" });
    }

    const paymentMethod = { id: methodId, type: selectedPaymentMethod };
    if (selectedPaymentMethod === "credit_card" || selectedPaymentMethod === "debit_card") {
      if (!formData.token) {
        return res.status(400).json({ error: "Token do cartão ausente" });
      }
      paymentMethod.token = formData.token;
      paymentMethod.installments = Number(formData.installments) || 1;
    } else if (methodId === "pix") {
      paymentMethod.type = "bank_transfer";
    } else {
      return res.status(400).json({ error: "Meio de pagamento não suportado" });
    }

    const externalReference = `largo_${crypto.randomUUID()}`;

    // 3) Cria a order com o valor calculado aqui (ignora formData.transaction_amount)
    const mpResponse = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Evita cobrança duplicada em caso de reenvio de rede
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        type: "online",
        processing_mode: "automatic",
        total_amount: amount,
        external_reference: externalReference,
        payer: {
          email: formData.payer.email,
          ...(formData.payer.identification ? { identification: formData.payer.identification } : {}),
        },
        transactions: {
          payments: [{ amount, payment_method: paymentMethod }],
        },
      }),
    });

    const order = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro do Mercado Pago:", JSON.stringify(order));
      const msg = order?.errors?.[0]?.message || order?.message || "Falha ao processar pagamento";
      return res.status(mpResponse.status).json({ error: msg });
    }

    const payment = order?.transactions?.payments?.[0];
    const pm = payment?.payment_method || {};

    return res.status(200).json({
      status: normalizeStatus(order),
      statusDetail: payment?.status_detail || order.status_detail || null,
      orderId: order.id,
      externalReference,
      // Só vem preenchido em pagamentos Pix
      pix: pm.ticket_url || pm.qr_code
        ? { ticket_url: pm.ticket_url || null, qr_code: pm.qr_code || null, qr_code_base64: pm.qr_code_base64 || null }
        : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno ao processar pagamento" });
  }
}
