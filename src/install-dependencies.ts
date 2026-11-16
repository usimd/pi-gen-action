import * as fs from 'fs/promises'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import {hostDependencies} from './host-dependencies.js'

export async function installHostDependencies(
  packages: string,
  modules: string,
  piGenDirectory: string
): Promise<void> {
  let execOutput: exec.ExecOutput | undefined

  try {
    core.startGroup('Installing build dependencies on host')
    const verbose = core.getBooleanInput('verbose-output')

    const piGenDependencies = await resolvePiGenDependencies(piGenDirectory)

    // qemu-user-binfmt conflicts with qemu-user-static on older Ubuntu releases;
    // we need the static package for F-flag binfmt_misc to work inside containers
    let installPackages = [
      ...new Set([
        ...hostDependencies.packages,
        ...packages.split(/[\s,]/),
        ...piGenDependencies
      ])
    ]
      .filter(p => p)
      .filter(p => p !== 'qemu-user-binfmt')
    const hostModules = [
      ...new Set([...hostDependencies.modules, ...modules.split(/[\s,]/)])
    ].filter(m => m)

    const sudoPath = await io.which('sudo', true)

    execOutput = await exec.getExecOutput(
      sudoPath,
      ['-E', 'apt-get', '-y', '-qq', '-o', 'Dpkg::Use-Pty=0', 'update'],
      {
        silent: !verbose,
        env: {
          ...process.env,
          DEBIAN_FRONTEND: 'noninteractive'
        }
      }
    )

    if (installPackages.includes('qemu-user-static')) {
      const policy = await exec.getExecOutput(
        'apt-cache',
        ['policy', 'qemu-user-static'],
        {silent: !verbose, env: {...process.env, LC_ALL: 'C'}}
      )
      // Ubuntu 26.04 replaced qemu-user-static with qemu-user-binfmt, which
      // ships static binaries and registers them with the F flag.
      if (!/Candidate: (?!\(none\))/.test(policy.stdout)) {
        installPackages = installPackages.map(p =>
          p === 'qemu-user-static' ? 'qemu-user-binfmt' : p
        )
      }
    }
    core.debug(
      `Installing additional host packages '${installPackages.join(' ')}'`
    )

    execOutput = await exec.getExecOutput(
      sudoPath,
      [
        '-E',
        'apt-get',
        '-qq',
        '-o',
        'Dpkg::Use-Pty=0',
        '--no-install-recommends',
        '--no-install-suggests',
        'install',
        '-y',
        ...installPackages
      ],
      {
        silent: !verbose,
        env: {
          ...process.env,
          DEBIAN_FRONTEND: 'noninteractive'
        }
      }
    )

    if (hostModules.length > 0) {
      core.debug(`Loading additional host modules '${hostModules.join(' ')}'`)
      execOutput = await exec.getExecOutput(
        sudoPath,
        ['modprobe', '-a', ...hostModules],
        {silent: !verbose}
      )
    }

    // qemu-user-static provides qemu-aarch64-static but build-docker.sh expects
    // "qemu-aarch64" in PATH. Create symlink so the static binary is found.
    const staticQemuAarch64 = '/usr/bin/qemu-aarch64-static'
    if (await fileExists(staticQemuAarch64)) {
      execOutput = await exec.getExecOutput(
        sudoPath,
        ['ln', '-sf', staticQemuAarch64, '/usr/local/bin/qemu-aarch64'],
        {silent: !verbose}
      )
    }

    core.info(`Installed packages on host: ${installPackages.join(' ')}`)
    core.info(`Loaded modules on host: ${hostModules.join(' ')}`)
  } catch (error) {
    throw new Error(execOutput?.stderr || (error as Error).message)
  } finally {
    core.endGroup()
  }
}

async function fileExists(path: string): Promise<boolean> {
  return fs
    .access(path)
    .then(() => true)
    .catch(() => false)
}

async function resolvePiGenDependencies(
  piGenDirectory: string
): Promise<string[]> {
  let piGenDependencies: string[] = []
  try {
    const dependenciesFile = `${piGenDirectory}/depends`
    const dependenciesStat = await fs.stat(dependenciesFile)
    if (dependenciesStat.isFile()) {
      core.debug(`pi-gen dependencies file found at ${dependenciesFile}`)
      piGenDependencies = (await fs.readFile(dependenciesFile))
        .toString()
        .split(/\n/)
        .map(dependency => dependency.substring(dependency.indexOf(':') + 1))
      core.debug(
        `Installing the following dependencies from pi-gen's dependency file: ${piGenDependencies}`
      )
    }
  } catch (error) {
    // ignore
  }

  return piGenDependencies
}
