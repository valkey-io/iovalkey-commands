'use strict'

const fs = require('fs')
const path = require('path')
const stringify = require('safe-stable-stringify')
const commandPath = path.join(__dirname, '..', 'lib', 'commands.json')
const valkeyCommands = require('..')

const Valkey = require('iovalkey')
const valkey = new Valkey(process.env.REDIS_URI)

valkey.command().then(function (res) {
  valkey.disconnect()

  // Find all special handled cases
  const commands = res.reduce(function (
    prev,
    [commandName, arity, flags, keyStart, keyStop, step]
  ) {
    const handled = String(valkeyCommands.getKeyIndexes).includes(
      `"${commandName}"`
    )
    const isMovableKey = flags.includes('movablekeys')
    if (isMovableKey && !handled) {
      console.log(commandName, flags, arity)
      throw new Error(`Unhandled movable command: ${commandName}`)
    }
    if (!isMovableKey && handled) {
      throw new Error(`Handled non-movable command: ${commandName}`)
    }
    // https://github.com/antirez/redis/issues/2598
    if (commandName === 'brpop' && keyStop === 1) {
      keyStop = -2
    }
    prev[commandName] = {
      arity: arity || 1, // https://github.com/antirez/redis/pull/2986
      flags,
      keyStart,
      keyStop,
      step
    }
    return prev
  },
  {})

  // Future proof. Valkey might implement this at some point
  // https://github.com/antirez/redis/pull/2982
  if (!commands.quit) {
    commands.quit = {
      arity: 1,
      flags: ['loading', 'stale', 'readonly'],
      keyStart: 0,
      keyStop: 0,
      step: 0
    }
  }

  // Use safe-stable-stringify instead fo JSON.stringify
  // for easier diffing
  const content = stringify(commands, null, '  ')

  fs.writeFileSync(commandPath, content)
})
