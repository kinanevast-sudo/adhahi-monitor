const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let sentNotifications = {};
let welcomeSent = false;

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('⚠️ إشعارات التيليغرام غير مفعلة', 'WARN');
    return false;
  }
  
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    }, { timeout: 10000 });
    log('✅ تم إرسال الرسالة بنجاح', 'SUCCESS');
    return true;
  } catch (error) {
    log(`❌ فشل الإرسال: ${error.message}`, 'ERROR');
    return false;
  }
}

// إرسال رسالة ترحيب (مرة واحدة فقط)
async function sendWelcomeMessage() {
  if (welcomeSent) return;
  
  const message = `🧪 <b>[وضع التجربة] بوت أضاحي مراقب يعمل!</b>\n\n✅ النظام نشط.\n\n📋 <b>سيتم إرسال رابط تجريبي فوراً (محاكاة التوفر).</b>\n\n🕐 الوقت: ${new Date().toLocaleString('ar-DZ')}`;
  
  const sent = await sendTelegram(message);
  if (sent) {
    welcomeSent = true;
    log('📨 تم إرسال رسالة الترحيب (وضع التجربة)', 'SUCCESS');
  }
}

// فحص مع إعادة المحاولة التلقائية + محاكاة التوفر
async function checkAvailabilityWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`📡 محاولة ${attempt}/${maxRetries} - جاري فحص التوفر...`, 'CHECK');
      
      // ========== 🧪 وضع التجربة: محاكاة التوفر ==========
      const MOCK_AVAILABLE = true;  // ✅ تغيير إلى false لإيقاف المحاكاة
      
      if (MOCK_AVAILABLE && !sentNotifications['23']) {
        log('🧪🧪🧪 [تجربة] محاكاة: ولاية عنابة متاحة! 🧪🧪🧪', 'ALERT');
        
        const alertMessage = `🧪 <b>[تجربة] تنبيه: ولاية عنابة أصبحت متاحة للحجز!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل (تجربة)</a>\n\n📅 الوقت: ${new Date().toLocaleString('ar-DZ')}\n\n⚠️ هذا إشعار تجريبي فقط، افتح الرابط وجرب التعبئة التلقائية.`;
        await sendTelegram(alertMessage);
        
        sentNotifications['23'] = true;
        return true;
      }
      // ========== نهاية وضع التجربة ==========
      
      // الوضع العادي (معلق أثناء التجربة)
      /*
      const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const wilayas = response.data;
      const annaba = wilayas.find(w => w.wilayaCode === '23');
      
      if (annaba) {
        const isAvailable = annaba.available === true;
        log(`📍 عنابة: ${isAvailable ? '✅ متاحة' : '❌ غير متاحة'}`, 'INFO');
        
        if (isAvailable && !sentNotifications['23']) {
          log('🚨🚨🚨 تنبيه: ولاية عنابة أصبحت متاحة للحجز! 🚨🚨🚨', 'ALERT');
          
          const alertMessage = `🚨 <b>تنبيه: ولاية ${annaba.wilayaNameAr} أصبحت متاحة للحجز!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل</a>\n\n📅 الوقت: ${new Date().toLocaleString('ar-DZ')}`;
          await sendTelegram(alertMessage);
          
          sentNotifications['23'] = true;
        } else if (!isAvailable) {
          sentNotifications['23'] = false;
        }
      }
      */
      
      return true;
      
    } catch (error) {
      const isTimeout = error.message.includes('timeout');
      log(`⚠️ المحاولة ${attempt} فشلت: ${isTimeout ? 'انتهى الوقت' : error.message}`, 'WARN');
      
      if (attempt === maxRetries) {
        log('❌ جميع المحاولات فشلت، سيتم إعادة المحاولة في الدقيقة القادمة', 'ERROR');
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  return false;
}

// ========== التشغيل الرئيسي ==========
async function run() {
  log('═══════════════════════════════════════');
  log('🧪 أضاحي مراقب - وضع التجربة (محاكاة التوفر)');
  log('📍 مراقبة ولاية عنابة (23)');
  log(`📨 التيليغرام: ${TELEGRAM_BOT_TOKEN ? '✅ مفعل' : '❌ غير مفعل'}`);
  log('═══════════════════════════════════════');
  
  await sendWelcomeMessage();
  await checkAvailabilityWithRetry(3);
}

run();
