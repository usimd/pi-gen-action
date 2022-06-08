import * as core from '@actions/core'
import {Git} from './git'

export async function clonePigen(
  piGenDirectory: string,
  ref: string
): Promise<void> {
  try {
    core.startGroup('Cloning pi-gen repository')
    core.debug(`Checking out ref ${ref} into ${piGenDirectory}`)
    const verbose = core.getBooleanInput('verbose-output')
    const git = await Git.getInstance(piGenDirectory, verbose)
    await git.clone('git://github.com/RPi-Distro/pi-gen.git', ref)
  } finally {
    core.endGroup()
  }
}
