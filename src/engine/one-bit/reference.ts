export type Rgb = readonly [number, number, number]

export interface OneBitOptions {
  paper: Rgb
  ink: Rgb
  contrast: number
  gridScale: number
}

export const DEFAULT_ONE_BIT_OPTIONS: Readonly<OneBitOptions> = {
  paper: [185, 185, 173],
  ink: [48, 47, 40],
  contrast: 1.24,
  gridScale: 3,
}

export const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const

export function ditherRgba(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  options: Readonly<OneBitOptions>,
  output = new Uint8ClampedArray(width * height * 4),
) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError('width and height must be positive integers')
  }
  const expectedLength = width * height * 4
  if (input.length !== expectedLength || output.length !== expectedLength) {
    throw new RangeError(`RGBA buffers must contain exactly ${expectedLength} bytes`)
  }
  if (!Number.isFinite(options.gridScale) || options.gridScale <= 0) throw new RangeError('gridScale must be positive')
  if (!Number.isFinite(options.contrast) || options.contrast < 0) throw new RangeError('contrast must not be negative')

  for (let y = 0; y < height; y += 1) {
    const thresholdRow = BAYER_4X4[Math.floor(y / options.gridScale) % 4]
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      let lightness = (input[index] * .2126 + input[index + 1] * .7152 + input[index + 2] * .0722) / 255
      lightness = Math.min(1, Math.max(0, (lightness - .5) * options.contrast + .5))
      const threshold = (thresholdRow[Math.floor(x / options.gridScale) % 4] + .5) / 16
      const colour = lightness > threshold ? options.paper : options.ink
      output[index] = colour[0]
      output[index + 1] = colour[1]
      output[index + 2] = colour[2]
      output[index + 3] = 255
    }
  }
  return output
}
