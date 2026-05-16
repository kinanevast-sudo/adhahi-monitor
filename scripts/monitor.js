const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let sentNotifications = {};

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('⚠️ إشعارات التيليغرام غير مفعلة - تأكد من إضافة Secrets', 'WARN');
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    }, {
      timeout: 30000
    });
    log('✅ تم إرسال إشعار التيليغرام', 'SUCCESS');
    return true;
  } catch (error) {
    log(`❌ فشل إرسال التيليغرام: ${error.message}`, 'ERROR');
    return false;
  }
}

async function checkAvailability() {
  try {
    log('جاري فحص التوفر...', 'CHECK');
    
    const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
      timeout: 60000  // ✅ زيادة الوقت إلى 60 ثانية
    });
    
    const wilayas = response.data;
    const annaba = wilayas.find(w => w.wilayaCode === '23');
    
    if (annaba) {
      const isAvailable = annaba.available === true;
      log(`عنابة (${annaba.wilayaCode}): ${isAvailable ? '✅ متاحة' : '❌ غير متاحة'} - ${annaba.wilayaNameAr}`);
      
      if (isAvailable && !sentNotifications['23']) {
        log('🚨🚨🚨 تنبيه: ولاية عنابة أصبحت متاحة للحجز! 🚨🚨🚨', 'ALERT');
        
        const message = `🚨 <b>تنبيه: ولاية ${annaba.wilayaNameAr} أصبحت متاحة للحجز!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل</a>\n\n📅 الوقت: ${new Date().toLocaleString('ar-DZ')}`;
        await sendTelegram(message);
        
        sentNotifications['23'] = true;
      } else if (!isAvailable) {
        sentNotifications['23'] = false;
      }
    } else {
      log('⚠️ لم يتم العثور على ولاية عنابة في الرد', 'WARN');
    }
    
  } catch (error) {
    log(`خطأ: ${error.message}`, 'ERROR');
    if (error.response) {
      log(`الرد: ${JSON.stringify(error.response.data)}`, 'ERROR');
    }
  }
}

async function run() {
  log('═══════════════════════════════════════');
  log('🐏 أضاحي مراقب - مع إشعارات تيليغرام');
  log('📍 مراقبة ولاية عنابة (23)');
  log(`📨 التيليغرام: ${TELEGRAM_BOT_TOKEN ? '✅ مفعل' : '❌ غير مفعل'}`);
  log('═══════════════════════════════════════');
  
  // إرسال رسالة اختبارية إذا كان البوت مفعلاً
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    await sendTelegram('✅ <b>بوت أضاحي مراقب يعمل بنجاح!</b>\n\nسأقوم بإشعارك فور توفر ولاية عنابة.\n\n⏱️ الوقت: ' + new Date().toLocaleString('ar-DZ'));
  }
  
  await checkAvailability();
}

run();
