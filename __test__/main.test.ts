import * as actions from '../src/actions.js'

vi.mock('../src/actions.js', () => ({
  run: vi.fn().mockReturnValue(Promise.resolve())
}))

describe('main', () => {
  it('should call actions.run()', async () => {
    await import('../src/main.js')
    expect(actions.run).toHaveBeenCalled()
  })
})
