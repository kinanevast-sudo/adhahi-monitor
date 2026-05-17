const axios = require('axios');
const fs = require('fs');

// ========== الإعدادات ==========
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ========== الولايات المراقبة (اكتب الأرقام التي تريدها) ==========
// أكواد الولايات:
// 23 = عنابة, 16 = الجزائر, 31 = وهران, 25 = قسنطينة, 15 = تيزي وزو
const WILAYAS_TO_MONITOR = ['23', '16', '31'];  // ← أضف أو اطرح الأرقام هنا

// حالة البوت
let monitoringActive = true;
let welcomeSent = false;
let dailyReportSent = false;
let lastReportDate = '';

// سجل الإشعارات المرسلة لكل ولاية
let sentNotifications = {};

// قائمة المهام
let tasks = [];

// ========== دوال مساعدة ==========
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

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

// تحميل المهام
function loadTasks() {
    try {
        if (fs.existsSync('tasks.json')) {
            const data = fs.readFileSync('tasks.json', 'utf8');
            tasks = JSON.parse(data);
            log(`تم تحميل ${tasks.length} مهمة`, 'INFO');
        }
    } catch (err) {
        tasks = [];
    }
}

// حفظ المهام
function saveTasks() {
    try {
        fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
    } catch (err) {
        log(`خطأ في حفظ المهام: ${err.message}`, 'ERROR');
    }
}

// إرسال رسالة تيليغرام
async function sendTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return false;
    }
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
                    reply = `🐏 <b>بوت أضاحي مراقب</b>\n\nمرحباً! أنا بوت لمراقبة حجوزات أضاحي.\n\n📋 <b>الأوامر المتاحة:</b>\n/status - حالة البوت والولاية\n/tasks - قائمة المهام\n/addtask نص المهمة\n/deltask رقم\n/monitor_on - تشغيل المراقبة\n/monitor_off - إيقاف المراقبة\n/check - فحص فوري\n/report - تقرير جميع الولايات\n/wilayas - عرض الولايات المراقبة\n/help - المساعدة`;
                    break;

                case '/help':
                    reply = `📋 <b>قائمة الأوامر:</b>\n\n/status - حالة المراقبة\n/tasks - عرض قائمة المهام\n/addtask مهمة - إضافة مهمة جديدة\n/deltask رقم - حذف مهمة\n/monitor_on - تشغيل المراقبة\n/monitor_off - إيقاف المراقبة\n/check - فحص فوري\n/report - تقرير جميع الولايات\n/wilayas - عرض الولايات المراقبة\n/start - الترحيب`;
                    break;

                case '/status':
                    const statusText = monitoringActive ? '🟢 شغالة' : '🔴 متوقفة';
                    let wilayasStatus = '';
                    for (const code of WILAYAS_TO_MONITOR) {
                        const notified = sentNotifications[code] ? 'تم الإشعار ✅' : 'في الانتظار ⏳';
                        wilayasStatus += `\n• ${getWilayaName(code)} (${code}): ${notified}`;
                    }
                    reply = `📊 <b>حالة البوت</b>\n\nالمراقبة: ${statusText}\nعدد المهام: ${tasks.length}\nالولايات المراقبة:${wilayasStatus}`;
                    break;

                case '/tasks':
                    if (tasks.length === 0) {
                        reply = `📋 <b>قائمة المهام</b>\n\nلا توجد مهام حالياً.\nأضف مهمة بـ: /addtask نص المهمة`;
                    } else {
                        let taskList = '';
                        tasks.forEach((task, index) => {
                            taskList += `\n${index + 1}. ${task.text}`;
                        });
                        reply = `📋 <b>قائمة المهام</b>\n${taskList}\n\nلحذف مهمة: /deltask رقم`;
                    }
                    break;

                case '/monitor_on':
                    monitoringActive = true;
                    reply = `🟢 <b>تم تشغيل المراقبة</b>\n\nسأقوم بإشعارك فور توفر أي ولاية من: ${WILAYAS_TO_MONITOR.map(c => getWilayaName(c)).join(', ')}`;
                    break;

                case '/monitor_off':
                    monitoringActive = false;
                    reply = `🔴 <b>تم إيقاف المراقبة</b>\n\nلن يتم إرسال أي إشعارات حتى يتم التشغيل مرة أخرى.`;
                    break;

                case '/check':
                    reply = `🔍 <b>جاري الفحص...</b>`;
                    await sendTelegram(reply);
                    await checkAvailability(true);
                    reply = `✅ <b>تم الفحص</b>\n\nيمكنك استخدام /report لرؤية النتائج.`;
                    await sendTelegram(reply);
                    continue;

                case '/report':
                    const report = await getFullReport();
                    await sendTelegram(report);
                    continue;

                case '/wilayas':
                    let wilayasList = '';
                    for (const code of WILAYAS_TO_MONITOR) {
                        wilayasList += `\n• ${getWilayaName(code)} (${code})`;
                    }
                    reply = `📍 <b>الولايات المراقبة حالياً</b>${wilayasList}\n\nلتغييرها، عدّل المصفوفة WILAYAS_TO_MONITOR في الكود.`;
                    break;

                default:
                    if (text.startsWith('/addtask')) {
                        const taskText = text.substring(9).trim();
                        if (taskText) {
                            tasks.push({ text: taskText, createdAt: new Date().toISOString() });
                            saveTasks();
                            reply = `✅ تم إضافة المهمة: "${taskText}"\nلديك الآن ${tasks.length} مهمة.`;
                        } else {
                            reply = `⚠️ الرجاء كتابة نص المهمة بعد /addtask\nمثال: /addtask متابعة حجوزات أضاحي`;
                        }
                    } else if (text.startsWith('/deltask')) {
                        const taskNum = parseInt(text.substring(8).trim());
                        if (isNaN(taskNum) || taskNum < 1 || taskNum > tasks.length) {
                            reply = `⚠️ رقم غير صحيح. المهام المتاحة: 1 إلى ${tasks.length}`;
                        } else {
                            const removed = tasks.splice(taskNum - 1, 1);
                            saveTasks();
                            reply = `✅ تم حذف المهمة: "${removed[0].text}"`;
                        }
                    } else {
                        reply = `⚠️ أمر غير معروف. استخدم /help لعرض الأوامر المتاحة.`;
                    }
            }

            await sendTelegram(reply);
        }
    } catch (error) {
        log(`خطأ في معالجة الأوامر: ${error.message}`, 'ERROR');
    }
}

// الحصول على تقرير كامل عن جميع الولايات
async function getFullReport() {
    try {
        const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const allWilayas = response.data;

        let report = `📊 <b>تقرير حالة الولايات</b>\n\n`;
        report += `🕐 ${new Date().toLocaleString('ar-DZ')}\n`;
        report += `━━━━━━━━━━━━━━━━━━━━━\n`;

        for (const code of WILAYAS_TO_MONITOR) {
            const wilaya = allWilayas.find(w => w.wilayaCode === code);
            if (wilaya) {
                const isAvailable = wilaya.available === true;
                const status = isAvailable ? '✅ <b>متاحة</b>' : '❌ غير متاحة';
                report += `\n📍 ${wilaya.wilayaNameAr} (${code}): ${status}`;
            } else {
                report += `\n📍 ${getWilayaName(code)} (${code}): ⚠️ غير معروف`;
            }
        }

        report += `\n\n━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `🟢 المراقبة: ${monitoringActive ? 'نشطة' : 'متوقفة'}`;
        return report;
    } catch (error) {
        return `❌ <b>خطأ في جلب التقرير</b>\n\n${error.message}`;
    }
}

// إرسال إشعار بدء المراقبة اليومية
async function sendDailyStartNotification() {
    const now = new Date();
    const hour = now.getHours();
    const today = now.toISOString().split('T')[0];

    // بين 8 و 9 صباحاً
    if (hour >= 8 && hour < 9 && lastReportDate !== today && monitoringActive) {
        lastReportDate = today;
        const message = `🌅 <b>بدء المراقبة اليومية</b>\n\n📅 التاريخ: ${now.toLocaleDateString('ar-DZ')}\n📍 الولايات: ${WILAYAS_TO_MONITOR.map(c => getWilayaName(c)).join(', ')}\n\nسأقوم بإشعارك فور توفر أي ولاية.`;
        await sendTelegram(message);
        log('📨 تم إرسال إشعار بدء المراقبة اليومية', 'SUCCESS');
    }
}

// إرسال تقرير نهاية اليوم
async function sendDailyEndNotification() {
    const now = new Date();
    const hour = now.getHours();
    const today = now.toISOString().split('T')[0];

    // بين 11 و 12 ليلاً
    if (hour >= 23 && hour < 24 && lastReportDate === today && !dailyReportSent) {
        dailyReportSent = true;
        const report = await getFullReport();
        const message = `🌙 <b>تقرير نهاية اليوم</b>\n\n${report}`;
        await sendTelegram(message);
        log('📨 تم إرسال تقرير نهاية اليوم', 'SUCCESS');
    } else if (hour === 0) {
        // إعادة تعيين في منتصف الليل
        dailyReportSent = false;
        lastReportDate = '';
    }
}

// فحص التوفر (مع إعادة محاولة)
async function checkAvailability(isManual = false) {
    if (!monitoringActive && !isManual) {
        log('⏸ المراقبة متوقفة (حسب أمر المستخدم)', 'INFO');
        return;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            log(`📡 محاولة ${attempt}/3 - جاري فحص التوفر...`, 'CHECK');

            const response = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas', {
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            const allWilayas = response.data;
            let anyAvailable = false;

            for (const code of WILAYAS_TO_MONITOR) {
                const wilaya = allWilayas.find(w => w.wilayaCode === code);
                if (wilaya) {
                    const isAvailable = wilaya.available === true;
                    log(`📍 ${wilaya.wilayaNameAr} (${code}): ${isAvailable ? '✅ متاحة' : '❌ غير متاحة'}`, 'INFO');

                    if (isAvailable && !sentNotifications[code]) {
                        log(`🚨 تنبيه: ولاية ${wilaya.wilayaNameAr} أصبحت متاحة للحجز!`, 'ALERT');
                        const message = `🚨 <b>تنبيه: ولاية ${wilaya.wilayaNameAr} أصبحت متاحة للحجز!</b>\n\n🔗 <a href="https://adhahi.dz/register">رابط التسجيل</a>\n\n📅 الوقت: ${new Date().toLocaleString('ar-DZ')}`;
                        await sendTelegram(message);
                        sentNotifications[code] = true;
                        anyAvailable = true;
                    } else if (!isAvailable) {
                        sentNotifications[code] = false;
                    }
                }
            }

            return true;

        } catch (error) {
            const isTimeout = error.message.includes('timeout');
            log(`⚠️ المحاولة ${attempt} فشلت: ${isTimeout ? 'انتهى الوقت' : error.message}`, 'WARN');

            if (attempt === 3) {
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
    log('🐏 أضاحي مراقب - الإصدار المتكامل');
    log(`📍 الولايات المراقبة: ${WILAYAS_TO_MONITOR.map(c => getWilayaName(c)).join(', ')}`);
    log(`📨 التيليغرام: ${TELEGRAM_BOT_TOKEN ? '✅ مفعل' : '❌ غير مفعل'}`);
    log('═══════════════════════════════════════');

    loadTasks();

    // معالجة الأوامر أولاً
    await handleCommands();

    // إرسال رسالة ترحيب (مرة واحدة)
    if (!welcomeSent) {
        const welcomeMessage = `🐏 <b>بوت أضاحي مراقب يعمل!</b>\n\n✅ النظام نشط.\n📍 الولايات المراقبة:\n${WILAYAS_TO_MONITOR.map(c => `• ${getWilayaName(c)} (${c})`).join('\n')}\n\n/help للأوامر`;
        await sendTelegram(welcomeMessage);
        welcomeSent = true;
    }

    // إشعار بدء المراقبة اليومية
    await sendDailyStartNotification();

    // الفحص العادي
    await checkAvailability(false);

    // تقرير نهاية اليوم
    await sendDailyEndNotification();
}

// تشغيل الدوال بشكل دوري
setInterval(async () => {
    await handleCommands();
    await checkAvailability(false);
    await sendDailyStartNotification();
    await sendDailyEndNotification();
}, 60000); // كل دقيقة

run();
