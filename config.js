/*
 * =============================================================
 *  CONFIG - pvp_HSbot
 * =============================================================
 *  تنظیمات اصلی بات
 *  - اطلاعات سرور و اکانت
 *  - Owner (فقط این شخص میتونه کنترل کنه)
 *  - محدودیت‌ها و کول‌داون‌ها
 * =============================================================
 */

module.exports = {
  // -------- Server --------
  server: {
    host: 'alt.6b6t.org',
    port: 25565,
    version: '1.21.11'
  },

  // -------- Account --------
  account: {
    username: 'pvp_HSbot',
    password: 'AZHAN8585@#@#ABOL1234',
    auth: 'offline'
  },

  // -------- Owner (فقط این شخص کنترل داره) --------
  owner: {
    name: 'pvp_HS'
    // UUID بعد از اولین ورود توی config.json ذخیره میشه
  },

  // -------- Command prefix --------
  prefix: '!',

  // -------- Timing (طبیعی و انسانی) --------
  timing: {
    // تاخیر بین کلیک‌ها و اکشن‌ها (میلی‌ثانیه)
    minReactionMs: 350,
    maxReactionMs: 900,

    // چرخش سر قبل از کلیک
    lookBeforeClickMs: 400,

    // تاخیر بین چت‌ها
    minChatDelayMs: 800,
    maxChatDelayMs: 1600,

    // منتظر موندن بین کارها در مود Shulker
    shulkerCycleWaitMs: 1500
  },

  // -------- Cooldowns (6b6t) --------
  cooldowns: {
    tpaSeconds: 120,     // 120 ثانیه بدون رنک
    homeSeconds: 90,
    chatCooldownMs: 2500 // فاصله بین پیام‌های چت
  },

  // -------- Auth / Login --------
  auth: {
    // هر بار بیاد سرور رمز رو بفرسته
    autoLogin: true,
    loginDelayMs: 1500
  },

  // -------- Render distance default --------
  render: {
    defaultDistance: 12,
    min: 2,
    max: 32
  },

  // -------- Shulker Farm (Mode 1) --------
  shulkerFarm: {
    scanRadius: 16,
    // ماکس شمارش سیکل قبل از استاپ خودکار (0 = بی‌نهایت)
    maxCycles: 0
  },

  // -------- Files --------
  files: {
    dataFile: './data/config.json',
    logFile: './data/bot.log'
  }
}
