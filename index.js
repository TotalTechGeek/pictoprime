#!/usr/bin/env node
// @ts-check

import { Command, Option } from 'commander'
import { findPrime } from './primeSearch.js'
import { transform } from './image.js'
import { splitEvery } from "ramda";
import commandExists from 'command-exists'

import log from 'loglevel'

const program = new Command()
program.version('1.0.6').name('pictoprime').description('A program to find picture-esque primes. Requires openssl.')

const outputOption = new Option('-x, --export <mode>', 'The output format').choices(['json', 'prime', 'ascii']).default('json')

program
    .option('-n, --number <number>', 'The number to be transformed into a prime.')
    .option('-i, --image <image>', 'Use an image to find primes.')
    .option('-q, --quiet', 'Hides some of the debug information to make it easier to get output from this program.')
    .addOption(outputOption)
    .option('--pixels <pixels>', 'The numbers to use to generate the prime (image mode). Left side is lighter, right side is darker.', '7772299408')
    .option('--width <width>', 'The width of the ascii to generate (image mode).', '32')
    .option('--contrast <contrast>', 'Additional contrast to apply between -1.0 and 1.0 (image mode).', '0.1')
    .option('-s, --sophie', 'Enable the search for an (almost) Sophie Germain prime (useful for Discrete Log cryptography).',)

program.parse(process.argv)

/** @type {{ number: string, sophie: boolean, image?: string, pixels: string, width: string, contrast: string, video: string, export: 'json' | 'prime' | 'ascii', quiet: boolean }} */
const options = program.opts()

async function main () {
    if (options.quiet) log.setLevel('info')
    else log.setLevel('debug')

    if (!await commandExists('openssl').then(() => true).catch(() => false)) throw new Error('You must have openssl in your path for this program to work.')

    if (!options.number && !options.image) throw new Error('Either a number or an image must be specified.')

    if (options.image) options.number = (await transform(options.image, {
        pixels: options.pixels,
        width: +options.width,
        contrast: +options.contrast
    })).replace(/\n/g, '')


    const result = await findPrime(options.number, options.sophie)

    if (options.export === 'json') log.info(JSON.stringify(result, undefined, 2))
    else if (options.export === 'prime') log.info(result.prime)
    else console.log(splitEvery(+options.width * 2, result.prime).join('\n'))
}

main().catch(err => {
    log.error(err)
})
