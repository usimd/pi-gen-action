import * as core from '@actions/core'
import {DEFAULT_CONFIG, writeToFile} from '@pi-gen-action/common'

async function run(): Promise<void> {
  try {
    const configFilePath = core.getInput('config_file')
    core.debug(`Writing pi-gen config file to ${configFilePath}`)

    const userConfig = DEFAULT_CONFIG

    userConfig.imgName = core.getInput('image_name') ?? DEFAULT_CONFIG.imgName
    userConfig.stageList =
      core.getInput('stage_list') ?? DEFAULT_CONFIG.stageList
    userConfig.release = core.getInput('release') ?? DEFAULT_CONFIG.release
    userConfig.deployCompression =
      core.getInput('compression') ?? DEFAULT_CONFIG.deployCompression
    userConfig.localeDefault =
      core.getInput('locale') ?? DEFAULT_CONFIG.localeDefault
    userConfig.targetHostname =
      core.getInput('hostname') ?? DEFAULT_CONFIG.targetHostname
    userConfig.keyboardKeymap =
      core.getInput('keyboard_keymap') ?? DEFAULT_CONFIG.keyboardKeymap
    userConfig.keyboardLayout =
      core.getInput('keyboard_layout') ?? DEFAULT_CONFIG.keyboardLayout
    userConfig.timezoneDefault =
      core.getInput('timezone') ?? DEFAULT_CONFIG.timezoneDefault
    userConfig.firstUserName =
      core.getInput('username') ?? DEFAULT_CONFIG.firstUserName
    userConfig.firstUserPass =
      core.getInput('password') ?? DEFAULT_CONFIG.firstUserPass
    userConfig.wpaEssid = core.getInput('wpa_essid') ?? DEFAULT_CONFIG.wpaEssid
    userConfig.wpaPassword =
      core.getInput('wpa_password') ?? DEFAULT_CONFIG.wpaPassword
    userConfig.wpaCountry =
      core.getInput('wpa_country') ?? DEFAULT_CONFIG.wpaCountry
    userConfig.enableSsh =
      core.getInput('enable_ssh') ?? DEFAULT_CONFIG.enableSsh
    userConfig.useQcow2 = core.getInput('use_qcow2') ?? DEFAULT_CONFIG.useQcow2

    await writeToFile(userConfig, configFilePath)

    core.setOutput('config-file', configFilePath)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
