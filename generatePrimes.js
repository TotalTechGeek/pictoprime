// @ts-check

/**
 * A simple function to generate a list of small primes.
 * This is used by the program for the purposes of small-primes tests,
 * to reduce the calls out to OpenSSL.
 * 
 * @test 5 returns [2, 3, 5, 7, 11]
 * @test 100
 * 
 * @param {number} count
 * @returns {number[]}
 */
export function generatePrimes(count = 2000) {
    const primes = [2]
    let nextTest = 3
    while (primes.length < count) {
        if (!primes.some(p => nextTest % p === 0)) primes.push(nextTest)
        nextTest += 2
    }
    return primes
}
