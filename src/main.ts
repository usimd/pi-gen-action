import * as core from '@actions/core'
import {configure} from './configure'
import {installHostDependencies} from './install-dependencies'
import {build} from './build'
import {Git} from './git'

async function run(): Promise<void> {
  const piGenDirectory = core.getInput('pi-gen-dir')
  core.debug(`Using pi-gen directory: ${piGenDirectory}`)

  const userConfig = await configure()

  const git = await Git.getInstance(piGenDirectory)
  await git.clone(piGenDirectory, core.getInput('pi-gen-version'))

  await installHostDependencies()
  await build(piGenDirectory, userConfig)
}

run()
