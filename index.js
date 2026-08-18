/*
 * =============================================================
 *  pvp_HSbot - Advanced 6b6t.org bot
 * =============================================================
 *  Owner: pvp_HS
 *  Modes: Shulker Farm (1), Kit (2)
 *
 *  ⚠️  بخش ورود به سرور و ست‌آپ Portal 1/2 دقیقاً همون کدیه
 *      که خودت فرستادی. فقط username و password به‌روز شدن.
 *      این بخش دست‌نخورده باقی مونده تا سرور کیک نده.
 * =============================================================
 */

const mineflayer = require('mineflayer')
const config = require('./config')
const { log, section } = require('./utils/logger')
const storage = require('./utils/storage')
const security = require('./utils/security')
const msg = require('./utils/msg')
const { get: t } = require('./utils/messages')

// Commands
const tpaCmd = require('./commands/tpa')
const homeCmd = require('./commands/home')
const dropCmd = require('./commands/drop')
const statsCmd = require('./commands/stats')
const helpCmd = require('./commands/help')

// Modes
const shulkerFarm = require('./modes/shulkerFarm')
const kit = require('./modes/kit')

// -------- State (منطبق با کد اصلی) --------
let bot
let stopped = false
let loggedIn = false
let timers = []
let inConfiguration = false
let transferCount = 0

let botReady = false // بعد از portal2 → کامندها فعال میشن
let currentLang = null // اول بار پرسیده میشه

// -------- helpers منطبق با کد اصلی --------
function timer(fn, ms) {
  const tm = setTimeout(() => {
    if (!stopped) fn()
  }, ms)
  timers.push(tm)
}

function clearTimers() {
  for (const tm of timers) clearTimeout(tm)
  timers = []
}

function stopMovement() {
  if (!bot) return
  try { bot.clearControlStates() } catch {}
  for (const key of ['forward','back','left','right','jump','sprint','sneak']) {
    try { bot.setControlState(key, false) } catch {}
  }
}

function pos() {
  if (!bot?.entity) return 'unknown'
  return (
    `X=${bot.entity.position.x.toFixed(2)} ` +
    `Y=${bot.entity.position.y.toFixed(2)} ` +
    `Z=${bot.entity.position.z.toFixed(2)}`
  )
}

function setPhysics(state) {
  try {
    bot.physicsEnabled = state
    log('PHYSICS', state ? 'ON' : 'OFF')
  } catch (e) {
    log('PHYSICS', `Could not change physics: ${e.message}`)
  }
}

// =============================================================
// COMMAND HANDLER
// =============================================================
async function handleCommand(bot, username, message) {
  const raw = message.trim()
  const isKitTrigger = raw.toLowerCase() === '?kit pvp'
  const isBotCmd = raw.startsWith(config.prefix) || isKitTrigger

  if (!isBotCmd) return

  // ✅ فقط owner (اسم + UUID)
  if (!security.isOwner(bot, username)) {
    log('SECURITY', `Blocked command from non-owner: ${username}`)
    return
  }

  const data = storage.load()
  const lang = currentLang || data.language || 'fa'

  // پارس کامند
  let parts, cmd, args
  if (isKitTrigger) {
    cmd = '?kit'
    args = ['pvp']
  } else {
    parts = raw.slice(config.prefix.length).trim().split(/\s+/)
    cmd = parts[0].toLowerCase()
    args = parts.slice(1)
  }

  log('CMD', `From ${username}: ${cmd} ${args.join(' ')}`)

  // -------- Language --------
  if (cmd === 'lang') {
    const choice = args[0]
    if (choice === '1' || choice === 'fa') {
      currentLang = 'fa'
      storage.update({ language: 'fa' })
      msg.sendToOwner(bot, t('langSet', 'fa'))
    } else if (choice === '2' || choice === 'en') {
      currentLang = 'en'
      storage.update({ language: 'en' })
      msg.sendToOwner(bot, t('langSet', 'en'))
    } else {
      msg.sendToOwner(bot, t('askLang', lang))
    }
    return
  }

  // اگه زبان انتخاب نشده، اول ازش بپرس
  if (!currentLang && !data.language) {
    msg.sendToOwner(bot, t('askLang', 'fa'))
    msg.sendToOwner(bot, t('askLang', 'en'))
    return
  }

  const currentMode = data.currentMode || 0

  switch (cmd) {
    case 'help':
      helpCmd.handleHelp(bot, lang)
      break

    case 'stats':
      statsCmd.handleStats(bot, lang)
      break

    case 'tpa':
      tpaCmd.handleTpaFromOwner(bot, lang)
      break

    case 'home':
      await homeCmd.handleHome(bot, lang)
      break

    case 'drop':
      await dropCmd.handleDrop(bot, lang)
      break

    case 'render': {
      const n = parseInt(args[0], 10)
      if (isNaN(n) || n < config.render.min || n > config.render.max) {
        msg.sendToOwner(bot, lang === 'fa'
          ? `⚠️ عدد رندر باید بین ${config.render.min} و ${config.render.max} باشه`
          : `⚠️ Render must be between ${config.render.min} and ${config.render.max}`)
        return
      }
      try {
        bot.settings.viewDistance = n
        if (bot._client) bot._client.write('settings', {
          locale: 'en_US',
          viewDistance: n,
          chatFlags: 0,
          chatColors: true,
          skinParts: 127,
          mainHand: 1
        })
      } catch {}
      storage.update({ renderDistance: n })
      msg.sendToOwner(bot, t('renderSet', lang, n))
      break
    }

    case 'mode': {
      const n = parseInt(args[0], 10)
      if (![0, 1, 2].includes(n)) {
        msg.sendToOwner(bot, lang === 'fa'
          ? '⚠️ !mode 0 / 1 / 2'
          : '⚠️ Use !mode 0 / 1 / 2')
        return
      }
      // متوقف کردن مود قبلی
      if (shulkerFarm.isRunning()) shulkerFarm.stop()
      if (kit.isRunning()) kit.stop()

      storage.update({ currentMode: n })
      const name = n === 0 ? 'None' : n === 1 ? 'Shulker Farm' : 'Kit'
      msg.sendToOwner(bot, t('modeSet', lang, n, name))
      break
    }

    case 'scan':
      if (currentMode !== 1) {
        msg.sendToOwner(bot, lang === 'fa'
          ? '⚠️ اول !mode 1 کن'
          : '⚠️ First !mode 1')
        return
      }
      await shulkerFarm.handleScan(bot, lang)
      break

    case 'start':
      if (currentMode === 1) {
        shulkerFarm.start(bot, lang)
      } else if (currentMode === 2) {
        msg.sendToOwner(bot, lang === 'fa'
          ? 'ℹ️ مود کیت با ?kit pvp شروع میشه'
          : 'ℹ️ Kit mode starts with ?kit pvp')
      } else {
        msg.sendToOwner(bot, lang === 'fa'
          ? '⚠️ هیچ مودی فعال نیست'
          : '⚠️ No mode active')
      }
      break

    case 'stop':
      if (shulkerFarm.isRunning()) {
        shulkerFarm.stop()
        msg.sendToOwner(bot, t('modeStop', lang))
      } else if (kit.isRunning()) {
        kit.stop()
        msg.sendToOwner(bot, t('modeStop', lang))
      } else {
        msg.sendToOwner(bot, lang === 'fa' ? 'ℹ️ چیزی برای توقف نیست' : 'ℹ️ Nothing to stop')
      }
      break

    case 'confirm':
      if (currentMode === 2 && kit.isAwaitingConfirm()) {
        await kit.confirmKill(bot, lang)
      } else {
        msg.sendToOwner(bot, lang === 'fa' ? 'ℹ️ منتظر تایید نبودم' : 'ℹ️ Not waiting')
      }
      break

    case '?kit':
      if (args[0] === 'pvp') {
        if (currentMode !== 2) {
          msg.sendToOwner(bot, lang === 'fa'
            ? '⚠️ اول !mode 2 کن'
            : '⚠️ First !mode 2')
          return
        }
        kit.startKit(bot, lang)
      }
      break

    default:
      msg.sendToOwner(bot, lang === 'fa'
        ? `❓ کامند ناشناخته: ${cmd}. برای راهنما !help بزن`
        : `❓ Unknown command: ${cmd}. Use !help`)
  }
}

// =============================================================
// START (منطبق دقیق با کد اصلی که فرستادی)
// =============================================================
function start() {
  stopped = false
  loggedIn = false
  inConfiguration = false
  botReady = false

  section('6b6t BOT STARTING')

  log('CONFIG', `Server: ${config.server.host}:${config.server.port}`)
  log('CONFIG', `Username: ${config.account.username}`)
  log('CONFIG', `Minecraft: ${config.server.version}`)
  log('CONFIG', 'VPN/Proxy: NONE')

  bot = mineflayer.createBot({
    host: config.server.host,
    port: config.server.port,
    username: config.account.username,
    password: config.account.password,
    version: config.server.version,
    auth: 'offline',
    physicsEnabled: false
  })

  // ============================================================
  // RAW PACKETS
  // ============================================================
  bot._client.on('packet', (data, meta) => {
    const important = [
      'start_configuration',
      'select_known_packs',
      'registry_data',
      'finish_configuration',
      'login',
      'disconnect',
      'transfer'
    ]

    if (important.includes(meta.name)) {
      log('PACKET', meta.name)
    }

    if (meta.name === 'start_configuration') {
      transferCount++
      inConfiguration = true

      section(`SERVER TRANSFER #${transferCount}`)
      log('TRANSFER', 'Configuration started')

      stopMovement()
      log('MOVE', 'Movement STOPPED for configuration')

      setPhysics(false)
    }

    if (meta.name === 'finish_configuration') {
      log('CONFIG', 'finish_configuration received')
    }

    if (meta.name === 'login' && inConfiguration) {
      inConfiguration = false
      log('TRANSFER', 'New server login received')

      timer(() => {
        if (stopped) return
        setPhysics(true)
        log('TRANSFER', 'Server transfer completed')
        log('POS', pos())
      }, 1000)
    }

    if (meta.name === 'disconnect') {
      section('RAW DISCONNECT PACKET')
      try {
        console.log(JSON.stringify(data, null, 2))
      } catch {
        console.log(data)
      }
    }
  })

  // ============================================================
  // LOGIN
  // ============================================================
  bot.on('login', () => {
    section('CONNECTED')
    log('LOGIN', 'Connection established')
  })

  // ============================================================
  // SPAWN
  // ============================================================
  bot.on('spawn', () => {
    section('SPAWN')
    log('POS', pos())

    if (!inConfiguration) {
      setPhysics(true)
    }

    log('SERVER', 'Waiting for login...')
  })

  // ============================================================
  // CHAT
  // ============================================================
  bot.on('messagestr', (message, position, jsonMsg) => {
    if (!message || !message.trim()) return

    log('CHAT', message)

    const text = message.toLowerCase()

    // --- LOGIN FLOW (منطبق با کد اصلی) ---
    if (
      !loggedIn &&
      (text.includes('please login') || text.includes('/login <password>'))
    ) {
      log('AUTH', 'Server requested /login')
      timer(() => {
        if (stopped || loggedIn) return
        log('AUTH', 'Sending /login')
        msg.sendInstant(bot, `/login ${config.account.password}`)
      }, 500)
    }

    if (
      !loggedIn &&
      (text.includes('you are now logged in') || text.includes('successfully logged in'))
    ) {
      loggedIn = true
      section('LOGIN SUCCESS')
      log('AUTH', 'Account login confirmed')
      log('POS', pos())

      log('WAIT', 'Waiting 10 seconds before Portal #1')
      timer(() => {
        portal1()
      }, 10000)
    }

    // --- بعد از آماده شدن بات ---
    if (botReady) {
      const data = storage.load()
      const lang = currentLang || data.language || 'fa'

      // فقط چت پلیرها (نه پیام سرور)
      // فرمت معمول: <username> message  یا  [username] message
      const playerChatMatch = message.match(/^[<\[]([^\s>\]]+)[>\]]\s*(.*)$/) ||
                              message.match(/^(\w+)\s*[:»]\s*(.*)$/)

      if (playerChatMatch) {
        const senderName = playerChatMatch[1]
        const content = playerChatMatch[2]
        if (content && content.startsWith(config.prefix) || content?.toLowerCase() === '?kit pvp') {
          handleCommand(bot, senderName, content).catch(e => log('CMD', `Error: ${e.message}`))
        }
      }

      // چک پیام‌های TPA سرور
      tpaCmd.checkTpaRequest(bot, message, lang)

      // چک تایید respawn set
      homeCmd.checkRespawnSet(bot, message, lang)
    }
  })

  // ============================================================
  // PORTAL 1 (دست‌نخورده از کد اصلی)
  // ============================================================
  function portal1() {
    if (stopped || !bot.entity) return
    section('PORTAL #1')
    log('POS', pos())
    log('MOVE', 'Moving forward')

    setPhysics(true)
    bot.setControlState('forward', true)

    timer(() => {
      if (stopped) return
      stopMovement()
      log('MOVE', 'Stopped')
      log('POS', pos())

      log('WAIT', 'Waiting 10 seconds before Portal #2')
      timer(() => {
        portal2()
      }, 10000)
    }, 10000)
  }

  // ============================================================
  // PORTAL 2 (دست‌نخورده از کد اصلی)
  // ============================================================
  function portal2() {
    if (stopped || !bot.entity) return
    section('PORTAL #2')
    log('POS', pos())

    setPhysics(true)
    log('MOVE', 'Moving forward toward Portal #2')

    bot.setControlState('forward', true)

    timer(() => {
      if (stopped) return
      stopMovement()
      log('MOVE', 'Movement stopped')
      log('POS', pos())

      // ✅ بعد از پورتال دوم بات آماده کاره
      botReady = true
      section('BOT READY - COMMANDS ACTIVE')
      log('READY', 'Bot is now ready for commands')

      // TPS tracker
      statsCmd.initTpsTracker(bot)

      // اگه زبان قبلاً انتخاب شده بود، پیام خوش‌آمدگویی
      const data = storage.load()
      if (data.language) {
        currentLang = data.language
        msg.sendToOwner(bot, data.language === 'fa'
          ? '✅ بات آماده کاره. !help برای راهنما'
          : '✅ Bot is ready. Use !help for commands')

        // ارسال کامند render distance ذخیره شده
        if (data.renderDistance) {
          try { bot.settings.viewDistance = data.renderDistance } catch {}
        }
      } else {
        // اولین بار → بپرس زبان
        msg.sendToOwner(bot, t('askLang', 'fa'))
        msg.sendToOwner(bot, t('askLang', 'en'))
      }

      // AutoTotem همیشگی
      startAutoTotemLoop()

    }, 10000)
  }

  // ============================================================
  // AutoTotem loop (هر ۵ ثانیه چک میکنه)
  // ============================================================
  function startAutoTotemLoop() {
    setInterval(async () => {
      if (!botReady || stopped) return
      try {
        const offhand = bot.inventory.slots[45]
        if (offhand && offhand.name === 'totem_of_undying') return

        const totem = bot.inventory.items().find(i => i.name === 'totem_of_undying')
        if (totem) {
          await bot.equip(totem, 'off-hand')
          log('AUTOTOTEM', 'Totem re-equipped')
        }
      } catch {}
    }, 5000)
  }

  // ============================================================
  // RESPAWN
  // ============================================================
  bot.on('respawn', () => {
    section('RESPAWN')
    log('POS', pos())
    if (!inConfiguration) {
      setPhysics(true)
    }
  })

  // ============================================================
  // KICK
  // ============================================================
  bot.on('kicked', reason => {
    stopped = true
    clearTimers()
    stopMovement()
    section('KICKED')
    try {
      if (typeof reason === 'string') console.log(reason)
      else console.log(JSON.stringify(reason, null, 2))
    } catch {
      console.log(String(reason))
    }

    // Auto-reconnect بعد از 30 ثانیه
    log('RECONNECT', 'Reconnecting in 30s...')
    setTimeout(() => {
      stopped = false
      start()
    }, 30000)
  })

  // ============================================================
  // END
  // ============================================================
  bot.on('end', reason => {
    stopped = true
    clearTimers()
    stopMovement()
    section('CONNECTION ENDED')
    log('END', reason || 'socketClosed')

    // Auto-reconnect
    log('RECONNECT', 'Reconnecting in 30s...')
    setTimeout(() => {
      stopped = false
      start()
    }, 30000)
  })

  // ============================================================
  // ERROR
  // ============================================================
  bot.on('error', err => {
    section('BOT ERROR')
    console.error(err)
  })

  bot._client.on('error', err => {
    section('PROTOCOL ERROR')
    console.error(err)
  })
}

// Graceful shutdown
process.on('SIGINT', () => {
  section('SHUTDOWN')
  stopped = true
  clearTimers()
  try { bot?.quit('shutdown') } catch {}
  setTimeout(() => process.exit(0), 500)
})

start()
