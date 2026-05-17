const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let notified = false;
let lastKeepAlive = 0;

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function sendTelegram(msg) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        log('❌ التوكن أو الشات آي دي غير موجود');
        return;
    }

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

async function sendKeepAlive() {
    const now = Date.now();

    // كل 10 دقائق
    if (now - lastKeepAlive >= 10 * 60 * 1000) {
        lastKeepAlive = now;

        await sendTelegram(
            `🟢 <b>البوت مازال يعمل</b>\n\n🕐 ${new Date().toLocaleString('ar-DZ')}\n📍 مراقبة: عنابة (23)`
        );

        log('📨 تم إرسال رسالة الاستمرارية');
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

            if (available && !notified) {
                await sendTelegram(
                    `🚨 <b>عنابة متاحة للحجز!</b>\n\n🔗 https://adhahi.dz/register\n🕐 ${new Date().toLocaleString('ar-DZ')}`
                );
                notified = true;
            } else if (!available) {
                notified = false;
            }
        }

        await sendKeepAlive();

    } catch (e) {
        log(`⚠️ خطأ: ${e.message}`);
    }
}

async function start() {
    log('════════════════════════════');
    log('🐏 بوت مراقبة أضاحي');
    log('📍 عنابة (23)');
    log('⏱️ فحص كل دقيقتين');
    log('════════════════════════════');

    // رسالة البداية (مرة واحدة)
    await sendTelegram(
        '✅ <b>بوت المراقبة يعمل</b>\n📍 عنابة (23)\n⏱️ فحص كل دقيقتين\n📢 سيتم الإشعار فور التوفر'
    );

    const startTime = Date.now();

    while (true) {
        await check();

        // إيقاف بعد ~55 دقيقة (باش ما يتقتلش من GitHub)
        if (Date.now() - startTime > 55 * 60 * 1000) {
            log('⏹️ انتهاء وقت التشغيل');
            break;
        }

        // انتظار دقيقتين
        await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    }
}

start();
