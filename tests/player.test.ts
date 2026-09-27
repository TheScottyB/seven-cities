import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioPlayer } from '../src/audio/player'

describe('the cue log', () => {
  it('never grows past 300 entries', () => {
    const p = new AudioPlayer()
    for (let i = 0; i < 400; i++) p.play([{ id: 'trade' }])
    expect(p.getLog().length).toBeLessThanOrEqual(300)
  })

  it('theme markers share the cap', () => {
    const p = new AudioPlayer()
    for (let i = 0; i < 400; i++) {
      p.setTheme('title')
      p.setTheme(null)
    }
    expect(p.getLog().length).toBeLessThanOrEqual(300)
  })

  it('setting the same theme twice logs one marker', () => {
    const p = new AudioPlayer()
    p.setTheme('title')
    p.setTheme('title')
    expect(p.getLog().map((e) => e.id)).toEqual(['music-title'])
  })
})

/** Just enough of an AudioContext for unlock() and the ambience bed. */
interface FakeNode {
  kind: string
  connected: number
  stoppedAt: number | null
  onended: (() => void) | null
}

function installFakeAudio() {
  const nodes: FakeNode[] = []
  const param = () => ({
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    setTargetAtTime: () => {},
  })
  const make = (kind: string, extra: object = {}) => {
    const n = {
      kind,
      connected: 0,
      stoppedAt: null as number | null,
      onended: null as (() => void) | null,
      connect() {
        n.connected++
      },
      disconnect() {
        n.connected = 0
      },
      start() {},
      stop(at = 0) {
        n.stoppedAt = at
      },
      ...extra,
    }
    nodes.push(n)
    return n
  }
  class FakeContext {
    state = 'running'
    currentTime = 10
    sampleRate = 8000
    destination = {}
    resumes = 0
    suspends = 0
    createGain = () => make('gain', { gain: param() })
    createOscillator = () => make('osc', { frequency: param() })
    createBiquadFilter = () => make('filter', { frequency: param(), Q: param() })
    createBufferSource = () => make('src')
    createDynamicsCompressor = () =>
      make('comp', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() })
    createBuffer = (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) })
    resume() {
      this.resumes++
      return Promise.resolve()
    }
    suspend() {
      this.suspends++
      return Promise.resolve()
    }
  }
  let last: FakeContext | null = null
  vi.stubGlobal(
    'AudioContext',
    class extends FakeContext {
      constructor() {
        super()
        last = this
      }
    },
  )
  return { nodes, ctx: () => last! }
}

describe('lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('unlock reports true only when it creates or wakes the context', () => {
    vi.useFakeTimers()
    const fake = installFakeAudio()
    const p = new AudioPlayer()
    expect(p.unlock()).toBe(true)
    expect(p.unlock()).toBe(false) // already running
    fake.ctx().state = 'suspended'
    expect(p.unlock()).toBe(true)
    fake.ctx().state = 'interrupted'
    expect(p.unlock()).toBe(true)
    expect(fake.ctx().resumes).toBe(2)
  })

  it('suspend and resume never create a context', () => {
    const fake = installFakeAudio()
    const p = new AudioPlayer()
    p.suspend()
    p.resume()
    expect(fake.nodes).toEqual([])
  })

  it('resume wakes a suspended or interrupted context and leaves a running one alone', () => {
    vi.useFakeTimers()
    const fake = installFakeAudio()
    const p = new AudioPlayer()
    p.unlock()
    p.resume()
    expect(fake.ctx().resumes).toBe(0)
    p.suspend()
    expect(fake.ctx().suspends).toBe(1)
    fake.ctx().state = 'interrupted'
    p.resume()
    expect(fake.ctx().resumes).toBe(1)
  })

  it('setMuted before unlock is honoured by the new context', () => {
    vi.useFakeTimers()
    const fake = installFakeAudio()
    const p = new AudioPlayer()
    p.setMuted(true)
    p.unlock()
    const master = fake.nodes.find((n) => n.kind === 'gain') as unknown as { gain: { value: number } }
    expect(master.gain.value).toBe(0)
    expect(p.toggleMute()).toBe(false)
    expect(p.toggleMute()).toBe(true)
  })
})

describe('the ambience bed', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('a change stops the old bed on the audio clock and unhooks it when it ends', () => {
    vi.useFakeTimers()
    const fake = installFakeAudio()
    const p = new AudioPlayer()
    p.unlock()
    const before = fake.nodes.length
    p.play([{ id: 'amb-sea' }])
    const sea = fake.nodes.slice(before)
    const oscs = sea.filter((n) => n.kind === 'osc')
    expect(oscs.length).toBe(2) // swell LFO + color drift

    p.play([{ id: 'amb-sea' }]) // same bed: nothing new
    expect(fake.nodes.length).toBe(before + sea.length)

    p.play([{ id: 'amb-land' }])
    const end = fake.ctx().currentTime + 1.5
    const src = sea.find((n) => n.kind === 'src')!
    expect(src.stoppedAt).toBe(end)
    for (const o of oscs) expect(o.stoppedAt).toBe(end)
    expect(vi.getTimerCount()).toBe(2) // texture tick + birdsong; the old bed needs no timer

    src.onended!()
    for (const n of sea.filter((n) => n.kind === 'gain' || n.kind === 'filter')) expect(n.connected).toBe(0)
  })

  it('amb-none still tears down the old bed', () => {
    vi.useFakeTimers()
    const fake = installFakeAudio()
    const p = new AudioPlayer()
    p.unlock()
    const before = fake.nodes.length
    p.play([{ id: 'amb-river' }])
    const river = fake.nodes.slice(before)
    p.play([{ id: 'amb-none' }])
    expect(fake.nodes.length).toBe(before + river.length)
    for (const n of river.filter((n) => n.kind === 'src' || n.kind === 'osc')) expect(n.stoppedAt).toBe(11.5)
  })
})
