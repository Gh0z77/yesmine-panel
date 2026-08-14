# Yesmine — xodimlar paneli

Yesmine do'konining xodimlari uchun alohida ilova. Do'kon saytidan
(`yesmine-boutique-suite`) mustaqil ishlaydi, lekin **bir xil Supabase
bazasiga** ulanadi.

## Kirish qanday ishlaydi

Xodim saytni ochadi — darhol bitta login forma chiqadi. Boshqa hech nima yo'q:
rol tanlash ham, bo'lim tanlash ham. Email va parolni yozadi va **o'z paneliga
tushadi**.

Qayerga tushishini brauzer emas, **baza hal qiladi**: `my_profile()` funksiyasi
hisob qaysi xodimga tegishli ekanini va uning lavozimini o'qiydi. Menyu ham
shundan tuziladi — kassirda "Moliya" degan yozuv umuman ko'rinmaydi.

Manzilni qo'lda yozib boshqa bo'limga o'tib bo'lmaydi: sahifa o'z joyiga
qaytaradi, va baza baribir ma'lumot bermaydi. Himoya kodda emas, bazada
(RLS + `has_permission()`), shuning uchun uni brauzerdan aylanib o'tib
bo'lmaydi.

## Sahifalar

Har biri o'z huquqi bilan ochiladi:

| Sahifa | Huquq |
|---|---|
| Boshqaruv paneli | `dashboard.view` |
| Kassa va smena | `cash.register` yoki `shift.manage` |
| Lidlar | `leads.read` |
| Buyurtmalar | `orders.read` |
| Mahsulotlar | `products.read` |
| Mijozlar | `orders.read` |
| Marketing / SMM | `smm.read` |
| Xodimlar | `staff.read` |
| Moliya | `finance.read` |
| Ta'minot | `supply.manage` |

## Ishga tushirish

```bash
npm install
cp .env.example .env    # qiymatlarni to'ldiring
npm run dev             # http://localhost:7700
```

## Xodimga hisob ochish

Panel hisob yaratmaydi — buni do'kon egasi qiladi:

1. Do'kon admin panelida xodimni **email bilan** qo'shing. Email avtomatik
   ruxsat ro'yxatiga tushadi.
2. Supabase Dashboard → **Authentication → Users → Add user** → o'sha email va
   parol, **Auto Confirm User** belgilangan holda.
3. Hisob avtomatik xodim yozuviga bog'lanadi (trigger).

Hisobi bor, lekin xodim yozuviga bog'lanmagan odam kirsa, "Panel
biriktirilmagan" ekranini ko'radi va hech qanday ma'lumot olmaydi.
