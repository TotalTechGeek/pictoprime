import { spawn } from 'child_process'

/**
 * Invokes a program using spawn & returns the stdout as a promise.
 * 
 * @test 'ls', ['examples/*.png']
 * 
 * @param {string} file 
 * @param {string[]} args 
 * @returns {Promise<string>}
 */
export async function spawnPromise (file, args) {
    const program = spawn(file, args)
    let data = ''
    return new Promise((resolve, reject) => {
        program.stdout.on('data', text => data += text.toString())
        program.on('error', reject)
        program.on('close', () => resolve(data))
        program.on('exit', () => resolve(data))
    })
};