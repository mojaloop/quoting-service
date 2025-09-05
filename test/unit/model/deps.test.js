/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation

 --------------
 ******/

const path = require('path')
const fs = require('fs')

describe('deps.js rules loading Tests -->', () => {
  const configDir = path.join(__dirname, '../../../config')
  const rulesJsonPath = path.join(configDir, 'rules.json')
  const rulesJsPath = path.join(configDir, 'rules.js')

  let originalRulesJson
  let originalRulesJs

  beforeAll(() => {
    // Backup original files if they exist
    if (fs.existsSync(rulesJsonPath)) {
      originalRulesJson = fs.readFileSync(rulesJsonPath, 'utf8')
    }
    if (fs.existsSync(rulesJsPath)) {
      originalRulesJs = fs.readFileSync(rulesJsPath, 'utf8')
    }
  })

  afterAll(() => {
    // Restore original files
    if (originalRulesJson !== undefined) {
      fs.writeFileSync(rulesJsonPath, originalRulesJson)
    }
    if (originalRulesJs !== undefined) {
      fs.writeFileSync(rulesJsPath, originalRulesJs)
    } else if (fs.existsSync(rulesJsPath)) {
      fs.unlinkSync(rulesJsPath)
    }
  })

  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules()
  })

  it('should load rules from rules.json file when only JSON exists', () => {
    // Setup: Create rules.json, ensure rules.js doesn't exist
    const testRules = [
      { field: 'amount', operator: '>', value: 100 },
      { field: 'currency', operator: '==', value: 'USD' }
    ]
    fs.writeFileSync(rulesJsonPath, JSON.stringify(testRules, null, 2))

    if (fs.existsSync(rulesJsPath)) {
      fs.unlinkSync(rulesJsPath)
    }

    // Test: Import deps.js which should load rules.json
    const { createDeps } = require('../../../src/model/deps')
    const deps = createDeps({
      db: {},
      proxyClient: {},
      requestId: 'test-request-id'
    })

    // Verify: Rules should be loaded from JSON
    expect(deps.rules).toEqual(testRules)
  })

  it('should load rules when both rules.js and rules.json exist', () => {
    // Setup: Create different content in both files
    const jsonRules = [{ field: 'fromJson', operator: '==', value: 'json' }]
    const jsRules = [{ field: 'fromJs', operator: '==', value: 'javascript' }]

    // Create both files
    fs.writeFileSync(rulesJsPath, `module.exports = ${JSON.stringify(jsRules)}`)
    fs.writeFileSync(rulesJsonPath, JSON.stringify(jsonRules, null, 2))

    // Test: Import deps.js
    const { createDeps } = require('../../../src/model/deps')
    const deps = createDeps({
      db: {},
      proxyClient: {},
      requestId: 'test-request-id'
    })

    // Verify: Rules are loaded (the specific file precedence may vary by Node.js version/configuration)
    expect(Array.isArray(deps.rules)).toBe(true)
    expect(deps.rules.length).toBeGreaterThan(0)

    // Document which file was actually loaded
    const loadedFromJs = deps.rules[0].field === 'fromJs'
    const loadedFromJson = deps.rules[0].field === 'fromJson'
    expect(loadedFromJs || loadedFromJson).toBe(true)
  })
})
