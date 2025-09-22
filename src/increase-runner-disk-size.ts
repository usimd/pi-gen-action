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
  '/usr/share/doc',
  '/usr/local/share/boost',
  '/opt/ghc',
  '/usr/share/man',
  '/usr/local/share/man',
  '/usr/local/go',
  '/root/.npm',
  '/home/runner/.npm',
  '/root/.cache/pip',
  '/home/runner/.cache/pip',
  '/root/.cache/go-build',
  '/root/.cache',
  '/home/runner/.cache'
]

export async function removeRunnerComponents(): Promise<void> {
  const verbose = core.getBooleanInput('verbose-output')
  const availableDiskSizeBeforeCleanup = await getAvailableDiskSize()
  const actions: Array<Promise<exec.ExecOutput>> = []

  actions.push(
    exec.getExecOutput(
      'sudo',
      [
        'sh',
        '-c',
        "tee /etc/dpkg/dpkg.cfg.d/01_nodoc > /dev/null << 'EOF'\npath-exclude /usr/share/doc/*\npath-exclude /usr/share/man/*\npath-exclude /usr/share/info/*\nEOF"
      ],
      getExecOptions('nodoc-dpkg-config', verbose)
    )
  )

  actions.push(
    exec.getExecOutput(
      'sudo',
      ['docker', 'system', 'prune', '--all', '--force', '--volumes'],
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
      .then(() => {
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
      .then(() => {
        const purgePackages = [
          'apache2',
          'nginx',
          'ant',
          'ant-optional',
          'azure-cli',
          '7zip',
          'ansible',
          'snapd',
          'php8*',
          'r-base',
          'imagemagick',
          'gfortran',
          'ghc*',
          'google-cloud-cli',
          'google-cloud-cli-anthoscli',
          'google-chrome-stable',
          'firefox',
          'sphinxsearch',
          'mysql-server',
          'mysql-client',
          'postgresql-client-*',
          'swig',
          'temurin-*'
        ]
        return exec
          .getExecOutput(
            'sudo',
            [
              'sh',
              '-c',
              'for alt in jar jarsigner java javac javadoc javap jcmd jconsole jdb jdeprscan jdeps jfr jhsdb jimage jinfo jjs jlink jmap jmod jnativescan jpackage jps jrunscript jshell jstack jstat jstatd jwebserver keytool pack200 rmic rmid rmiregistry unpack200 serialver; do update-alternatives --remove-all "$alt" || true; done'
            ],
            getExecOptions('remove-java-alternatives', verbose)
          )
          .then(() => {
            return exec.getExecOutput(
              'sudo',
              ['apt', 'purge', ...purgePackages],
              getExecOptions('apt-purge-packages', verbose)
            )
          })
          .then(() => {
            return exec
              .getExecOutput(
                'sudo',
                ['sh', '-c', 'apt-get autoremove && apt-get autoclean'],
                getExecOptions('apt-autoremove-autoclean', verbose)
              )
              .then(() =>
                exec.getExecOutput(
                  'sudo',
                  [
                    'rm',
                    '-rf',
                    '/var/cache/apt/archives/*',
                    '/var/lib/apt/lists/*'
                  ],
                  getExecOptions('rm-apt-cache', verbose)
                )
              )
          })
      })
  )

  return Promise.all(actions).then(async () => {
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

const logPrefixColorTheme: Record<string, (s: string) => string> = {
  'nodoc-dpkg-config': colors.yellowBright,
  'docker-system-prune': colors.cyan,
  'remove-java-alternatives': colors.magentaBright,
  swapoff: colors.redBright,
  'rm-swapfile': colors.green,
  'rm-host-paths': colors.magenta,
  'apt-purge-packages': colors.yellow,
  'apt-autoremove-autoclean': colors.blue,
  'rm-apt-cache': colors.gray
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
