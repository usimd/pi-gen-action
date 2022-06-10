import * as fs from 'fs'
import * as exec from '@actions/exec'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {PiGenStages} from './pi-gen-stages'
import {PiGenConfig, writeToFile} from './pi-gen-config'

export class PiGen {
  private configFilePath: string
  private piGenBuildLogPattern = new RegExp(
    '^\\s*\\[(?:\\d{2}:?){3}\\].*',
    'gm'
  )

  constructor(private piGenDirectory: string, private config: PiGenConfig) {
    if (!this.validatePigenDirectory()) {
      throw new Error(`pi-gen directory at ${this.piGenDirectory} is invalid`)
    }

    this.configFilePath = `${fs.realpathSync(this.piGenDirectory)}/config`
  }

  async build(verbose = false): Promise<exec.ExecOutput> {
    core.debug(`Writing user config to ${this.configFilePath}`)
    await writeToFile(this.config, this.piGenDirectory, this.configFilePath)

    const dockerOpts = this.getStagesAsDockerMounts()
    core.debug(
      `Running pi-gen build with PIGEN_DOCKER_OPTS="${dockerOpts}" and config: ${JSON.stringify(
        this.config
      )}`
    )

    return await exec.getExecOutput(
      '"./build-docker.sh"',
      ['-c', this.configFilePath],
      {
        cwd: this.piGenDirectory,
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
  }

  async getLastImagePath(): Promise<string | undefined> {
    const imageExtension =
      this.config.deployCompression === 'none'
        ? 'img'
        : this.config.deployCompression
    const imageGlob = await glob.create(
      `${this.piGenDirectory}/deploy/*.${imageExtension}`,
      {matchDirectories: false}
    )
    const foundImages = await imageGlob.glob()
    return foundImages.length > 0 ? foundImages[0] : undefined
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

  private getStagesAsDockerMounts(): string {
    return this.config.stageList
      .split(/\s+/)
      .map(userStageDir => fs.realpathSync(userStageDir))
      .map(userStageDir => `-v ${userStageDir}:${userStageDir}`)
      .join(' ')
  }

  private logOutput(
    line: string,
    verbose: boolean,
    stream: 'info' | 'error'
  ): void {
    if (verbose || this.piGenBuildLogPattern.test(line)) {
      stream === 'info' ? core.info(line) : core.error(line)
    }
  }
}
