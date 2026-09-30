/**
 * Minimal PNG reader: 8-bit, non-interlaced, colour type 6 (RGBA) or 2 (RGB).
 *
 * Chrome's `--screenshot` is the only rasteriser this project has, and Node has
 * no built-in PNG decoder, so the logo tool needs this to get at the pixels of
 * the frame grid it just rendered. Only what Chrome actually emits is handled —
 * anything else throws rather than guessing.
 *
 * Usage:  const { width, height, rgba } = decodePng(bytes)
 */
import { inflateSync } from 'node:zlib'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * @param bytes - the whole file.
 * @returns the decoded image; `rgba` is `width * height * 4`.
 */
export function decodePng(bytes) {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('not a PNG')
  }
  let offset = 8
  let header
  const idat = []
  while (offset < bytes.length) {
    const length = readUint32(bytes, offset)
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      header = {
        width: readUint32(data, 0),
        height: readUint32(data, 4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }
  if (header === undefined) throw new Error('PNG has no IHDR')
  const { width, height, bitDepth, colorType, interlace } = header
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`)
  if (colorType !== 6 && colorType !== 2) throw new Error(`unsupported PNG colour type ${colorType}`)
  if (interlace !== 0) throw new Error('interlaced PNG is not supported')

  const channels = colorType === 6 ? 4 : 3
  const stride = width * channels
  const raw = inflateSync(Buffer.concat(idat))
  if (raw.length < (stride + 1) * height) throw new Error('PNG pixel data is short')

  // Undo the per-scanline filters (PNG spec §9.2).
  const lines = Buffer.alloc(stride * height)
  let previous = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const source = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const line = lines.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0
      const b = previous[x]
      const c = x >= channels ? previous[x - channels] : 0
      const value = source[x]
      switch (filter) {
        case 0: line[x] = value; break
        case 1: line[x] = (value + a) & 0xff; break
        case 2: line[x] = (value + b) & 0xff; break
        case 3: line[x] = (value + ((a + b) >> 1)) & 0xff; break
        case 4: line[x] = (value + paeth(a, b, c)) & 0xff; break
        default: throw new Error(`unknown PNG filter ${filter} on row ${y}`)
      }
    }
    previous = line
  }

  if (channels === 4) return { width, height, rgba: new Uint8ClampedArray(lines) }
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0, o = 0; i < width * height; i++, o += 4) {
    rgba[o] = lines[i * 3]
    rgba[o + 1] = lines[i * 3 + 1]
    rgba[o + 2] = lines[i * 3 + 2]
    rgba[o + 3] = 255
  }
  return { width, height, rgba }
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

function readUint32(bytes, at) {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
}
