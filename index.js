#!/usr/bin/env node
// @ts-check

import { Command } from 'commander'
import { findPrime } from './primeSearch.js'
import { transform } from './image.js'
import commandExists from 'command-exists'

const program = new Command()
program.version('1.0.1').name('pictoprime').description('A program to find picture-esque primes. Requires openssl.')

program
    .option('-n, --number <number>', 'The number to be transformed into a prime.')
    .option('-i, --image <image>', 'Use an image to find primes.') 
    .option('--pixels <pixels>', 'The numbers to use to generate the prime (image mode). Left side is lighter, right side is darker.', '7772299408')
    .option('--width <width>', 'The width of the ascii to generate (image mode).', '32')
    .option('--contrast <contrast>', 'Additional contrast to apply between -1.0 and 1.0 (image mode).', '0.1')
    .option('-s, --sophie', 'Enable the search for an (almost) Sophie Germain prime (useful for Discrete Log cryptography).',)

program.parse(process.argv)

/** @type {{ number: string, sophie: boolean, image?: string, pixels: string, width: string, contrast: string }} */
const options = program.opts()

if (!await commandExists('openssl').then(() => true).catch(() => false)) throw new Error('You must have openssl in your path for this program to work.')
if (!options.number && !options.image) throw new Error('Either a number or an image must be specified.')

if (options.image) options.number = (await transform(options.image, {
    pixels: options.pixels,
    width: +options.width,
    contrast: +options.contrast
})).replace(/\n/g, '')

findPrime(options.number, options.sophie)
    .then(async i => console.log(i))