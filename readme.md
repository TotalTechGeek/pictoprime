# Pictoprime 

This is a program used to generate prime numbers from pictures.

## Dependencies 

Ensure you have the following dependencies:

- [Node.js](https://nodejs.org/en/download/) (16+ supported, earlier versions will also likely work)
- [GraphicsMagick](https://github.com/IonicaBizau/image-to-ascii/blob/HEAD/INSTALLATION.md)
- OpenSSL ([Window](https://wiki.openssl.org/index.php/Binaries)) (Mac / Linux likely already have it)

GraphicsMagick Common Installations: 
```
# OS X
brew install graphicsmagick

# Windows users can install the binaries from http://www.graphicsmagick.org/ or using the command line:
choco install graphicsmagick
```

## To Install
You can install this program just by running: 
```
npm i -g pictoprime 
```





## To Run
```
$ pictoprime --help
Usage: pictoprime [options]

A program to find picture-esque primes. Requires openssl.

Options:
  -V, --version          output the version number
  -n, --number <number>  The number to be transformed into a prime.
  -i, --image <image>    Use an image to find primes.
  --pixels <pixels>      The numbers to use to generate the prime (image mode). Left side is lighter, right side is darker. (default: "7772299408")
  --width <width>        The width of the ascii to generate (image mode). (default: "32")
  -s, --sophie           Enable the search for an (almost) Sophie Germain prime (useful for Discrete Log cryptography).
  -h, --help             display help for command
  ```

### Example 

```
pictoprime -i examples/headshot.png
```


## To Develop

Clone the repository and run:
```
yarn
```
then 
```
node index.js 
```