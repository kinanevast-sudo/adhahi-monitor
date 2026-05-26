const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let notified = false;
let lastOpenWilayas = [];

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
        log(`❌ فشل الإرسال: ${e.message}`);
    }
}

function getWilayaName(wilaya) {
    return wilaya.wilayaNameAr || wilaya.wilayaNameFr || wilaya.wilayaCode;
}

async function check() {
    try {
        log('🔍 جاري فحص API...');
        
        const res = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
            timeout: 20000
        });

        const wilayas = res.data;
        
        if (!Array.isArray(wilayas)) {
            log('⚠️ الرد ليس مصفوفة');
            return;
        }
        
        // تصفية الولايات المتاحة
        const openWilayas = wilayas.filter(w => w.available === true);
        
        // إشعار عنابة المنفرد (للحفاظ على السلوك الأصلي)
        const annaba = wilayas.find(w => w.wilayaCode === '23');
        if (annaba) {
            const annabaAvailable = annaba.available === true;
            log(`عنابة: ${annabaAvailable ? '✅ متاحة' : '❌ غير متاحة'}`);

            if (annabaAvailable && !notified) {
                await sendTelegram(
                    `🚨 <b>عنابة متاحة للحجز!</b>\n\n🔗 https://adhahi.dz/register\n🕐 ${new Date().toLocaleString('ar-DZ')}`
                );
                notified = true;
            } else if (!annabaAvailable) {
                notified = false;
            }
        }
        
        // إرسال قائمة بجميع الولايات المفتوحة (إذا تغيرت القائمة)
        const currentOpenCodes = openWilayas.map(w => w.wilayaCode).sort().join(',');
        const lastOpenCodes = lastOpenWilayas.sort().join(',');
        
        if (openWilayas.length > 0 && currentOpenCodes !== lastOpenCodes) {
            let openList = '';
            for (const w of openWilayas) {
                openList += `• ${getWilayaName(w)} (${w.wilayaCode})\n`;
            }
            
            const message = `📊 <b>الولايات المتاحة للحجز حالياً</b>\n\n${openList}\n🕐 ${new Date().toLocaleString('ar-DZ')}\n\n🔗 https://adhahi.dz/register`;
            await sendTelegram(message);
            lastOpenWilayas = openWilayas.map(w => w.wilayaCode);
            log(`📨 تم إرسال قائمة الولايات المفتوحة: ${openWilayas.length} ولاية`);
        } else if (openWilayas.length === 0 && lastOpenWilayas.length > 0) {
            await sendTelegram(`🔒 <b>جميع الولايات أغلقت</b>\n\n🕐 ${new Date().toLocaleString('ar-DZ')}`);
            lastOpenWilayas = [];
            log('📨 تم إرسال إشعار إغلاق جميع الولايات');
        } else if (openWilayas.length > 0) {
            log(`📊 الولايات المفتوحة (${openWilayas.length}): ${currentOpenCodes}`);
        }
        
        // إرسال رسالة استمرارية كل 30 دقيقة (اختياري)
        const now = Date.now();
        if (!global.lastKeepAlive || now - global.lastKeepAlive > 30 * 60 * 1000) {
            global.lastKeepAlive = now;
            await sendTelegram(`🟢 <b>البوت مازال يعمل</b>\n🕐 ${new Date().toLocaleString('ar-DZ')}`);
        }

    } catch (e) {
        log(`⚠️ خطأ: ${e.message}`);
        // لا نرسل إشعار خطأ حتى لا نزعج المستخدم
    }
}

async function start() {
    log('═══════════════════════════════════════');
    log('🐏 بوت مراقبة أضاحي - جميع الولايات');
    log('📍 مراقبة جميع الولايات المفتوحة');
    log('⏱️ يعمل على GitHub Actions');
    log('═══════════════════════════════════════');

    // رسالة البداية (مرة واحدة فقط)
    if (!global.started) {
        await sendTelegram('✅ <b>بوت المراقبة يعمل</b>\n📍 مراقبة جميع الولايات\n📢 سيتم الإشعار عند فتح أي ولاية');
        global.started = true;
    }

    await check();
}

start();
