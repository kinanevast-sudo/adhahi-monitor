const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function sendTelegram(msg) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: msg,
            parse_mode: 'HTML'
        });
        log('✅ تم الإرسال');
    } catch (e) {
        log(`❌ فشل: ${e.message}`);
    }
}

async function check() {
    try {
        const res = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
            timeout: 15000
        });

        const annaba = res.data.find(w => w.wilayaCode === '23');

        if (annaba) {
            const available = annaba.available === true;

            log(`عنابة: ${available ? '✅ متاحة' : '❌ غير متاحة'}`);

            if (available) {
                await sendTelegram(`🚨 <b>تنبيه: عنابة متاحة!</b>\n\n🔗 https://adhahi.dz/register\n🕐 ${new Date().toLocaleString('ar-DZ')}`);
            } else {
                // ✅ رسالة كل مرة (يعني كل 2 دقائق)
                await sendTelegram(`🟢 <b>البوت يعمل</b>\n📍 عنابة غير متاحة\n🕐 ${new Date().toLocaleString('ar-DZ')}`);
            }
        }

    } catch (e) {
        log(`⚠️ خطأ: ${e.message}`);
    }
}

async function start() {
    log('🐏 تشغيل فحص جديد');
    await check();
}

start();
