import { loopPhase, type EnvironmentMode, type SceneId } from './environment-presets'
import type { NormalizedPoint } from './one-bit/core'

const INK = '#181815'
const DARK = '#34342e'
const MID = '#74746b'
const LIGHT = '#b3b3a8'
const PAPER = '#e1e1d5'

export interface FloatState extends NormalizedPoint {
  tilt: number
}

export interface EnvironmentDrawState {
  context: CanvasRenderingContext2D
  width: number
  height: number
  time: number
  mode: EnvironmentMode
  image?: HTMLImageElement
}

export type EnvironmentDrawer = (state: EnvironmentDrawState) => void

function phase(state: EnvironmentDrawState, duration = 12_000) {
  return state.mode === 'loop' ? loopPhase(state.time, duration) : 0
}

function cycle(state: EnvironmentDrawState) {
  return state.mode === 'loop' ? (state.time % 12_000) / 12_000 : 0
}

function fill(context: CanvasRenderingContext2D, colour: string, width: number, height: number) {
  context.fillStyle = colour
  context.fillRect(0, 0, width, height)
}

function polygon(context: CanvasRenderingContext2D, colour: string, points: Array<[number, number]>) {
  context.fillStyle = colour
  context.beginPath()
  points.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y))
  context.closePath()
  context.fill()
}

function circle(context: CanvasRenderingContext2D, colour: string, x: number, y: number, radius: number) {
  context.fillStyle = colour
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
}

function solid(background: string, foreground: string): EnvironmentDrawer {
  return (state) => {
    const { context, width, height, mode } = state
    fill(context, background, width, height)
    if (mode !== 'loop') return
    const offset = width * (.018 + (phase(state) + 1) * .006)
    context.fillStyle = foreground
    context.fillRect(offset, 0, Math.max(2, width * .0025), height)
  }
}

export function getFloatState(time: number, mode: EnvironmentMode): FloatState {
  if (mode === 'static') return { x: .5, y: .46, tilt: 0 }
  return {
    x: .5 + Math.sin(time * .00052) * (62 / 1280),
    y: .46 + Math.sin(time * .00104) * (25 / 720),
    tilt: Math.sin(time * .00052) * 1.5,
  }
}

const drawField: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const p = phase(state, 8_000)
  const cx = width * (.48 + p * .03)
  const cy = height * .46
  const radius = width * (.52 + p * .03)
  fill(context, INK, width, height)
  const glow = context.createRadialGradient(cx, cy, Math.max(1, width / 128), cx, cy, radius)
  glow.addColorStop(0, PAPER)
  glow.addColorStop(.36, MID)
  glow.addColorStop(1, INK)
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
}

const drawGrid: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  fill(context, DARK, width, height)
  const columns = 10
  const rows = 6
  for (let column = 0; column < columns; column += 1) {
    const distance = Math.abs(column - (columns - 1) / 2) / (columns / 2)
    const lightness = 195 - distance * 118
    context.fillStyle = `rgb(${lightness.toFixed(2)},${lightness.toFixed(2)},${Math.max(0, lightness - 7).toFixed(2)})`
    context.fillRect(column * width / columns, 0, width / columns - Math.max(2, width * .005), height)
  }
  context.fillStyle = 'rgba(28,28,24,.36)'
  for (let row = 1; row < rows; row += 1) {
    context.fillRect(0, row * height / rows - Math.max(2, height * .005), width, Math.max(4, height * .01))
  }
  if (state.mode !== 'loop') return
  const band = width * .18
  const scanX = ((state.time % 6000) / 6000) * width
  for (const center of [scanX - width, scanX, scanX + width]) {
    const light = context.createLinearGradient(center - band, height, center + band, 0)
    light.addColorStop(0, 'rgba(225,225,213,0)')
    light.addColorStop(.36, 'rgba(225,225,213,.06)')
    light.addColorStop(.5, 'rgba(225,225,213,.42)')
    light.addColorStop(.64, 'rgba(225,225,213,.06)')
    light.addColorStop(1, 'rgba(225,225,213,0)')
    context.fillStyle = light
    context.fillRect(0, 0, width, height)
  }
}

const drawBeam: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const shift = width * phase(state) * .014
  fill(context, INK, width, height)
  const beam = context.createLinearGradient(width * .18, 0, width * .82, height)
  beam.addColorStop(0, DARK)
  beam.addColorStop(.5, PAPER)
  beam.addColorStop(1, MID)
  context.fillStyle = beam
  context.beginPath()
  context.moveTo(width * .21 + shift, 0)
  context.lineTo(width * .72 + shift, 0)
  context.lineTo(width * .49 + shift, height)
  context.lineTo(-width * .02 + shift, height)
  context.closePath()
  context.fill()
}

const drawContour: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const p = phase(state)
  const cx = width * (.66 + p * .008)
  const cy = height * (.43 + p * .006)
  fill(context, DARK, width, height)
  const field = context.createRadialGradient(cx, cy, 0, cx, cy, width * .56)
  field.addColorStop(0, LIGHT)
  field.addColorStop(.55, MID)
  field.addColorStop(1, INK)
  context.fillStyle = field
  context.fillRect(0, 0, width, height)
  context.strokeStyle = 'rgba(24,24,21,.58)'
  context.lineWidth = Math.max(2, width * .004)
  for (let index = 1; index <= 7; index += 1) {
    context.beginPath()
    context.ellipse(cx, cy, width * .075 * index * (1 + p * .008), height * .055 * index * (1 + p * .008), -.18, 0, Math.PI * 2)
    context.stroke()
  }
}

const drawVoid: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const shift = width * phase(state) * .008
  fill(context, INK, width, height)
  context.fillStyle = LIGHT
  context.fillRect(width * .78 + shift, 0, width * .22, height)
  context.fillStyle = MID
  context.fillRect(width * .735 + shift, 0, width * .025, height)
}

const drawFloat: EnvironmentDrawer = (state) => {
  const { context, width, height, time, mode } = state
  const position = getFloatState(time, mode)
  fill(context, DARK, width, height)
  const glow = context.createRadialGradient(position.x * width, position.y * height, width / 64, position.x * width, position.y * height, width * .49)
  glow.addColorStop(0, PAPER)
  glow.addColorStop(.42, MID)
  glow.addColorStop(1, DARK)
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
  context.fillStyle = INK
  context.beginPath()
  context.ellipse(position.x * width, position.y * height + height * .246, width * .21, height * .06, 0, 0, Math.PI * 2)
  context.fill()
}

const drawHalo: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const radius = width * (208 / 1280) * (1 + phase(state, 8_000) * .06)
  fill(context, INK, width, height)
  const field = context.createRadialGradient(width * .5, height * .39, width / 160, width * .5, height * .39, radius * 1.8)
  field.addColorStop(0, PAPER)
  field.addColorStop(.5, MID)
  field.addColorStop(1, INK)
  context.fillStyle = field
  context.fillRect(0, 0, width, height)
}

const drawRaster: EnvironmentDrawer = (state) => {
  const { context, width, height, image } = state
  fill(context, INK, width, height)
  const glow = context.createRadialGradient(width * .52, height * .43, 0, width * .52, height * .43, width * .62)
  glow.addColorStop(0, LIGHT)
  glow.addColorStop(.55, MID)
  glow.addColorStop(1, INK)
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
  if (!image?.complete || image.naturalWidth === 0) return
  const targetHeight = height * .68
  const targetWidth = targetHeight * (image.naturalWidth / image.naturalHeight)
  context.save()
  context.translate(width * .54, height * .43)
  context.rotate(phase(state) * .025)
  context.shadowColor = 'rgba(20,20,16,.65)'
  context.shadowBlur = width * .035
  context.shadowOffsetX = width * .018
  context.shadowOffsetY = height * .035
  context.drawImage(image, -targetWidth * .5, -targetHeight * .5, targetWidth, targetHeight)
  context.restore()
}

const drawAperture: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const p = phase(state)
  fill(context, INK, width, height)
  circle(context, PAPER, width * (.79 + p * .009), height * .46, height * (.48 + p * .008))
  circle(context, DARK, width * (.79 + p * .009), height * .46, height * .29)
}

const drawTrack: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const p = phase(state)
  fill(context, PAPER, width, height)
  context.strokeStyle = DARK
  context.lineWidth = height * .12
  context.lineCap = 'square'
  context.beginPath()
  context.moveTo(-width * .04, height * .7)
  context.bezierCurveTo(width * .26, height * .7, width * .46, height * .28, width * .82, height * .38)
  context.stroke()
  context.fillStyle = INK
  context.fillRect(width * (.77 + p * .014), height * .31, width * .13, height * .16)
}

const drawShutter: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const shift = width * phase(state) * .012
  fill(context, INK, width, height)
  polygon(context, PAPER, [[0, 0], [width * .42 + shift, 0], [width * .29 + shift, height], [0, height]])
  polygon(context, MID, [[width * .46 + shift, 0], [width * .72 + shift, 0], [width * .59 + shift, height], [width * .33 + shift, height]])
  polygon(context, LIGHT, [[width * .76 + shift, 0], [width, 0], [width, height], [width * .63 + shift, height]])
}

const drawOrbit: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  fill(context, PAPER, width, height)
  const cx = width * .68
  const cy = height * .49
  const radius = height * .34
  context.strokeStyle = INK
  context.lineWidth = Math.max(5, width * .009)
  context.beginPath()
  context.arc(cx, cy, radius, 0, Math.PI * 2)
  context.stroke()
  const angle = -.65 + cycle(state) * Math.PI * 2
  circle(context, DARK, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, height * .055)
}

const drawSteps: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const lift = height * phase(state) * .012
  fill(context, PAPER, width, height)
  context.fillStyle = DARK
  context.fillRect(0, height * .72 - lift, width * .72, height * .28 + lift)
  context.fillStyle = MID
  context.fillRect(width * .18, height * .45 - lift, width * .54, height * .27)
  context.fillStyle = INK
  context.fillRect(width * .36, height * .18 - lift, width * .36, height * .27)
}

const drawFold: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const angle = cycle(state) * Math.PI * 2
  const topHinge = width * Math.sin(angle) * .018
  const bottomHinge = width * (Math.sin(angle - .65) - Math.sin(-.65)) * .014
  const lift = height * (1 - Math.cos(angle)) * .006
  fill(context, INK, width, height)
  polygon(context, PAPER, [[width * .13, height * .15], [width * .54 + topHinge, height * .08 + lift], [width * .49 + bottomHinge, height * .82 - lift], [width * .08, height * .9]])
  polygon(context, LIGHT, [[width * .54 + topHinge, height * .08 + lift], [width * .84, height * .25], [width * .78, height * .74], [width * .49 + bottomHinge, height * .82 - lift]])
  polygon(context, MID, [[width * .49 + bottomHinge, height * .82 - lift], [width * .78, height * .74], [width * .68, height * .92], [width * .18, height * .96]])
}

const drawPortal: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const p = phase(state)
  fill(context, INK, width, height)
  const colours = [MID, LIGHT, PAPER]
  colours.forEach((colour, index) => {
    const insetX = width * (.11 + index * .105 + p * .004 * index)
    const insetY = height * (.1 + index * .085 + p * .004 * index)
    context.strokeStyle = colour
    context.lineWidth = Math.max(4, width * .009)
    context.strokeRect(insetX, insetY, width - insetX * 2, height - insetY * 2)
  })
}

const drawRibbon: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const p = phase(state)
  fill(context, PAPER, width, height)
  context.strokeStyle = INK
  context.lineWidth = height * .26
  context.lineCap = 'butt'
  context.beginPath()
  context.moveTo(-width * .04, height * (.3 + p * .008))
  context.bezierCurveTo(width * .28, height * .03, width * .53, height * .93, width * 1.04, height * (.61 - p * .008))
  context.stroke()
  context.strokeStyle = MID
  context.lineWidth = height * .075
  context.stroke()
}

const drawStrata: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const angle = cycle(state) * Math.PI * 2
  const drift = (offset: number, amplitude: number) => (Math.sin(angle + offset) - Math.sin(offset)) * amplitude
  fill(context, PAPER, width, height)
  const upper = drift(0, .024)
  const middle = drift(.7, .018)
  const lower = drift(1.4, .014)
  polygon(context, LIGHT, [[0, height * (.38 + upper)], [width * .35, height * (.29 + upper)], [width * .68, height * (.42 + upper)], [width, height * (.31 + upper)], [width, height], [0, height]])
  polygon(context, MID, [[0, height * (.58 + middle)], [width * .3, height * (.49 + middle)], [width * .64, height * (.61 + middle)], [width, height * (.48 + middle)], [width, height], [0, height]])
  polygon(context, INK, [[0, height * (.79 + lower)], [width * .37, height * (.7 + lower)], [width * .72, height * (.82 + lower)], [width, height * (.69 + lower)], [width, height], [0, height]])
}

const drawTarget: EnvironmentDrawer = (state) => {
  const { context, width, height } = state
  const angle = cycle(state) * Math.PI * 2
  const cx = width * (.72 + Math.sin(angle) * .018)
  const cy = height * (.43 + (Math.cos(angle) - 1) * .014)
  fill(context, PAPER, width, height)
  context.strokeStyle = INK
  context.lineWidth = Math.max(4, width * .007)
  context.beginPath()
  context.arc(cx, cy, height * .29, 0, Math.PI * 2)
  context.stroke()
  context.fillStyle = INK
  context.fillRect(cx - width * .19, cy - height * .012, width * .38, height * .024)
  context.fillRect(cx - width * .007, cy - height * .33, width * .014, height * .66)
  circle(context, PAPER, cx + width * .055, cy - height * .075, height * .06)
}

export const environmentDrawers: Record<SceneId, EnvironmentDrawer> = {
  black: solid('#000', '#fff'),
  white: solid('#fff', '#000'),
  field: drawField,
  grid: drawGrid,
  beam: drawBeam,
  contour: drawContour,
  void: drawVoid,
  float: drawFloat,
  halo: drawHalo,
  raster: drawRaster,
  aperture: drawAperture,
  track: drawTrack,
  shutter: drawShutter,
  orbit: drawOrbit,
  steps: drawSteps,
  fold: drawFold,
  portal: drawPortal,
  ribbon: drawRibbon,
  strata: drawStrata,
  target: drawTarget,
}
