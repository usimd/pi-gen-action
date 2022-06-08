import * as core from '@actions/core'
import {Git} from './git'

export async function clonePigen(
  piGenDirectory: string,
  ref: string
): Promise<void> {
  try {
    core.startGroup('Cloning pi-gen repository')
    core.debug(`Checking ref ${ref} into ${piGenDirectory}`)
    const verbose = core.getBooleanInput('verbose-output')
    const token = core.getInput('github-token')
    const git = await Git.getInstance(piGenDirectory, token, verbose)
    await git.clone('https://github.com/RPi-Distro/pi-gen', ref)
  } finally {
    core.endGroup()
  }
}
