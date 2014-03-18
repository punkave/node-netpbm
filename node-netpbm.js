var child_process = require('child_process');
var async = require('async');

var exec_queue = async.queue(function(command, callback) {
  child_process.exec(command, callback);
});

exec_queue.concurrency = 10;

// Callback's first argument is error if any. Second
// argument (if no error) is an object with width, height
// and type properties (gif, jpg, png or as redefined by
// options, see convert). The "options" argument is not
// mandatory and is usually unnecessary for info().

module.exports.info = function(fileIn, options, callback)
{
  if (typeof(options) === 'function') {
    callback = options;
    options = {};
  }
  if (!options) {
    options = {};
  }
  options.infoOnly = true;
  module.exports.convert(fileIn, null, options, callback);
}

module.exports.convert = function(fileIn, fileOut, options, callback)
{
  if (!options) {
    options = {};
  }
  // By default no more than 10 image processing pipelines are forked at any one time.
  // Additional requests wait patiently for their turn. If you are using the cluster
  // module you might want a lower limit as each node process gets its own pool
  // of image conversion processes
  if (options.limit) {
    exec_queue.concurrency = options.limit;
  }

  var typeMap = options.typeMap ? options.typeMap : {
    'jpeg': 'jpg'
  };

  var jpegQuality = options.jpegQuality ? options.jpegQuality : 85;

  var types = options.types ? options.types : [
    {
      name: 'jpg',
      importer: 'jpegtopnm ',
      exporter: 'pnmtojpeg -quality ' + jpegQuality + ' ',
      fileCommandReports: 'JPEG'
    },
    {
      name: 'png',
      // Preseve alpha channel in PNGs. Generally they are not used
      // in this context unless it's worth it. However most (all?)
      // Linux distributions don't include a new enough netpbm, so
      // default to not doing it
      importer: options.alpha ? 'pngtopam -byrow -alphapam ' : 'pngtopnm -mix ',
      exporter: 'pnmtopng ',
      sameTypeExporter: options.alpha ? 'pamrgbatopng ' : 'pnmtopng ',
      fileCommandReports: 'PNG'
    },
    {
      name: 'gif',
      importer: 'giftopnm ',
      exporter: 'ppmquant 256 | ppmtogif ',
      fileCommandReports: 'GIF'
    }
  ];

  if (options.extraTypes) {
    types = types.concat(options.extraTypes);
  }

  var typesByName = {};
  var i;
  for (i = 0; (i < types.length); i++) {
    typesByName[types[i].name] = types[i];
  }

  var typeOut;
  if (!options.infoOnly) {
    var typeOut = typeByExtension(fileOut);
    if (!typeOut) {
      callback('unsupported output file extension: ' + fileOut);
      return;
    }
  }

  var typeIn = typeByExtension(fileIn);
  if (typeIn) {
    preparePipeline();
  }
  else
  {
    // typeByHeader is async
    typeByHeader(fileIn, function(err, result) {
      if (err) {
        callback(err);
        return;
      }
      typeIn = result;
      preparePipeline();
    });
  }

  function preparePipeline() {

    // Coding convention: each time cmd is appended to, you are responsible for including a trailing space. Not the next guy.
    var cmd = typesByName[typeIn].importer + "< " + escapeshellarg(fileIn) + " ";

    if (options.infoOnly) {
      var result = {};
      // Due to the row-by-row processing of the netpbm utilities,
      // reading the width and height from the intermediate
      // .pam/.ppm file and then shutting down the pipeline is
      // fast, much faster than completely converting the whole thing
      // just to learn the dimensions would be. So this is not as
      // inefficient as it seems
      cmd += "| head -3 ";
      result.type = typeIn;
      exec_queue.push(cmd, function(err, stdout, stderr) {
        if (err) {
          callback(err + ': ' + stderr);
          return;
        }

        if (!stdout) {
          callback("No netpbm output");
          return;
        }

        var lines = stdout.split(/[\r\n]+/);
        // PAM files are different, sigh
        if (lines[1].match(/^WIDTH (\d+)/) && lines[2].match(/^HEIGHT (\d+)/))
        {
          var matches = lines[1].match(/^WIDTH (\d+)/);
          result.width = parseInt(matches[1]);
          var matches = lines[2].match(/^HEIGHT (\d+)/);
          result.height = parseInt(matches[1]);
        } else {
          var matches = lines[1].match(/^(\d+) (\d+)/);
          if (matches) {
            result.width = parseInt(matches[1]);
            result.height = parseInt(matches[2]);
          }
        }
        if (result.width && result.height) {
          callback(null, result);
          return;
        }
        callback("Unexpected netpbm output");
        return;
      });
      return;
    }

    if (options.alpha) {
      scaler = 'pamscale ';
      fitter = '-xyfit ';
    } else {
      scaler = 'pnmscale ';
      fitter = '-xysize ';
    }

    if (options.width && options.height) {
      cmd += "| " + scaler + fitter + options.width + ' ' + options.height + ' ';
    } else if (options.width) {
      cmd += "| " + scaler + "-width " + options.width + ' ';
    } else if (options.height) {
      cmd += "| " + scaler + "-height " + options.height + ' ';
    } else {
      // Size unchanged
    }

    // Watermark image is centered on the main image. Must be a .pam file
    // (with an alpha channel, for best results)
    if (options.watermark) {
      cmd += "| pamcomp -align=center -valign=middle " + escapeshellarg(options.watermark) + ' ';
    }

    var exporter = (typesByName[typeOut].sameTypeExporter && (typeIn === typeOut)) ? typesByName[typeOut].sameTypeExporter : typesByName[typeOut].exporter;
    cmd += "| " + exporter + "> " + escapeshellarg(fileOut);

    exec_queue.push(cmd, function(err, stdout, stderr) {
      if (err) {
        callback(err + ': ' + stderr);
      }
      else
      {
        // All is well - the desired result is in fileOut
        callback(null);
      }
    });
  }

  function typeByExtension(filename) {
    var result = filename.match(/\.(\w+)$/);
    if (result) {
      var extension = result[1];
      extension = extension.toLowerCase();
      if (typeMap[extension]) {
        extension = typeMap[extension];
      }
      if (typesByName[extension]) {
        return extension;
      }
    }
    return false;
  }

  function typeByHeader(filename, callback) {
    var cmd = 'file ' + escapeshellarg(filename);
    exec_queue.push(cmd, function(err, stdout, stderr) {
      if (err) {
        callback(err + ': ' + stderr);
        return;
      }
      var i;
      for (i = 0; (i < types.length); i++) {
        var type = types[i];
        if (stdout.indexOf(type.fileCommandReports) !== -1) {

          callback(null, type.name);
          return;
        }
      }
      callback('Unknown');
    });
  }

  // http://phpjs.org/functions/escapeshellarg:866
  function escapeshellarg(arg) {
    // Quote and escape an argument for use in a shell command
    //
    // version: 1109.2015
    // discuss at: http://phpjs.org/functions/escapeshellarg
    // +   original by: Felix Geisendoerfer (http://www.debuggable.com/felix)
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // *     example 1: escapeshellarg("kevin's birthday");
    // *     returns 1: "'kevin\'s birthday'"
    var ret = '';

    ret = arg.replace(/[^\\]'/g, function (m, i, s) {
        return m.slice(0, 1) + '\\\'';
    });

    return "'" + ret + "'";
  }
};
