const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let notified = false;
let firstRun = true;
let isRunning = true;
let lastUpdateId = 0;

const CHECK_INTERVAL = 2 * 60 * 1000;      // كل دقيقتين
const HEARTBEAT_INTERVAL = 10 * 60 * 1000; // كل 10 دقائق

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
            
            if (available && !notified) {
                await sendTelegram(`🚨 <b>تنبيه: ولاية عنابة أصبحت متاحة للحجز!</b>\n\n🔗 <a href="https://adhahi.dz/register">اضغط هنا للتسجيل</a>\n\n🕐 ${new Date().toLocaleString('ar-DZ')}`);
                notified = true;
            } else if (!available) {
                notified = false;
            }
        }
        
    } catch (e) {
        log(`⚠️ خطأ: ${e.message}`);
    }
}

// 🟢 رسالة كل 10 دقائق
async function heartbeat() {
    await sendTelegram(`🟢 <b>البوت يعمل</b>\n\n🕐 ${new Date().toLocaleString('ar-DZ')}\n📍 مراقبة: عنابة`);
}

// 📩 قراءة رسائل التيليجرام (للتحكم)
async function listenCommands() {
    try {
        const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`, {
            params: { offset: lastUpdateId + 1, timeout: 10 }
        });

        const updates = res.data.result;

        for (const update of updates) {
            lastUpdateId = update.update_id;

            const text = update.message?.text;

            if (text) {
                log(`📩 أمر وارد: ${text}`);

                if (text.includes('اوقفه')) {
                    isRunning = false;
                    await sendTelegram('⛔ تم إيقاف البوت');
                }

                if (text.includes('شغله')) {
                    isRunning = true;
                    await sendTelegram('▶️ تم تشغيل البوت من جديد');
                }
            }
        }

    } catch (e) {
        log(`⚠️ خطأ في قراءة الأوامر: ${e.message}`);
    }
}

// 🚀 التشغيل
async function start() {
    log('🐏 بدء تشغيل البوت...');

    if (firstRun) {
        await sendTelegram('✅ <b>تم تشغيل بوت مراقبة الأضاحي</b>\n📍 عنابة\n⏱️ فحص كل دقيقتين');
        firstRun = false;
    }

    // حلقة الفحص
    setInterval(async () => {
        if (isRunning) {
            log('🔄 فحص...');
            await check();
        }
    }, CHECK_INTERVAL);

    // حلقة التذكير
    setInterval(async () => {
        if (isRunning) {
            await heartbeat();
        }
    }, HEARTBEAT_INTERVAL);

    // حلقة استقبال الأوامر
    setInterval(async () => {
        await listenCommands();
    }, 5000); // كل 5 ثواني
}

start();
