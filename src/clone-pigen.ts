import * as core from '@actions/core'
import {Git} from './git'

export async function clonePigen(
  piGenDirectory: string,
  ref: string
): Promise<void> {
  try {
    core.startGroup('Cloning pi-gen repository')
    const git = await Git.getInstance(piGenDirectory)
    await git.clone('https://github.com/RPi-Distro/pi-gen', ref)
  } finally {
    core.endGroup()
  }
}
