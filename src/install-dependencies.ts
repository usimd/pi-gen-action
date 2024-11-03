import * as fs from 'fs/promises'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import {hostDependencies} from './host-dependencies'

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

    const installPackages = [
      ...new Set([
        ...hostDependencies.packages,
        ...packages.split(/[\s,]/),
        ...piGenDependencies
      ])
    ].filter(p => p)
    const hostModules = [
      ...new Set([...hostDependencies.modules, ...modules.split(/[\s,]/)])
    ].filter(m => m)
    core.debug(
      `Installing additional host packages '${installPackages.join(' ')}'`
    )
    core.debug(`Loading additional host modules '${hostModules.join(' ')}'`)

    const sudoPath = await io.which('sudo', true)

    execOutput = await exec.getExecOutput(
      sudoPath,
      ['-E', 'apt-get', '-y', '-qq', '-o', 'Dpkg::Use-Pty=0', 'update'],
      {
        silent: !verbose,
        env: {
          DEBIAN_FRONTEND: 'noninteractive'
        }
      }
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
          DEBIAN_FRONTEND: 'noninteractive'
        }
      }
    )
    execOutput = await exec.getExecOutput(
      sudoPath,
      ['modprobe', '-a', ...hostModules],
      {silent: !verbose}
    )

    core.info(`Installed packages on host: ${installPackages.join(' ')}`)
    core.info(`Loaded modules on host: ${hostModules.join(' ')}`)
  } catch (error) {
    throw new Error(execOutput?.stderr || (error as Error).message)
  } finally {
    core.endGroup()
  }
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
