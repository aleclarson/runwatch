#!/usr/bin/env node
var path = require('path')
var argv = require('minimist')(process.argv.slice(2))
var files = argv._
var cmd = argv.r
if (!files || !cmd) {
  var usage = require('usage-and-quit')
  usage(path.join(__dirname, 'USAGE.txt'))
}
var spawn = require('child_process').spawn
function spawnCommand () {
  var cmds = cmd.split(' ')
  var proc = spawn(cmds[0], cmds.slice(1), {
    stdio: 'inherit', stdout: 'inherit',
    detached: true,
  })
  return proc.on('error', err => {
    console.error(err)
    proc.exited = true
  }).on('exit', () => {
    proc.exited = true
  })
}
var proc = spawnCommand()
function killCommand () {
  if (!proc.exited) {
    process.kill(-proc.pid, 'SIGKILL')
  }
}
function debounce(fn, ms) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}
var respawn = debounce(() => {
  killCommand()
  proc = spawnCommand()
}, 16)
function isDescendant(parent, file) {
  return file == parent || file.startsWith(parent + '/')
}
var cwd = process.cwd()
var only = []
for (let file of files) {
  const maybeHigher = file.startsWith('..') || path.isAbsolute(file)
  file = path.resolve(file)
  if (maybeHigher) {
    const prevCwd = cwd
    while (!isDescendant(cwd, file)) {
      cwd = path.dirname(cwd)
    }
    if (cwd !== prevCwd) {
      only.forEach((file, i) => {
        only[i] = path.relative(cwd, path.join(prevCwd, file))
      })
    }
  }
  only.push(path.relative(cwd, file))
}
only.forEach((file, i) => {
  only[i] = '/' + file
})
//console.log({cwd,only,})
var {filespy} = require('filespy')
var spy = filespy(cwd, {
  only,
  skip: ['node_modules', '.git'],
}).on('change', () => {
  respawn()
}).on('error', err => {
  console.error(err)
  die()
}).on('ready', () => {
  //console.log(spy)
})
function die() {
  killCommand()
  process.exit()
}
process.on('SIGTERM', die)
process.on('SIGINT', die)
process.on('uncaughtException', die)
