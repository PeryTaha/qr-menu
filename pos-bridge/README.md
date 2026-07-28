# Masa POS Köprüsü

Kasadaki bilgisayarda çalışan, kasa ekranından gelen "POS'a gönder" isteklerini
bulut uygulamasından alıp fiziksel POS cihazına ileten yerel program.

## Kurulum

1. `.env.example` dosyasını `.env` olarak kopyalayın, `CLOUD_BASE_URL` ve
   `POS_BRIDGE_SECRET` değerlerini doldurun (`POS_BRIDGE_SECRET`, ana
   uygulamanın `.env` dosyasındakiyle birebir aynı olmalı).
2. `npm run start` ile çalıştırın. Program sürekli açık kalmalı (kasa
   bilgisayarı açıkken arka planda çalışsın).

## Eksik olan kısım

`index.js` içindeki `sendAmountToPos()` fonksiyonu henüz **gerçek POS
cihazına bağlanmıyor** — bu, cihazın markasına ve Ziraat'in o terminalde
kullandığı ECR protokolüne bağlı, ve bu bilgi olmadan doldurulamaz. Protokol
belli olduğunda yalnızca bu fonksiyonun içini doldurmak yeterli; kuyruk,
onay/red akışı ve masa hesabına otomatik "ödendi" yazma zaten çalışıyor.
