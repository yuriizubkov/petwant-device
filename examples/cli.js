const PetwantDevice = require('../index')
const petwant = new PetwantDevice()

async function setup() {
  console.info('Initializing PetwantDevice object...')
  try {
    console.info('GPIO...')
    await petwant.setupGPIO()

    console.info('UART...')
    await petwant.connect()

    console.info('LEDs...')
    await Promise.all([
      petwant.setPowerLedState(true),
      petwant.setLinkLedState(true)
    ])

    petwant.on('buttondown', () => console.info('Button down'))

    petwant.on('buttonup', () => console.info('Button up'))

    petwant.on('buttonlongpress', pressedTime =>
      console.info('Button long press time (ms):', pressedTime)
    )

    petwant.on('datetimeutc', dateTimeUtc =>
      console.info('DateTime from device (UTC):', dateTimeUtc)
    )

    petwant.on('clocksynchronized', () => console.info('Clock was synced'))

    petwant.on('scheduledfeedingstarted', entryData =>
      console.info('Scheduled feeding started:', entryData)
    )

    petwant.on('feedingcomplete', motorRevolutions =>
      console.info(
        'Feeding complete with motor revolutions done:',
        motorRevolutions
      )
    )

    petwant.on('unknownmessage', data =>
      console.info('Unknown Message received:', data)
    )

    petwant.on('warningnofood', () => console.info('No food!'))

    console.info('Setup complete')
  } catch (err) {
    console.error(err)
  }
}

// Setup Petwant device
setup()

// Cleanup on exit
async function cleanup(sig) {
  if (sig) console.info('Cleanup on signal:', sig)
  else console.info('Cleanup.')

  try {
    await petwant.setLinkLedState(false)
    petwant.destroy()
  } catch (err) {
    console.error(err)
  }

  process.exit(0)
}

;[
  'SIGHUP',
  'SIGINT',
  'SIGQUIT',
  'SIGILL',
  'SIGTRAP',
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGUSR1',
  'SIGSEGV',
  'SIGUSR2',
  'SIGTERM',
  'unhandledRejection',
  'uncaughtException'
].forEach(sig => {
  process.on(sig, cleanup)
})

// Keyboard input
const stdin = process.stdin

stdin.setRawMode(true)
stdin.resume()
stdin.setEncoding('utf8')

stdin.on('data', key => {
  console.info('\r\nKey pressed:', key)
  switch (String(key)) {
    case 'q':
      console.info('Good bye!')
      cleanup()
      break
    case 's':
      console.info('Requesting schedule...')
      petwant
        .getSchedule()
        .then(scheduleArray => {
          console.info('Schedule:', scheduleArray)
        })
        .catch(err => console.error(err))
      break
    case 'f':
      console.info('Starting manual feeding')
      petwant
        .feedManually()
        .then(() => {
          console.info('Manual feeding started...')
        })
        .catch(err => console.error(err))
      break
    case 'e':
      console.info('Editing schedule entry')
      petwant
        .setScheduleEntry(16, 0, 2, 2)
        .then(() => {
          console.info('Schedule entry was successfully set')
        })
        .catch(err => console.error(err))
      break
    case 'd':
      console.info('Deleting schedule entries...')
      petwant
        .clearSchedule()
        .then(() => {
          console.info('Schedule deleted')
        })
        .catch(err => console.error(err))
      break
    case 'b':
      if (!petwant.powerLedBlinking) {
        console.info('Power LED blink ON')
        petwant.powerLedBlinking = true
      } else {
        console.info('Power LED blink OFF')
        petwant.powerLedBlinking = false
      }
      break
    case 'n':
      if (!petwant.linkLedBlinking) {
        console.info('Link LED blink ON')
        petwant.linkLedBlinking = true
      } else {
        console.info('Link LED blink OFF')
        petwant.linkLedBlinking = false
      }
      break
    default:
      console.info(
        "Press 'q' to quit, 's' to request schedule, 'f' to start feeding manually, 'e' to edit schedule entry, 'd' to delete all schedule entries, 'b' to enable/disable blink with power led, 'n' to enable/disable blink with link led"
      )
  }
})
