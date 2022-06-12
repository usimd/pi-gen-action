import * as fs from 'fs'
import {major} from 'semver'
import * as yaml from 'js-yaml'
import wrap from 'word-wrap'
// eslint-disable-next-line import/no-commonjs, @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const replaceSection = require('markdown-replace-section')

function getTagVersion(packageJson: string): number {
  const packageDesc = JSON.parse(
    fs.readFileSync(packageJson, {encoding: 'utf-8'})
  )
  return major(packageDesc['version'])
}

function replaceUsageSection(
  readme: string,
  sectionTitle: string,
  content: string
): string {
  return replaceSection(readme, sectionTitle, content, true)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUsageSection(actionYaml: any, actionVersion: number): string {
  const usageSection = [
    '```yaml',
    `- uses: usimd/pi-gen-action@v${actionVersion}`,
    '  with:'
  ]

  for (const key of Object.keys(actionYaml.inputs)) {
    const input = actionYaml.inputs[key]
    const description = (input.description as string).replace(/\s+/g, ' ')
    usageSection.push(
      wrap(description, {indent: '    # ', width: 80}).trimEnd()
    )

    let defaultValue
    if (input.default !== undefined && input.default.toString()) {
      defaultValue =
        typeof input.default === 'string' ? `${input.default}` : input.default
    } else {
      defaultValue = "''"
    }

    usageSection.push(`    ${key}: ${defaultValue}`)
    usageSection.push('')
  }

  return usageSection.join('\n').concat('```')
}

function updateUsage(
  readmePath: string,
  actionYamlPath: string,
  packageJsonPath: string
): void {
  const actionYaml = yaml.load(fs.readFileSync(actionYamlPath).toString())
  const originalReadme = fs.readFileSync(readmePath).toString()
  const actionVersion = getTagVersion(packageJsonPath)

  const updatedReadme = replaceUsageSection(
    originalReadme,
    'Usage',
    buildUsageSection(actionYaml, actionVersion)
  )
  fs.writeFileSync(readmePath, updatedReadme)
}

updateUsage('README.md', 'action.yml', 'package.json')
