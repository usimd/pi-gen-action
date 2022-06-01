import * as fs from 'fs'
import * as exec from '@actions/exec'
import {PiGenStages} from './pi-gen-stages'
import {loadFromFile, PiGenConfig} from './pi-gen-config'

export class PiGen {
  private configFilePath: string
  private config: Promise<PiGenConfig>

  constructor(private piGenDirectory: fs.PathLike, piGenConfigFile = 'config') {
    if (!this.validatePigenDirectory()) {
      throw new Error(`pi-gen directory at ${this.piGenDirectory} is invalid`)
    }

    this.configFilePath = fs.readlinkSync(piGenConfigFile)
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
      return false
    }

    const piGenDirContent = fs.readdirSync(this.piGenDirectory, {
      withFileTypes: true
    })
    const requiredFiles = ['build-docker.sh', 'Dockerfile']
    const requiredDirectories = Object.keys(PiGenStages)
    const existingFiles = piGenDirContent
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
    const existingDirectories = piGenDirContent
      .filter(entry => entry.isFile())
      .map(entry => entry.name)

    if (
      !requiredFiles.every(file => existingFiles.includes(file)) ||
      !requiredDirectories.every(dir => existingDirectories.includes(dir))
    ) {
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
