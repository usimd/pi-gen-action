import * as exec from '@actions/exec'
import * as core from '@actions/core'

export async function removeRunnerComponents(): Promise<void> {
  try {
    core.startGroup('Removing runner components to increase disk build space')

    const availableDiskSizeBeforeCleanup = await getAvailableDiskSize()
    core.debug(
      `Available disk space before cleanup: ${availableDiskSizeBeforeCleanup / 1024 / 1024}G`
    )

    await exec
      .getExecOutput(
        'sudo',
        ['docker', 'system', 'prune', '--all', '--force'],
        {
          silent: true,
          failOnStdErr: false,
          ignoreReturnCode: true
        }
      )
      .then((returnValue: exec.ExecOutput) => core.debug(returnValue.stdout))

    await exec
      .getExecOutput(
        'sudo',
        [
          'sh',
          '-c',
          'snap list | sed 1d | cut -d" " -f1 | xargs -I{} snap remove {}'
        ],
        {
          silent: true,
          failOnStdErr: false,
          ignoreReturnCode: true
        }
      )
      .then((returnValue: exec.ExecOutput) => core.debug(returnValue.stdout))

    await exec
      .getExecOutput('sudo', ['swapoff', '-a'], {
        silent: true,
        failOnStdErr: false,
        ignoreReturnCode: true
      })
      .then((returnValue: exec.ExecOutput) => core.debug(returnValue.stdout))

    // See https://github.com/actions/runner-images/issues/2840#issuecomment-2272410832
    const hostPathsToRemove = [
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
      '/mnt/swapfile',
      '/swapfile',
      '/var/cache/snapd',
      '/var/lib/snapd',
      '/tmp/*',
      '/usr/share/doc'
    ]

    await exec
      .getExecOutput('sudo', ['rm', '-rf', ...hostPathsToRemove], {
        silent: true,
        ignoreReturnCode: true,
        failOnStdErr: false
      })
      .then((returnValue: exec.ExecOutput) => core.debug(returnValue.stdout))

    await exec
      .getExecOutput(
        'sudo',
        ['apt', 'purge', 'snapd', 'php8*', 'r-base', 'imagemagick'],
        {
          silent: true,
          ignoreReturnCode: true
        }
      )
      .then((returnValue: exec.ExecOutput) => core.debug(returnValue.stdout))
    await exec
      .getExecOutput('sudo', ['apt-get', 'autoremove'], {
        silent: true,
        ignoreReturnCode: true
      })
      .then((returnValue: exec.ExecOutput) => core.debug(returnValue.stdout))
    await exec
      .getExecOutput('sudo', ['apt-get', 'autoclean'], {
        silent: true,
        ignoreReturnCode: true
      })
      .then((returnValue: exec.ExecOutput) => core.debug(returnValue.stdout))

    const availableDiskSizeAfterCleanup = await getAvailableDiskSize()
    core.debug(
      `Available disk space after cleanup: ${availableDiskSizeAfterCleanup / 1024 / 1024}G`
    )

    core.info(
      `Reclaimed runner disk space: ${((availableDiskSizeAfterCleanup - availableDiskSizeBeforeCleanup) / 1024 / 1024).toFixed(2)}G`
    )
  } finally {
    core.endGroup()
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
