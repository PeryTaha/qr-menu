const CLOUD_BASE_URL = process.env.CLOUD_BASE_URL;
const POS_BRIDGE_SECRET = process.env.POS_BRIDGE_SECRET;
const POLL_INTERVAL_MS = 2000;

if (!CLOUD_BASE_URL || !POS_BRIDGE_SECRET) {
  console.error(
    "CLOUD_BASE_URL ve POS_BRIDGE_SECRET .env dosyasında tanımlı olmalı (bkz. .env.example).",
  );
  process.exit(1);
}

async function fetchNextRequest() {
  const response = await fetch(`${CLOUD_BASE_URL}/api/pos-payments/bridge`, {
    headers: { authorization: `Bearer ${POS_BRIDGE_SECRET}` },
  });
  if (!response.ok) {
    throw new Error(`Bekleyen istek alınamadı (HTTP ${response.status})`);
  }
  const payload = await response.json();
  return payload.request;
}

async function reportResult(id, approved, message) {
  const response = await fetch(`${CLOUD_BASE_URL}/api/pos-payments/bridge`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${POS_BRIDGE_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id, approved, message }),
  });
  if (!response.ok) {
    throw new Error(`Sonuç bildirilemedi (HTTP ${response.status})`);
  }
}

// Ziraat'in bu terminalde kullandığı ECR protokolü belli olunca bu fonksiyonun
// içini doldurun: tutarı (kuruş cinsinden) cihaza iletip müşterinin kartını
// okutmasını bekleyin, ardından onay/red bilgisini döndürün. Protokol henüz
// bilinmediği için şimdilik hiçbir şey göndermiyor ve her isteği reddediyor.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- imza korunuyor; gerçek protokol eklenince kullanılacak
async function sendAmountToPos(amountKurus) {
  throw new Error(
    "POS protokolü henüz tanımlanmadı: index.js içindeki sendAmountToPos() fonksiyonunu doldurun.",
  );
}

async function processNextRequest() {
  const request = await fetchNextRequest();
  if (!request) return;

  const lira = (request.amount / 100).toFixed(2);
  console.log(`Masa ${request.tableNo}: ${lira} TL POS'a gönderiliyor...`);
  try {
    await sendAmountToPos(request.amount);
    await reportResult(request.id, true);
    console.log(`İstek ${request.id} onaylandı.`);
  } catch (error) {
    await reportResult(request.id, false, error.message);
    console.error(`İstek ${request.id} başarısız: ${error.message}`);
  }
}

async function main() {
  console.log(`Masa POS köprüsü başladı. ${CLOUD_BASE_URL} adresi dinleniyor.`);
  for (;;) {
    try {
      await processNextRequest();
    } catch (error) {
      console.error("Döngü hatası:", error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();
