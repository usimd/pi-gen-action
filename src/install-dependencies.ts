import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import {hostDependencies} from './host-dependencies'

export async function installHostDependencies(
  packages: string,
  modules: string
): Promise<void> {
  let execOutput: exec.ExecOutput | undefined

  try {
    core.startGroup('Installing build dependencies on host')
    const verbose = core.getBooleanInput('verbose-output')

    const installPackages = [
      ...new Set([
        ...hostDependencies.packages,
        ...packages.split(new RegExp('[s,]'))
      ])
    ].filter(p => p)
    const hostModules = [
      ...new Set([
        ...hostDependencies.modules,
        ...modules.split(new RegExp('[s,]'))
      ])
    ].filter(m => m)
    core.debug(
      `Installing additional host packages '${installPackages.join(' ')}'`
    )
    core.debug(`Loading additional host modules '${hostModules.join(' ')}'`)

    const sudoPath = await io.which('sudo', true)
    execOutput = await exec.getExecOutput(
      sudoPath,
      [
        'apt-get',
        '--no-install-recommends',
        '--no-install-suggests',
        'install',
        '-y',
        ...installPackages
      ],
      {silent: !verbose}
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
