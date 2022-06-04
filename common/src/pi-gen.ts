import * as fs from 'fs'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import {PiGenStages} from './pi-gen-stages'
import {loadFromFile, PiGenConfig} from './pi-gen-config'

export class PiGen {
  private configFilePath: string
  private config: Promise<PiGenConfig>
  private lastLogLine?: string
  private piGenBuildLogPattern = new RegExp('^[(?:d{2}:?){3}].*')

  constructor(private piGenDirectory: fs.PathLike, piGenConfigFile = 'config') {
    if (!this.validatePigenDirectory()) {
      throw new Error(`pi-gen directory at ${this.piGenDirectory} is invalid`)
    }

    this.configFilePath = fs.realpathSync(piGenConfigFile)
    this.config = loadFromFile(this.configFilePath)
  }

  async build(verbose = false): Promise<void> {
    const userConfig = await this.config
    const dockerOpts = this.getStagesAsDockerMounts(userConfig)

    core.debug(
      `Running pi-gen build with PIGEN_DOCKER_OPTS="${dockerOpts}" and config: ${JSON.stringify(
        userConfig
      )}`
    )

    try {
      const ret = await exec.exec(
        '"./build-docker.sh"',
        ['-c', this.configFilePath],
        {
          cwd: this.piGenDirectory.toString(),
          env: {
            PIGEN_DOCKER_OPTS: dockerOpts
          },
          listeners: {
            stdline: (line: string) => this.logOutput(line, verbose, 'info'),
            errline: (line: string) => this.logOutput(line, verbose, 'error')
          },
          silent: true
        }
      )

      if (ret !== 0) {
        throw new Error()
      }
    } catch (error) {
      core.setFailed(`Build failed: ${this.lastLogLine}`)
    }
  }

  private validatePigenDirectory(): boolean {
    const dirStat = fs.statSync(this.piGenDirectory)

    if (!dirStat.isDirectory()) {
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

  private getStagesAsDockerMounts(userConfig: PiGenConfig): string {
    return userConfig.stageList
      .split(' ')
      .map(userStageDir => fs.realpathSync(userStageDir))
      .map(userStageDir => `-v ${userStageDir}:${userStageDir}`)
      .join(' ')
  }

  private logOutput(
    line: string,
    verbose: boolean,
    stream: 'info' | 'error'
  ): void {
    this.lastLogLine = line
    if (verbose || this.piGenBuildLogPattern.test(line)) {
      stream === 'info' ? core.info(line) : core.error(line)
    }
  }
}
