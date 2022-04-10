// @ts-check
import Jimp from "jimp";
import _imageToAscii from 'image-to-ascii'
import tempy from 'tempy';
import { promisify } from 'util'

const imageToAscii = promisify(_imageToAscii)


/**
 * @param {number} time 
 */
async function delay (time) {
    return new Promise(resolve => setTimeout(resolve, time))
}

/**
 * Takes an image and converts it to ASCII art.
 * @param {string} file 
 * @param {{ pixels?: string, width?: number, contrast?: number }} [options]
 * @returns {Promise<string>}
 */
export async function transform (file, {
    pixels = "7772299408",
    width = 32,
    contrast = 0.1
} = {}) {
    const im = await Jimp.read(file)
    const temp = tempy.file({ extension: 'png' })
    await im.contrast(contrast).write(temp);
    await delay(2000)
    const result = await imageToAscii(temp, {
        size: {
            width
        },
        size_options: {
            px_size: {
                width: 2,
                height: 1
            }
        },
        colored: false,
        // Light to Dark
        pixels,
        reverse: true,
    });
    return result
}