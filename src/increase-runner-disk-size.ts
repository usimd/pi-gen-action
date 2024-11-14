import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as colors from 'ansi-colors'

// See https://github.com/actions/runner-images/issues/2840#issuecomment-2272410832
const HOST_PATHS_TO_REMOVE = [
  '/opt/google/chrome',
  '/opt/microsoft/msedge',
  '/opt/microsoft/powershell',
  '/opt/mssql-tools',
  '/opt/hostedtoolcache',
  '/opt/pipx',
  '/usr/lib/mono',
  '/usr/local/julia*',
  '/usr/local/lib/android',
  '/usr/local/lib/node_modules',
  '/usr/local/share/chromium',
  '/usr/local/share/powershell',
  '/usr/share/dotnet',
  '/usr/share/swift',
  '/var/cache/snapd',
  '/var/lib/snapd',
  '/tmp/*',
  '/usr/share/doc'
]

export async function removeRunnerComponents(): Promise<void> {
  const verbose = core.getBooleanInput('verbose-output')
  const availableDiskSizeBeforeCleanup = await getAvailableDiskSize()
  const actions = []

  actions.push(
    exec.getExecOutput(
      'sudo',
      ['docker', 'system', 'prune', '--all', '--force'],
      getExecOptions('docker-system-prune', verbose)
    )
  )

  actions.push(
    exec
      .getExecOutput(
        'sudo',
        ['swapoff', '-a'],
        getExecOptions('swapoff', verbose)
      )
      .then(result => {
        return exec.getExecOutput(
          'sudo',
          ['rm', '-rf', '/mnt/swapfile', '/swapfile'],
          getExecOptions('rm-swapfile', verbose)
        )
      })
  )

  actions.push(
    exec
      .getExecOutput(
        'sudo',
        ['rm', '-rf', ...HOST_PATHS_TO_REMOVE],
        getExecOptions('rm-host-paths', verbose)
      )
      .then((returnValue: exec.ExecOutput) => {
        return exec
          .getExecOutput(
            'sudo',
            ['apt', 'purge', 'snapd', 'php8*', 'r-base', 'imagemagick'],
            getExecOptions('apt-purge-packages', verbose)
          )
          .then((returnValue: exec.ExecOutput) => {
            return exec.getExecOutput(
              'sudo',
              ['sh', '-c', 'apt-get autoremove && apt-get autoclean'],
              getExecOptions('apt-autoremove-autoclean', verbose)
            )
          })
      })
  )

  return Promise.all(actions).then(async outputs => {
    core.debug(
      `Available disk space before cleanup: ${availableDiskSizeBeforeCleanup / 1024 / 1024}G`
    )
    const availableDiskSizeAfterCleanup = await getAvailableDiskSize()
    core.debug(
      `Available disk space after cleanup: ${availableDiskSizeAfterCleanup / 1024 / 1024}G`
    )
    core.info(
      `Reclaimed runner disk space: ${((availableDiskSizeAfterCleanup - availableDiskSizeBeforeCleanup) / 1024 / 1024).toFixed(2)}G`
    )
  })
}

const logPrefixColorTheme: Record<string, Function> = {
  'docker-system-prune': colors.cyan,
  swapoff: colors.redBright,
  'rm-swapfile': colors.green,
  'rm-host-paths': colors.magenta,
  'apt-purge-packages': colors.yellow,
  'apt-autoremove-autoclean': colors.blue
}

export function getExecOptions(logPrefix: string, verbose: boolean) {
  return {
    silent: true,
    ...(verbose && {
      listeners: {
        stdline: (line: string) =>
          core.info(`${logPrefixColorTheme[logPrefix](logPrefix)}: ${line}`),
        errline: (line: string) =>
          core.info(`${logPrefixColorTheme[logPrefix](logPrefix)}: ${line}`)
      }
    })
  }
}

async function getAvailableDiskSize(): Promise<number> {
  const dfCall = exec.getExecOutput(
    'sh',
    ['-c', 'df --output=avail / | sed 1d'],
    {silent: true}
  )
  return dfCall.then((output: exec.ExecOutput) =>
    parseInt(output.stdout.trim())
  )
}
