// @ts-check

/**
 * TODO: docs
 * @param {number} count 
 */
export function generatePrimes(count) {
  const primes = [2];
  let nextTest = 3;
  while (primes.length < count) {
    if (!primes.some((p) => nextTest % p === 0)) {
      primes.push(nextTest);
    }
    nextTest++;
  }
  return primes;
}
