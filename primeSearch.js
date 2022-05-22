// @ts-check

import { promisify } from 'util';
import { exec } from 'child_process';
import { cpus } from 'os';
import { createHash } from 'crypto';

import log from 'loglevel';

import { generatePrimes } from './generatePrimes.js';

const execPromise = promisify(exec);

const SMALL_PRIMES = generatePrimes(2000).map((p) => BigInt(p));

// Todo: Make this configurable.
/**
 * The ways that we allow the algorithm to substitute a character.
 * Like 0 can become 8 or 9, so on and so forth.
 * @type {Record<number, Array<string>>}
 */
const allowed = {
  0: ['8', '9', '5'],
  1: ['7'],
  2: ['6'],
  7: ['1'],
  5: ['0'],
  8: ['0', '9'],
  6: ['2'],
  9: ['4'],
  4: ['9'],
};

/**
 * These are used to swap out the last digit if necessary.
 * @type {Record<number, string>}
 */
const lastDigitSubstitution = {
  0: '3',
  2: '3',
  4: '9',
  6: '9',
  8: '9',
  5: '3',
};

/**
 * Used to simplify the set lookup (since the values getting stuck in there are quite large.)
 * @param {string} str
 */
function hash(str) {
  return createHash('sha256').update(str).digest('base64');
}

/**
 * Finds a character that the algorithm is allowed to modify.
 * @param {string} keyFrame
 * @returns{number}
 */
function findIndexAllowed(keyFrame) {
  // Allow it to adjust any character except for the last one ;)
  const index = Math.floor(Math.random() * (keyFrame.length - 2));
  const char = keyFrame[index];
  if (allowed[char]) return index;
  return findIndexAllowed(keyFrame);
}

/**
 * Selects a random element from an array.
 * @template T
 * @param {Array<T>} arr
 */
function randomInArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Replaces one of the characters in the keyframe with a random character.
 * @param {string} keyFrame
 * @param {unknown} [specified=null]
 */
function replaceRandomCharacter(keyFrame, specified = null) {
  // do not replace the last character
  const index = findIndexAllowed(keyFrame);

  // replace that position in the string
  const replaceWith = randomInArray(specified || allowed[keyFrame[index]]);
  keyFrame =
    keyFrame.substring(0, index) + replaceWith + keyFrame.substring(index + 1);

  return keyFrame;
}

/**
 * Tries to generate a test that is not in the tested set.
 * The algorithm is written rather naively, but this is fine (although inefficient) because
 * it takes up very little of the CPU time. The real crunch comes from the prime checking :)
 * @param {Set<string>} tested
 * @param {string} keyFrame
 */
function generateTest(tested, keyFrame) {
  let val = keyFrame;
  while (tested.has(hash(val))) val = replaceRandomCharacter(keyFrame);
  return val;
}

/**
 * Generates a collection of tests that are not in the tested set.
 * This is used so we may execute the tests in parallel.
 *
 * @param {Set<string>} tested
 * @param {string} keyFrame
 * @param {number} count
 */
function generateTests(tested, keyFrame, count) {
  let arr = [];
  const giveUp = escapeAfter(256);
  tests: for (let i = 0; i < count; i++) {
    do {
      arr[i] = generateTest(tested, keyFrame);
      tested.add(hash(arr[i]));
      if (giveUp()) break tests;
    } while (!isPossiblyPrime(arr[i]));
  }
  if (arr.length === 1) return arr.filter((i) => isPossiblyPrime(i)); // will clean up all this code later...
  return arr;
}

/**
 * Keeps track of if a threshold has been passed, and returns true if it has.
 * @param {number} num
 */
function passes(num) {
  let next = num;
  return (val) => {
    const result = val > next;
    if (result) next = num + Math.floor(val / num) * num;
    return result;
  };
}

/**
 * Keeps track of how many times it has been invoked to trigger an escape, this is for generateTests,
 * which is implemented naively.
 * @param {number} num
 */
function escapeAfter(num) {
  let count = 0;
  return () => count++ > num;
}

/**
 * This generates a series of multipliers that are multiplied to the original prime to try to find a new prime.
 */
function* almostSophieGermainMultipliers() {
  // 2, 4, 6, 8, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900
  yield 2n;
  yield 4n;
  yield 6n;
  yield 8n;

  for (let i = 1n; i <= 9n; i++) {
    for (let j = 1n; j <= 10n; j++) {
      yield j * 10n ** i;
    }
  }

  // for(let i = 1n; i < 4096; i++) {
  //     yield i * 2n
  // }
}

/**
 * Extracts the prime value from the result returned from OpenSSL.
 * @param {string} str
 */
function extractResult(str) {
  // If parenthesis show up, it's because there's hex involved.
  if (str.includes('(')) {
    const split = str.split('(');
    return split[1].split(')')[0];
  }

  // This will typically work.
  return str.split(' ')[0];
}

/**
 * TODO: docs
 * @param {string} val
 * @param {number} simultaneous
 */
async function findAlmostSophieGermain(val, simultaneous) {
  const gen = almostSophieGermainMultipliers();
  let done = false;
  while (!done) {
    const tests = [];
    for (let i = 0; i < simultaneous; i++) {
      const next = gen.next();
      if (next.done) done = true;
      else tests.push(next.value);
    }

    const primeCheck = await Promise.all(
      tests
        .map((test) =>
          typeof test === 'bigint' ? test * BigInt(val) + 1n : 0n
        )
        .map((i) => execPromise(`openssl prime ${i.toString()}`))
    );
    const results = primeCheck
      .filter((i) => i.stdout.includes('is prime'))
      .map((i) => i.stdout);

    if (results.length) return extractResult(results[0]);
  }
  return '';
}

/**
 * Searches for a prime number by adjusting the original number.
 * @param {string} original
 * @param {boolean} [sophie=false]
 */
export async function findPrime(original, sophie = false) {
  // Swap out the last digit with something that is allowed.
  if (lastDigitSubstitution[original[original.length - 1]]) {
    original =
      original.slice(0, original.length - 1) +
      lastDigitSubstitution[original[original.length - 1]];
  }

  let keyFrame = original;
  let attempts = 0;
  let failedViable = 0;

  const simultaneous = cpus().length;

  const tested = new Set();
  const rekeyAt = Math.floor(keyFrame.length / 1);

  const rekeyCheck = passes(rekeyAt);
  const restartCheck = passes(rekeyAt * 4);
  const degenerateCheck = passes(160);

  log.debug(
    `Starting process, rekey at ${rekeyAt} attempts, with ${simultaneous} checks each attempt.`
  );

  while (true) {
    log.debug(attempts);

    const tests = generateTests(tested, keyFrame, simultaneous);

    // Turn the tests into `openssl prime` processes, and wait for them to complete.
    const result = await Promise.all(
      tests.map((i) => execPromise(`openssl prime ${i}`))
    );

    // Filter out any of the results that are not prime.
    const successes = result.filter((i) => !i.stdout.includes('not prime'));

    // If we had any successes, we can stop.
    if (successes.length) {
      const prime = successes.map((i) => extractResult(i.stdout))[0];
      const result = {
        prime,
        attempts,
        simultaneous,
        distinctTested: tested.size,
      };

      if (sophie) {
        const sophieGermain = await findAlmostSophieGermain(
          prime,
          simultaneous
        );
        if (sophieGermain)
          return {
            ...result,
            sophieGermain,
          };
      } else return result;
    }

    attempts++;
    if (!tests.length) failedViable++;

    // If we reach the rekey point (every "rekeyAt" attempts), we adjust a single digit in the keyframe, and use that as the new keyframe.
    // This is used to try to prevent degradation of quality of the visual.
    if (!tests.length || rekeyCheck(tested.size))
      keyFrame = generateTest(tested, keyFrame);
    if (restartCheck(tested.size)) keyFrame = generateTest(tested, original);
    if (degenerateCheck(failedViable))
      keyFrame = original = replaceRandomCharacter(original, [
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
      ]);
  }
}

/**
 * @param {string | number | bigint | boolean} value
 */
function isPossiblyPrime(value) {
  const integerValue = BigInt(value);
  return isNotDivisibleBySmallPrimes(integerValue);
}

/**
 * @param {bigint} value
 */
function isNotDivisibleBySmallPrimes(value) {
  for (const v of SMALL_PRIMES) {
    if (value % v === 0n) {
      return false;
    }
  }
  return true;
}
