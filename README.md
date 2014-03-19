# node-netpbm

node-netpbm scales and converts GIF, JPEG and PNG images asynchronously, without running out of memory, even if the original image is very large. It does this via the netpbm utilities, a classic package of simple Unix tools that convert image formats and perform operations row-by-row so that memory is not exhausted. If you have ever tried to import 16-megapixel JPEGs with gd or imagemagick, you know exactly why you need this package.

node-netpbm also provides a simple way to check the dimensions of an existing image file without paying the full price of converting it.

## System Requirements

You must have the [netpbm utilities](http://netpbm.sourceforge.net) installed. For best results, [install the "stable" or "advanced" version](http://netpbm.sourceforge.net/getting_netpbm.php) from the netpbm site. You can also use your operating system's package manager if you can live without support for preserving alpha channels in PNGs (as of this writing most Linux distributions have an older version of netpbm that can't do this). On Ubuntu systems this is all you need to do:

    apt-get install netpbm

`node-netpbm` is designed for use on Linux, MacOS X and other Unix systems. No guarantees are made that it will work on Windows systems or anywhere else where shell pipelines don't behave reasonably and/or simple utilities like `head` and `tail` do not exist. But we'll accept pull requests. Make sure the tests pass!

## Converting and scaling images

node-netpbm offers a very simple API for converting and scaling images:

    var convert = require('netpbm').convert;

    convert('input/file.png', 
      'output/file.jpg', 
      { width: 300, height: 400 },
      function(err) {
        if (!err) {
          console.log("Hooray, your image is ready!");
        }
      }
    );

This code creates an image as close to 300x400 pixels as possible without distorting the aspect ratio of the original image. See below for more information about the options available.

node-netpbm will automatically detect file types from file extensions. Uppercase is automatically converted to lowercase in file extensions, and jpeg is accepted as a synonym for jpg.

## Options for converting and scaling images

The third parameter to `convert` is an object containing options such as `alpha`, `width`, `height` and `limit`. 

* If you specify `alpha: true` and you have a very up to date version of the netpbm utilities that includes the `pngtopam` and `pamrgbatopng` utilities (check at the command line), alpha channel will be preserved when scaling a PNG input file to a PNG output file. As of this writing Ubuntu does not include these in its netpbm package. For more information and source code download links, see the [netpbm site](http://netpbm.sourceforge.net/getting_netpbm.php). The "stable" and "advanced" tarballs have both utilities ("super stable" does not).

* If you specify just `width`, the output image will be that wide, and the height will scale to maintain the aspect ratio of the original.

* If you specify just `height`, the output image will be that tall, and the width will scale to maintain the aspect ratio of the original.

* If you specify both `width` and `height` properties for the options parameter, the output image will be as close to that size as possible without changing the aspect ratio of the original. For instance, if the original is 2000x2000 and you specify 300x400, the output will be 300x300. If the original is 500x5000 and you specify 300x400, the output will be 40x400. 

A common use for the third approach is to specify the width you typically want but also specify a maximum height to avoid unwanted results if the original is extremely tall, like an infographic.

* If you are processing many image uploads for many users simultaneously, spawning lots of image processing Unix pipelines asynchronously could use a lot of resources. To prevent this, node-netpbm automatically throttles the number of simultaneously pending pipelines to 10. Additional requests will automatically wait until a slot is available. You can override this by setting the `limit` option to a different value. There isn't much benefit in setting this option higher than the number of cores available to you. In fact, if you are using the cluster module to run a node process for each core, you might want to set `limit` to 1 so that each process does not spawn up to 10 image pipelines.

* Additional options exist for advanced uses such as overriding the netpbm utilities used for each conversion. See the source code for details.

## Obtaining image dimensions

Here's how:

    var info = require('netpbm').info;

    info('file.jpg', function(err, result) {
      if (!err) {
        console.log("Type: " + result.type + 
          " width: " + result.width + 
          " height: " + result.height);
      }
    });

Like `convert`, `info` is asynchronous. If there is no error, the type, width and height are passed to the callback via the `result` object. 

The `type` property will contain `gif`, `jpg` or `png`. `width` and `height` are hopefully self-explanatory.

You can also call `info` with three parameters: the filename, an options object, and the callback. Usually you won't need this, but `info` does support the same advanced parameters for overriding types as `convert` does. `info` currently does not support the `limit` option, however obtaining image dimensions has a much smaller impact on the system than actually converting or scaling a complete image.

Although the `info` function is reasonably fast, you should not rely on calling it every time you display an image. For good performance you should cache everything you know about each image in your database.

## Contributing Code

We love pull requests. But you gotta make sure the tests still pass. cd to the `tests` folder and run `node test.js`. If it blows up, your code isn't ready.

## Changelog

1.0.2: Child process concurrency managed by [async.queue](https://github.com/caolan/async#queue). No change in documented behavior.

1.0.1: The `limit` option is respected even when only fetcing `info` to prevent crashes due to resource starvation. Thanks to Alex / Ajax.

1.0.0: Prevent `node-netpbm` from crashing if the netpbm utilities produce no output without an error code (thanks to Alexander Johansson). Also decided to declare 1.0.0 stable since this is the first change in many moons.

## Contact

Created at [P'unk Avenue](http://punkave.com), an amazing design-and-build firm in South Philly. Feel free to drop [Tom Boutell](mailto:tom@punkave.com) a line with questions. Better yet, send pull requests and open issues on [http://github.com/punkave/node-netpbm](github).

