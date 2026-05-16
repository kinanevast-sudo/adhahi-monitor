const axios = require('axios');

let sentNotifications = {};

async function checkAvailability() {
  try {
    const res = await axios.get('https://adhahi.dz/api/v1/public/wilaya-quotas');
    const annaba = res.data.find(w => w.wilayaCode === '23');
    
    if (annaba) {
      const isAvailable = annaba.available === true;
      console.log(`[${new Date().toISOString()}] عنابة: ${isAvailable ? '✅ متاحة' : '❌ غير متاحة'}`);
      
      if (isAvailable && !sentNotifications['23']) {
        console.log('🚨 تنبيه: ولاية عنابة متاحة للحجز!');
        console.log('🔗 https://adhahi.dz/register');
        sentNotifications['23'] = true;
      }
    }
  } catch (error) {
    console.error('خطأ:', error.message);
  }
}

checkAvailability();
