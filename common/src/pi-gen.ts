import * as fs from 'fs'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {PiGenStages} from './pi-gen-stages'
import {loadFromFile, PiGenConfig} from './pi-gen-config'

export class PiGen {
  private configFilePath: string
  private config: Promise<PiGenConfig>

  constructor(private piGenDirectory: fs.PathLike, piGenConfigFile = 'config') {
    if (!this.validatePigenDirectory()) {
      throw new Error(`pi-gen directory at ${this.piGenDirectory} is invalid`)
    }

    this.configFilePath = fs.realpathSync(piGenConfigFile)
    this.config = loadFromFile(this.configFilePath)
  }

  async build(): Promise<void> {
    await exec.exec('"./build-docker.sh"', ['-c', this.configFilePath], {
      cwd: this.piGenDirectory.toString(),
      env: {
        PIGEN_DOCKER_OPTS: await this.getUserStagesAsDockerMounts()
      }
    })
  }

  private validatePigenDirectory(): boolean {
    const dirStat = fs.statSync(this.piGenDirectory)

    if (!dirStat.isDirectory) {
      core.debug(`Not a directory: ${this.piGenDirectory}`)
      return false
    }

    const piGenDirContent = fs.readdirSync(this.piGenDirectory, {
      withFileTypes: true
    })
    const requiredFiles = ['build-docker.sh', 'Dockerfile']
    const requiredDirectories = Object.values(PiGenStages).filter(
      value => typeof value === 'string'
    ) as string[]
    const existingFiles = piGenDirContent
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
    const existingDirectories = piGenDirContent
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)

    if (!requiredFiles.every(file => existingFiles.includes(file))) {
      core.debug(
        `Not all required files in pi-gen dir. Required: ${requiredFiles.join(
          ', '
        )} but found ${existingFiles.join(', ')}`
      )
      return false
    }

    if (!requiredDirectories.every(dir => existingDirectories.includes(dir))) {
      core.debug(
        `Not all required directories in pi-gen dir. Required: ${requiredDirectories.join(
          ', '
        )} but found ${existingDirectories.join(', ')}`
      )
      return false
    }

    return true
  }

  private validateStageDirectory(stageDirectory: string): boolean {
    const dirStat = fs.statSync(stageDirectory)

    if (!dirStat || !dirStat.isDirectory) {
      return false
    }

    return true
  }

  private async getUserStagesAsDockerMounts(): Promise<string> {
    const userConfig = await this.config
    return new Promise(() =>
      userConfig.stageList
        .split(' ')
        .filter(stageDir => this.validateStageDirectory(stageDir))
        .map(userStageDir => fs.realpathSync(userStageDir))
        .map(userStageDir => `-v "${userStageDir}:${userStageDir}"`)
    )
  }
}
