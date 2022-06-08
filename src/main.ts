import * as core from '@actions/core'
import {configure} from './configure'
import {installHostDependencies} from './install-dependencies'
import {build} from './build'

async function run(): Promise<void> {
  const piGenDirectory = core.getInput('pi-gen-dir')
  core.debug(`Using pi-gen directory: ${piGenDirectory}`)

  const userConfig = await configure()
  await installHostDependencies()
  await build(piGenDirectory, userConfig)
}

run()
