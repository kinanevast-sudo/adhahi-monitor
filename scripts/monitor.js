const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let notified = false;
let lastKeepAlive = 0;

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

async function sendKeepAlive() {
    const now = Math.floor(Date.now() / 1000);
    // كل 10 دقائق (600 ثانية)
    if (now - lastKeepAlive >= 600) {
        lastKeepAlive = now;
        const time = new Date().toLocaleString('ar-DZ');
        await sendTelegram(`🟢 <b>البوت يعمل بشكل طبيعي</b>\n\n🕐 الوقت: ${time}\n📍 مراقبة: ولاية عنابة (23)\n📊 الحالة: في انتظار التوفر`);
        log('📨 تم إرسال إشعار استمرارية');
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
                await sendTelegram(`🚨 <b>🚨 تنبيه: ولاية عنابة أصبحت متاحة للحجز! 🚨</b>\n\n🔗 <a href="https://adhahi.dz/register">اضغط هنا للتسجيل</a>\n\n🕐 الوقت: ${new Date().toLocaleString('ar-DZ')}`);
                notified = true;
            } else if (!available) {
                notified = false;
            }
        }
        
        // إرسال إشعار استمرارية
        await sendKeepAlive();
        
    } catch (e) {
        log(`⚠️ خطأ: ${e.message}`);
    }
}

async function start() {
    log('════════════════════════════');
    log('🐏 بوت مراقبة أضاحي');
    log('📍 عنابة (23)');
    log('⏱️ إشعار استمرارية كل 10 دقائق');
    log('════════════════════════════');
    
    await sendTelegram('✅ <b>بوت المراقبة يعمل</b>\n\n📍 ولاية عنابة (23)\n⏱️ سيتم إرسال تأكيد كل 10 دقائق\n📢 سيتم الإشعار فور توفر الحجز');
    await check();
}

start();
