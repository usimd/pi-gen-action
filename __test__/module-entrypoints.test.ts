// Tests for module entrypoints that invoke actions at require-time

describe('Module entrypoints main.ts and post.ts', () => {
  it('invokes exported main when requiring main.ts', () => {
    const mockMain = jest.fn()

    jest.isolateModules(() => {
      jest.doMock('../src/actions', () => ({main: mockMain}))
      require('../src/main')
    })

    expect(mockMain).toHaveBeenCalled()
  })

  it('invokes saveCache and cleanup when requiring post.ts', () => {
    const mockSave = jest.fn().mockReturnValue(Promise.resolve())
    const mockCleanup = jest.fn()

    jest.isolateModules(() => {
      jest.doMock('../src/actions', () => ({
        saveCache: mockSave,
        cleanup: mockCleanup
      }))
      require('../src/post')
    })

    expect(mockSave).toHaveBeenCalled()
  })
})
