const axios = require('axios');
const fs = require('fs');

// ========== الإعدادات ==========
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ========== الولايات المراقبة (افتراضية) ==========
let WILAYAS_TO_MONITOR = ['23'];  // عنابة افتراضياً

// حالة البوت
let monitoringActive = true;
let welcomeSent = false;
let lastReportDate = '';
let dailyReportSent = false;

// سجل الإشعارات
let sentNotifications = {};
let tasks = [];

// ========== أسماء الولايات ==========
function getWilayaName(code) {
    const names = {
        '01': 'أدرار', '02': 'الشلف', '03': 'الأغواط', '04': 'أم البواقي', '05': 'باتنة',
        '06': 'بجاية', '07': 'بسكرة', '08': 'بشار', '09': 'البليدة', '10': 'البويرة',
        '11': 'تمنراست', '12': 'تبسة', '13': 'تلمسان', '14': 'تيارت', '15': 'تيزي وزو',
        '16': 'الجزائر', '17': 'الجلفة', '18': 'جيجل', '19': 'سطيف', '20': 'سعيدة',
        '21': 'سكيكدة', '22': 'سيدي بلعباس', '23': 'عنابة', '24': 'قالمة', '25': 'قسنطينة',
        '26': 'المدية', '27': 'مستغانم', '28': 'المسيلة', '29': 'معسكر', '30': 'ورقلة',
        '31': 'وهران', '32': 'البيض', '33': 'اليزي', '34': 'برج بوعريريج', '35': 'بومرداس',
        '36': 'الطارف', '37': 'تندوف', '38': 'تيسمسيلت', '39': 'الوادي', '40': 'خنشلة',
        '41': 'سوق أهراس', '42': 'تيبازة', '43': 'ميلة', '44': 'عين الدفلى', '45': 'النعامة',
        '46': 'عين تموشنت', '47': 'غرداية', '48': 'غليزان', '49': 'تيميمون', '50': 'برج باجي مختار',
        '51': 'أولاد جلال', '52': 'بني عباس', '53': 'عين صالح', '54': 'إن قزام', '55': 'تقرت',
        '56': 'جانت', '57': 'المغير', '58': 'المنيعة'
    };
    return names[code] || code;
}

// تحميل الإعدادات من ملف
function loadSettings() {
    try {
        if (fs.existsSync('settings.json')) {
            const data = fs.readFileSync('settings.json', 'utf8');
            const settings = JSON.parse(data);
            if (settings.wilayas) WILAYAS_TO_MONITOR = settings.wilayas;
            if (settings.tasks) tasks = settings.tasks;
            log(`تم تحميل الإعدادات: ${WILAYAS_TO_MONITOR.length} ولاية`, 'INFO');
        }
    } catch (err) {
        log(`خطأ في تحميل الإعدادات: ${err.message}`, 'ERROR');
    }
}

// حفظ الإعدادات
function saveSettings() {
    try {
        const settings = { wilayas: WILAYAS_TO_MONITOR, tasks: tasks };
        fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));
    } catch (err) {
        log(`خطأ في حفظ الإعدادات: ${err.message}`, 'ERROR');
    }
}

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

async function sendTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        }, { timeout: 10000 });
        return true;
    } catch (error) {
        log(`فشل الإرسال: ${error.message}`, 'ERROR');
        return false;
    }
}

// ========== معالجة الأوامر ==========
async function handleCommands() {
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

            await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${update.update_id + 1}`);

            if (!text.startsWith('/')) continue;

            log(`📨 أمر وارد: ${text}`, 'INFO');

            let reply = '';

            switch (text.toLowerCase()) {
                case '/start':
                    reply = `🐏 <b>بوت أضاحي مراقب</b>\n\nمرحباً!\n\n📋 <b>الأوامر المتاحة:</b>\n/status - حالة البوت\n/tasks - قائمة المهام\n/addtask نص\n/deltask رقم\n/addwilaya رقم - إضافة ولاية\n/removewilaya رقم - حذف ولاية\n/wilayas - عرض الولايات\n/monitor_on - تشغيل المراقبة\n/monitor_off - إيقاف المراقبة\n/check - فحص فوري\n/report - تقرير شامل\n/help - المساعدة`;
                    break;

                case '/help':
                    reply = `📋 <b>قائمة الأوامر:</b>\n\n/status - حالة المراقبة\n/tasks - عرض المهام\n/addtask مهمة - إضافة مهمة\n/deltask رقم - حذف مهمة\n/addwilaya رقم - إضافة ولاية\n/removewilaya رقم - حذف ولاية\n/wilayas - عرض الولايات المراقبة\n/monitor_on - تشغيل المراقبة\n/monitor_off - إيقاف المراقبة\n/check - فحص فوري\n/report - تقرير جميع الولايات\n/start - الترحيب`;
                    break;

                case '/status':
                    reply = `📊 <b>حالة البوت</b>\n\nالمراقبة: ${monitoringActive ? '🟢 شغالة' : '🔴 متوقفة'}\nعدد المهام: ${tasks.length}\nالولايات: ${WILAYAS_TO_MONITOR.map(c => getWilayaName(c)).join(', ')}`;
                    break;

                case '/tasks':
                    if (tasks.length === 0) {
                        reply = `📋 لا توجد مهام. أضف بـ /addtask نص`;
                    } else {
                        let list = '';
                        tasks.forEach((t, i) => list += `\n${i + 1}. ${t.text}`);
                        reply = `📋 <b>المهام</b>${list}\n\nحذف: /deltask رقم`;
                    }
                    break;

                case '/monitor_on':
                    monitoringActive = true;
                    reply = `🟢 <b>تم تشغيل المراقبة</b>`;
                    break;

                case '/monitor_off':
                    monitoringActive = false;
                    reply = `🔴 <b>تم إيقاف المراقبة</b>`;
                    break;

                case '/check':
                    reply = `🔍 جاري الفحص...`;
                    await sendTelegram(reply);
                    await quickCheck();
                    reply = `✅ تم الفحص. استخدم /report للنتائج.`;
                    await sendTelegram(reply);
                    continue;

                case '/report':
                    const report = await getFullReport();
                    await sendTelegram(report);
                    continue;

                case '/wilayas':
                    reply = `📍 <b>الولايات المراقبة</b>\n${WILAYAS_TO_MONITOR.map(c => `• ${getWilayaName(c)} (${c})`).join('\n')}`;
                    break;

                default:
                    if (text.startsWith('/addtask')) {
                        const taskText = text.substring(9).trim();
                        if (taskText) {
                            tasks.push({ text: taskText });
                            saveSettings();
                            reply = `✅ تم إضافة: "${taskText}"`;
                        } else {
                            reply = `⚠️ اكتب نص المهمة بعد /addtask`;
                        }
                    } 
                    else if (text.startsWith('/deltask')) {
                        const num = parseInt(text.substring(8).trim());
                        if (num > 0 && num <= tasks.length) {
                            const removed = tasks.splice(num - 1, 1);
                            saveSettings();
                            reply = `✅ تم حذف: "${removed[0].text}"`;
                        } else {
                            reply = `⚠️ رقم غير صحيح (1-${tasks.length})`;
                        }
                    }
                    else if (text.startsWith('/addwilaya')) {
                        const code = text.substring(11).trim();
                        if (code && /^\d{2}$/.test(code)) {
                            if (!WILAYAS_TO_MONITOR.includes(code)) {
                                WILAYAS_TO_MONITOR.push(code);
                                saveSettings();
                                reply = `✅ تم إضافة ولاية ${getWilayaName(code)} (${code})`;
                            } else {
                                reply = `⚠️ ولاية ${getWilayaName(code)} موجودة بالفعل`;
                            }
                        } else {
                            reply = `⚠️ اكتب رقم ولاية صحيح (مثال: /addwilaya 16)`;
                        }
                    }
                    else if (text.startsWith('/removewilaya')) {
                        const code = text.substring(13).trim();
                        if (code && /^\d{2}$/.test(code)) {
                            const index = WILAYAS_TO_MONITOR.indexOf(code);
                            if (index !== -1) {
                                WILAYAS_TO_MONITOR.splice(index, 1);
                                saveSettings();
                                reply = `✅ تم حذف ولاية ${getWilayaName(code)} (${code})`;
                            } else {
                                reply = `⚠️ ولاية ${getWilayaName(code)} غير موجودة`;
                            }
                        } else {
                            reply = `⚠️ اكتب رقم ولاية صحيح (مثال: /removewilaya 16)`;
                        }
                    }
                    else {
                        reply = `⚠️ أمر غير معروف. /help للمساعدة`;
                    }
            }

            await sendTelegram(reply);
        }
    } catch (error) {
        log(`خطأ في الأوامر: ${error.message}`, 'ERROR');
    }
}

async function quickCheck() {
    try {
        const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', { timeout: 10000 });
        const allWilayas = response.data;
        for (const code of WILAYAS_TO_MONITOR) {
            const wilaya = allWilayas.find(w => w.wilayaCode === code);
            if (wilaya?.available && !sentNotifications[code]) {
                await sendTelegram(`🚨 <b>ولاية ${wilaya.wilayaNameAr} متاحة!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل</a>`);
                sentNotifications[code] = true;
            }
        }
    } catch (error) {
        log(`فحص سريع فشل: ${error.message}`, 'ERROR');
    }
}

async function getFullReport() {
    try {
        const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', { timeout: 10000 });
        const allWilayas = response.data;
        let report = `📊 <b>تقرير الولايات</b>\n\n🕐 ${new Date().toLocaleString('ar-DZ')}\n━━━━━━━━━━━━━━━\n`;
        for (const code of WILAYAS_TO_MONITOR) {
            const wilaya = allWilayas.find(w => w.wilayaCode === code);
            if (wilaya) {
                const status = wilaya.available ? '✅ متاحة' : '❌ غير متاحة';
                report += `\n📍 ${wilaya.wilayaNameAr} (${code}): ${status}`;
            }
        }
        return report;
    } catch (error) {
        return `❌ خطأ: ${error.message}`;
    }
}

async function checkAvailability() {
    if (!monitoringActive) return;

    try {
        const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', { timeout: 10000 });
        const allWilayas = response.data;

        for (const code of WILAYAS_TO_MONITOR) {
            const wilaya = allWilayas.find(w => w.wilayaCode === code);
            if (wilaya) {
                const isAvailable = wilaya.available === true;
                if (isAvailable && !sentNotifications[code]) {
                    log(`🚨 ${wilaya.wilayaNameAr} متاحة!`, 'ALERT');
                    await sendTelegram(`🚨 <b>تنبيه: ولاية ${wilaya.wilayaNameAr} متاحة!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل</a>`);
                    sentNotifications[code] = true;
                } else if (!isAvailable) {
                    sentNotifications[code] = false;
                }
            }
        }
    } catch (error) {
        log(`فحص فشل: ${error.message}`, 'WARN');
    }
}

// ========== التشغيل ==========
async function run() {
    log('═══════════════════════════════════════');
    log('🐏 أضاحي مراقب - النسخة المستقرة');
    log(`الولايات: ${WILAYAS_TO_MONITOR.map(c => getWilayaName(c)).join(', ')}`);
    log('═══════════════════════════════════════');

    loadSettings();
    await handleCommands();

    if (!welcomeSent) {
        await sendTelegram(`✅ <b>بوت أضاحي مراقب يعمل!</b>\n\nالولايات: ${WILAYAS_TO_MONITOR.map(c => getWilayaName(c)).join(', ')}\n/help للأوامر`);
        welcomeSent = true;
    }

    await checkAvailability();
}

run();
setInterval(() => { run(); }, 60000);
