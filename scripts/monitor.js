const axios = require('axios');

// إعدادات التيليغرام (تقرأ من GitHub Secrets)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// سجل الإشعارات المرسلة (لمنع التكرار)
let sentNotifications = {};

// دوال مساعدة
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

// إرسال إشعار تيليغرام
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('⚠️ إشعارات التيليغرام غير مفعلة (أضف secrets)', 'WARN');
    return false;
  }
  
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
    log('✅ تم إرسال إشعار التيليغرام', 'SUCCESS');
    return true;
  } catch (error) {
    log(`❌ فشل إرسال التيليغرام: ${error.message}`, 'ERROR');
    return false;
  }
}

// المراقبة
async function checkAvailability() {
  try {
    log('جاري فحص التوفر...', 'CHECK');
    
    const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
      timeout: 10000
    });
    
    const wilayas = response.data;
    const annaba = wilayas.find(w => w.wilayaCode === '23');
    
    if (annaba) {
      const isAvailable = annaba.available === true;
      const status = isAvailable ? '✅ متاحة' : '❌ غير متاحة';
      log(`عنابة: ${status}`);
      
      if (isAvailable && !sentNotifications['23']) {
        log('🚨 تنبيه: ولاية عنابة متاحة للحجز!', 'ALERT');
        
        const message = `🚨 <b>تنبيه: ولاية عنابة أصبحت متاحة للحجز!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل</a>\n\n📅 الوقت: ${new Date().toLocaleString('ar-DZ')}`;
        await sendTelegram(message);
        
        sentNotifications['23'] = true;
      } else if (!isAvailable) {
        sentNotifications['23'] = false;
      }
    }
    
  } catch (error) {
    log(`خطأ: ${error.message}`, 'ERROR');
  }
}

// بدء التشغيل
log('═══════════════════════════════════════');
log('🐏 أضاحي مراقب - مع إشعارات تيليغرام');
log('📍 مراقبة ولاية عنابة (23)');
log('📨 التيليغرام: ' + (TELEGRAM_BOT_TOKEN ? '✅ مفعل' : '❌ غير مفعل'));
log('═══════════════════════════════════════');

checkAvailability();
