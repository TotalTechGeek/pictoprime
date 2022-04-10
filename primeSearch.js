// @ts-check

import { promisify } from 'util'
import { exec } from 'child_process'
import { cpus } from 'os';
import { createHash } from 'crypto';

const execPromise = promisify(exec);

// Todo: Make this configurable.
/**
 * The ways that we allow the algorithm to substitute a character.
 * Like 0 can become 8 or 9, so on and so forth.
 * @type {{ [key: string]: string[] }}
 */
const allowed = {
    '0': ['8', '9'],
    '1': ['7'],
    '7': ['1'],
    '8': ['0', '9'],
    '9': ['4'],
    '4': ['9']
}


// These are used to swap out the last digit if necessary.
const lastDigitSubstitution = {
    '0': '3',
    '2': '3',
    '4': '9',
    '6': '9',
    '8': '9',
    '5': '3'
}

/**
 * Used to simplify the set lookup (since the values getting stuck in there are quite large.)
 * @param {string} str 
 * @returns {string}
 */
function hash (str) {
    return createHash('sha256').update(str).digest('base64')
}


/**
 * Finds a character that the algorithm is allowed to modify.
 * @param {string} keyFrame 
 * @returns {number}
 */
function findIndexAllowed (keyFrame) {
    // Allow it to adjust any character except for the last one ;)
    const index = Math.floor(Math.random() * (keyFrame.length - 2))
    const char = keyFrame[index]
    if (allowed[char]) return index
    return findIndexAllowed(keyFrame)
}

/**
 * Selects a random element from an array.
 * @template T
 * @param {T[]} arr 
 */
function randomInArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Replaces one of the characters in the keyframe with a random character.
 * @param {string} keyFrame 
 */
function replaceRandomCharacter(keyFrame) {
    // do not replace the last character
    const index = findIndexAllowed(keyFrame)

    // replace that position in the string
    const replaceWith = randomInArray(allowed[keyFrame[index]])
    keyFrame = keyFrame.substring(0, index) + replaceWith + keyFrame.substring(index + 1)

    return keyFrame
}



/**
 * Tries to generate a test that is not in the tested set.
 * The algorithm is written rather naively, but this is fine (although inefficient) because
 * it takes up very little of the CPU time. The real crunch comes from the prime checking :) 
 * @param {Set<string>} tested 
 * @param {string} keyFrame 
 */
function generateTest (tested, keyFrame) {
    let val = keyFrame
    while (tested.has(hash(val))) val = replaceRandomCharacter(keyFrame)
    return val
}


/**
 * Generates a collection of tests that are not in the tested set.
 * This is used so we may execute the tests in parallel.
 * 
 * @param {Set<string>} tested 
 * @param {string} keyFrame 
 * @param {number} count 
 */
function generateTests (tested, keyFrame, count) {
    let arr = []
    for (let i = 0; i < count; i++) {
        arr.push(generateTest(tested, keyFrame))
        tested.add(hash(arr[i]))
    }
    return arr
}


/**
 * Keeps track of if a threshold has been passed, and returns true if it has.
 * @param {number} num 
 */
function passes (num) {
    let next = num 

    return val => {
        const result = val > next
        if (result) next += num
        return result        
    }
}

/**
 * This generates a series of multipliers that are multiplied to the original prime to try to find a new prime.
 */
function* almostSophieGermainMultipliers () {
    // 2, 4, 6, 8, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900
    yield 2n
    yield 4n
    yield 6n
    yield 8n

    for(let i = 1n; i <= 9n; i++) {
        for (let j = 1n; j <= 10n; j++) {
            yield j * (10n ** i)
        }
    }
    
    // for(let i = 1n; i < 4096; i++) {
    //     yield i * 2n
    // }
}


/**
 * @param {string} val
 * @param {number} simultaneous
 * @returns {Promise<string>} 
 */
async function findAlmostSophieGermain (val, simultaneous) {
    const gen = almostSophieGermainMultipliers()
    let done = false 
    while (!done) {
        const tests = []
        for (let i = 0; i < simultaneous; i++) {
            const next = gen.next()
            if (next.done) done = true
            else tests.push(next.value)
        }

        const primeCheck = await Promise.all(tests.map(test => typeof test === 'bigint' ? test * BigInt(val) + 1n : 0n).map(i => execPromise(`openssl prime ${i.toString()}`)))
        const results = primeCheck.filter(i => i.stdout.includes('is prime')).map(i => i.stdout)

        if (results.length) return results[0].split(' ')[0]
    }
    return ''
}


/**
 * Searches for a prime number by adjusting the original number.
 * @param {string} original 
 * @param {boolean} sophie
 */
export async function findPrime (original, sophie = false) {
    
    // Swap out the last digit with something that is allowed.
    if (lastDigitSubstitution[original[original.length - 1]]) {
        original = original.slice(0, original.length - 1) + lastDigitSubstitution[original[original.length - 1]]
    }

    let keyFrame = original
    let attempts = 0

    const simultaneous = cpus().length

    const tested = new Set()
    const rekeyAt = Math.floor(keyFrame.length / 3)

    const rekeyCheck = passes(rekeyAt)
    const restartCheck = passes(rekeyAt * 6)

    console.log(`Starting process, rekey at ${rekeyAt} attempts, with ${simultaneous} checks each attempt.`)

    while (true) {
        console.log(attempts)

        const tests = generateTests(tested, keyFrame, simultaneous)

        // Turn the tests into `openssl prime` processes, and wait for them to complete.
        const result = await Promise.all(tests.map(i => execPromise(`openssl prime ${i}`)))

        // Filter out any of the results that are not prime.
        const successes = result.filter(i => !i.stdout.includes('not prime'))
        
        // If we had any successes, we can stop.
        if(successes.length) {
            const prime = successes.map(i => i.stdout.split(' ')[0])[0]
            const result = { 
                prime,
                attempts,
                simultaneous,
                distinctTested: tested.size
            }

            if (sophie) {
                const sophieGermain = await findAlmostSophieGermain(prime, simultaneous)
                if (sophieGermain) return {
                    ...result,
                    sophieGermain
                }
            }
            else return result 
        }
    
        attempts++

        // If we reach the rekey point (every "rekeyAt" attempts), we adjust a single digit in the keyframe, and use that as the new keyframe.
        // This is used to try to prevent degradation of quality of the visual.
        if (rekeyCheck(tested.size)) keyFrame = generateTest(tested, keyFrame)
        if (restartCheck(tested.size)) keyFrame = generateTest(tested, original)
    }
    
}
