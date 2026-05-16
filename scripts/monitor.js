const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let sentNotifications = {};
let lastWilayaStatus = {};

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

async function sendTelegram(message, chatId = null) {
  const targetChatId = chatId || TELEGRAM_CHAT_ID;
  if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
    log('⚠️ إشعارات التيليغرام غير مفعلة', 'WARN');
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

// معالجة الأوامر الواردة من تيليغرام
async function handleTelegramCommands() {
  if (!TELEGRAM_BOT_TOKEN) return;
  
  try {
    // جلب آخر التحديثات
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
    const response = await axios.get(url, { timeout: 10000 });
    const updates = response.data.result || [];
    
    for (const update of updates) {
      const message = update.message;
      if (!message || !message.text) continue;
      
      const chatId = message.chat.id;
      const text = message.text.trim();
      const isCommand = text.startsWith('/');
      
      if (!isCommand) continue;
      
      log(`📨 أمر وارد: ${text} من ${chatId}`, 'INFO');
      
      let reply = '';
      
      switch (text.toLowerCase()) {
        case '/start':
          reply = `🐏 <b>بوت أضاحي مراقب</b>\n\nمرحباً! أنا بوت لمراقبة حجوزات أضاحي.\n\n📋 <b>الأوامر المتاحة:</b>\n/status - حالة المراقبة\n/wilayas - الولايات المراقبة\n/check - فحص فوري\n/help - المساعدة`;
          break;
          
        case '/help':
          reply = `📋 <b>قائمة الأوامر:</b>\n\n/status - عرض حالة المراقبة\n/wilayas - عرض الولايات المراقبة\n/check - إجراء فحص فوري\n/start - الترحيب`;
          break;
          
        case '/status':
          reply = `📊 <b>حالة المراقبة</b>\n\n`;
          reply += `🟢 النظام: نشط\n`;
          reply += `📍 عنابة: ${lastWilayaStatus['23']?.available === true ? '✅ متاحة' : '❌ غير متاحة'}\n`;
          reply += `🕐 آخر فحص: ${lastWilayaStatus['23']?.lastCheck || 'لم يتم بعد'}`;
          break;
          
        case '/wilayas':
          reply = `📍 <b>الولايات المراقبة حالياً:</b>\n\n`;
          reply += `• عنابة (23) - ${lastWilayaStatus['23']?.available === true ? '✅ متاحة' : '❌ غير متاحة'}\n`;
          break;
          
        case '/check':
          reply = `🔍 <b>جاري إجراء فحص فوري...</b>\nسأقوم بالرد عليك بعد اكتمال الفحص.`;
          await sendTelegram(reply, chatId);
          
          // إجراء فحص فوري
          await checkAvailability(true);
          
          const status = lastWilayaStatus['23']?.available === true ? '✅ متاحة' : '❌ غير متاحة';
          reply = `📊 <b>نتيجة الفحص:</b>\n\n📍 عنابة (23): ${status}\n🕐 الوقت: ${new Date().toLocaleString('ar-DZ')}`;
          await sendTelegram(reply, chatId);
          continue; // تجنب إرسال الرد الافتراضي
          
        default:
          reply = `⚠️ أمر غير معروف. استخدم /help لعرض الأوامر المتاحة.`;
      }
      
      await sendTelegram(reply, chatId);
      
      // تأشير أن هذا التحديث تمت معالجته
      await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${update.update_id + 1}`);
    }
  } catch (error) {
    log(`خطأ في معالجة أوامر التيليغرام: ${error.message}`, 'ERROR');
  }
}

async function checkAvailability(isManual = false) {
  try {
    log(`📡 جاري فحص التوفر...${isManual ? ' (يدوي)' : ''}`, 'CHECK');
    
    const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    const wilayas = response.data;
    const annaba = wilayas.find(w => w.wilayaCode === '23');
    
    if (annaba) {
      const isAvailable = annaba.available === true;
      lastWilayaStatus['23'] = {
        available: isAvailable,
        lastCheck: new Date().toLocaleString('ar-DZ'),
        name: annaba.wilayaNameAr
      };
      
      log(`📍 عنابة: ${isAvailable ? '✅ متاحة' : '❌ غير متاحة'}`, 'INFO');
      
      if (isAvailable && !sentNotifications['23']) {
        log('🚨 تنبيه: ولاية عنابة أصبحت متاحة للحجز!', 'ALERT');
        
        const message = `🚨 <b>تنبيه: ولاية ${annaba.wilayaNameAr} أصبحت متاحة للحجز!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل</a>\n\n📅 الوقت: ${new Date().toLocaleString('ar-DZ')}`;
        await sendTelegram(message);
        
        sentNotifications['23'] = true;
      } else if (!isAvailable) {
        sentNotifications['23'] = false;
      }
    }
    
  } catch (error) {
    log(`⚠️ فشل الفحص: ${error.message}`, 'WARN');
  }
}

async function run() {
  log('═══════════════════════════════════════');
  log('🐏 أضاحي مراقب - مع أوامر تيليغرام');
  log('📍 مراقبة ولاية عنابة (23)');
  log('═══════════════════════════════════════');
  
  // معالجة الأوامر الواردة
  await handleTelegramCommands();
  
  // إجراء الفحص العادي
  await checkAvailability();
}

run();
