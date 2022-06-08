import * as core from '@actions/core'
import {DEFAULT_CONFIG, validateConfig, PiGenConfig} from './pi-gen-config'

export async function configure(): Promise<PiGenConfig> {
  try {
    core.startGroup('Validating input and generating pi-gen config')

    const userConfig = DEFAULT_CONFIG

    userConfig.imgName = core.getInput('image-name') ?? DEFAULT_CONFIG.imgName
    userConfig.stageList =
      core.getInput('stage-list') ?? DEFAULT_CONFIG.stageList
    userConfig.release = core.getInput('release') ?? DEFAULT_CONFIG.release
    userConfig.deployCompression =
      core.getInput('compression') ?? DEFAULT_CONFIG.deployCompression
    userConfig.compressionLevel =
      core.getInput('compression-level') ?? DEFAULT_CONFIG.compressionLevel
    userConfig.localeDefault =
      core.getInput('locale') ?? DEFAULT_CONFIG.localeDefault
    userConfig.targetHostname =
      core.getInput('hostname') ?? DEFAULT_CONFIG.targetHostname
    userConfig.keyboardKeymap =
      core.getInput('keyboard-keymap') ?? DEFAULT_CONFIG.keyboardKeymap
    userConfig.keyboardLayout =
      core.getInput('keyboard-layout') ?? DEFAULT_CONFIG.keyboardLayout
    userConfig.timezoneDefault =
      core.getInput('timezone') ?? DEFAULT_CONFIG.timezoneDefault
    userConfig.firstUserName =
      core.getInput('username') ?? DEFAULT_CONFIG.firstUserName
    userConfig.firstUserPass =
      core.getInput('password') ?? DEFAULT_CONFIG.firstUserPass
    userConfig.wpaEssid = core.getInput('wpa-essid') ?? DEFAULT_CONFIG.wpaEssid
    userConfig.wpaPassword =
      core.getInput('wpa-password') ?? DEFAULT_CONFIG.wpaPassword
    userConfig.wpaCountry =
      core.getInput('wpa-country') ?? DEFAULT_CONFIG.wpaCountry
    userConfig.enableSsh =
      core.getInput('enable-ssh') ?? DEFAULT_CONFIG.enableSsh
    userConfig.useQcow2 = core.getInput('use-qcow2') ?? DEFAULT_CONFIG.useQcow2

    validateConfig(userConfig)

    return userConfig
  } finally {
    core.endGroup()
  }
}
