var failures = 0;

var convert = require('../node-netpbm.js').convert;
var info = require('../node-netpbm.js').info;
var exec = require('child_process').exec;

// Change me to true to test alpha preservation
// support for PNG-to-PNG conversions. This won't
// work for you if you don't have a newer netpbm
// with several new commands, see the documentation.
var alpha = false;

// Make sure netpbm is available before plunging ahead

requirements();

function requirements() {
  process.stdout.write('System requirements: ');
  exec('pnmtopng --version && pngtopnm --version && pnmscale --version', function(err, stdout, stderr) {
    if (err) {
      console.log("NOT MET");
      console.log("You do not have the netpbm utilities installed, or they are");
      console.log("out of date. Make sure you have pnmtopng, pngtopnm and pamscale");
      console.log("commands. Ubuntu hint: apt-get install netpbm");
      process.exit(2);
    }
    console.log("MET");
    test1();
  });
}

// Pass-through conversion: GIF to GIF, no size change

function test1() {
  process.stdout.write('test 1: ');
  convert('sample.gif', 'test1.gif', { alpha: alpha }, next('test1.gif', 'gif', 350, 361, test2));
}

// Convert GIF to JPEG

function test2() {
  process.stdout.write('test 2: ');
  convert('sample.gif', 'test2.jpg', { alpha: alpha }, next('test2.jpg', 'jpg', 350, 361, test3));
}

// JPEG to JPEG with size change: as big as possible while
// fitting in 300px x 300px without changing the aspect ratio

function test3() {
  process.stdout.write('test 3: ');
  convert('sample.jpg', 'test3.jpg', { alpha: alpha, 'width': 300, 'height': 300}, next('test3.jpg', 'jpg', 224, 300, test4));
}

// JPEG to PNG with size change: width of exactly 300px

function test4() {
  process.stdout.write('test 4: ');
  convert('sample.jpg', 'test4.png', { alpha: alpha, 'width': 300 }, next('test4.png', 'png', 300, 402, test5));
}

// PNG to PNG with size change: height of exactly 300px.
// Note the 'file' command shows the alpha channel was preserved

function test5() {
  process.stdout.write('test 5: ');
  convert('sample.png', 'test5.png', { alpha: alpha, 'height': 300 }, next('test5.png', 'png', 279, 300, test6));
}

// Just like test6, but the file type has to be determined
// by inspection of the file

function test6() {
  process.stdout.write('test 6: ');
  convert('sample.mystery', 'test6.png', { alpha: alpha, 'height': 300 }, next('test6.png', 'png', 279, 300, null));
}

// Confirm that we like the results, then call the next test if any

function next(filename, type, width, height, nextTest) {
  return function(err) {
    if (err) {
      console.log("FAILED: " + err);
    }
    else
    {
      // Confirm file type, width and height are actually correct
      // before going on to the next test
      info(filename, {}, function(err, info) {
        if (err) {
          console.log("FAILED: " + err);
        } else if (info.type !== type) {
          console.log("FAILED: type is " + info.type + ", not " + type);
        } else if (info.width !== width) {
          console.log("FAILED: width is " + info.width + ", not " + width);
        } else if (info.height !== height) {
          console.log("FAILED: height is " + info.height + ", not " + height);
        } else {
          console.log("SUCCESS");
        }
        if (nextTest) {
          nextTest();
          return;
        } 
        // If any tests failed return a nonzero exit status
        // so that tools like Jenkins can spot it
        if (failures) {
          process.exit(1);
        }
      });
    }
  };
}
