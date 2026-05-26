const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let notified = false;
let lastKeepAlive = 0;
let lastOpenWilayas = []; // تخزين آخر الولايات المفتوحة لمنع التكرار

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
            `🟢 <b>البوت مازال يعمل</b>\n\n🕐 ${new Date().toLocaleString('ar-DZ')}\n📍 مراقبة: جميع الولايات`
        );

        log('📨 تم إرسال رسالة الاستمرارية');
    }
}

// الحصول على اسم الولاية بالعربية من الكود
function getWilayaName(wilaya) {
    return wilaya.wilayaNameAr || wilaya.wilayaNameFr || wilaya.wilayaCode;
}

async function check() {
    try {
        const res = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
            timeout: 15000
        });

        const wilayas = res.data;
        
        // تصفية الولايات المتاحة (available === true)
        const openWilayas = wilayas.filter(w => w.available === true);
        
        // التحقق من عنابة بشكل منفصل للإشعار الفردي (للحفاظ على السلوك الأصلي)
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
        const openWilayasNames = openWilayas.map(w => `• ${getWilayaName(w)} (${w.wilayaCode})`).join('\n');
        const currentOpenList = openWilayas.map(w => w.wilayaCode).sort().join(',');
        const lastOpenList = lastOpenWilayas.sort().join(',');
        
        // إذا تغيرت قائمة الولايات المفتوحة أو كان هناك ولايات مفتوحة
        if (openWilayas.length > 0 && currentOpenList !== lastOpenList) {
            let message = `📊 <b>الولايات المتاحة للحجز حالياً</b>\n\n${openWilayasNames}\n\n🕐 ${new Date().toLocaleString('ar-DZ')}`;
            
            // إضافة رابط التسجيل العام
            if (openWilayas.length > 0) {
                message += `\n\n🔗 https://adhahi.dz/register`;
            }
            
            await sendTelegram(message);
            lastOpenWilayas = openWilayas.map(w => w.wilayaCode);
            log(`📨 تم إرسال قائمة الولايات المفتوحة: ${openWilayas.length} ولاية`);
        } else if (openWilayas.length === 0 && lastOpenWilayas.length > 0) {
            // جميع الولايات أغلقت
            await sendTelegram(`🔒 <b>جميع الولايات أغلقت</b>\n\n🕐 ${new Date().toLocaleString('ar-DZ')}`);
            lastOpenWilayas = [];
            log('📨 تم إرسال إشعار إغلاق جميع الولايات');
        }

        await sendKeepAlive();

    } catch (e) {
        log(`⚠️ خطأ: ${e.message}`);
    }
}

async function start() {
    log('════════════════════════════');
    log('🐏 بوت مراقبة أضاحي - جميع الولايات');
    log('📍 مراقبة جميع الولايات المفتوحة');
    log('⏱️ فحص كل دقيقتين');
    log('════════════════════════════');

    // رسالة البداية (مرة واحدة)
    await sendTelegram(
        '✅ <b>بوت المراقبة يعمل</b>\n📍 مراقبة جميع الولايات\n⏱️ فحص كل دقيقتين\n📢 سيتم الإشعار عند فتح أي ولاية'
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
