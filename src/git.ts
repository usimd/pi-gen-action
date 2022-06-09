import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import path from 'path'
import fs from 'fs'

export class Git {
  private gitCmd = ''
  private repoPath = ''
  private verbose = false

  private constructor() {}

  static async getInstance(
    repoPath: string,
    token: string,
    verbose = false
  ): Promise<Git> {
    const git = new Git()
    await git.initialize(repoPath, token)
    git.setVerbosity(verbose)
    return git
  }

  async clone(repository: string, ref: string): Promise<void> {
    let checkoutArgs: string[] = []

    if (this.verbose) {
      checkoutArgs.push('--progress')
    }

    await this.execGit(['remote', 'add', 'origin', repository])
    await this.execGit([
      'fetch',
      ...checkoutArgs,
      '--prune',
      '--no-tags',
      '--no-recurse-submodules',
      '--depth=1',
      'origin',
      `+refs/heads/${ref}*:refs/remotes/origin/${ref}*`,
      `+refs/tags/${ref}*:refs/tags/${ref}*`
    ])

    if (await this.tagExists(ref)) {
      checkoutArgs = [ref]
    } else if (await this.branchExists(ref)) {
      checkoutArgs = ['-B', ref, `refs/remotes/origin/${ref}`]
    } else {
      throw new Error(`No ref ${ref} found in ${repository}`)
    }

    await this.execGit(['checkout', '--force', ...checkoutArgs])
  }

  private setVerbosity(verbose: boolean): void {
    this.verbose = verbose
  }

  private async initialize(repoPath: string, token: string): Promise<void> {
    this.gitCmd = await io.which('git', true)
    await io.mkdirP(repoPath)
    this.repoPath = await fs.promises.realpath(repoPath)

    await this.execGit(['init', this.repoPath])
    await this.execGit(['config', '--local', 'gc.auto', '0'])
    await this.execGit([
      'config',
      '--local',
      `http.https://github.com/.extraheader`,
      'AUTHORIZATION: basic ***'
    ])

    const basicCredential = Buffer.from(
      `x-access-token:${token}`,
      'utf8'
    ).toString('base64')
    const configPath = path.join(this.repoPath, '.git', 'config')
    let content = (await fs.promises.readFile(configPath)).toString()
    content = content.replace(
      'AUTHORIZATION: basic ***',
      `AUTHORIZATION: basic ${basicCredential}`
    )
    await fs.promises.writeFile(configPath, content)
  }

  private async execGit(args: string[]): Promise<exec.ExecOutput> {
    core.debug(`Executing: ${this.gitCmd} ${args?.join(' ')}`)
    return await exec.getExecOutput(this.gitCmd, args, {
      silent: !this.verbose,
      cwd: this.repoPath
    })
  }

  private async branchExists(branchName: string): Promise<boolean> {
    const branchList = await this.execGit([
      'branch',
      '--list',
      '--remote',
      `origin/${branchName}`
    ])
    return !!branchList.stdout.trim()
  }

  private async tagExists(tagName: string): Promise<boolean> {
    const tagList = await this.execGit(['tag', '--list', tagName])
    return !!tagList.stdout.trim()
  }
}
