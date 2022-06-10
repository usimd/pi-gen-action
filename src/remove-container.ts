import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'

export async function removeContainer(containerName: string): Promise<void> {
  let execOutput: exec.ExecOutput | undefined
  try {
    core.startGroup('Removing pi-gen build container')

    const dockerCmd = await io.which('docker', true)
    execOutput = await exec.getExecOutput(
      dockerCmd,
      ['rm', '-v', containerName],
      {
        silent: !core.getBooleanInput('verbose-output'),
        ignoreReturnCode: true
      }
    )

    if (execOutput.exitCode === 0) {
      core.info(`Successfully removed container ${containerName}`)
    }
  } catch (error) {
    throw new Error(execOutput?.stderr ?? (error as Error)?.message ?? error)
  } finally {
    core.endGroup()
  }
}
