import * as core from '@actions/core'
import * as fs from 'fs/promises'

async function run(): Promise<void> {
  try {
    core.info('Running check and creation of pi-gen config')

    const lines: string[] = []

    const imageName: string = core.getInput('image-name')
    lines.push(`IMG_NAME=${imageName}`)

    const release: string = core.getInput('release')
    lines.push(`RELEASE=${release}`)

    const compression: string = core.getInput('compression')
    lines.push(`DEPLOY_COMPRESSION=${compression}`)

    const locale: string = core.getInput('locale')
    lines.push(`LOCALE_DEFAULT=${locale}`)

    const hostname: string = core.getInput('hostname')
    lines.push(`TARGET_HOSTNAME=${hostname}`)

    const keyboardKeymap: string = core.getInput('keyboard-keymap')
    lines.push(`KEYBOARD_KEYMAP=${keyboardKeymap}`)

    const keyboardLayout: string = core.getInput('keyboard-layout')
    lines.push(`KEYBOARD_LAYOUT=${keyboardLayout}`)

    const timezone: string = core.getInput('timezone')
    lines.push(`TIMEZONE_DEFAULT=${timezone}`)

    const username: string = core.getInput('username')
    lines.push(`FIRST_USER_NAME=${username}`)

    const password: string = core.getInput('password')
    lines.push(`FIRST_USER_PASS=${password}`)

    await fs.writeFile('pi_gen_config', lines.join('\n'))
    const pigenConfigFile = await fs.readFile('pi_gen_config', {
      encoding: 'utf8'
    })
    core.info(`Wrote to file 'pi_gen_config':\n\n${pigenConfigFile}`)

    core.setOutput('config-file', 'pi_gen_config')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
