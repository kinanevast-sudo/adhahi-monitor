const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let sentNotifications = {};
let lastWilayaStatus = {};
let testMessageSent = false;

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

async function sendTelegram(message, chatId = null) {
  const targetChatId = chatId || TELEGRAM_CHAT_ID;
  if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: targetChatId,
      text: message,
      parse_mode: 'HTML'
    }, { timeout: 10000 });
    return true;
  } catch (error) {
    log(`❌ فشل الإرسال: ${error.message}`, 'ERROR');
    return false;
  }
}

// معالجة أوامر تيليغرام (دائماً تعمل أولاً)
async function handleTelegramCommands() {
  if (!TELEGRAM_BOT_TOKEN) return;
  
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
    const response = await axios.get(url, { timeout: 10000 });
    const updates = response.data.result || [];
    
    for (const update of updates) {
      const message = update.message;
      if (!message || !message.text) continue;
      
      const chatId = message.chat.id;
      const text = message.text.trim();
      
      // تأشير أن هذا التحديث تمت معالجته
      await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${update.update_id + 1}`);
      
      if (!text.startsWith('/')) continue;
      
      log(`📨 أمر وارد: ${text}`, 'INFO');
      
      let reply = '';
      
      switch (text.toLowerCase()) {
        case '/start':
          reply = `🐏 <b>بوت أضاحي مراقب</b>\n\nمرحباً! أنا بوت لمراقبة حجوزات أضاحي.\n\n📋 <b>الأوامر المتاحة:</b>\n/status - حالة المراقبة\n/check - فحص فوري\n/help - المساعدة`;
          break;
          
        case '/help':
          reply = `📋 <b>قائمة الأوامر:</b>\n\n/status - عرض حالة المراقبة\n/check - إجراء فحص فوري\n/start - الترحيب`;
          break;
          
        case '/status':
          const isAvailable = lastWilayaStatus['23']?.available === true;
          reply = `📊 <b>حالة المراقبة</b>\n\n`;
          reply += `🟢 النظام: نشط\n`;
          reply += `📍 عنابة: ${isAvailable ? '✅ متاحة' : '❌ غير متاحة'}\n`;
          reply += `🕐 آخر فحص: ${lastWilayaStatus['23']?.lastCheck || 'لم يتم بعد'}`;
          break;
          
        case '/check':
          reply = `🔍 <b>جاري إجراء فحص فوري...</b>`;
          await sendTelegram(reply, chatId);
          
          // فحص فوري
          const result = await quickCheck();
          const status = result ? '✅ متاحة' : '❌ غير متاحة';
          reply = `📊 <b>نتيجة الفحص:</b>\n\n📍 عنابة: ${status}\n🕐 الوقت: ${new Date().toLocaleString('ar-DZ')}`;
          await sendTelegram(reply, chatId);
          continue;
          
        default:
          reply = `⚠️ أمر غير معروف. استخدم /help.`;
      }
      
      await sendTelegram(reply, chatId);
    }
  } catch (error) {
    log(`خطأ في معالجة الأوامر: ${error.message}`, 'ERROR');
  }
}

// فحص سريع (10 ثوانٍ فقط)
async function quickCheck() {
  try {
    const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const annaba = response.data.find(w => w.wilayaCode === '23');
    return annaba?.available === true;
  } catch (error) {
    return false;
  }
}

// الفحص العادي مع تحديث الحالة
async function regularCheck() {
  try {
    const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    const annaba = response.data.find(w => w.wilayaCode === '23');
    
    if (annaba) {
      const isAvailable = annaba.available === true;
      lastWilayaStatus['23'] = {
        available: isAvailable,
        lastCheck: new Date().toLocaleString('ar-DZ'),
        name: annaba.wilayaNameAr
      };
      
      log(`📍 عنابة: ${isAvailable ? '✅ متاحة' : '❌ غير متاحة'}`, 'INFO');
      
      if (isAvailable && !sentNotifications['23']) {
        log('🚨 تنبيه: ولاية عنابة أصبحت متاحة!', 'ALERT');
        const message = `🚨 <b>تنبيه: ولاية ${annaba.wilayaNameAr} أصبحت متاحة للحجز!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل</a>`;
        await sendTelegram(message);
        sentNotifications['23'] = true;
      } else if (!isAvailable) {
        sentNotifications['23'] = false;
      }
    }
    
    return true;
  } catch (error) {
    log(`⚠️ فشل الفحص العادي: ${error.message}`, 'WARN');
    return false;
  }
}

// ========== التشغيل الرئيسي ==========
async function run() {
  log('═══════════════════════════════════════');
  log('🐏 أضاحي مراقب - الإصدار المحسن');
  log('📍 مراقبة ولاية عنابة (23)');
  log('═══════════════════════════════════════');
  
  // 1. معالجة الأوامر أولاً (قد ترسل رسالة ترحيب)
  await handleTelegramCommands();
  
  // 2. إرسال رسالة ترحيب تجريبية (مرة واحدة)
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && !testMessageSent) {
    await sendTelegram('✅ <b>بوت أضاحي مراقب يعمل!</b>\n\nالأوامر المتاحة:\n/status - حالة المراقبة\n/check - فحص فوري\n/help - المساعدة');
    testMessageSent = true;
    log('📨 تم إرسال رسالة الترحيب', 'SUCCESS');
  }
  
  // 3. الفحص العادي
  await regularCheck();
}

run();
