const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let notified = false;

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function sendTelegram(msg) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
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
            timeout: 8000, // 8 ثواني فقط، لا ننتظر أكثر
            headers: {
                'User-Agent': 'Mozilla/5.0 (GitHub Actions Bot)'
            }
        });

        // نمر على كل الولايات ونجمع المفتوحة
        let openList = [];
        let annabaAvailable = false;

        for (const w of res.data) {
            if (w.available === true) {
                openList.push(`• ${w.wilayaNameAr || w.wilayaNameFr} (${w.wilayaCode})`);
                if (w.wilayaCode === '23') annabaAvailable = true;
            }
        }

        // إشعار عنابة
        if (annabaAvailable && !notified) {
            await sendTelegram(`🚨 <b>عنابة متاحة للحجز!</b>\n🔗 https://adhahi.dz/register`);
            notified = true;
        } else if (!annabaAvailable) {
            notified = false;
        }

        // إشعار بكل الولايات المفتوحة (كل مرة)
        if (openList.length > 0) {
            let message = `📊 <b>الولايات المتاحة للحجز (${openList.length})</b>\n\n${openList.join('\n')}\n\n🔗 https://adhahi.dz/register`;
            await sendTelegram(message);
            log(`تم إرسال قائمة بـ ${openList.length} ولاية`);
        } else {
            log('لا توجد ولايات متاحة');
        }

    } catch (e) {
        log(`⚠️ فشل الاتصال بـ API: ${e.message}`);
        // نرسل إشعار فشل مرة واحدة فقط
        if (!global.failNotified) {
            await sendTelegram(`⚠️ تعذر الاتصال بـ API أضاحي، سيتم إعادة المحاولة لاحقاً.`);
            global.failNotified = true;
        }
    }
}

// نقطة الدخول الرئيسية للمهمة
check();
